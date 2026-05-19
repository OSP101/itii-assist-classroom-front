importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAOgm56BteZP_ipSdv8il8r6knK3i4vTFc",
  authDomain: "itii-assist-classrooms.firebaseapp.com",
  projectId: "itii-assist-classrooms",
  storageBucket: "itii-assist-classrooms.firebasestorage.app",
  messagingSenderId: "217696858922",
  appId: "1:217696858922:web:27341ecb0e7b7ca971e453"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title =
    payload.notification?.title ||
    payload.data?.title ||
    'แจ้งเตือนใหม่';

  const options = {
    body:
      payload.notification?.body ||
      payload.data?.body ||
      '',
    icon: payload.notification?.icon || '/images/logo.png',
    badge: '/images/badge.png',
    data: payload.data || {},
    requireInteraction: payload.data?.requireInteraction === 'true',
  };

  self.registration.showNotification(title, options);
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
