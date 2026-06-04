import Dexie, { type Table } from 'dexie'

export type Workstream = 'Fitness' | 'Gear' | 'Logistics' | 'Finance' | 'Life Admin' | 'Work / Leave' | 'On Trail'
export type GearStatus = 'need' | 'owned' | 'tested'
export type Island = 'NI' | 'SI'
export type RouteKind = 'milestone' | 'section' | 'highlight' | 'resupply' | 'rest' | 'hazard'
export type RouteVariant = 'main' | 'alternate' | 'sidetrip'
export type Difficulty = 'easy' | 'moderate' | 'hard' | 'alpine'
export type StoreType = 'supermarket' | 'foursquare' | 'alpine-store' | 'mail-box'

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
  kmMark: number
  storeType: StoreType
  mailBox: boolean
  restTown: boolean
  carryDays: string
  notes?: string
}

export interface RoutePoint {
  id?: number
  seq: number
  name: string
  island: Island
  region: string
  kind: RouteKind
  km: number
  difficulty: Difficulty
  variant: RouteVariant
  done: boolean
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
  seedVersion: number
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
  route!: Table<RoutePoint, number>

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
    this.version(2).stores({
      tasks: '++id, workstream, done, dueDate',
      gear: '++id, category, status',
      fund: '++id, date',
      resupply: '++id, island, mailBox, restTown, storeType, kmMark',
      training: '++id, date',
      settings: 'id',
      route: '++id, seq, island, kind, variant, done',
    })
  }
}

export const db = new TaPrepDatabase()

