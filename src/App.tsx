import { useEffect, useMemo, useState } from 'react'
import {
  db,
  defaultSettings,
  ensureSeeded,
  resetToSeed,
  type AppSettings,
  type ElevationPoint,
  type FundContribution,
  type GearItem,
  type GearStatus,
  type Difficulty,
  type ResupplyPoint,
  type RouteKind,
  type RoutePoint,
  type RouteVariant,
  type StoreType,
  type Task,
  type TrainingEntry,
  type Workstream,
  workstreams,
} from './db'

type Tab = 'Dashboard' | 'Route' | 'Tasks' | 'Gear' | 'Fund' | 'Resupply' | 'Training'
type RouteFilter = 'All' | 'North Is' | 'South Is' | 'Highlights' | 'Resupply' | 'Hazards' | 'Alternates'
type RouteViewMode = 'List' | 'Map' | 'Elevation'
type ResupplyFilter = 'All' | 'Mail-a-box' | 'Rest towns' | 'South Is'
type GearFilter = 'All' | 'Need' | 'Owned' | 'Tested'

const tabs: Tab[] = ['Dashboard', 'Route', 'Tasks', 'Gear', 'Fund', 'Resupply', 'Training']
const workstreamOrder = workstreams.map((stream) => stream.name)
const currency = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('en-NZ')
const todayIso = () => new Date().toISOString().slice(0, 10)
const routeFilters: RouteFilter[] = ['All', 'North Is', 'South Is', 'Highlights', 'Resupply', 'Hazards', 'Alternates']
const resupplyFilters: ResupplyFilter[] = ['All', 'Mail-a-box', 'Rest towns', 'South Is']
const gearFilters: GearFilter[] = ['All', 'Need', 'Owned', 'Tested']
const barColorClass = {
  teal: 'bg-teal',
  fern: 'bg-fern',
  coral: 'bg-coral',
  amber: 'bg-amber',
}
const kindStyle: Record<RouteKind, string> = {
  milestone: 'border-ink bg-ink text-paper',
  section: 'border-teal bg-teal text-paper',
  highlight: 'border-ochre bg-ochre text-paper',
  resupply: 'border-blue-700 bg-blue-700 text-white',
  rest: 'border-fern bg-fern text-paper',
  hazard: 'border-rust bg-rust text-paper',
}
const kindDot: Record<RouteKind, string> = {
  milestone: '#2E2A25',
  section: '#4E8F8A',
  highlight: '#B5651D',
  resupply: '#1D4ED8',
  rest: '#5D8A55',
  hazard: '#9B3D1E',
}

interface AppData {
  tasks: Task[]
  gear: GearItem[]
  route: RoutePoint[]
  elevation: ElevationPoint[]
  fund: FundContribution[]
  resupply: ResupplyPoint[]
  training: TrainingEntry[]
  settings: AppSettings
}

interface Stats {
  days: number
  taskProgress: number
  saved: number
  target: number
  requiredMonthly: number
  trainingKm: number
  routeProgress: number
  routeDone: number
}

const emptyData: AppData = {
  tasks: [],
  gear: [],
  route: [],
  elevation: [],
  fund: [],
  resupply: [],
  training: [],
  settings: defaultSettings,
}

function monthsBetweenNow(targetIso: string) {
  const now = new Date()
  const target = new Date(`${targetIso}T00:00:00`)
  const diff = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth()
  return Math.max(diff + (target.getDate() >= now.getDate() ? 0 : -1), 1)
}

function daysUntil(targetIso: string) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const target = new Date(`${targetIso}T00:00:00`)
  return Math.ceil((target.getTime() - start.getTime()) / 86_400_000)
}

