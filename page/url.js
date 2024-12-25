export const updateURL = (map) => {
  const { lng, lat } = map.getCenter();

  const url = new URL(window.location);
  url.searchParams.set('x', lat.toFixed(5))
  url.searchParams.set('y', lng.toFixed(5))
  url.searchParams.set('z', map.getZoom().toFixed(5));

  history.replaceState(null, "", url)
}

const LNGLAT_TOKYO = [139.7669975, 35.6812505] // Tokyo
const DEFAULT_ZOOM = 11

export const getLngLatFromURL = () => {
  const params = new URLSearchParams(window.location.search)
  const lat = parseFloat(params.get("x"))
  const lng = parseFloat(params.get("y"))
  if (isNaN(lat) || isNaN(lng)) {
    return LNGLAT_TOKYO
  }

  return [lng, lat]
}

export const getZoomFromURL = () => {
  const params = new URLSearchParams(window.location.search)
  return parseFloat(params.get("z")) || DEFAULT_ZOOM
}
