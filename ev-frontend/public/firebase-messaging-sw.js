// firebase-messaging-sw.js
// Must be served at /firebase-messaging-sw.js (from the public/ folder)
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBaWC5TJ2YEF1QRw9xF4hxGWZNu3LTVQOY",
  authDomain: "ev-p2p.firebaseapp.com",
  projectId: "ev-p2p",
  storageBucket: "ev-p2p.firebasestorage.app",
  messagingSenderId: "329477379562",
  appId: "1:329477379562:web:e020ec50b93facea988e93"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || 'Charge My EV';
  const body = notification.body || '';
  const deepLink = data.deepLink || '/';

  return self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: { deepLink }
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const deepLink = event.notification.data?.deepLink || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.navigate(deepLink).then((c) => c.focus());
        }
      }
      return clients.openWindow(deepLink);
    })
  );
});
