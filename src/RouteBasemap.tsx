import { useEffect, useMemo, useRef, useState } from 'react'
import { db, type RouteKind, type RoutePoint } from './db'

type MaplibreModule = typeof import('maplibre-gl')
type TurfModule = typeof import('@turf/turf')
type LineFeature = GeoJSON.Feature<GeoJSON.LineString, Record<string, unknown>>
type PointFeature = GeoJSON.Feature<GeoJSON.Point, Record<string, unknown>>
type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>

interface LayerToggles {
  hazards: boolean
  resupply: boolean
  highlights: boolean
  alternates: boolean
  progress: boolean
}

const totalTrailKm = 3008
const routeSource = `${import.meta.env.BASE_URL}te-araroa.geojson`
const emptyFeatureCollection: FeatureCollection = { type: 'FeatureCollection', features: [] }
const emptyLine: LineFeature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
const defaultLayerToggles: LayerToggles = { hazards: true, resupply: true, highlights: true, alternates: true, progress: true }
const useWatercolor = true
const kindColors: Record<RouteKind, string> = {
  milestone: '#5a4632',
  section: '#8a7a66',
  highlight: '#B5651D',
  resupply: '#1d6f9e',
  rest: '#3b6d2f',
  hazard: '#9B3D1E',
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function lineFromGeoJson(data: FeatureCollection): LineFeature {
  for (const feature of data.features) {
    if (feature.geometry.type === 'LineString') {
      return feature as LineFeature
    }
    if (feature.geometry.type === 'MultiLineString') {
      return {
        type: 'Feature',
        properties: feature.properties ?? {},
        geometry: {
          type: 'LineString',
          coordinates: feature.geometry.coordinates.flat(),
        },
      }
    }
  }

  return emptyLine
}

function boundsForLine(maplibre: MaplibreModule, line: LineFeature) {
  const [first, ...rest] = line.geometry.coordinates
  const bounds = new maplibre.LngLatBounds(first as [number, number], first as [number, number])
  rest.forEach((coord) => bounds.extend(coord as [number, number]))
  return bounds
}

function shouldShowPoint(point: RoutePoint, toggles: LayerToggles) {
  if (!toggles.hazards && point.kind === 'hazard') return false
  if (!toggles.resupply && point.kind === 'resupply') return false
  if (!toggles.highlights && point.kind === 'highlight') return false
  if (!toggles.alternates && point.variant !== 'main') return false
  return true
}

function waypointFeatures(turf: TurfModule, trail: LineFeature, route: RoutePoint[], trailLengthKm: number, toggles: LayerToggles): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: route.filter((point) => Number.isFinite(point.km) && shouldShowPoint(point, toggles)).map((point) => {
      const distanceKm = Math.max(0, Math.min((point.km / totalTrailKm) * trailLengthKm, trailLengthKm))
      const feature = turf.along(trail, distanceKm, { units: 'kilometers' }) as PointFeature
      return {
        ...feature,
        properties: {
          id: point.id,
          name: point.name,
          island: point.island,
          region: point.region,
          kind: point.kind,
          difficulty: point.difficulty,
          variant: point.variant,
          km: point.km,
          notes: point.notes ?? '',
          provider: point.provider ?? '',
          phone: point.phone ?? '',
          cost: point.cost ?? '',
          transportNotes: point.transportNotes ?? '',
          done: point.done,
          color: kindColors[point.kind],
        },
      }
    }),
  }
}

function progressFeature(turf: TurfModule, trail: LineFeature, route: RoutePoint[], trailLengthKm: number): LineFeature {
  const maxDoneKm = Math.max(0, ...route.filter((point) => point.done && Number.isFinite(point.km)).map((point) => point.km))
  if (!maxDoneKm) return emptyLine
  const distanceKm = Math.max(0, Math.min((maxDoneKm / totalTrailKm) * trailLengthKm, trailLengthKm))
  return turf.lineSliceAlong(trail, 0, distanceKm, { units: 'kilometers' }) as LineFeature
}

function hereFeature(turf: TurfModule, trail: LineFeature, route: RoutePoint[], trailLengthKm: number): FeatureCollection {
  const maxDoneKm = Math.max(0, ...route.filter((point) => point.done && Number.isFinite(point.km)).map((point) => point.km))
  if (!maxDoneKm) return emptyFeatureCollection
  const distanceKm = Math.max(0, Math.min((maxDoneKm / totalTrailKm) * trailLengthKm, trailLengthKm))
  const point = turf.along(trail, distanceKm, { units: 'kilometers' }) as PointFeature
  return { type: 'FeatureCollection', features: [{ ...point, properties: { label: 'You are here' } }] }
}

