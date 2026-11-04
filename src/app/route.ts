import { useEffect, useState } from 'react'

export type Section = 'solve' | 'train' | 'stats' | 'study' | 'settings'
export type Route = { section: Section; detail?: string }

const SECTIONS: Section[] = ['solve', 'train', 'stats', 'study', 'settings']

export function parseRoute(hash: string): Route {
  const [section, detail] = hash.replace(/^#\/?/, '').split('/')
  return SECTIONS.includes(section as Section) ? { section: section as Section, detail: detail || undefined } : { section: 'solve' }
}

export function routeHref(route: Route) {
  return `#/${route.section}${route.detail ? `/${route.detail}` : ''}`
}

export function navigate(route: Route) {
  window.location.hash = routeHref(route)
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const update = () => {
      setRoute(parseRoute(window.location.hash))
      document.querySelector('main')?.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  return route
}
