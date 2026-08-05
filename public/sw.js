// public/sw.js — Web Push Service Worker for DentalMCQ
// This file must stay in /public so it is served at the root path /sw.js

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  if (!e.data) return;

  let payload;
  try { payload = e.data.json(); } catch { return; }

  const { title = 'DentalMCQ', body = '', type = '', link = '/' } = payload;
  const badge = '/icon-192.png';

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge,
      tag: type,           // group same-type notifs (e.g., only one payment_pending at once)
      renotify: true,      // still vibrate even if same tag
      data: { link },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = e.notification.data?.link || '/';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If the app is already open, focus it and navigate.
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', link });
          return;
        }
      }
      // Otherwise open a new tab.
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});