export const defaultSettings: AppSettings = {
  id: 'app',
  fundTargetNZD: 12000,
  departureDate: '2027-11-01',
  finishDate: '2028-04-01',
  seedVersion: 2,
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

export const seedRoute: RoutePoint[] = [
  [1, 'Cape Reinga', 'NI', 'Northland', 'milestone', 0, 'easy', 'main', 'Southbound start. Lighthouse, two oceans meet, Māori sacred site.'],
  [2, 'Ninety Mile Beach', 'NI', 'Northland', 'highlight', 20, 'moderate', 'main', '88km continuous sand. Epic sunsets, sore feet.'],
  [3, 'Kerikeri / Paihia', 'NI', 'Northland', 'resupply', 220, 'easy', 'main', 'Bay of Islands. Good resupply + rest.'],
  [4, 'Whananaki', 'NI', 'Northland', 'highlight', 300, 'easy', 'main', 'Longest footbridge in southern hemisphere; coastal views.'],
  [5, 'Auckland', 'NI', 'Auckland', 'rest', 600, 'easy', 'main', 'Big city. Full resupply, gear, zero day.'],
  [6, 'Hamilton', 'NI', 'Waikato', 'resupply', 800, 'easy', 'main', 'Full resupply. (Auckland to Hamilton has long road/town walking: meh section.)'],
  [7, 'Pureora / Timber Trail', 'NI', 'Waikato', 'section', 1080, 'moderate', 'main', 'Forest. Timber Trail is a stunning 2-day ride/walk.'],
  [8, 'Tongariro Alpine Crossing', 'NI', 'Ruapehu', 'highlight', 1150, 'hard', 'main', 'Volcanic craters, emerald lakes. Most famous day-walk in NZ.'],
  [9, 'Round the Mountain (Ruapehu)', 'NI', 'Ruapehu', 'highlight', 1150, 'hard', 'sidetrip', 'Popular side trip; circles Mt Ruapehu. Fit hikers ~2-3 days.'],
  [10, 'Whanganui River (canoe)', 'NI', 'Whanganui', 'highlight', 1250, 'moderate', 'main', 'Only paddle section. 3-5 day canoe journey. Book operator in advance.'],
  [11, 'Palmerston North', 'NI', 'Manawatū', 'resupply', 1500, 'easy', 'main', 'Full supermarkets + outdoor stores. Good place to post SI resupply boxes.'],
  [12, 'Tararua Range', 'NI', 'Wellington', 'section', 1600, 'hard', 'main', 'Goblin forest + exposed alpine. Notorious weather: carry extra food.'],
  [13, 'Wellington', 'NI', 'Wellington', 'rest', 1700, 'easy', 'main', 'NI finish. Last big gear stores. Book Cook Strait ferry. Post SI boxes here.'],
  [14, 'Queen Charlotte Track', 'SI', 'Marlborough', 'highlight', 1700, 'easy', 'main', 'SI opener. Bays, dolphins; water-taxi can carry your pack.'],
  [15, 'Havelock', 'SI', 'Marlborough', 'resupply', 1785, 'easy', 'main', 'Four Square. Start of the big Richmond carry. Sort QCT permit/ferry at i-SITE.'],
  [16, 'Richmond Range to St Arnaud', 'SI', 'Nelson', 'section', 1900, 'hard', 'main', 'Longest carry on trail. ~8-10 days food. Steep, exposed, remote.'],
  [17, 'Red Hills Ridgeline', 'SI', 'Nelson', 'section', 1900, 'alpine', 'alternate', 'Cuts ~29km for 19km of ridge scrambling. Better views than the valley. Exposed: check weather.'],
  [18, 'St Arnaud / Nelson Lakes', 'SI', 'Nelson', 'resupply', 2030, 'easy', 'main', 'MAIL A BOX (alpine store only). Stunning glacial lakes.'],
  [19, 'Waiau Pass', 'SI', 'Nelson/Lewis', 'section', 2100, 'alpine', 'main', '2nd highest point (1,870m). Technical alpine: experienced only. Snow/ice can linger to Dec.'],
  [20, 'Boyle Village', 'SI', 'Canterbury', 'resupply', 2180, 'easy', 'main', 'MAIL A BOX. Remote.'],
  [21, 'Harper Pass', 'SI', 'Canterbury', 'section', 2230, 'hard', 'main', 'Historic Southern Alps crossing. River crossings; carry GPS. Hot pool near Hurunui Hut.'],
  [22, "Arthur's Pass", 'SI', 'Canterbury', 'resupply', 2300, 'easy', 'main', 'MAIL A BOX (small alpine store). Possible exit to Greymouth/Christchurch.'],
  [23, 'Rakaia River', 'SI', 'Canterbury', 'hazard', 2360, 'alpine', 'main', 'HAZARD ZONE: do NOT ford. Bypass by vehicle via Methven (school bus / Methven Travel shuttle).'],
  [24, 'Lake Coleridge', 'SI', 'Canterbury', 'rest', 2300, 'easy', 'main', 'Camping/dorm just before village. Tricky transport around Rakaia.'],
  [25, 'Rangitata River', 'SI', 'Canterbury', 'hazard', 2420, 'alpine', 'main', 'HAZARD ZONE: do NOT ford. Bypass by vehicle. ~Hakatere Conservation Park detour.'],
  [26, 'Two Thumb Range / Stag Saddle', 'SI', 'Canterbury', 'highlight', 2500, 'hard', 'main', "Trail's HIGHEST point (~1,925m). Views to Lake Tekapo. Dark-sky reserve overhead."],
  [27, 'Stag Saddle Ridge Route', 'SI', 'Canterbury', 'highlight', 2500, 'alpine', 'alternate', 'Leave official trail at the saddle; ridge gives far better views, ~same length.'],
  [28, 'Lake Tekapo', 'SI', 'Canterbury', 'resupply', 2560, 'easy', 'main', 'Decent Four Square. Turquoise lake. Rest option.'],
  [29, 'Twizel', 'SI', 'Canterbury', 'resupply', 2615, 'easy', 'main', 'Two Four Squares, bakeries. Resupply.'],
  [30, 'Ahuriri River', 'SI', 'Otago', 'hazard', 2650, 'alpine', 'main', 'Big braided river: detour if high flow. Check ECAN river levels.'],
  [31, 'Breast Hill / Lake Hāwea', 'SI', 'Otago', 'highlight', 2700, 'hard', 'main', 'Demanding climb; ridge views over Lake Hāwea.'],
  [32, 'Wānaka', 'SI', 'Otago', 'rest', 2585, 'easy', 'main', 'New World. Beautiful lakeside town. Roys Peak side trip; #thattree.'],
  [33, 'Roys Peak', 'SI', 'Otago', 'highlight', 2585, 'moderate', 'sidetrip', 'Iconic viewpoint above Wānaka. Half-day side trip.'],
  [34, 'Motatapu Track', 'SI', 'Otago', 'section', 2640, 'hard', 'main', 'TA Trust favourite. Steep, remote tussock.'],
  [35, 'Arrowtown / Queenstown', 'SI', 'Otago', 'rest', 2680, 'easy', 'main', 'Full resupply + rest. Adventure-tourism hub.'],
  [36, 'Te Anau', 'SI', 'Southland', 'resupply', 2800, 'easy', 'main', 'Big Four Square. Gateway to Fiordland. Kepler Track side trip.'],
  [37, 'Kepler Track', 'SI', 'Southland', 'highlight', 2800, 'moderate', 'sidetrip', 'Great Walk; alpine + lake + river. Optional loop.'],
  [38, 'Takitimu / Aparima', 'SI', 'Southland', 'section', 2880, 'moderate', 'main', 'Forest + river valleys.'],
  [39, 'Riverton', 'SI', 'Southland', 'resupply', 2940, 'easy', 'main', 'Coastal resupply.'],
  [40, 'Invercargill', 'SI', 'Southland', 'resupply', 2975, 'easy', 'main', "PAK'nSAVE ~2km off trail. Last city."],
  [41, 'Bluff', 'SI', 'Southland', 'milestone', 3008, 'easy', 'main', 'FINISH. The signpost at Stirling Point.'],
].map(([seq, name, island, region, kind, km, difficulty, variant, notes]) => ({
  seq: seq as number,
  name: name as string,
  island: island as Island,
  region: region as string,
  kind: kind as RouteKind,
  km: km as number,
  difficulty: difficulty as Difficulty,
  variant: variant as RouteVariant,
  done: false,
  notes: notes as string,
}))

export const seedResupply: ResupplyPoint[] = [
  ['Kerikeri/Paihia', 'NI', 220, 'supermarket', false, true, '2-3', 'Good first proper resupply.'],
  ['Auckland', 'NI', 600, 'supermarket', false, true, '2-3', 'Full gear + supermarkets.'],
  ['Hamilton', 'NI', 800, 'supermarket', false, false, '2-3', 'Full resupply.'],
  ['Palmerston North', 'NI', 1500, 'supermarket', false, false, '2-3', 'Best place to POST South Island boxes.'],
  ['Wellington', 'NI', 1700, 'supermarket', false, true, '—', 'Last big gear stores; book ferry; post SI boxes.'],
  ['Havelock', 'SI', 1785, 'foursquare', false, false, '8-10', 'Stock up for the Richmond carry.'],
  ['St Arnaud', 'SI', 2030, 'alpine-store', true, false, '—', 'MAIL A BOX — tiny alpine store only.'],
  ['Boyle Village', 'SI', 2180, 'alpine-store', true, false, '—', 'MAIL A BOX — remote.'],
  ["Arthur's Pass", 'SI', 2300, 'alpine-store', true, false, '—', 'MAIL A BOX — small store; or exit to Greymouth/Chch.'],
  ['Lake Tekapo', 'SI', 2560, 'foursquare', false, true, '4-5', 'Good Four Square; rest option.'],
  ['Twizel', 'SI', 2615, 'foursquare', false, false, '4-5', 'Two Four Squares + bakeries.'],
  ['Wānaka', 'SI', 2585, 'supermarket', false, true, '4-5', 'New World; rest + side trips.'],
  ['Queenstown/Arrowtown', 'SI', 2680, 'supermarket', false, true, '4-5', 'Full resupply + rest.'],
  ['Te Anau', 'SI', 2800, 'foursquare', false, true, '4-5', 'Big Four Square; Fiordland gateway.'],
  ['Riverton', 'SI', 2940, 'foursquare', false, false, '2-3', 'Coastal resupply.'],
  ['Invercargill', 'SI', 2975, 'supermarket', false, false, '1-2', "PAK'nSAVE ~2km off trail; last city."],
].map(([name, island, kmMark, storeType, mailBox, restTown, carryDays, notes]) => ({
  name: name as string,
  island: island as Island,
  kmMark: kmMark as number,
  storeType: storeType as StoreType,
  mailBox: mailBox as boolean,
  restTown: restTown as boolean,
  carryDays: carryDays as string,
  notes: notes as string,
}))

export const seedGear: GearItem[] = [
  ['Pack', 'Backpack 50-60L', 1300, ''],
  ['Pack', 'Pack liner / dry bags', 120, 'Keep sleep + clothes dry.'],
  ['Pack', 'Trekking poles', 480, 'Big help on river crossings + descents.'],
  ['Shelter', 'Tent / shelter', 1100, 'Free-standing handy for hut overflow camping.'],
  ['Shelter', 'Tent stakes + guylines', 120, ''],
  ['Sleep', 'Sleeping bag/quilt (comfort ~0°C)', 800, 'Snow possible even in Jan.'],
  ['Sleep', 'Sleeping mat', 400, ''],
  ['Sleep', 'Inflatable pillow', 70, ''],
  ['Cook', 'Canister stove', 90, 'Gas sold at most resupply + outdoor stores.'],
  ['Cook', 'Pot 750ml', 130, ''],
  ['Cook', 'Lighter + backup', 30, ''],
  ['Cook', 'Spork', 15, ''],
  ['Water', 'Water filter (Sawyer)', 90, ''],
  ['Water', 'Dirty + clean bottles/bladder', 180, ''],
  ['Water', 'Backup purification tablets', 20, ''],
  ['Clothing (worn)', 'Trail runners', 0, 'Carry 1-2 spare pairs over the trip.'],
  ['Clothing (worn)', 'Hiking socks (x3)', 150, ''],
  ['Clothing (worn)', 'Shorts / hiking pants', 250, ''],
  ['Clothing (worn)', 'Sun shirt (long sleeve)', 180, ''],
  ['Clothing (worn)', 'Sun hat + sunglasses', 120, ''],
  ['Clothing (packed)', 'Rain jacket (quality)', 350, 'Non-negotiable: cold soaking rain is a hypothermia risk.'],
  ['Clothing (packed)', 'Rain pants', 220, ''],
  ['Clothing (packed)', 'Down/synthetic insulated jacket', 350, ''],
  ['Clothing (packed)', 'Thermal top + bottom', 350, ''],
  ['Clothing (packed)', 'Warm hat + gloves', 120, ''],
  ['Clothing (packed)', 'Gaiters', 160, 'Mud + scree.'],
  ['Electronics', 'Phone', 200, 'Primary nav (FarOut/Guthook).'],
  ['Electronics', 'Power bank 10000mAh', 220, ''],
  ['Electronics', 'Charging cables + plug', 120, ''],
  ['Electronics', 'Headlamp + spare battery', 90, ''],
  ['Electronics', 'PLB / satellite messenger', 110, 'ESSENTIAL: many remote no-signal sections.'],
  ['Navigation', 'FarOut/Guthook app + offline maps', 0, 'Download before remote sections.'],
  ['Navigation', 'Paper map / compass backup', 80, 'For Richmond, Harper, Waiau, alpine sections.'],
  ['Safety', 'First aid kit', 250, ''],
  ['Safety', 'Blister kit (tape, needle)', 60, ''],
  ['Safety', 'Emergency blanket + whistle', 70, ''],
  ['Toiletries', 'Sunscreen', 100, ''],
  ['Toiletries', 'Sandfly repellent (DEET) + head net', 90, 'NZ sandflies are relentless on the west/south.'],
  ['Toiletries', 'Toothbrush + paste', 60, ''],
  ['Toiletries', 'Trowel + TP + sanitiser', 120, ''],
  ['Docs/Admin', 'Passport + ID', 50, ''],
  ['Docs/Admin', 'TA Trail Pass (DOC huts/campsites)', 0, 'Buy before season; carry confirmation.'],
  ['Docs/Admin', 'Bank card + cash (NZD)', 30, ''],
  ['Docs/Admin', 'Travel + rescue insurance proof', 0, 'Confirm it covers backcountry + heli evac.'],
].map(([category, name, weightG, notes]) => ({
  category: category as string,
  name: name as string,
  weightG: weightG as number,
  notes: notes as string,
  status: 'need' as GearStatus,
}))

export async function resetToSeed() {
  await db.transaction('rw', [db.tasks, db.gear, db.fund, db.resupply, db.training, db.settings, db.route], async () => {
    await Promise.all([
      db.tasks.clear(),
      db.gear.clear(),
      db.fund.clear(),
      db.resupply.clear(),
      db.training.clear(),
      db.settings.clear(),
      db.route.clear(),
    ])
    await db.settings.put(defaultSettings)
    await db.tasks.bulkAdd(seedTasks)
    await db.gear.bulkAdd(seedGear)
    await db.resupply.bulkAdd(seedResupply)
    await db.route.bulkAdd(seedRoute)
  })
}

export async function upgradeSeedsToV2(settings: AppSettings) {
  await db.transaction('rw', [db.gear, db.resupply, db.route, db.settings], async () => {
    await Promise.all([db.gear.clear(), db.resupply.clear(), db.route.clear()])
    await db.gear.bulkAdd(seedGear)
    await db.resupply.bulkAdd(seedResupply)
    await db.route.bulkAdd(seedRoute)
    await db.settings.put({ ...defaultSettings, ...settings, seedVersion: 2 })
  })
}

export async function ensureSeeded() {
  const taskCount = await db.tasks.count()
  if (taskCount === 0) {
    await resetToSeed()
  } else {
    const settings = { ...defaultSettings, ...((await db.settings.get('app')) ?? {}) }
    if ((settings.seedVersion ?? 1) < 2 || (await db.route.count()) === 0) {
      await upgradeSeedsToV2(settings)
    } else {
      await db.settings.put(settings)
    }
  }
}
