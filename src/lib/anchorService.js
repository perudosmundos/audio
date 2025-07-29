// Сервис для работы с Anchor.fm API
class AnchorService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.anchor.fm/v1';
  }

  // Загрузка эпизода
  async uploadEpisode(audioFile, metadata) {
    try {
      console.log('Anchor: Uploading episode', metadata.title);
      
      const formData = new FormData();
      formData.append('audio_file', audioFile);
      formData.append('title', metadata.title);
      formData.append('description', metadata.description);
      formData.append('publish_date', metadata.publishDate || new Date().toISOString());
      
      if (metadata.duration) {
        formData.append('duration', metadata.duration);
      }
      
      if (metadata.language) {
        formData.append('language', metadata.language);
      }

      const response = await fetch(`${this.baseUrl}/episodes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Anchor API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Anchor: Episode uploaded successfully', result);
      
      return {
        success: true,
        episodeId: result.id,
        audioUrl: result.audio_url,
        rssUrl: result.rss_url
      };
    } catch (error) {
      console.error('Anchor: Upload failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Получение списка эпизодов
  async getEpisodes(limit = 50, offset = 0) {
    try {
      console.log('Anchor: Fetching episodes');
      
      const response = await fetch(`${this.baseUrl}/episodes?limit=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Anchor API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Anchor: Episodes fetched successfully', result);
      
      return {
        success: true,
        episodes: result.episodes || [],
        total: result.total || 0
      };
    } catch (error) {
      console.error('Anchor: Fetch failed', error);
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
      console.log('Anchor: Fetching episode', episodeId);
      
      const response = await fetch(`${this.baseUrl}/episodes/${episodeId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Anchor API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Anchor: Episode fetched successfully', result);
      
      return {
        success: true,
        episode: result
      };
    } catch (error) {
      console.error('Anchor: Fetch failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Обновление эпизода
  async updateEpisode(episodeId, metadata) {
    try {
      console.log('Anchor: Updating episode', episodeId);
      
      const response = await fetch(`${this.baseUrl}/episodes/${episodeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) {
        throw new Error(`Anchor API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Anchor: Episode updated successfully', result);
      
      return {
        success: true,
        episode: result
      };
    } catch (error) {
      console.error('Anchor: Update failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Удаление эпизода
  async deleteEpisode(episodeId) {
    try {
      console.log('Anchor: Deleting episode', episodeId);
      
      const response = await fetch(`${this.baseUrl}/episodes/${episodeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Anchor API error: ${response.status} ${response.statusText}`);
      }

      console.log('Anchor: Episode deleted successfully');
      
      return {
        success: true
      };
    } catch (error) {
      console.error('Anchor: Delete failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Получение статистики
  async getAnalytics(episodeId, dateRange = '30d') {
    try {
      console.log('Anchor: Fetching analytics for episode', episodeId);
      
      const response = await fetch(`${this.baseUrl}/episodes/${episodeId}/analytics?range=${dateRange}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Anchor API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Anchor: Analytics fetched successfully', result);
      
      return {
        success: true,
        analytics: result
      };
    } catch (error) {
      console.error('Anchor: Analytics fetch failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Создание экземпляра сервиса
const anchorService = new AnchorService(process.env.ANCHOR_API_KEY || 'your-api-key-here');

export default anchorService; 