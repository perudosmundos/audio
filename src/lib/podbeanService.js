// Сервис для работы с Podbean API
class PodbeanService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.podbean.com/v1';
  }

  // Загрузка эпизода
  async uploadEpisode(audioFile, metadata) {
    try {
      console.log('Podbean: Uploading episode', metadata.title);
      
      // Сначала загружаем аудиофайл
      const formData = new FormData();
      formData.append('file', audioFile);
      
      const uploadResponse = await fetch(`${this.baseUrl}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`Podbean upload error: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();
      console.log('Podbean: Audio file uploaded', uploadData);

      // Затем создаем эпизод
      const episodeData = {
        title: metadata.title,
        description: metadata.description || '',
        file_id: uploadData.file_id,
        published_at: metadata.publishDate || new Date().toISOString(),
        status: 'published'
      };

      const episodeResponse = await fetch(`${this.baseUrl}/episodes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(episodeData)
      });

      if (!episodeResponse.ok) {
        throw new Error(`Podbean episode creation error: ${episodeResponse.status} ${episodeResponse.statusText}`);
      }

      const result = await episodeResponse.json();
      console.log('Podbean: Episode created successfully', result);
      
      return {
        success: true,
        episodeId: result.id,
        audioUrl: result.audio_url,
        rssUrl: result.podcast.rss_url
      };
    } catch (error) {
      console.error('Podbean: Upload failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Получение списка эпизодов
  async getEpisodes(limit = 50, offset = 0) {
    try {
      console.log('Podbean: Fetching episodes');
      
      const response = await fetch(`${this.baseUrl}/episodes?limit=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Podbean API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Podbean: Episodes fetched successfully', result);
      
      return {
        success: true,
        episodes: result.episodes || [],
        total: result.total || 0
      };
    } catch (error) {
      console.error('Podbean: Fetch failed', error);
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
      console.log('Podbean: Fetching episode', episodeId);
      
      const response = await fetch(`${this.baseUrl}/episodes/${episodeId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Podbean API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Podbean: Episode fetched successfully', result);
      
      return {
        success: true,
        episode: result
      };
    } catch (error) {
      console.error('Podbean: Fetch failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Обновление эпизода
  async updateEpisode(episodeId, metadata) {
    try {
      console.log('Podbean: Updating episode', episodeId);
      
      const response = await fetch(`${this.baseUrl}/episodes/${episodeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) {
        throw new Error(`Podbean API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Podbean: Episode updated successfully', result);
      
      return {
        success: true,
        episode: result
      };
    } catch (error) {
      console.error('Podbean: Update failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Удаление эпизода
  async deleteEpisode(episodeId) {
    try {
      console.log('Podbean: Deleting episode', episodeId);
      
      const response = await fetch(`${this.baseUrl}/episodes/${episodeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Podbean API error: ${response.status} ${response.statusText}`);
      }

      console.log('Podbean: Episode deleted successfully');
      
      return {
        success: true
      };
    } catch (error) {
      console.error('Podbean: Delete failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Получение статистики
  async getAnalytics(episodeId, dateRange = '30d') {
    try {
      console.log('Podbean: Fetching analytics for episode', episodeId);
      
      const response = await fetch(`${this.baseUrl}/episodes/${episodeId}/analytics?range=${dateRange}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Podbean API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Podbean: Analytics fetched successfully', result);
      
      return {
        success: true,
        analytics: result
      };
    } catch (error) {
      console.error('Podbean: Analytics fetch failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Получение информации о подкасте
  async getPodcastInfo() {
    try {
      console.log('Podbean: Fetching podcast info');
      
      const response = await fetch(`${this.baseUrl}/podcasts`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Podbean API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Podbean: Podcast info fetched successfully', result);
      
      return {
        success: true,
        podcast: result.podcasts[0] // Обычно у пользователя один подкаст
      };
    } catch (error) {
      console.error('Podbean: Podcast info fetch failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Получение информации об использовании хранилища
  async getStorageUsage() {
    try {
      console.log('Podbean: Fetching storage usage');
      
      const response = await fetch(`${this.baseUrl}/account/usage`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Podbean API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Podbean: Storage usage fetched successfully', result);
      
      return {
        success: true,
        usage: result
      };
    } catch (error) {
      console.error('Podbean: Storage usage fetch failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Создание экземпляра сервиса
const podbeanService = new PodbeanService(process.env.PODBEAN_API_KEY || 'your-api-key-here');

export default podbeanService; 