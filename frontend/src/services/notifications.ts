export async function ensureNotificationPermission() {
  if (!('Notification' in window)) return false
  const permission = Notification.permission
  if (permission === 'granted') return true
  if (permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function fireLocalNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  new Notification(title, options)
}

export function playRingtone(url?: string) {
  const audio = new Audio(url || '/tones/default.mp3')
  audio.play().catch(() => {
    // ignored
  })
}
