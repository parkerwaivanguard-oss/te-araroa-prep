import Dexie, { type Table } from 'dexie'

export type Workstream =
  | 'Fitness'
  | 'Gear'
  | 'Logistics'
  | 'Finance'
  | 'Life Admin'
  | 'Work / Leave'
  | 'On Trail'

export type GearStatus = 'need' | 'owned' | 'tested'
export type Island = 'NI' | 'SI'

export interface Task {
  id?: number
  workstream: Workstream
  title: string
  done: boolean
  dueDate?: string
  notes?: string
}

export interface GearItem {
  id?: number
  category: string
  name: string
  weightG?: number
  status: GearStatus
  notes?: string
}

export interface FundContribution {
  id?: number
  date: string
  amountNZD: number
  note?: string
}

export interface ResupplyPoint {
  id?: number
  name: string
  island: Island
  mailBox: boolean
  daysFood?: number
  notes?: string
}

export interface TrainingEntry {
  id?: number
  date: string
  distanceKm: number
  packKg?: number
  elevationM?: number
  notes?: string
}

export interface AppSettings {
  id: 'app'
  fundTargetNZD: number
  departureDate: string
  finishDate: string
}

export interface WorkstreamWindow {
  name: Workstream
  group: 'prep' | 'finance' | 'life' | 'on-trail'
  color: 'teal' | 'fern' | 'coral' | 'amber'
  start: string
  end: string
}

export class TaPrepDatabase extends Dexie {
  tasks!: Table<Task, number>
  gear!: Table<GearItem, number>
  fund!: Table<FundContribution, number>
  resupply!: Table<ResupplyPoint, number>
  training!: Table<TrainingEntry, number>
  settings!: Table<AppSettings, string>

  constructor() {
    super('ta-prep')
    this.version(1).stores({
      tasks: '++id, workstream, done, dueDate',
      gear: '++id, category, status',
      fund: '++id, date',
      resupply: '++id, island, mailBox',
      training: '++id, date',
      settings: 'id',
    })
  }
}

export const db = new TaPrepDatabase()

export const defaultSettings: AppSettings = {
  id: 'app',
  fundTargetNZD: 12000,
  departureDate: '2027-11-01',
  finishDate: '2028-04-01',
}

export const workstreams: WorkstreamWindow[] = [
  { name: 'Fitness', group: 'prep', color: 'teal', start: '2026-07', end: '2027-11' },
  { name: 'Gear', group: 'prep', color: 'teal', start: '2026-07', end: '2027-10' },
  { name: 'Logistics', group: 'prep', color: 'teal', start: '2027-07', end: '2027-10' },
  { name: 'Finance', group: 'finance', color: 'fern', start: '2026-07', end: '2027-11' },
  { name: 'Life Admin', group: 'life', color: 'coral', start: '2027-01', end: '2027-10' },
  { name: 'Work / Leave', group: 'life', color: 'coral', start: '2027-01', end: '2027-07' },
  { name: 'On Trail', group: 'on-trail', color: 'amber', start: '2027-11', end: '2028-04' },
]

