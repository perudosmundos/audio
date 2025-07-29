const express = require('express');
const cors = require('cors');
const path = require('path');

// Полифилл для fetch в Node.js
if (!global.fetch) {
  global.fetch = require('node-fetch');
}

const app = express();
const PORT = 3000;

// CORS middleware
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'Accept-Ranges', 'Content-Range', 'If-Range']
}));

// Middleware для парсинга JSON
app.use(express.json());

// API роуты
app.use('/api', async (req, res, next) => {
  try {
    // Импортируем API роуты динамически
    const apiPath = req.path;
    
    if (apiPath.startsWith('/direct-audio/')) {
      // Обработка прямого доступа к аудио
      const filePath = apiPath.replace('/direct-audio/', '');
      const targetUrl = `https://audio.alexbrin102.workers.dev/${filePath}`;
      
      console.log('Dev server: Direct audio request for', targetUrl);
      
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'audio/*,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive'
      };
      
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }
      if (req.headers['if-range']) {
        headers['If-Range'] = req.headers['if-range'];
      }
      
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        signal: AbortSignal.timeout(15000) // Используем AbortSignal вместо timeout
      });

      if (!response.ok && response.status !== 206) {
        return res.status(response.status).json({ 
          error: `Failed to fetch audio: ${response.statusText}`,
          details: 'Direct access failed'
        });
      }

      // Устанавливаем CORS заголовки
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range, If-Range');
      
      // Передаем заголовки
      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      
      const acceptRanges = response.headers.get('accept-ranges');
      if (acceptRanges) {
        res.setHeader('Accept-Ranges', acceptRanges);
      }
      
      const contentRange = response.headers.get('content-range');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      
      res.status(response.status);
      
      // Стримим данные
      const stream = response.body;
      if (stream) {
        stream.pipe(res);
      } else {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);
      }
      
    } else if (apiPath.startsWith('/audio-proxy/')) {
      // Обработка прокси аудио
      const filePath = apiPath.replace('/audio-proxy/', '');
      const targetUrl = `https://audio.alexbrin102.workers.dev/${filePath}`;
      
      console.log('Dev server: Proxy audio request for', targetUrl);
      
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      };
      
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }
      if (req.headers['if-range']) {
        headers['If-Range'] = req.headers['if-range'];
      }
      
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        signal: AbortSignal.timeout(15000) // Используем AbortSignal вместо timeout
      });

      if (!response.ok && response.status !== 206) {
        return res.status(response.status).json({ 
          error: 'Failed to fetch audio from all proxy sources',
          details: 'All proxy attempts failed'
        });
      }

      // Устанавливаем CORS заголовки
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range, If-Range');
      
      // Передаем заголовки
      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      
      const acceptRanges = response.headers.get('accept-ranges');
      if (acceptRanges) {
        res.setHeader('Accept-Ranges', acceptRanges);
      }
      
      const contentRange = response.headers.get('content-range');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      
      res.status(response.status);
      
      // Стримим данные
      const stream = response.body;
      if (stream) {
        stream.pipe(res);
      } else {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);
      }
      
    } else if (apiPath === '/test-specific') {
      // Обработка тестового API
      const testUrl = 'https://audio.alexbrin102.workers.dev/2025-02-19_RU.mp3';
      const fileName = '2025-02-19_RU.mp3';
      
      console.log('Dev server: Test specific request for', testUrl);
      
      const results = {
        timestamp: new Date().toISOString(),
        originalUrl: testUrl,
        tests: {}
      };

      try {
        // Тест 1: Прямой доступ к оригинальной ссылке
        try {
          const directResponse = await fetch(testUrl, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(10000)
          });
          
          results.tests.directOriginal = {
            available: directResponse.ok || directResponse.status === 206,
            status: directResponse.status,
            statusText: directResponse.statusText,
            headers: Object.fromEntries(directResponse.headers.entries())
          };
        } catch (error) {
          results.tests.directOriginal = {
            available: false,
            error: error.message
          };
        }

        // Тест 2: Прямой доступ через наш API
        try {
          const directApiResponse = await fetch(`http://localhost:${PORT}/api/direct-audio/${fileName}`, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(10000)
          });
          
          results.tests.directAPI = {
            available: directApiResponse.ok || directApiResponse.status === 206,
            status: directApiResponse.status,
            statusText: directApiResponse.statusText,
            headers: Object.fromEntries(directApiResponse.headers.entries())
          };
        } catch (error) {
          results.tests.directAPI = {
            available: false,
            error: error.message
          };
        }

        // Тест 3: Прокси через наш API
        try {
          const proxyApiResponse = await fetch(`http://localhost:${PORT}/api/audio-proxy/${fileName}`, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(10000)
          });
          
          results.tests.proxyAPI = {
            available: proxyApiResponse.ok || proxyApiResponse.status === 206,
            status: proxyApiResponse.status,
            statusText: proxyApiResponse.statusText,
            headers: Object.fromEntries(proxyApiResponse.headers.entries())
          };
        } catch (error) {
          results.tests.proxyAPI = {
            available: false,
            error: error.message
          };
        }

        // Определяем лучший рабочий метод
        let bestMethod = null;
        if (results.tests.directOriginal.available) {
          bestMethod = 'directOriginal';
        } else if (results.tests.directAPI.available) {
          bestMethod = 'directAPI';
        } else if (results.tests.proxyAPI.available) {
          bestMethod = 'proxyAPI';
        }

        results.bestMethod = bestMethod;
        results.summary = {
          hasWorkingMethod: !!bestMethod,
          totalTests: Object.keys(results.tests).length,
          workingTests: Object.values(results.tests).filter(test => test.available).length
        };

        res.status(200).json(results);
        
      } catch (error) {
        res.status(500).json({
          error: 'Internal server error',
          details: error.message,
          timestamp: new Date().toISOString()
        });
      }
      
    } else {
      // Для других API роутов
      res.status(404).json({ error: 'API route not found' });
    }
  } catch (error) {
    console.error('Dev server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Bunny.net audio proxy route
app.get('/api/bunny-audio/*', async (req, res) => {
  const filePath = req.params[0];
  
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }

  // Direct access to Bunny.net CDN
  const targetUrl = `https://dosmundos-audio.b-cdn.net/${filePath}`;
  
  console.log('Bunny audio: Fetching from', targetUrl);
  
  try {
    // Get headers for Range requests
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'audio/*,*/*;q=0.9',
      'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive'
    };
    
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
      console.log('Bunny audio: Range header', req.headers.range);
    }
    if (req.headers['if-range']) {
      headers['If-Range'] = req.headers['if-range'];
    }
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(20000)
    });

    console.log('Bunny audio: Response status', response.status);

    if (!response.ok && response.status !== 206) {
      console.error('Bunny audio: Failed to fetch', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `Failed to fetch audio: ${response.statusText}`,
        details: 'Bunny.net CDN access failed'
      });
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range, If-Range');
    
    // Pass headers from Bunny.net CDN
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) {
      res.setHeader('Accept-Ranges', acceptRanges);
    }
    
    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }
    
    // Pass status code
    res.status(response.status);
    
    // Stream data
    console.log('Bunny audio: Streaming audio data');
    
    const stream = response.body;
    if (stream) {
      stream.pipe(res);
    } else {
      // Fallback for cases when stream is not available
      console.log('Bunny audio: Stream not available, using buffer fallback');
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log('Bunny audio: Sending buffer of size', buffer.length);
      res.send(buffer);
    }
    
  } catch (error) {
    console.error('Bunny audio error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      suggestion: 'Try accessing Bunny.net CDN directly'
    });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Development API server running on http://localhost:${PORT}`);
  console.log(`📡 API routes available:`);
  console.log(`   - /api/direct-audio/*`);
  console.log(`   - /api/audio-proxy/*`);
  console.log(`   - /api/test-specific`);
});

module.exports = app; 