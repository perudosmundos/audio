import { supabase } from '@/lib/supabaseClient';
import logger from '@/lib/logger';

const getApiBase = () => {
  // Always use relative paths for /api routes
  // In dev: Vite proxy handles /api → localhost:5173/api
  // In prod: Vercel handles /api endpoints
  return '';
};

const migrationService = {
  /**
   * Get list of episodes that need migration (storage_provider is null or 'r2')
   */
  getEpisodesToMigrate: async () => {
    try {
      const { data, error } = await supabase
        .from('episodes')
        .select('slug, title, audio_url, r2_object_key, r2_bucket_name, storage_provider')
        .or('storage_provider.is.null,storage_provider.eq.r2')
        .order('date', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        episodes: data || [],
        count: (data || []).length,
      };
    } catch (error) {
      logger.error('[Migration] Error fetching episodes:', error);
      return { success: false, error: error.message, episodes: [], count: 0 };
    }
  },

  /**
   * Migrate a single episode from R2 to Hostinger
   */
  migrateEpisode: async (episode, onProgress) => {
    const { slug, audio_url, r2_object_key, r2_bucket_name } = episode;
    
    if (!audio_url || !r2_object_key) {
      logger.warn(`[Migration] Episode ${slug}: No audio URL or R2 key`);
      return { success: false, episode: slug, reason: 'No audio URL' };
    }

    try {
      logger.info(`[Migration] Starting migration for episode: ${slug}`);
      
      if (onProgress) onProgress({ status: 'updating', episode: slug, message: 'Обновление ссылки...' });

      // Простое решение: файл уже есть на Hostinger, просто меняем ссылку
      const hostingerUrl = `https://dosmundos.pe/wp-content/uploads/Audio/${r2_object_key}`;

      // Update database
      const { error: updateError } = await supabase
        .from('episodes')
        .update({
          audio_url: hostingerUrl,
          storage_provider: 'hostinger',
          hostinger_file_key: r2_object_key,
          updated_at: new Date().toISOString(),
        })
        .eq('slug', slug);

      if (updateError) throw updateError;

      logger.info(`[Migration] Successfully migrated episode: ${slug}`);
      return {
        success: true,
        episode: slug,
        oldUrl: audio_url,
        newUrl: hostingerUrl,
      };
    } catch (error) {
      logger.error(`[Migration] Error migrating ${slug}:`, error);
      
      // Attempt rollback - restore old URL
      try {
        await supabase
          .from('episodes')
          .update({ storage_provider: 'r2', updated_at: new Date().toISOString() })
          .eq('slug', slug);
        logger.info(`[Migration] Rollback completed for ${slug}`);
      } catch (rollbackError) {
        logger.error(`[Migration] Rollback failed for ${slug}:`, rollbackError);
      }

      return {
        success: false,
        episode: slug,
        error: error.message,
      };
    }
  },

  /**
   * Migrate multiple episodes
   */
  migrateMultipleEpisodes: async (episodes, currentLanguage, onProgress) => {
    logger.info(`[Migration] Starting batch migration for ${episodes.length} episodes`);

    const results = {
      total: episodes.length,
      succeeded: 0,
      failed: 0,
      details: [],
      startTime: new Date(),
      endTime: null,
    };

    for (let i = 0; i < episodes.length; i++) {
      const episode = episodes[i];
      
      if (onProgress) {
        onProgress({
          total: episodes.length,
          current: i + 1,
          percentage: Math.floor(((i + 1) / episodes.length) * 100),
          status: 'migrating',
          episode: episode.slug,
        });
      }

      const result = await migrationService.migrateEpisode(episode, onProgress);
      results.details.push(result);

      if (result.success) {
        results.succeeded++;
      } else {
        results.failed++;
      }

      // Small delay between requests to avoid overwhelming the server
      if (i < episodes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    results.endTime = new Date();
    results.duration = Math.round((results.endTime - results.startTime) / 1000);

    logger.info(`[Migration] Batch migration completed: ${results.succeeded} succeeded, ${results.failed} failed`);

    return results;
  },

  /**
   * Get migration status - show progress of migration
   */
  getMigrationStatus: async () => {
    try {
      const { data, error } = await supabase
        .from('episodes')
        .select('storage_provider');

      if (error) throw error;

      const stats = {
        total: 0,
        r2: 0,
        hostinger: 0,
        unknown: 0,
      };

      (data || []).forEach(item => {
        stats.total += 1;
        
        if (item.storage_provider === 'hostinger') {
          stats.hostinger += 1;
        } else if (item.storage_provider === 'r2' || item.storage_provider === null) {
          stats.r2 += 1;
        } else {
          stats.unknown += 1;
        }
      });

      return {
        success: true,
        stats,
        percentage: stats.total > 0 ? Math.round((stats.hostinger / stats.total) * 100) : 0,
      };
    } catch (error) {
      logger.error('[Migration] Error getting status:', error);
      return { success: false, error: error.message };
    }
  },
};

export default migrationService;