function compactKg(grams: number) {
  return `${number.format(grams)} g / ${(grams / 1000).toFixed(2)} kg`
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item)
    groups[key] = [...(groups[key] ?? []), item]
    return groups
  }, {})
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Dashboard')
  const [data, setData] = useState<AppData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [offlineReady, setOfflineReady] = useState(false)

  const loadData = async () => {
    const [tasks, gear, route, elevation, fund, resupply, training, settings] = await Promise.all([
      db.tasks.orderBy('id').toArray(),
      db.gear.orderBy('id').toArray(),
      db.route.orderBy('seq').toArray(),
      db.elevation.orderBy('km').toArray(),
      db.fund.orderBy('date').toArray(),
      db.resupply.orderBy('id').toArray(),
      db.training.orderBy('date').toArray(),
      db.settings.get('app'),
    ])
    setData({ tasks, gear, route, elevation, fund, resupply, training, settings: settings ?? defaultSettings })
  }

  useEffect(() => {
    ensureSeeded().then(loadData).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const showOfflineReady = () => {
      setOfflineReady(true)
      window.setTimeout(() => setOfflineReady(false), 4200)
    }
    window.addEventListener('ta-offline-ready', showOfflineReady)
    return () => window.removeEventListener('ta-offline-ready', showOfflineReady)
  }, [])

  const refresh = async () => {
    await loadData()
  }

  const stats = useMemo(() => {
    const doneTasks = data.tasks.filter((task) => task.done).length
    const saved = data.fund.reduce((sum, item) => sum + item.amountNZD, 0)
    const trainingKm = data.training.reduce((sum, item) => sum + item.distanceKm, 0)
    const routeDone = data.route.filter((point) => point.done).length
    const target = data.settings.fundTargetNZD
    const remaining = Math.max(target - saved, 0)
    return {
      days: daysUntil(data.settings.departureDate),
      taskProgress: data.tasks.length ? Math.round((doneTasks / data.tasks.length) * 100) : 0,
      saved,
      target,
      requiredMonthly: remaining / monthsBetweenNow(data.settings.departureDate),
      trainingKm,
      routeProgress: data.route.length ? Math.round((routeDone / data.route.length) * 100) : 0,
      routeDone,
    }
  }, [data])

  if (loading) {
    return <main className="min-h-screen bg-bone px-6 py-10 text-ink">Loading Te Araroa Prep...</main>
  }

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-line pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rust">Local-first thru-hike prep</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-serif text-4xl leading-tight text-ink md:text-6xl">Te Araroa Prep</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/70">
                Southbound runway from Cape Reinga to Bluff, with every note stored in this browser.
              </p>
            </div>
            <div className="rounded-md border border-line bg-paper px-4 py-3 text-sm shadow-hush">
              <span className="block text-xs uppercase tracking-[0.16em] text-ink/50">Departure</span>
              <strong className="font-serif text-xl">{data.settings.departureDate}</strong>
            </div>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-line pb-3" aria-label="Main sections">
          {tabs.map((tab) => (
            <button
              className={`tab-button ${activeTab === tab ? 'tab-button-active' : ''}`}
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        {activeTab === 'Dashboard' && <Dashboard data={data} stats={stats} refresh={refresh} />}
        {activeTab === 'Route' && <RouteView route={data.route} elevation={data.elevation} refresh={refresh} />}
        {activeTab === 'Tasks' && <TasksView tasks={data.tasks} refresh={refresh} />}
        {activeTab === 'Gear' && <GearView gear={data.gear} refresh={refresh} />}
        {activeTab === 'Fund' && <FundView data={data} stats={stats} refresh={refresh} />}
        {activeTab === 'Resupply' && <ResupplyView points={data.resupply} refresh={refresh} />}
        {activeTab === 'Training' && <TrainingView entries={data.training} refresh={refresh} />}
      </div>
      {offlineReady && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md border border-rust bg-paper px-4 py-3 text-sm font-semibold text-rust shadow-hush">
          Offline-ready
        </div>
      )}
    </main>
  )
}

function Dashboard({ data, stats, refresh }: { data: AppData; stats: Stats; refresh: () => Promise<void> }) {
  return (
    <section className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-5">
        <Metric title="Days to depart" value={stats.days.toString()} detail="Cape Reinga target" large />
        <Metric title="Route progress" value={`${stats.routeProgress}%`} detail={`${stats.routeDone} / ${data.route.length} waypoints reached`} />
        <Metric title="Prep progress" value={`${stats.taskProgress}%`} detail={`${data.tasks.filter((task) => task.done).length} of ${data.tasks.length} tasks`} />
        <Metric title="TA Fund" value={`${currency.format(stats.saved)} / ${currency.format(stats.target)}`} detail={`${currency.format(stats.requiredMonthly)} required per month`} />
        <Metric title="Training logged" value={`${stats.trainingKm.toFixed(1)} km`} detail="Cumulative distance" />
      </div>
      <section className="panel">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="section-kicker">Route progress</p>
            <h2 className="section-title">Cape Reinga to Bluff</h2>
          </div>
          <p className="text-sm text-ink/60">{stats.routeDone} / {data.route.length} waypoints reached</p>
        </div>
        <div className="mt-4 h-3 rounded-full border border-line bg-bone">
          <div className="h-full rounded-full bg-teal" style={{ width: `${stats.routeProgress}%` }} />
        </div>
      </section>
      <Gantt />
      <SettingsPanel settings={data.settings} refresh={refresh} />
    </section>
  )
}

function Metric({ title, value, detail, large = false }: { title: string; value: string; detail: string; large?: boolean }) {
  return (
    <article className="panel">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rust">{title}</p>
      <p className={`mt-3 font-serif leading-none text-ink ${large ? 'text-6xl' : 'text-3xl'}`}>{value}</p>
      <p className="mt-3 text-sm text-ink/60">{detail}</p>
    </article>
  )
}

