export const LOCKED_COMPOSITION = 'locked'
export const LEGACY_COMPOSITION = 'legacy'

export function readCompositionMode(search = '') {
  return new URLSearchParams(search).get('composition') === LEGACY_COMPOSITION
    ? LEGACY_COMPOSITION
    : LOCKED_COMPOSITION
}

export function withCompositionMode(href, mode) {
  const url = new URL(href)

  if (mode === LEGACY_COMPOSITION) {
    url.searchParams.set('composition', LEGACY_COMPOSITION)
  } else {
    url.searchParams.delete('composition')
  }

  return `${url.pathname}${url.search}${url.hash}`
}
