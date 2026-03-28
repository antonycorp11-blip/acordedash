self.addEventListener('push', function(event) {
  let title = "Studio Acorde";
  let body = "Lembrete: Abra o sistema!";
  let icon = "/apple-touch-icon.png";

  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || body;
      icon = data.icon || icon;
    } catch (e) {
      body = event.data.text();
    }
  }

  const options = {
    body,
    icon,
    vibrate: [300, 100, 300, 100, 300, 500, 800], // Faz o celular vibrar de forma forte 
    requireInteraction: true // Deixa o banner fixo pra pessoa n perder
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Manda pra aba q já tá aberta e traz o browser pro foreground
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
