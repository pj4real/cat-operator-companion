// Ravi's demo day. One operator, one machine (Cat 320 excavator, EXC001).
export const operator = {
  id: 'OP1001',
  name: 'Ravi Kumar',
  role: 'Excavator Operator · Level 2',
  language: 'Hindi',
  site: 'NH-48 widening, Sriperumbudur',
  shift: '07:00 – 19:00',
  usualPattern: 'ISO',
  passport: { hours: 1412, machines: 3, noStrikeDays: 41, level: 2, nextLevelPct: 68 },
  weekHours: [
    { day: 'Mon', h: 10.2, ot: 0.2 },
    { day: 'Tue', h: 10.6, ot: 0.6 },
    { day: 'Wed', h: 9.8, ot: 0 },
    { day: 'Thu', h: 11.1, ot: 1.1 },
    { day: 'Fri', h: 0, ot: 0 },
  ],
}

export const machine = {
  id: 'EXC001',
  model: 'Cat 320',
  owner: 'Rental · Sri Balaji Earthmovers',
  pattern: 'SAE',
  engineHours: 1530.2,
  fuelPct: 38,
  serviceDueIn: 12,
}

// Tasks for today. The P10/P50/P90 comes from the ML API (fallback values below).
export const tasks = [
  {
    id: 'T101', title: 'Trenching for OFC duct, Zone B', zone: 'B', start: '07:30',
    input: { task_type: 'Trenching', weather: 'Cloudy', operator_skill: 'Intermediate', soil: 'Clay',
      machine_age_yrs: 4, ambient_temp_c: 31, volume_m3: 110, planner_estimate_min: 50 },
    fallback: { p10: 58, p50: 64, p90: 71, reasons: [{ factor: 'Soil', value: 'Clay', minutes: 8 }] },
    note: 'Moved before 13:00 rain',
  },
  {
    id: 'T102', title: 'Load spoil into dumpers, Bay 2', zone: 'A', start: '09:00',
    input: { task_type: 'Material Loading', weather: 'Sunny', operator_skill: 'Intermediate', soil: 'Loam',
      machine_age_yrs: 4, ambient_temp_c: 36, volume_m3: 180, planner_estimate_min: 50 },
    fallback: { p10: 52, p50: 57, p90: 63, reasons: [{ factor: 'Operator skill', value: 'Intermediate', minutes: 5 }] },
  },
  {
    id: 'T103', title: 'Grade shoulder, chainage 4+200', zone: 'C', start: '14:30',
    input: { task_type: 'Grading', weather: 'Rainy', operator_skill: 'Intermediate', soil: 'Loam',
      machine_age_yrs: 4, ambient_temp_c: 29, volume_m3: 120, planner_estimate_min: 42 },
    fallback: { p10: 48, p50: 54, p90: 61, reasons: [{ factor: 'Weather', value: 'Rainy', minutes: 7 }] },
    note: 'Rain likely 13:00–15:00',
  },
]

export const briefing = [
  { icon: 'cable', text: 'Fibre route (Call Before u Dig) at 1.2 m in Zone B. Depth limit will be set to 0.9 m.' },
  { icon: 'zap', text: '11 kV line over the haul road. Height limit 6 m near the poles.' },
  { icon: 'users', text: '2 new labourers on site (Day 3). Shown with a green ring on your map.' },
  { icon: 'sun', text: 'Heat index 41 °C at 14:00. Heat rest 13:00–13:40, engine off, shade at Bay 1.' },
]

export const lessons = [
  { title: 'Restart after a long idle: seat, belt, look', from: 'Yesterday 10:35 · belt off at restart', mins: 1.5, done: false },
  { title: 'Loading on a slope: bucket low while tracking', from: 'Yesterday 15:10 · travel with raised bucket', mins: 2, done: false },
  { title: 'Working near buried utilities', from: 'Site rule · Zone B', mins: 3, done: true },
]

// aggregates for the dashboard KPI tiles and charts (this week, EXC001)
export const weeklyStats = {
  utilizationPct: 63,
  idlePct: 37,
  idleFuelL: 41.6,
  idleCostINR: 3744,
  safetyScore: 96,
  incidentsThisWeek: 0,
}

// idle minutes by ML-classified reason, this week -- feeds the idle-reason donut
export const idleBreakdown = [
  { reason: 'Waiting for truck', pct: 44 },
  { reason: 'Heat rest', pct: 19 },
  { reason: 'Warm-up', pct: 13 },
  { reason: 'Cool-down', pct: 9 },
  { reason: 'No reason found', pct: 15 },
]

// simplified top-down site layout for the map widget (viewBox 0 0 100 60).
// Coordinates are spaced so marker halos and labels don't overlap each other
// or the zone corner labels -- checked by hand, not just "looks roughly right".
export const siteMap = {
  zones: [
    { id: 'A', label: 'Bay 2 · Loading', x: 4, y: 36, w: 22, h: 20, tone: 'neutral' },
    { id: 'B', label: 'Zone B · Trenching (fibre)', x: 32, y: 8, w: 34, h: 24, tone: 'hazard' },
    { id: 'C', label: 'Zone C · Grading', x: 70, y: 32, w: 24, h: 22, tone: 'neutral' },
  ],
  powerline: { y: 4, poles: [18, 50, 84] },
  fibre: [[35, 20], [61, 17]],
  excavator: { x: 49, y: 24 },
  dumper: { x: 12, y: 46 },
  workers: [{ x: 58, y: 27, tag: 'Day 3 · Suresh' }, { x: 61, y: 30, tag: 'Day 3 · Anbu' }],
  heatRest: { x: 20, y: 40, label: 'Heat rest · Bay 1' },
}

export const hourly = [
  // matches the format of the official telemetry sample
  { time: '08:00', fuel: 5.2, cycles: 12, idle: 30, belt: 'Fastened', alert: 'No' },
  { time: '10:00', fuel: 3.8, cycles: 2, idle: 55, belt: 'Unfastened', alert: 'Yes' },
  { time: '14:00', fuel: 6.1, cycles: 10, idle: 15, belt: 'Fastened', alert: 'No' },
  { time: '2025-05-02 09:00', fuel: 2.0, cycles: 1, idle: 60, belt: 'Unfastened', alert: 'Yes' },
]
