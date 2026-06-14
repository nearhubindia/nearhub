/* global importScripts, firebase */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBv0aD-mE3ahPDcQpEeZmMSUVWtM57_-vc',
  authDomain: 'nearhub-b8dd7.firebaseapp.com',
  projectId: 'nearhub-b8dd7',
  storageBucket: 'nearhub-b8dd7.firebasestorage.app',
  messagingSenderId: '822544369307',
  appId: '1:822544369307:web:e7ac97ee3f89c9a334283e',
  measurementId: 'G-3RDDBXSGB0',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const link = data.url || data.dealUrl || '/';

  self.registration.showNotification(notification.title || 'NearHub', {
    body: notification.body || '',
    icon: '/nearhub.png',
    data: { link },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        existing.focus();
        if ('navigate' in existing) {
          return existing.navigate(link);
        }
        return existing;
      }
      return self.clients.openWindow(link);
    })
  );
});
