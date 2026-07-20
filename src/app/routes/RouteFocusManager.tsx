import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export function RouteFocusManager() {
  const location = useLocation()
  const previousRoute = useRef<string | null>(null)
  const route = location.pathname + location.search

  useEffect(() => {
    if (previousRoute.current === route) {
      return
    }
    const hasNavigated = previousRoute.current !== null
    previousRoute.current = route
    if (!hasNavigated) {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [route])

  return null
}
