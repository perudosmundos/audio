import { supabase } from '@/lib/supabaseClient';

class ConflictChecker {
  /**
   * Проверяет конфликты для файла в очереди
   * @param {Object} fileItem - Элемент файла из очереди
   * @returns {Promise<Object>} Информация о конфликтах
   */
  async checkFileConflicts(fileItem) {
    const { episodeSlug, lang, r2ObjectKey } = fileItem;
    
    const conflicts = {
      hasFileConflict: false,
      hasDBConflict: false,
      fileConflict: null,
      dbConflict: null,
      overwriteOptions: {
        overwriteServerFile: false,
        overwriteEpisodeInfo: false,
        overwriteTranscript: false,
        overwriteQuestions: false
      }
    };

    try {
      // 1. Проверяем конфликт с файловым хранилищем
      if (r2ObjectKey) {
        const fileInfo = await this.checkFileExistsInStorage(r2ObjectKey);
        if (fileInfo.exists) {
          conflicts.hasFileConflict = true;
          conflicts.fileConflict = {
            type: 'file',
            message: `Файл уже существует в ${fileInfo.source === 'database' ? 'БД' : 'Hostinger'}`,
            r2ObjectKey: r2ObjectKey,
            url: fileInfo.url,
            source: fileInfo.source,
            size: fileInfo.size
          };
        }
      }

      // 2. Проверяем конфликты с базой данных
      const dbConflicts = await this.checkDBConflicts(episodeSlug, lang);
      if (dbConflicts.hasConflicts) {
        conflicts.hasDBConflict = true;
        conflicts.dbConflict = dbConflicts;
      }

      return conflicts;
    } catch (error) {
      console.error('Error checking conflicts:', error);
      throw error;
    }
  }

  /**
   * Проверяет существование файла в хранилище
   * @param {string} r2ObjectKey - Ключ файла в R2
   * @returns {Promise<Object>} { exists: boolean, url: string, size: number }
   */
  async checkFileExistsInStorage(r2ObjectKey) {
    try {
      // Сначала проверяем через существующий эпизод в БД
      const { data: episodeData, error: episodeError } = await supabase
        .from('episodes')
        .select('r2_object_key, audio_url')
        .eq('r2_object_key', r2ObjectKey)
        .maybeSingle();

      if (episodeError) {
        console.warn('Error checking file existence in DB:', episodeError);
      }

      if (episodeData) {
        return {
          exists: true,
          url: episodeData.audio_url,
          source: 'database',
          size: null // Размер не хранится в БД
        };
      }

      // Если не найден в БД, проверяем напрямую в R2/Hostinger
      try {
        const r2Service = await import('@/lib/r2Service');
        const fileInfo = await r2Service.default.checkFileExists(r2ObjectKey);
        
        if (fileInfo.exists) {
          return {
            exists: true,
            url: fileInfo.url,
            source: 'hostinger',
            size: fileInfo.size
          };
        }
      } catch (r2Error) {
        console.warn('Error checking file in Hostinger:', r2Error);
      }

      return {
        exists: false,
        url: null,
        source: 'none',
        size: null
      };
    } catch (error) {
      console.error('Error checking file in storage:', error);
      return {
        exists: false,
        url: null,
        source: 'error',
        size: null
      };
    }
  }

  /**
   * Проверяет конфликты с базой данных
   * @param {string} episodeSlug - Slug эпизода
   * @param {string} lang - Язык
   * @returns {Promise<Object>}
   */
  async checkDBConflicts(episodeSlug, lang) {
    const conflicts = {
      hasConflicts: false,
      episode: null,
      transcript: null,
      questions: null
    };

    try {
      // Проверяем эпизод
      const { data: episode, error: episodeError } = await supabase
        .from('episodes')
        .select('*')
        .eq('slug', episodeSlug)
        .eq('lang', lang)
        .maybeSingle();

      if (episodeError) {
        console.warn('Error checking episode conflict:', episodeError);
        return conflicts;
      }

      if (episode) {
        conflicts.hasConflicts = true;
        conflicts.episode = {
          exists: true,
          title: episode.title,
          date: episode.date,
          audio_url: episode.audio_url
        };

        // Проверяем транскрипт
        const { data: transcript, error: transcriptError } = await supabase
          .from('transcripts')
          .select('status, updated_at')
          .eq('episode_slug', episodeSlug)
          .eq('lang', lang)
          .maybeSingle();

        if (!transcriptError && transcript) {
          conflicts.transcript = {
            exists: true,
            status: transcript.status,
            updated_at: transcript.updated_at
          };
        }

        // Проверяем вопросы
        const { data: questions, error: questionsError } = await supabase
          .from('questions')
          .select('id')
          .eq('episode_slug', episodeSlug)
          .eq('lang', lang);

        if (!questionsError && questions && questions.length > 0) {
          conflicts.questions = {
            exists: true,
            count: questions.length
          };
        }
      }

      return conflicts;
    } catch (error) {
      console.error('Error checking DB conflicts:', error);
      return conflicts;
    }
  }

  /**
   * Генерирует сообщение о конфликтах для пользователя
   * @param {Object} conflicts - Информация о конфликтах
   * @returns {string}
   */
  generateConflictMessage(conflicts) {
    const messages = [];

    if (conflicts.hasFileConflict) {
      messages.push('📁 Файл уже существует в хранилище');
    }

    if (conflicts.hasDBConflict) {
      const db = conflicts.dbConflict;
      if (db.episode?.exists) {
        messages.push('🗃️ Эпизод уже существует в БД');
      }
      if (db.transcript?.exists) {
        messages.push('📝 Транскрипт уже существует');
      }
      if (db.questions?.exists) {
        messages.push(`❓ Вопросы уже существуют (${db.questions.count})`);
      }
    }

    return messages.length > 0 ? messages.join('\n') : null;
  }

  /**
   * Определяет рекомендуемые настройки замены на основе конфликтов
   * @param {Object} conflicts - Информация о конфликтах
   * @returns {Object}
   */
  getRecommendedOverwriteSettings(conflicts) {
    const settings = {
      overwriteServerFile: false,
      overwriteEpisodeInfo: false,
      overwriteTranscript: false,
      overwriteQuestions: false
    };

    if (conflicts.hasFileConflict) {
      settings.overwriteServerFile = true;
    }

    if (conflicts.hasDBConflict) {
      const db = conflicts.dbConflict;
      if (db.episode?.exists) {
        settings.overwriteEpisodeInfo = true;
      }
      if (db.transcript?.exists) {
        settings.overwriteTranscript = true;
      }
      if (db.questions?.exists) {
        settings.overwriteQuestions = true;
      }
    }

    return settings;
  }
}

export default new ConflictChecker();
