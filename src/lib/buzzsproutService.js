// Сервис для работы с Buzzsprout API
class BuzzsproutService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.buzzsprout.com/api';
  }

  // Загрузка эпизода
  async uploadEpisode(audioFile, metadata) {
    try {
      console.log('Buzzsprout: Uploading episode', metadata.title);
      
      // Сначала загружаем аудиофайл
      const formData = new FormData();
      formData.append('audio_file', audioFile);
      
      const uploadResponse = await fetch(`${this.baseUrl}/audio_files`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`Buzzsprout upload error: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      const audioFileData = await uploadResponse.json();
      console.log('Buzzsprout: Audio file uploaded', audioFileData);

      // Затем создаем эпизод
      const episodeData = {
        title: metadata.title,
        description: metadata.description || '',
        audio_file_id: audioFileData.id,
        published_at: metadata.publishDate || new Date().toISOString(),
        private: false
      };

      const episodeResponse = await fetch(`${this.baseUrl}/episodes`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(episodeData)
      });

      if (!episodeResponse.ok) {
        throw new Error(`Buzzsprout episode creation error: ${episodeResponse.status} ${episodeResponse.statusText}`);
      }

      const result = await episodeResponse.json();
      console.log('Buzzsprout: Episode created successfully', result);
      
      return {
        success: true,
        episodeId: result.id,
        audioUrl: result.audio_url,
        rssUrl: result.podcast.rss_url
      };
    } catch (error) {
      console.error('Buzzsprout: Upload failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Получение списка эпизодов
  async getEpisodes(limit = 50, offset = 0) {
    try {
      console.log('Buzzsprout: Fetching episodes');
      
      const response = await fetch(`${this.baseUrl}/episodes?limit=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Buzzsprout API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Buzzsprout: Episodes fetched successfully', result);
      
      return {
        success: true,
        episodes: result || [],
        total: result.length || 0
      };
    } catch (error) {
      console.error('Buzzsprout: Fetch failed', error);
      return {
        success: false,
        error: error.message,
        episodes: []
      };
    }
  }

  // Получение информации об эпизоде
  async getEpisode(episodeId) {
    try {
      console.log('Buzzsprout: Fetching episode', episodeId);
      
      const response = await fetch(`${this.baseUrl}/episodes/${episodeId}`, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Buzzsprout API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Buzzsprout: Episode fetched successfully', result);
      
      return {
        success: true,
        episode: result
      };
    } catch (error) {
      console.error('Buzzsprout: Fetch failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Обновление эпизода
  async updateEpisode(episodeId, metadata) {
    try {
      console.log('Buzzsprout: Updating episode', episodeId);
      
      const response = await fetch(`${this.baseUrl}/episodes/${episodeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) {
        throw new Error(`Buzzsprout API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Buzzsprout: Episode updated successfully', result);
      
      return {
        success: true,
        episode: result
      };
    } catch (error) {
      console.error('Buzzsprout: Update failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Удаление эпизода
  async deleteEpisode(episodeId) {
    try {
      console.log('Buzzsprout: Deleting episode', episodeId);
      
      const response = await fetch(`${this.baseUrl}/episodes/${episodeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Buzzsprout API error: ${response.status} ${response.statusText}`);
      }

      console.log('Buzzsprout: Episode deleted successfully');
      
      return {
        success: true
      };
    } catch (error) {
      console.error('Buzzsprout: Delete failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Получение статистики
  async getAnalytics(episodeId, dateRange = '30d') {
    try {
      console.log('Buzzsprout: Fetching analytics for episode', episodeId);
      
      const response = await fetch(`${this.baseUrl}/episodes/${episodeId}/analytics?range=${dateRange}`, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Buzzsprout API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Buzzsprout: Analytics fetched successfully', result);
      
      return {
        success: true,
        analytics: result
      };
    } catch (error) {
      console.error('Buzzsprout: Analytics fetch failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Получение информации о подкасте
  async getPodcastInfo() {
    try {
      console.log('Buzzsprout: Fetching podcast info');
      
      const response = await fetch(`${this.baseUrl}/podcasts`, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Buzzsprout API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Buzzsprout: Podcast info fetched successfully', result);
      
      return {
        success: true,
        podcast: result[0] // Обычно у пользователя один подкаст
      };
    } catch (error) {
      console.error('Buzzsprout: Podcast info fetch failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Создание экземпляра сервиса
const buzzsproutService = new BuzzsproutService(process.env.BUZZSPROUT_API_KEY || 'your-api-key-here');

export default buzzsproutService; 