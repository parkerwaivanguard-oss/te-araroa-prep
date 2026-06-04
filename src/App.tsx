import { useEffect, useMemo, useState } from 'react'
import {
  db,
  defaultSettings,
  ensureSeeded,
  resetToSeed,
  type AppSettings,
  type FundContribution,
  type GearItem,
  type GearStatus,
  type ResupplyPoint,
  type Task,
  type TrainingEntry,
  type Workstream,
  workstreams,
} from './db'

type Tab = 'Dashboard' | 'Tasks' | 'Gear' | 'Fund' | 'Resupply' | 'Training'

const tabs: Tab[] = ['Dashboard', 'Tasks', 'Gear', 'Fund', 'Resupply', 'Training']
const workstreamOrder = workstreams.map((stream) => stream.name)
const currency = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('en-NZ')
const todayIso = () => new Date().toISOString().slice(0, 10)
const barColorClass = {
  teal: 'bg-teal',
  fern: 'bg-fern',
  coral: 'bg-coral',
  amber: 'bg-amber',
}

interface AppData {
  tasks: Task[]
  gear: GearItem[]
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
}

const emptyData: AppData = {
  tasks: [],
  gear: [],
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

  const loadData = async () => {
    const [tasks, gear, fund, resupply, training, settings] = await Promise.all([
      db.tasks.orderBy('id').toArray(),
      db.gear.orderBy('id').toArray(),
      db.fund.orderBy('date').toArray(),
      db.resupply.orderBy('id').toArray(),
      db.training.orderBy('date').toArray(),
      db.settings.get('app'),
    ])
    setData({ tasks, gear, fund, resupply, training, settings: settings ?? defaultSettings })
  }

  useEffect(() => {
    ensureSeeded().then(loadData).finally(() => setLoading(false))
  }, [])

  const refresh = async () => {
    await loadData()
  }

  const stats = useMemo(() => {
    const doneTasks = data.tasks.filter((task) => task.done).length
    const saved = data.fund.reduce((sum, item) => sum + item.amountNZD, 0)
    const trainingKm = data.training.reduce((sum, item) => sum + item.distanceKm, 0)
    const target = data.settings.fundTargetNZD
    const remaining = Math.max(target - saved, 0)
    return {
      days: daysUntil(data.settings.departureDate),
      taskProgress: data.tasks.length ? Math.round((doneTasks / data.tasks.length) * 100) : 0,
      saved,
      target,
      requiredMonthly: remaining / monthsBetweenNow(data.settings.departureDate),
      trainingKm,
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
        {activeTab === 'Tasks' && <TasksView tasks={data.tasks} refresh={refresh} />}
        {activeTab === 'Gear' && <GearView gear={data.gear} refresh={refresh} />}
        {activeTab === 'Fund' && <FundView data={data} stats={stats} refresh={refresh} />}
        {activeTab === 'Resupply' && <ResupplyView points={data.resupply} refresh={refresh} />}
        {activeTab === 'Training' && <TrainingView entries={data.training} refresh={refresh} />}
      </div>
    </main>
  )
}

function Dashboard({ data, stats, refresh }: { data: AppData; stats: Stats; refresh: () => Promise<void> }) {
  return (
    <section className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Days to depart" value={stats.days.toString()} detail="Cape Reinga target" large />
        <Metric title="Prep progress" value={`${stats.taskProgress}%`} detail={`${data.tasks.filter((task) => task.done).length} of ${data.tasks.length} tasks`} />
        <Metric title="TA Fund" value={`${currency.format(stats.saved)} / ${currency.format(stats.target)}`} detail={`${currency.format(stats.requiredMonthly)} required per month`} />
        <Metric title="Training logged" value={`${stats.trainingKm.toFixed(1)} km`} detail="Cumulative distance" />
      </div>
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
  const grouped = groupBy(gear, (item) => item.category)
  const categoryWeights = Object.fromEntries(Object.entries(grouped).map(([category, items]) => [category, packWeight(items)]))
  const overall = packWeight(gear)

  const add = async () => {
    if (!draft.category.trim() || !draft.name.trim()) return
    await db.gear.add({ ...draft, category: draft.category.trim(), name: draft.name.trim() })
    setDraft({ category: '', name: '', status: 'need' })
    await refresh()
  }

  return (
    <section className="grid gap-5">
      <FormPanel title={`Pack weight ${compactKg(overall)}`} kicker="Gear">
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
    </section>
  )
}

function packWeight(items: GearItem[]) {
  return items.filter((item) => item.status !== 'need').reduce((sum, item) => sum + (item.weightG ?? 0), 0)
}

function GearRow({ item, refresh }: { item: GearItem; refresh: () => Promise<void> }) {
  const update = async (changes: Partial<GearItem>) => {
    if (!item.id) return
    await db.gear.update(item.id, changes)
    await refresh()
  }

  return (
    <article className="grid gap-2 rounded-md border border-line bg-bone/40 p-3 lg:grid-cols-[1fr_0.45fr_0.45fr_1fr_auto]">
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
  return (
    <section className="panel">
      <p className="section-kicker">Resupply</p>
      <h2 className="section-title">South Island focus points</h2>
      <div className="mt-5 grid gap-3">
        {points.map((point) => <ResupplyRow point={point} key={point.id} refresh={refresh} />)}
      </div>
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
    <article className="grid gap-2 rounded-md border border-line bg-bone/40 p-3 lg:grid-cols-[0.8fr_0.3fr_0.5fr_0.5fr_1.5fr] lg:items-center">
      <strong>{point.name}</strong>
      <span className="rounded-sm border border-line px-2 py-1 text-center text-sm">{point.island}</span>
      <label className="inline-flex items-center gap-2 text-sm">
        <input className="accent-sage" type="checkbox" checked={point.mailBox} onChange={(event) => update({ mailBox: event.target.checked })} />
        Mail box
      </label>
      <input className="input" type="number" placeholder="Days food" value={point.daysFood ?? ''} onChange={(event) => update({ daysFood: event.target.value ? Number(event.target.value) : undefined })} />
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
