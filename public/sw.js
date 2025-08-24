const CACHE_NAME = 'podcast-app-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';
const AUDIO_CACHE = 'audio-v1';

// Ресурсы для кеширования при установке
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/vite.svg'
];

// Максимальный размер кеша аудио (100MB)
const MAX_AUDIO_CACHE_SIZE = 100 * 1024 * 1024;

self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      }),
      self.skipWaiting()
    ])
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    Promise.all([
      // Очистка старых кешей
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== AUDIO_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Обработка аудиофайлов
  if (isAudioRequest(request)) {
    event.respondWith(handleAudioRequest(request));
    return;
  }

  // Обработка API запросов к Supabase
  if (isSupabaseRequest(request)) {
    event.respondWith(handleSupabaseRequest(request));
    return;
  }

  // Обработка статических ресурсов
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Обработка навигационных запросов
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Стратегия "сеть сначала" для остального
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

// Проверка, является ли запрос аудиофайлом
function isAudioRequest(request) {
  const url = new URL(request.url);
  return request.destination === 'audio' || 
         url.pathname.includes('.mp3') || 
         url.pathname.includes('.wav') || 
         url.pathname.includes('.m4a') ||
         url.searchParams.has('audio') ||
         request.headers.get('accept')?.includes('audio/');
}

// Проверка, является ли запрос к Supabase
function isSupabaseRequest(request) {
  return request.url.includes('supabase.co');
}

// Проверка, является ли запрос статическим ресурсом
function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.includes('/assets/') || 
         url.pathname.endsWith('.js') || 
         url.pathname.endsWith('.css') || 
         url.pathname.endsWith('.svg') ||
         url.pathname.endsWith('.png') ||
         url.pathname.endsWith('.jpg') ||
         url.pathname.endsWith('.jpeg');
}

// Обработка аудио запросов с кешированием
async function handleAudioRequest(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    console.log('[SW] Serving audio from cache:', request.url);
    return cachedResponse;
  }

  try {
    console.log('[SW] Fetching audio from network:', request.url);
    const response = await fetch(request);
    
    if (response.ok && response.status === 200) {
      // Проверяем размер кеша перед добавлением
      await manageCacheSize(cache, response.clone());
      await cache.put(request, response.clone());
      console.log('[SW] Audio cached:', request.url);
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Audio fetch failed, checking cache:', error);
    return cachedResponse || new Response('Audio not available offline', { status: 503 });
  }
}

// Обработка запросов к Supabase с офлайн поддержкой
async function handleSupabaseRequest(request) {
  const url = new URL(request.url);
  
  try {
    const response = await fetch(request);
    
    // Кешируем только GET запросы с успешными ответами
    if (request.method === 'GET' && response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Supabase request failed, trying cache:', error);
    
    if (request.method === 'GET') {
      const cache = await caches.open(DYNAMIC_CACHE);
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        console.log('[SW] Serving Supabase data from cache:', request.url);
        return cachedResponse;
      }
    }
    
    // Для POST/PUT/DELETE запросов в офлайне сохраняем в IndexedDB
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      await queueOfflineRequest(request);
      return new Response(JSON.stringify({ 
        success: true, 
        offline: true, 
        message: 'Request queued for sync when online' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Data not available offline', { status: 503 });
  }
}

// Обработка статических ресурсов
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return cachedResponse || new Response('Resource not available offline', { status: 503 });
  }
}

// Обработка навигационных запросов
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    const cache = await caches.open(STATIC_CACHE);
    const cachedIndex = await cache.match('/index.html');
    return cachedIndex || new Response('App not available offline', { status: 503 });
  }
}

// Управление размером кеша
async function manageCacheSize(cache, response) {
  const contentLength = response.headers.get('content-length');
  if (!contentLength) return;

  const size = parseInt(contentLength);
  let totalSize = size;

  // Подсчитываем текущий размер кеша
  const keys = await cache.keys();
  for (const key of keys) {
    const cachedResponse = await cache.match(key);
    if (cachedResponse) {
      const cachedSize = cachedResponse.headers.get('content-length');
      if (cachedSize) {
        totalSize += parseInt(cachedSize);
      }
    }
  }

  // Если превышаем лимит, удаляем старые записи
  if (totalSize > MAX_AUDIO_CACHE_SIZE) {
    console.log('[SW] Cache size exceeded, cleaning up...');
    const keysToDelete = keys.slice(0, Math.ceil(keys.length * 0.3)); // Удаляем 30% старых записей
    for (const key of keysToDelete) {
      await cache.delete(key);
    }
  }
}

// Сохранение офлайн запросов в IndexedDB
async function queueOfflineRequest(request) {
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('OfflineRequests', 1);
    
    dbRequest.onerror = () => reject(dbRequest.error);
    
    dbRequest.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('requests')) {
        db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
      }
    };
    
    dbRequest.onsuccess = async (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['requests'], 'readwrite');
      const store = transaction.objectStore('requests');
      
      const requestData = {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body: request.method !== 'GET' ? await request.text() : null,
        timestamp: Date.now()
      };
      
      store.add(requestData);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

// Обработка сообщений от основного потока
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'CACHE_AUDIO':
      cacheAudioFile(data.url);
      break;
    case 'CLEAR_CACHE':
      clearAllCaches();
      break;
    case 'SYNC_OFFLINE_REQUESTS':
      syncOfflineRequests();
      break;
  }
});

// Кеширование аудиофайла по запросу
async function cacheAudioFile(url) {
  try {
    const cache = await caches.open(AUDIO_CACHE);
    const response = await fetch(url);
    if (response.ok) {
      await manageCacheSize(cache, response.clone());
      await cache.put(url, response);
      console.log('[SW] Audio file cached:', url);
    }
  } catch (error) {
    console.error('[SW] Failed to cache audio file:', error);
  }
}

// Очистка всех кешей
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('[SW] All caches cleared');
}

// Синхронизация офлайн запросов
async function syncOfflineRequests() {
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('OfflineRequests', 1);
    
    dbRequest.onsuccess = async (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['requests'], 'readonly');
      const store = transaction.objectStore('requests');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = async () => {
        const requests = getAllRequest.result;
        console.log('[SW] Syncing', requests.length, 'offline requests');
        
        for (const requestData of requests) {
          try {
            const response = await fetch(requestData.url, {
              method: requestData.method,
              headers: requestData.headers,
              body: requestData.body
            });
            
            if (response.ok) {
              // Удаляем успешно синхронизированный запрос
              const deleteTransaction = db.transaction(['requests'], 'readwrite');
              const deleteStore = deleteTransaction.objectStore('requests');
              deleteStore.delete(requestData.id);
            }
          } catch (error) {
            console.error('[SW] Failed to sync request:', error);
          }
        }
        resolve();
      };
    };
  });
}
