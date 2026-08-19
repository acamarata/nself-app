/**
 * usePageMeta.ts — Dynamic document.title + meta description + OG tags
 *
 * Purpose:    Set per-route page metadata via DOM mutation.
 *             Resets to default on unmount.
 * Inputs:     { title, description?, ogImage? }
 * Outputs:    DOM mutations to <title>, <meta name="description">, og:title, og:image
 * Constraints: SSR-safe (no-op if document undefined); SPA-only
 * SPORT:      D-S9-T1
 */
import { useEffect } from 'react'

interface PageMetaOptions {
  title: string
  description?: string
  ogImage?: string
}

const DEFAULT_TITLE = 'ɳTask — Tasks that work the way you do'
const DEFAULT_DESCRIPTION =
  'ɳTask is a free, open-source task manager built on ɳSelf. Use the hosted version at no cost, or self-host in minutes with the ɳSelf CLI.'

function getMeta(name: string): HTMLMetaElement | null {
  return document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
}

function getOgMeta(property: string): HTMLMetaElement | null {
  return document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null
}

function setOrCreateMeta(name: string, content: string) {
  if (typeof document === 'undefined') return
  let el = getMeta(name)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setOrCreateOgMeta(property: string, content: string) {
  if (typeof document === 'undefined') return
  let el = getOgMeta(property)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function usePageMeta({ title, description, ogImage }: PageMetaOptions) {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const prevTitle = document.title
    const prevDesc = getMeta('description')?.getAttribute('content') ?? DEFAULT_DESCRIPTION
    const prevOgTitle = getOgMeta('og:title')?.getAttribute('content') ?? DEFAULT_TITLE
    const prevOgImage = getOgMeta('og:image')?.getAttribute('content') ?? ''

    document.title = `${title} — ɳTask`
    setOrCreateMeta('description', description ?? DEFAULT_DESCRIPTION)
    setOrCreateOgMeta('og:title', title)
    if (ogImage) setOrCreateOgMeta('og:image', ogImage)

    return () => {
      document.title = prevTitle
      setOrCreateMeta('description', prevDesc)
      setOrCreateOgMeta('og:title', prevOgTitle)
      if (ogImage) setOrCreateOgMeta('og:image', prevOgImage)
    }
  }, [title, description, ogImage])
}
