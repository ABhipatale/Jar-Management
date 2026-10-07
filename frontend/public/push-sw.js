/* Phone notifications for jar reminders (loaded into the app's service worker). */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    // The server sends the company's own icon with each notification.
    self.registration.showNotification(data.title || '🔔', {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.icon || '/icons/icon-192.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/notifications' },
    })
  );
});

// Tapping the notification opens (or focuses) the app on the 🔔 screen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/notifications', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ('focus' in w) {
          if ('navigate' in w) w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