function Gantt() {
  const start = monthIndex('2026-06')
  const end = monthIndex('2028-04')
  const total = end - start + 1
  const labels = [
    { label: 'Jun 2026', month: '2026-06', edge: 'start' },
    { label: 'Jan 2027', month: '2027-01', edge: 'middle' },
    { label: 'Jul 2027', month: '2027-07', edge: 'middle' },
    { label: 'Apr 2028', month: '2028-04', edge: 'end' },
  ]

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Timeline</p>
          <h2 className="section-title">Prep streams to Bluff</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Legend color="bg-teal" label="prep" />
          <Legend color="bg-fern" label="finance" />
          <Legend color="bg-coral" label="life/work" />
          <Legend color="bg-amber" label="on trail" />
        </div>
      </div>
      <div className="mt-6 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="relative ml-36 h-8 border-b border-line">
            {labels.map(({ label, month, edge }) => (
              <span
                className={`absolute whitespace-nowrap text-xs text-ink/50 ${edge === 'end' ? '-translate-x-full' : edge === 'middle' ? '-translate-x-1/2' : ''}`}
                key={label}
                style={{ left: `${markerLeft(month, start, total)}%` }}
              >
                {label}
              </span>
            ))}
            <Marker month="2027-11" label="Depart 11/2027" start={start} total={total} />
            <Marker month="2028-04" label="Bluff 4/2028" start={start} total={total} />
          </div>
          <div className="mt-4 grid gap-3">
            {workstreams.map((stream) => {
              const left = markerLeft(stream.start, start, total)
              const width = ((monthIndex(stream.end) - monthIndex(stream.start) + 1) / total) * 100
              return (
                <div className="grid grid-cols-[8rem_1fr] items-center gap-4" key={stream.name}>
                  <span className="text-sm font-medium">{stream.name}</span>
                  <div className="relative h-8 rounded-sm border border-line/70 bg-bone/60">
                    <div className={`absolute top-1/2 h-4 -translate-y-1/2 rounded-sm ${barColorClass[stream.color]}`} style={{ left: `${left}%`, width: `${width}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-sm border border-line px-2 py-1">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}

function Marker({ month, label, start, total }: { month: string; label: string; start: number; total: number }) {
  return (
    <span className="absolute top-0 h-96 border-l border-dashed border-rust/70" style={{ left: `${markerLeft(month, start, total)}%` }}>
      <span className={`whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-rust ${month === '2028-04' ? '-ml-2 inline-block -translate-x-full' : 'ml-2'}`}>{label}</span>
    </span>
  )
}

function monthIndex(value: string) {
  const [year, month] = value.split('-').map(Number)
  return year * 12 + month
}

function markerLeft(month: string, start: number, total: number) {
  return ((monthIndex(month) - start) / Math.max(total - 1, 1)) * 100
}

function SettingsPanel({ settings, refresh }: { settings: AppSettings; refresh: () => Promise<void> }) {
  const [draft, setDraft] = useState(settings)

  const save = async () => {
    await db.settings.put(draft)
    await refresh()
  }

  const reset = async () => {
    await resetToSeed()
    setDraft(defaultSettings)
    await refresh()
  }

  return (
    <section className="panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">Settings</p>
          <h2 className="section-title">Targets and seed data</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Fund target">
            <input className="input" type="number" value={draft.fundTargetNZD} onChange={(event) => setDraft({ ...draft, fundTargetNZD: Number(event.target.value) })} />
          </Field>
          <Field label="Departure">
            <input className="input" type="date" value={draft.departureDate} onChange={(event) => setDraft({ ...draft, departureDate: event.target.value })} />
          </Field>
          <Field label="Finish">
            <input className="input" type="date" value={draft.finishDate} onChange={(event) => setDraft({ ...draft, finishDate: event.target.value })} />
          </Field>
          <div className="flex gap-2 self-end">
            <button className="button-primary" type="button" onClick={save}>Save</button>
            <button className="button-quiet" type="button" onClick={reset}>Reset seed</button>
          </div>
        </div>
      </div>
    </section>
  )
}

function RouteView({ route, elevation, refresh }: { route: RoutePoint[]; elevation: ElevationPoint[]; refresh: () => Promise<void> }) {
  const [filter, setFilter] = useState<RouteFilter>('All')
  const [mode, setMode] = useState<RouteViewMode>('List')
  const [draft, setDraft] = useState<RoutePoint>({
    seq: (route.at(-1)?.seq ?? 0) + 1,
    name: '',
    island: 'NI',
    region: '',
    kind: 'section',
    km: route.at(-1)?.km ?? 0,
    difficulty: 'moderate',
    variant: 'main',
    done: false,
    notes: '',
  })

  const visibleRoute = route.filter((point) => {
    if (filter === 'North Is') return point.island === 'NI'
    if (filter === 'South Is') return point.island === 'SI'
    if (filter === 'Highlights') return point.kind === 'highlight'
    if (filter === 'Resupply') return point.kind === 'resupply'
    if (filter === 'Hazards') return point.kind === 'hazard'
    if (filter === 'Alternates') return point.variant === 'alternate' || point.variant === 'sidetrip'
    return true
  })

  const addWaypoint = async () => {
    if (!draft.name.trim() || !draft.region.trim()) return
    await db.route.add({ ...draft, name: draft.name.trim(), region: draft.region.trim(), notes: draft.notes?.trim() })
    setDraft({ ...draft, seq: draft.seq + 1, name: '', region: '', notes: '' })
    await refresh()
  }

  return (
    <section className="grid gap-5">
      <section className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker">Route</p>
            <h2 className="section-title">South-bound waypoints</h2>
            <p className="mt-2 text-sm text-ink/60">{visibleRoute.length} of {route.length} waypoints shown</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented options={routeFilters} value={filter} onChange={(value) => setFilter(value as RouteFilter)} />
            <Segmented options={['List', 'Map', 'Elevation']} value={mode} onChange={(value) => setMode(value as RouteViewMode)} />
          </div>
        </div>
      </section>

      {filter === 'Hazards' && <RiverCrossingWarning />}
      {mode === 'Map' ? <RouteMap route={visibleRoute} /> : mode === 'Elevation' ? <ElevationProfile elevation={elevation} route={route} /> : (
        <section className="grid gap-3">
          {visibleRoute.map((point) => <RouteCard point={point} key={point.id} refresh={refresh} />)}
        </section>
      )}

      <FormPanel title="Add waypoint" kicker="Route">
        <input className="input" type="number" placeholder="Seq" value={draft.seq} onChange={(event) => setDraft({ ...draft, seq: Number(event.target.value) })} />
        <input className="input sm:col-span-2" placeholder="Name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        <select className="input" value={draft.island} onChange={(event) => setDraft({ ...draft, island: event.target.value as 'NI' | 'SI' })}>
          <option value="NI">NI</option>
          <option value="SI">SI</option>
        </select>
        <input className="input" placeholder="Region" value={draft.region} onChange={(event) => setDraft({ ...draft, region: event.target.value })} />
        <input className="input" type="number" placeholder="Km" value={draft.km} onChange={(event) => setDraft({ ...draft, km: Number(event.target.value) })} />
        <select className="input" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as RouteKind })}>
          {(['milestone', 'section', 'highlight', 'resupply', 'rest', 'hazard'] satisfies RouteKind[]).map((kind) => <option key={kind} value={kind}>{kind}</option>)}
        </select>
        <select className="input" value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value as Difficulty })}>
          {(['easy', 'moderate', 'hard', 'alpine'] satisfies Difficulty[]).map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
        </select>
        <select className="input" value={draft.variant} onChange={(event) => setDraft({ ...draft, variant: event.target.value as RouteVariant })}>
          {(['main', 'alternate', 'sidetrip'] satisfies RouteVariant[]).map((variant) => <option key={variant} value={variant}>{variant}</option>)}
        </select>
        <input className="input sm:col-span-3" placeholder="Notes" value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        <button className="button-primary" type="button" onClick={addWaypoint}>Add</button>
      </FormPanel>
    </section>
  )
}

function RouteCard({ point, refresh }: { point: RoutePoint; refresh: () => Promise<void> }) {
  const update = async (changes: Partial<RoutePoint>) => {
    if (!point.id) return
    await db.route.update(point.id, changes)
    await refresh()
  }

  return (
    <article className={`panel ${point.variant !== 'main' ? 'border-dashed' : ''}`}>
      {point.kind === 'hazard' && <RiverCrossingWarning compact />}
      <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-start">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink/70">
          <input className="h-5 w-5 accent-sage" type="checkbox" checked={point.done} onChange={(event) => update({ done: event.target.checked })} />
          {point.done ? 'Reached' : 'To go'}
        </label>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-serif text-2xl leading-tight ${point.done ? 'text-ink/45 line-through' : 'text-ink'}`}>{point.seq}. {point.name}</h3>
            <Badge className={kindStyle[point.kind]}>{point.kind}</Badge>
            <Badge className="border-line bg-bone text-ink">{point.difficulty}</Badge>
            {point.variant !== 'main' && <Badge className="border-rust bg-transparent text-rust">{point.variant === 'alternate' ? 'ALT' : 'SIDE'}</Badge>}
          </div>
          <p className="mt-2 text-sm text-ink/60">{point.island} · {point.region} · km {number.format(point.km)}</p>
          <p className="mt-3 text-sm leading-6 text-ink/75">{point.notes}</p>
          {point.kind === 'hazard' && <HazardTransport point={point} />}
        </div>
        <button className="button-quiet" type="button" onClick={async () => point.id && db.route.delete(point.id).then(refresh)}>Delete</button>
      </div>
      <div className="mt-4 grid gap-2 border-t border-line pt-4 lg:grid-cols-[0.35fr_1fr_0.35fr_0.65fr_0.5fr_0.5fr_0.7fr_1.4fr]">
        <input className="input" type="number" value={point.seq} onChange={(event) => update({ seq: Number(event.target.value) })} />
        <input className="input" value={point.name} onChange={(event) => update({ name: event.target.value })} />
        <select className="input" value={point.island} onChange={(event) => update({ island: event.target.value as 'NI' | 'SI' })}>
          <option value="NI">NI</option>
          <option value="SI">SI</option>
        </select>
        <input className="input" value={point.region} onChange={(event) => update({ region: event.target.value })} />
        <input className="input" type="number" value={point.km} onChange={(event) => update({ km: Number(event.target.value) })} />
        <select className="input" value={point.kind} onChange={(event) => update({ kind: event.target.value as RouteKind })}>
          {(['milestone', 'section', 'highlight', 'resupply', 'rest', 'hazard'] satisfies RouteKind[]).map((kind) => <option key={kind} value={kind}>{kind}</option>)}
        </select>
        <select className="input" value={point.difficulty} onChange={(event) => update({ difficulty: event.target.value as Difficulty })}>
          {(['easy', 'moderate', 'hard', 'alpine'] satisfies Difficulty[]).map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
        </select>
        <select className="input" value={point.variant} onChange={(event) => update({ variant: event.target.value as RouteVariant })}>
          {(['main', 'alternate', 'sidetrip'] satisfies RouteVariant[]).map((variant) => <option key={variant} value={variant}>{variant}</option>)}
        </select>
        <input className="input lg:col-span-8" value={point.notes ?? ''} onChange={(event) => update({ notes: event.target.value })} />
      </div>
    </article>
  )
}

function RiverCrossingWarning({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-md border border-rust bg-rust/5 text-rust ${compact ? 'mb-4 p-3' : 'p-4'}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]">River-crossing rule</p>
      <p className="mt-2 text-sm leading-6 text-ink/80">
        Do NOT cross if water is above your waist, or moving faster than your walking pace. If unsure — wait, camp, reassess, or turn back. Rakaia/Rangitata/Ahuriri are hazard zones — bypass by vehicle, never ford.
      </p>
    </div>
  )
}

function HazardTransport({ point }: { point: RoutePoint }) {
  const phoneHref = point.phone ? `tel:${point.phone.replace(/\s+/g, '')}` : undefined

  return (
    <div className="mt-4 rounded-md border border-rust bg-rust/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rust">Hazard transport</p>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
        <div>
          <span className="block text-ink/45">Provider</span>
          <strong>{point.provider || 'TBC'}</strong>
        </div>
        <div>
          <span className="block text-ink/45">Phone</span>
          {phoneHref ? <a className="font-semibold text-rust underline decoration-rust/40 underline-offset-4" href={phoneHref}>{point.phone}</a> : <strong>—</strong>}
        </div>
        <div>
          <span className="block text-ink/45">Cost</span>
          <strong>{point.cost || 'TBC'}</strong>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink/75">{point.transportNotes || 'Confirm bypass details closer to date.'}</p>
    </div>
  )
}

function RouteMap({ route }: { route: RoutePoint[] }) {
  const maxKm = Math.max(...route.map((point) => point.km), 3008)

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Map</p>
          <h2 className="section-title">Schematic trail line</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(['milestone', 'section', 'highlight', 'resupply', 'rest', 'hazard'] satisfies RouteKind[]).map((kind) => (
            <span className="inline-flex items-center gap-2 rounded-sm border border-line px-2 py-1" key={kind}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: kindDot[kind] }} />
              {kind}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <svg className="min-h-[620px] min-w-[520px] rounded-md border border-line bg-bone" viewBox="0 0 520 620" role="img" aria-label="Schematic map of route waypoints across New Zealand">
          <path d="M214 32 C173 68 151 126 167 183 C181 232 158 270 134 312 C171 317 205 302 218 265 C237 213 267 177 251 123 C242 92 247 59 214 32Z" fill="#E5DCCD" stroke="#C9B9A5" strokeWidth="2" />
          <path d="M318 293 C267 336 237 392 252 452 C262 495 226 543 190 589 C259 574 324 527 353 461 C382 394 373 337 318 293Z" fill="#E5DCCD" stroke="#C9B9A5" strokeWidth="2" />
          <path d="M222 42 C208 122 201 193 188 280 C245 344 296 430 209 585" fill="none" stroke="#8F7D68" strokeDasharray="5 7" strokeWidth="2" />
          {route.map((point) => {
            const y = 42 + (point.km / maxKm) * 540
            const baseX = point.island === 'NI' ? 205 : 292
            const wobble = ((point.seq % 5) - 2) * 8
            return (
              <g key={point.id ?? point.seq}>
                <circle cx={baseX + wobble} cy={y} r={point.variant === 'main' ? 5 : 7} fill={kindDot[point.kind]} stroke={point.variant === 'main' ? '#F4EFE6' : '#9B3D1E'} strokeDasharray={point.variant === 'main' ? undefined : '3 3'} strokeWidth="2" />
                {(point.kind === 'milestone' || point.kind === 'hazard') && <text x={baseX + wobble + 10} y={y + 4} className="fill-ink text-[10px]">{point.name}</text>}
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}

function ElevationProfile({ elevation, route }: { elevation: ElevationPoint[]; route: RoutePoint[] }) {
  const width = 760
  const height = 320
  const padding = { top: 24, right: 32, bottom: 42, left: 54 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maxKm = 3008
  const maxElevation = 2000
  const x = (km: number) => padding.left + (km / maxKm) * plotWidth
  const y = (elevationM: number) => padding.top + plotHeight - (Math.min(elevationM, maxElevation) / maxElevation) * plotHeight
  const linePoints = elevation.map((point) => `${x(point.km)},${y(point.elevationM)}`).join(' ')
  const areaPoints = `${padding.left},${padding.top + plotHeight} ${linePoints} ${padding.left + plotWidth},${padding.top + plotHeight}`
  const hazards = route.filter((point) => point.kind === 'hazard')
  const resupplies = route.filter((point) => point.kind === 'resupply')

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Elevation</p>
          <h2 className="section-title">Approximate trail profile</h2>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-ink/60">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rust" /> profile</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 border-l border-dashed border-rust" /> hazard</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 bg-blue-700" /> resupply</span>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <svg className="min-w-[640px] rounded-md border border-line bg-bone" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Approximate Te Araroa elevation profile">
          {[1000, 2000].map((grid) => (
            <g key={grid}>
              <line x1={padding.left} x2={width - padding.right} y1={y(grid)} y2={y(grid)} stroke="#D8CDBD" strokeDasharray="5 6" />
              <text x={12} y={y(grid) + 4} className="fill-ink/60 text-[11px]">{grid}m</text>
            </g>
          ))}
          <line x1={padding.left} x2={width - padding.right} y1={padding.top + plotHeight} y2={padding.top + plotHeight} stroke="#8F7D68" />
          <line x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + plotHeight} stroke="#8F7D68" />
          <polygon points={areaPoints} fill="#B5651D" opacity="0.18" />
          <polyline points={linePoints} fill="none" stroke="#9B3D1E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {hazards.map((point) => (
            <g key={`hazard-${point.name}`}>
              <line x1={x(point.km)} x2={x(point.km)} y1={padding.top} y2={padding.top + plotHeight} stroke="#9B3D1E" strokeDasharray="5 6" strokeWidth="1.5" />
              <text x={x(point.km) + 4} y={padding.top + 14} className="fill-rust text-[10px]">{point.name}</text>
            </g>
          ))}
          {resupplies.map((point) => (
            <line key={`resupply-${point.name}`} x1={x(point.km)} x2={x(point.km)} y1={padding.top + plotHeight} y2={padding.top + plotHeight + 12} stroke="#1D4ED8" strokeWidth="2" />
          ))}
          {elevation.map((point, index) => (
            <g key={`${point.km}-${point.label}`}>
              <circle cx={x(point.km)} cy={y(point.elevationM)} r={point.label ? 4 : 2.5} fill={point.label ? '#9B3D1E' : '#B5651D'} />
              {point.label && (
                <text x={x(point.km) + (index % 2 === 0 ? 8 : -8)} y={y(point.elevationM) - (index % 3 === 0 ? 10 : 16)} textAnchor={index % 2 === 0 ? 'start' : 'end'} className="fill-ink text-[10px]">
                  <title>{point.label}</title>
                  {point.label}
                </text>
              )}
            </g>
          ))}
          {[0, 1000, 2000, 3008].map((km) => (
            <text key={km} x={x(km)} y={height - 16} textAnchor={km === 0 ? 'start' : km === 3008 ? 'end' : 'middle'} className="fill-ink/60 text-[11px]">{km} km</text>
          ))}
        </svg>
      </div>
      <p className="mt-3 text-sm text-ink/60">Approximate profile — heights/km are indicative, not survey data.</p>
    </section>
  )
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`rounded-sm border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${className}`}>{children}</span>
}

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-line bg-bone p-1">
      {options.map((option) => (
        <button className={`rounded px-3 py-1.5 text-sm font-semibold transition ${value === option ? 'bg-rust text-paper' : 'text-ink/65 hover:text-rust'}`} key={option} type="button" onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  )
}

function TasksView({ tasks, refresh }: { tasks: Task[]; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(workstreamOrder.map((stream) => [stream, true])))
  const [draft, setDraft] = useState<Partial<Task>>({ workstream: 'Fitness', title: '' })
  const grouped = groupBy(tasks, (task) => task.workstream)

  const addTask = async () => {
    if (!draft.title?.trim()) return
    await db.tasks.add({ workstream: draft.workstream as Workstream, title: draft.title.trim(), done: false, dueDate: draft.dueDate, notes: draft.notes })
    setDraft({ workstream: draft.workstream, title: '' })
    await refresh()
  }

  return (
    <section className="grid gap-5">
      <FormPanel title="Add task" kicker="Tasks">
        <select className="input" value={draft.workstream} onChange={(event) => setDraft({ ...draft, workstream: event.target.value as Workstream })}>
          {workstreamOrder.map((stream) => <option key={stream}>{stream}</option>)}
        </select>
        <input className="input sm:col-span-2" placeholder="Task title" value={draft.title ?? ''} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <input className="input" type="date" value={draft.dueDate ?? ''} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
        <input className="input sm:col-span-2" placeholder="Notes" value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        <button className="button-primary" type="button" onClick={addTask}>Add</button>
      </FormPanel>
      {workstreamOrder.map((stream) => (
        <section className="panel" key={stream}>
          <button className="flex w-full items-center justify-between text-left" type="button" onClick={() => setOpen({ ...open, [stream]: !open[stream] })}>
            <h2 className="font-serif text-2xl">{stream}</h2>
            <span className="text-sm text-rust">{grouped[stream]?.filter((task) => task.done).length ?? 0}/{grouped[stream]?.length ?? 0}</span>
          </button>
          {open[stream] && (
            <div className="mt-4 grid gap-3">
              {(grouped[stream] ?? []).map((task) => <TaskRow key={task.id} task={task} refresh={refresh} />)}
            </div>
          )}
        </section>
      ))}
    </section>
  )
}

function TaskRow({ task, refresh }: { task: Task; refresh: () => Promise<void> }) {
  const update = async (changes: Partial<Task>) => {
    if (!task.id) return
    await db.tasks.update(task.id, changes)
    await refresh()
  }

  return (
    <article className="grid gap-2 rounded-md border border-line bg-bone/40 p-3 md:grid-cols-[auto_1.2fr_0.5fr_1fr_auto] md:items-center">
      <input className="h-5 w-5 accent-sage" type="checkbox" checked={task.done} onChange={(event) => update({ done: event.target.checked })} aria-label={`Mark ${task.title} done`} />
      <input className={`input ${task.done ? 'text-ink/45 line-through' : ''}`} value={task.title} onChange={(event) => update({ title: event.target.value })} />
      <input className="input" type="date" value={task.dueDate ?? ''} onChange={(event) => update({ dueDate: event.target.value || undefined })} />
      <input className="input" placeholder="Notes" value={task.notes ?? ''} onChange={(event) => update({ notes: event.target.value })} />
      <button className="button-quiet" type="button" onClick={async () => task.id && db.tasks.delete(task.id).then(refresh)}>Delete</button>
    </article>
  )
}

function GearView({ gear, refresh }: { gear: GearItem[]; refresh: () => Promise<void> }) {
  const [draft, setDraft] = useState<GearItem>({ category: '', name: '', status: 'need' })
  const [filter, setFilter] = useState<GearFilter>('All')
  const visibleGear = gear.filter((item) => filter === 'All' || item.status === filter.toLowerCase())
  const visibleBaseGear = visibleGear.filter((item) => !item.optional)
  const visibleOptionalGear = visibleGear.filter((item) => item.optional)
  const grouped = groupBy(visibleBaseGear, (item) => item.category)
  const allGrouped = groupBy(gear.filter((item) => !item.optional), (item) => item.category)
  const categoryWeights = Object.fromEntries(Object.entries(allGrouped).map(([category, items]) => [category, packWeight(items)]))
  const overall = packWeight(gear)
  const optionalIfCarried = optionalWeight(gear)

  const add = async () => {
    if (!draft.category.trim() || !draft.name.trim()) return
    await db.gear.add({ ...draft, category: draft.category.trim(), name: draft.name.trim() })
    setDraft({ category: '', name: '', status: 'need' })
    await refresh()
  }

  return (
    <section className="grid gap-5">
      <FormPanel title={`Base pack weight ${compactKg(overall)} · optional if carried ${compactKg(optionalIfCarried)}`} kicker="Gear">
        <input className="input" placeholder="Category" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
        <input className="input" placeholder="Item name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        <input className="input" type="number" placeholder="Weight g" value={draft.weightG ?? ''} onChange={(event) => setDraft({ ...draft, weightG: event.target.value ? Number(event.target.value) : undefined })} />
        <select className="input" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as GearStatus })}>
          <option value="need">need</option>
          <option value="owned">owned</option>
          <option value="tested">tested</option>
        </select>
        <input className="input sm:col-span-2" placeholder="Notes" value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        <button className="button-primary" type="button" onClick={add}>Add</button>
      </FormPanel>
      <section className="panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-kicker">Filter</p>
          <p className="mt-1 text-sm text-ink/60">{visibleBaseGear.length} base + {visibleOptionalGear.length} optional of {gear.length} gear items shown</p>
        </div>
        <Segmented options={gearFilters} value={filter} onChange={(value) => setFilter(value as GearFilter)} />
      </section>
      {Object.entries(grouped).map(([category, items]) => (
        <section className="panel" key={category}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-2xl">{category}</h2>
            <p className="text-sm text-ink/60">{compactKg(categoryWeights[category])}</p>
          </div>
          <div className="mt-4 grid gap-3">
            {items.map((item) => <GearRow item={item} key={item.id} refresh={refresh} />)}
          </div>
        </section>
      ))}
      {visibleOptionalGear.length > 0 && (
        <section className="panel border-dashed bg-paper/55 text-ink/70">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <p className="section-kicker">Optional</p>
              <h2 className="font-serif text-xl">Optional / luxury (bounce, don't carry)</h2>
            </div>
            <p className="text-sm text-ink/55">{compactKg(optionalIfCarried)} if carried</p>
          </div>
          <div className="mt-4 grid gap-2">
            {visibleOptionalGear.map((item) => <GearRow item={item} key={item.id} refresh={refresh} optional />)}
          </div>
        </section>
      )}
    </section>
  )
}

function packWeight(items: GearItem[]) {
  return items.filter((item) => !item.optional && item.status !== 'need').reduce((sum, item) => sum + (item.weightG ?? 0), 0)
}

function optionalWeight(items: GearItem[]) {
  return items.filter((item) => item.optional && item.status !== 'need').reduce((sum, item) => sum + (item.weightG ?? 0), 0)
}

function GearRow({ item, refresh, optional = false }: { item: GearItem; refresh: () => Promise<void>; optional?: boolean }) {
  const update = async (changes: Partial<GearItem>) => {
    if (!item.id) return
    await db.gear.update(item.id, changes)
    await refresh()
  }

  return (
    <article className={`grid gap-2 rounded-md border border-line bg-bone/40 p-3 lg:grid-cols-[1fr_0.45fr_0.45fr_1fr_auto] ${optional ? 'text-sm opacity-80' : ''}`}>
      <input className="input" value={item.name} onChange={(event) => update({ name: event.target.value })} />
      <input className="input" type="number" placeholder="grams" value={item.weightG ?? ''} onChange={(event) => update({ weightG: event.target.value ? Number(event.target.value) : undefined })} />
      <select className="input" value={item.status} onChange={(event) => update({ status: event.target.value as GearStatus })}>
        <option value="need">need</option>
        <option value="owned">owned</option>
        <option value="tested">tested</option>
      </select>
      <input className="input" placeholder="Notes" value={item.notes ?? ''} onChange={(event) => update({ notes: event.target.value })} />
      <button className="button-quiet" type="button" onClick={async () => item.id && db.gear.delete(item.id).then(refresh)}>Delete</button>
    </article>
  )
}

function FundView({ data, stats, refresh }: { data: AppData; stats: Stats; refresh: () => Promise<void> }) {
  const [draft, setDraft] = useState<FundContribution>({ date: todayIso(), amountNZD: 0, note: '' })
  const progress = Math.min((stats.saved / Math.max(stats.target, 1)) * 100, 100)

  const add = async () => {
    if (!draft.amountNZD) return
    await db.fund.add(draft)
    setDraft({ date: todayIso(), amountNZD: 0, note: '' })
    await refresh()
  }

  return (
    <section className="grid gap-5">
      <section className="panel">
        <p className="section-kicker">Fund</p>
        <h2 className="section-title">{currency.format(stats.saved)} saved toward {currency.format(stats.target)}</h2>
        <div className="mt-4 h-3 rounded-full border border-line bg-bone">
          <div className="h-full rounded-full bg-fern" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-sm text-ink/60">{currency.format(stats.requiredMonthly)} per month needed by {data.settings.departureDate}</p>
      </section>
      <FormPanel title="Add contribution" kicker="Log">
        <input className="input" type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        <input className="input" type="number" value={draft.amountNZD || ''} placeholder="Amount NZD" onChange={(event) => setDraft({ ...draft, amountNZD: Number(event.target.value) })} />
        <input className="input sm:col-span-2" placeholder="Note" value={draft.note ?? ''} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
        <button className="button-primary" type="button" onClick={add}>Add</button>
      </FormPanel>
      <div className="panel grid gap-3">
        {data.fund.length === 0 && <p className="text-sm text-ink/60">No contributions yet.</p>}
        {data.fund.map((item) => (
          <article className="grid gap-2 rounded-md border border-line bg-bone/40 p-3 sm:grid-cols-[0.8fr_0.8fr_1fr_auto] sm:items-center" key={item.id}>
            <span>{item.date}</span>
            <strong>{currency.format(item.amountNZD)}</strong>
            <span className="text-sm text-ink/60">{item.note}</span>
            <button className="button-quiet" type="button" onClick={async () => item.id && db.fund.delete(item.id).then(refresh)}>Delete</button>
          </article>
        ))}
      </div>
    </section>
  )
}

function ResupplyView({ points, refresh }: { points: ResupplyPoint[]; refresh: () => Promise<void> }) {
  const [filter, setFilter] = useState<ResupplyFilter>('All')
  const visiblePoints = points.filter((point) => {
    if (filter === 'Mail-a-box') return point.mailBox
    if (filter === 'Rest towns') return point.restTown
    if (filter === 'South Is') return point.island === 'SI'
    return true
  })

  return (
    <section className="grid gap-5">
      <section className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker">Resupply</p>
            <h2 className="section-title">Town, box, and carry plan</h2>
            <p className="mt-2 text-sm text-ink/60">{visiblePoints.length} of {points.length} resupply points shown</p>
          </div>
          <Segmented options={resupplyFilters} value={filter} onChange={(value) => setFilter(value as ResupplyFilter)} />
        </div>
      </section>
      <section className="panel">
        <div className="grid gap-3">
          {visiblePoints.map((point) => <ResupplyRow point={point} key={point.id} refresh={refresh} />)}
        </div>
      </section>
    </section>
  )
}

function ResupplyRow({ point, refresh }: { point: ResupplyPoint; refresh: () => Promise<void> }) {
  const update = async (changes: Partial<ResupplyPoint>) => {
    if (!point.id) return
    await db.resupply.update(point.id, changes)
    await refresh()
  }

  return (
    <article className="grid gap-2 rounded-md border border-line bg-bone/40 p-3 lg:grid-cols-[0.9fr_0.25fr_0.45fr_0.55fr_0.5fr_0.55fr_1.5fr] lg:items-center">
      <div>
        <strong>{point.name}</strong>
        <p className="text-xs text-ink/50">km {number.format(point.kmMark)}</p>
      </div>
      <span className="rounded-sm border border-line px-2 py-1 text-center text-sm">{point.island}</span>
      <select className="input" value={point.storeType} onChange={(event) => update({ storeType: event.target.value as StoreType })}>
        {(['supermarket', 'foursquare', 'alpine-store', 'mail-box'] satisfies StoreType[]).map((store) => <option key={store} value={store}>{store}</option>)}
      </select>
      <label className="inline-flex items-center gap-2 text-sm">
        <input className="accent-sage" type="checkbox" checked={point.mailBox} onChange={(event) => update({ mailBox: event.target.checked })} />
        Mail box
      </label>
      <label className="inline-flex items-center gap-2 text-sm">
        <input className="accent-sage" type="checkbox" checked={point.restTown} onChange={(event) => update({ restTown: event.target.checked })} />
        Rest
      </label>
      <input className="input" placeholder="Carry days" value={point.carryDays} onChange={(event) => update({ carryDays: event.target.value })} />
      <input className="input" value={point.notes ?? ''} onChange={(event) => update({ notes: event.target.value })} />
    </article>
  )
}

function TrainingView({ entries, refresh }: { entries: TrainingEntry[]; refresh: () => Promise<void> }) {
  const [draft, setDraft] = useState<TrainingEntry>({ date: todayIso(), distanceKm: 0, notes: '' })
  const total = entries.reduce((sum, entry) => sum + entry.distanceKm, 0)
  const max = Math.max(...entries.map((entry) => entry.distanceKm), 1)

  const add = async () => {
    if (!draft.distanceKm) return
    await db.training.add(draft)
    setDraft({ date: todayIso(), distanceKm: 0, notes: '' })
    await refresh()
  }

  return (
    <section className="grid gap-5">
      <FormPanel title={`${total.toFixed(1)} km cumulative`} kicker="Training">
        <input className="input" type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        <input className="input" type="number" placeholder="Distance km" value={draft.distanceKm || ''} onChange={(event) => setDraft({ ...draft, distanceKm: Number(event.target.value) })} />
        <input className="input" type="number" placeholder="Pack kg" value={draft.packKg ?? ''} onChange={(event) => setDraft({ ...draft, packKg: event.target.value ? Number(event.target.value) : undefined })} />
        <input className="input" type="number" placeholder="Elevation m" value={draft.elevationM ?? ''} onChange={(event) => setDraft({ ...draft, elevationM: event.target.value ? Number(event.target.value) : undefined })} />
        <input className="input sm:col-span-2" placeholder="Notes" value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        <button className="button-primary" type="button" onClick={add}>Add</button>
      </FormPanel>
      <section className="panel">
        <p className="section-kicker">Distance over time</p>
        <div className="mt-5 flex h-48 items-end gap-2 border-b border-line">
          {entries.length === 0 && <p className="self-center text-sm text-ink/60">No training logged yet.</p>}
          {entries.map((entry) => (
            <div className="flex flex-1 flex-col items-center gap-2" key={entry.id}>
              <div className="w-full rounded-t-sm bg-teal" style={{ height: `${Math.max((entry.distanceKm / max) * 100, 4)}%` }} title={`${entry.distanceKm} km`} />
              <span className="hidden text-[10px] text-ink/50 sm:block">{entry.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel grid gap-3">
        {entries.map((entry) => (
          <article className="grid gap-2 rounded-md border border-line bg-bone/40 p-3 sm:grid-cols-[0.7fr_0.6fr_0.6fr_0.6fr_1fr_auto] sm:items-center" key={entry.id}>
            <span>{entry.date}</span>
            <strong>{entry.distanceKm} km</strong>
            <span>{entry.packKg ? `${entry.packKg} kg` : ''}</span>
            <span>{entry.elevationM ? `${entry.elevationM} m` : ''}</span>
            <span className="text-sm text-ink/60">{entry.notes}</span>
            <button className="button-quiet" type="button" onClick={async () => entry.id && db.training.delete(entry.id).then(refresh)}>Delete</button>
          </article>
        ))}
      </section>
    </section>
  )
}

function FormPanel({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <p className="section-kicker">{kicker}</p>
      <h2 className="section-title">{title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink/50">
      {label}
      {children}
    </label>
  )
}

export default App
