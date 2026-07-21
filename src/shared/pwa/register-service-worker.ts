export async function registerOpenTradeServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return null

  const base = new URL(import.meta.env.BASE_URL, window.location.href)
  try {
    return await navigator.serviceWorker.register(
      new URL('sw.js', base),
      { scope: base.pathname },
    )
  } catch {
    return null
  }
}
