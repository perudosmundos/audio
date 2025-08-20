import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

// Регистрация Service Worker для офлайн поддержки
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[SW] Service Worker registered successfully:', registration);
        
        // Проверяем обновления Service Worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] New Service Worker available');
                // Можно показать уведомление пользователю об обновлении
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[SW] Service Worker registration failed:', error);
      });
  });

  // Обработка сообщений от Service Worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
      case 'SYNC_COMPLETE':
        console.log('[SW] Background sync completed:', data);
        break;
      case 'CACHE_UPDATE':
        console.log('[SW] Cache updated:', data);
        break;
      default:
        console.log('[SW] Unknown message type:', type, data);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);