export const seedTasks: Task[] = [
  ['Fitness', 'Monthly loaded overnight backpacking trip (start now)'],
  ['Fitness', 'Ramp to 3-5 day loaded multi-day walks (H1 2027)'],
  ['Fitness', 'Bibbulmun Track section hikes as TA dress rehearsal'],
  ['Fitness', 'Train trail-leg adaptation early (plan low daily km first 3 weeks)'],
  ['Gear', 'Research lightweight setup (shelter / sleep / pack)'],
  ['Gear', 'Buy core kit (H1 2027)'],
  ['Gear', 'Field-test all gear wet + loaded on Bibbulmun'],
  ['Gear', 'Finalise kit + stock consumable spares (shoes, socks, water filter)'],
  ['Logistics', 'Register on Te Araroa website + donate (~$500/island)'],
  ['Logistics', 'Buy Trail Pass (DOC huts + campsites discount)'],
  ['Logistics', 'Book flights Perth to Auckland + Cape Reinga transfer'],
  ['Logistics', 'Plan resupply boxes for remote South Island sections'],
  ['Finance', 'Open dedicated "TA Fund" account'],
  ['Finance', 'Reach NZD 12,000 target by departure'],
  ['Finance', 'Keep daily spend cap; route savings into TA Fund'],
  ['Finance', 'Ring-fence TA Fund from the Melbourne deposit pool'],
  ['Life Admin', 'Care plan for mother Li Ying: emergency contacts, medical, financial proxy [HIGH PRIORITY]'],
  ['Life Admin', 'Advance HK Sha Tin dispute to "no live presence needed" / brief proxy lawyer (caveat already registered)'],
  ['Life Admin', 'Set Parallax Locus / SLR products / Azure to run unattended 5 months (or pause cleanly)'],
  ['Life Admin', 'Confirm PR travel facility valid past return date (PR granted Feb 2026)'],
  ['Life Admin', 'Note WA 190 "live in WA" commitment window (~to Feb 2028): low risk'],
  ['Work / Leave', 'Open SLR leave / sabbatical conversation (H1 2027)'],
  ['Work / Leave', 'Bundle leave into PM-title + DD-platform (Path A) negotiation'],
  ['Work / Leave', 'Frame as "recharge, return to lead product" with Pete & Rob'],
  ['On Trail', 'Depart Cape Reinga ~1 Nov 2027 (southbound)'],
  ['On Trail', 'Reach Bluff before April 2028'],
  ['On Trail', '~4-6 months, 3,000 km'],
].map(([workstream, title]) => ({ workstream: workstream as Workstream, title, done: false }))

export const seedResupply: ResupplyPoint[] = [
  { name: 'Havelock', island: 'SI', mailBox: true, notes: 'Limited supplies: mail a box' },
  { name: 'St Arnaud', island: 'SI', mailBox: true, daysFood: 8, notes: 'Start of long Richmond/Nelson Lakes carry' },
  { name: 'Boyle Village', island: 'SI', mailBox: true, notes: 'Remote: mail a box' },
  { name: 'Arthurs Pass', island: 'SI', mailBox: true, notes: 'Limited resupply: mail a box' },
  { name: 'Picton', island: 'SI', mailBox: false, notes: 'Last major supermarket before ~900 km gap to Wanaka' },
  { name: 'Wanaka', island: 'SI', mailBox: false, notes: 'Next big supermarket after Picton gap' },
]

export const seedGear: GearItem[] = [
  ['Shelter', 'Tent / shelter'],
  ['Sleep', 'Sleeping bag/quilt'],
  ['Sleep', 'Sleeping mat'],
  ['Pack', 'Backpack'],
  ['Clothing', 'Rain shell'],
  ['Clothing', 'Insulation layer'],
  ['Clothing', 'Base layers'],
  ['Footwear', 'Trail runners'],
  ['Cook', 'Stove'],
  ['Cook', 'Pot'],
  ['Water', 'Water filter'],
  ['Electronics', 'Phone'],
  ['Electronics', 'Power bank'],
  ['Electronics', 'Headlamp'],
  ['Electronics', 'PLB / satellite messenger'],
  ['First aid', 'First aid kit'],
].map(([category, name]) => ({ category, name, status: 'need' as GearStatus }))

export async function resetToSeed() {
  await db.transaction('rw', [db.tasks, db.gear, db.fund, db.resupply, db.training, db.settings], async () => {
    await Promise.all([
      db.tasks.clear(),
      db.gear.clear(),
      db.fund.clear(),
      db.resupply.clear(),
      db.training.clear(),
      db.settings.clear(),
    ])
    await db.settings.put(defaultSettings)
    await db.tasks.bulkAdd(seedTasks)
    await db.gear.bulkAdd(seedGear)
    await db.resupply.bulkAdd(seedResupply)
  })
}

export async function ensureSeeded() {
  const taskCount = await db.tasks.count()
  if (taskCount === 0) {
    await resetToSeed()
  } else {
    await db.settings.put({ ...defaultSettings, ...((await db.settings.get('app')) ?? {}) })
  }
}