function popupHtml(point: RoutePoint) {
  const action = point.done ? 'Un-reach' : 'Mark reached'
  const transport = point.kind === 'hazard'
    ? `<div class="ta-map-popup-section"><strong>Hazard transport</strong><br>${escapeHtml(point.provider || 'TBC')}<br>${escapeHtml(point.phone || '')}<br>${escapeHtml(point.cost || '')}<br>${escapeHtml(point.transportNotes || 'Confirm bypass details closer to date.')}</div>`
    : ''

  return `
    <div class="ta-map-popup">
      <h3>${escapeHtml(point.name)}</h3>
      <p>${escapeHtml(point.island)} · ${escapeHtml(point.region)} · ${escapeHtml(point.kind)} · ${escapeHtml(point.difficulty)} · km ${escapeHtml(point.km)}</p>
      <p>${escapeHtml(point.notes)}</p>
      ${transport}
      <button type="button" data-route-id="${escapeHtml(point.id)}">${action}</button>
    </div>
  `
}

export function RouteBasemap({ route, refresh }: { route: RoutePoint[]; refresh: () => Promise<void> }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<import('maplibre-gl').Map | null>(null)
  const maplibreRef = useRef<MaplibreModule | null>(null)
  const turfRef = useRef<TurfModule | null>(null)
  const trailRef = useRef<LineFeature | null>(null)
  const trailLengthRef = useRef(0)
  const popupRef = useRef<import('maplibre-gl').Popup | null>(null)
  const refreshRef = useRef(refresh)
  const [localRoute, setLocalRoute] = useState(route)
  const localRouteRef = useRef(route)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [toggles, setToggles] = useState<LayerToggles>(defaultLayerToggles)

  useEffect(() => {
    localRouteRef.current = localRoute
  }, [localRoute])

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    const sync = window.setTimeout(() => setLocalRoute(route), 0)
    return () => window.clearTimeout(sync)
  }, [route])

  const tileStyle = useMemo(() => {
    // Stadia domain auth requires the GitHub Pages host to be whitelisted in the Stadia dashboard.
    // If tiles 401/403 in production, whitelist the domain or fall back to an API key per Stadia docs.
    return {
      version: 8,
      sources: {
        basemap: {
          type: 'raster',
          tiles: useWatercolor ? ['https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg'] : ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: useWatercolor ? '© Stamen Design © Stadia Maps © OpenStreetMap contributors' : '© OpenStreetMap contributors',
        },
      },
      layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
    } satisfies import('maplibre-gl').StyleSpecification
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    let cancelled = false

    const start = async () => {
      try {
        const [{ default: maplibre }, turf, response] = await Promise.all([
          import('maplibre-gl'),
          import('@turf/turf'),
          fetch(routeSource),
        ])
        if (!response.ok) throw new Error(`Route GeoJSON failed to load (${response.status})`)

        const data = await response.json() as FeatureCollection
        if (cancelled || !mapContainerRef.current) return

        // TODO: Replace the placeholder anchor route with the official TA GPX converted to simplified GeoJSON.
        const trail = lineFromGeoJson(data)
        const trailLengthKm = turf.length(trail, { units: 'kilometers' })
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        maplibreRef.current = maplibre
        turfRef.current = turf
        trailRef.current = trail
        trailLengthRef.current = trailLengthKm

        const map = new maplibre.Map({
          container: mapContainerRef.current,
          style: tileStyle,
          center: [171.5, -41.5],
          zoom: 4.2,
        })
        mapRef.current = map
        map.addControl(new maplibre.NavigationControl({ visualizePitch: false }), 'top-right')
        map.addControl(new maplibre.ScaleControl({ maxWidth: 160, unit: 'metric' }), 'bottom-left')

        map.on('load', () => {
          map.addSource('trail', { type: 'geojson', data: prefersReducedMotion ? trail : emptyLine })
          map.addSource('progress', { type: 'geojson', data: emptyLine })
          map.addSource('waypoints', { type: 'geojson', data: emptyFeatureCollection })
          map.addSource('here', { type: 'geojson', data: emptyFeatureCollection })

          map.addLayer({
            id: 'trail-line',
            type: 'line',
            source: 'trail',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#9B3D1E', 'line-width': 3, 'line-opacity': 0.82 },
          })
          map.addLayer({
            id: 'progress-line',
            type: 'line',
            source: 'progress',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#5d1f12', 'line-width': 5, 'line-opacity': 0.95 },
          })
          map.addLayer({
            id: 'waypoint-circles',
            type: 'circle',
            source: 'waypoints',
            paint: {
              'circle-radius': ['case', ['==', ['get', 'kind'], 'milestone'], 10, 8],
              'circle-color': ['get', 'color'],
              'circle-opacity': ['case', ['get', 'done'], 0.96, 0],
              'circle-stroke-color': ['get', 'color'],
              'circle-stroke-width': ['case', ['get', 'done'], 2, 3],
              'circle-stroke-opacity': 0.95,
            },
          })
          map.addLayer({
            id: 'here-marker',
            type: 'circle',
            source: 'here',
            paint: {
              'circle-radius': 8,
              'circle-color': '#2E2A25',
              'circle-stroke-color': '#F4EFE6',
              'circle-stroke-width': 3,
            },
          })

          ;(map.getSource('waypoints') as import('maplibre-gl').GeoJSONSource | undefined)?.setData(waypointFeatures(turf, trail, localRouteRef.current, trailLengthKm, defaultLayerToggles))
          ;(map.getSource('progress') as import('maplibre-gl').GeoJSONSource | undefined)?.setData(defaultLayerToggles.progress ? progressFeature(turf, trail, localRouteRef.current, trailLengthKm) : emptyLine)
          ;(map.getSource('here') as import('maplibre-gl').GeoJSONSource | undefined)?.setData(defaultLayerToggles.progress ? hereFeature(turf, trail, localRouteRef.current, trailLengthKm) : emptyFeatureCollection)

          map.fitBounds(boundsForLine(maplibre, trail), { padding: 48, duration: prefersReducedMotion ? 0 : 900 })

          if (prefersReducedMotion) {
            setReady(true)
            return
          }

          const startTime = performance.now()
          const animate = (time: number) => {
            if (!mapRef.current) return
            const progress = Math.min((time - startTime) / 3000, 1)
            const source = mapRef.current.getSource('trail') as import('maplibre-gl').GeoJSONSource | undefined
            const revealKm = trailLengthKm * progress
            const slice = revealKm > 0.001
              ? turf.lineSliceAlong(trail, 0, revealKm, { units: 'kilometers' }) as LineFeature
              : emptyLine
            source?.setData(slice)
            if (progress < 1) {
              window.requestAnimationFrame(animate)
	            } else {
	              source?.setData(trail)
	              setReady(true)
            }
          }
          window.requestAnimationFrame(animate)
        })

        map.on('click', 'waypoint-circles', (event) => {
          const feature = event.features?.[0]
          const id = Number(feature?.properties?.id)
          const point = localRouteRef.current.find((routePoint) => routePoint.id === id)
          if (!point || !maplibreRef.current) return

          popupRef.current?.remove()
          popupRef.current = new maplibreRef.current.Popup({ closeButton: true, maxWidth: '320px' })
            .setLngLat(event.lngLat)
            .setHTML(popupHtml(point))
            .addTo(map)

          const button = popupRef.current.getElement().querySelector<HTMLButtonElement>('button[data-route-id]')
          button?.addEventListener('click', async () => {
            if (!point.id) return
            const nextDone = !point.done
            setLocalRoute((current) => current.map((item) => item.id === point.id ? { ...item, done: nextDone } : item))
            await db.route.update(point.id, { done: nextDone })
            await refreshRef.current()
            popupRef.current?.remove()
          })
        })

        map.on('mouseenter', 'waypoint-circles', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'waypoint-circles', () => { map.getCanvas().style.cursor = '' })
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Map failed to load')
      }
    }

    start()
    return () => {
      cancelled = true
      popupRef.current?.remove()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [tileStyle])

  useEffect(() => {
    const map = mapRef.current
    const turf = turfRef.current
    const trail = trailRef.current
    const trailLengthKm = trailLengthRef.current
    if (!map || !turf || !trail || !map.isStyleLoaded()) return

    ;(map.getSource('waypoints') as import('maplibre-gl').GeoJSONSource | undefined)?.setData(waypointFeatures(turf, trail, localRoute, trailLengthKm, toggles))
    ;(map.getSource('progress') as import('maplibre-gl').GeoJSONSource | undefined)?.setData(toggles.progress ? progressFeature(turf, trail, localRoute, trailLengthKm) : emptyLine)
    ;(map.getSource('here') as import('maplibre-gl').GeoJSONSource | undefined)?.setData(toggles.progress ? hereFeature(turf, trail, localRoute, trailLengthKm) : emptyFeatureCollection)
  }, [localRoute, ready, toggles])

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">Map</p>
          <h2 className="section-title">Interactive trail basemap</h2>
          <p className="mt-2 text-sm text-ink/60">Online basemap tiles are required here. List, Art, and Elevation remain available offline.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-ink/70">
          <LayerToggle label="Hazards" checked={toggles.hazards} onChange={(hazards) => setToggles((current) => ({ ...current, hazards }))} />
          <LayerToggle label="Resupply" checked={toggles.resupply} onChange={(resupply) => setToggles((current) => ({ ...current, resupply }))} />
          <LayerToggle label="Highlights" checked={toggles.highlights} onChange={(highlights) => setToggles((current) => ({ ...current, highlights }))} />
          <LayerToggle label="Alternates" checked={toggles.alternates} onChange={(alternates) => setToggles((current) => ({ ...current, alternates }))} />
          <LayerToggle label="Progress" checked={toggles.progress} onChange={(progress) => setToggles((current) => ({ ...current, progress }))} />
        </div>
      </div>
      {!useWatercolor && (
        <p className="mt-4 rounded-md border border-line bg-bone px-3 py-2 text-sm text-ink/65">Using OSM fallback tiles. Enable Stadia domain auth for the watercolor basemap.</p>
      )}
      {error && <p className="mt-4 rounded-md border border-rust bg-rust/5 px-3 py-2 text-sm text-rust">{error}</p>}
      <div className="mt-5 h-[620px] min-h-[65vh] overflow-hidden rounded-md border border-line bg-bone">
        <div ref={mapContainerRef} className="h-full w-full" />
      </div>
    </section>
  )
}

function LayerToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input className="accent-sage" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}
