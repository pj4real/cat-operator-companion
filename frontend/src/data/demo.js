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
  fuelL: 78,
  tankL: 345,
  fuelPct: 23,
  serviceDueIn: 12,
  // last night's sensor snapshot + S·O·S oil sample, input to the health model
  healthDay: { hyd_oil_temp_max: 79, coolant_temp_max: 88, engine_load_pct: 62, hrs_since_oil_change: 210,
    sos_iron_ppm: 29, sos_silicon_ppm: 24, sos_soot_pct: 0.7, sos_water_pct: 0.04, idle_pct: 30,
    fault_codes_7d: 1, machine_age_yrs: 4 },
  healthFallback: { risk_pct: 46, level: 'watch', component: 'Engine air intake',
    action: 'Check air filter and intake hoses: dust is getting into the engine',
    reasons: [{ factor: 'Silicon in oil', value: '24 ppm', usual: '8', points: 41 }] },
  fuelFallback: { runs_out_at: '14:43', refuel_before: 'T103', litres_planned: 71.1, co2_kg: 191, fuel_left_end_l: 6.9 },
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

export const hourly = [
  // matches the format of the official telemetry sample
  { time: '08:00', fuel: 5.2, cycles: 12, idle: 30, belt: 'Fastened', alert: 'No' },
  { time: '10:00', fuel: 3.8, cycles: 2, idle: 55, belt: 'Unfastened', alert: 'Yes' },
  { time: '14:00', fuel: 6.1, cycles: 10, idle: 15, belt: 'Fastened', alert: 'No' },
]
