/**
 * Self-hosted Web Push service worker (webpush-go, VAPID).
 * No external push provider account (e.g. Firebase) is used — this handles
 * standard Push API events delivered via the browser's built-in push service,
 * signed with the server's own VAPID key pair.
 */

const APP_ICON = '/icons/icon-192.png';
const APP_BADGE = '/icons/badge-96.png';
const DEFAULT_VIBRATION_PATTERN = [180, 80, 240];

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    return;
  }

  if (!payload) {
    return;
  }

  const title = payload.title || 'แจ้งเตือนใหม่';
  const options = {
    body: payload.body || '',
    icon: payload.icon || APP_ICON,
    badge: payload.badge || APP_BADGE,
    data: payload.data || {},
    requireInteraction: !!payload.requireInteraction,
    renotify: true,
    tag: payload.tag || (payload.data && payload.data.type) || 'labtas-webpush',
    vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : DEFAULT_VIBRATION_PATTERN,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * 👉 คลิกแจ้งเตือน
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  switch (data.type) {
    case 'new-task':
      url = data.workerUrl || '/worker';
      break;
    case 'queue-ready':
      url = data.bookingUrl || `/queue/book?pin=${data.pinCode}`;
      break;
    default:
      url = data.url || '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

/**
 * Service Worker lifecycle
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
