// Service Worker para Push Notifications
// Teatro Colón - Sistema de Rotativos

self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker instalado')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activado')
  event.waitUntil(self.clients.claim())
})

// Manejar notificaciones push
self.addEventListener('push', (event) => {
  console.log('[SW] Push recibido:', event)

  let data = {
    title: 'Teatro Colón',
    body: 'Nueva notificación',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    url: '/'
  }

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() }
    }
  } catch (e) {
    console.error('[SW] Error parseando datos:', e)
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Ver'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ],
    tag: data.tag || 'default',
    renotify: true
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Manejar click en notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Click en notificación:', event)

  event.notification.close()

  if (event.action === 'close') {
    return
  }

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una ventana abierta, enfocarla
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen)
            return client.focus()
          }
        }
        // Si no, abrir una nueva
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen)
        }
      })
  )
})

// Manejar cierre de notificación
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notificación cerrada:', event)
})
