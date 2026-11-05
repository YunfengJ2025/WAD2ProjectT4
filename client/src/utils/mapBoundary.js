// Camera limits allow a little room around Singapore's offshore islands.
// Pin validation uses the actual planning-area polygons rather than this rectangle.
export const SINGAPORE_MAP_BOUNDS = [[103.57, 1.13], [104.13, 1.51]]

function inRing(lng, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j]
    const [x2, y2] = ring[i]
    // Treat shared planning-area edges as part of Singapore.
    const cross = (lng - x1) * (y2 - y1) - (lat - y1) * (x2 - x1)
    if (Math.abs(cross) < 1e-12 && lng >= Math.min(x1, x2) && lng <= Math.max(x1, x2)
      && lat >= Math.min(y1, y2) && lat <= Math.max(y1, y2)) return true
    if ((y1 > lat) !== (y2 > lat) && lng < (x2 - x1) * (lat - y1) / (y2 - y1) + x1) {
      inside = !inside
    }
  }
  return inside
}

export function isWithinSingapore(point, areas) {
  if (!Number.isFinite(point?.lng) || !Number.isFinite(point?.lat)) return false
  const { lng, lat } = point
  return (areas?.features || []).some(({ geometry }) => {
    const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates]
      : geometry?.type === 'MultiPolygon' ? geometry.coordinates : []
    return polygons.some(([outer, ...holes]) => inRing(lng, lat, outer)
      && !holes.some((hole) => inRing(lng, lat, hole)))
  })
}
