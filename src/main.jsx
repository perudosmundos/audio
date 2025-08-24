import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

// Регистрация Service Worker только в production; в dev удаляем SW, чтобы не мешал Vite HMR
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          // SW registered

          // Проверяем обновления Service Worker
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New Service Worker available
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
          // Background sync completed
          break;
        case 'CACHE_UPDATE':
          // Cache updated
          break;
        default:
          // Unknown message type
      }
    });
  } else {
    // В режиме разработки удаляем любые активные SW, чтобы они не перехватывали HMR-запросы
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);