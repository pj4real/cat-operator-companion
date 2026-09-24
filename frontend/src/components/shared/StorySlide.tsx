import { useEffect, useState, type ReactNode } from 'react'
import {
  ArrowRight, Brain, Camera, CircleCheck, Cpu, Database, Eye, Fuel, Gauge, HardHat, HeartPulse, Languages, Layers,
  LayoutDashboard, Lightbulb, Map, MessageSquareText, Mic, Moon, MonitorSmartphone, Radio, ShieldAlert, Smartphone, Sparkles,
  Sun, Tablet, Timer, TrendingDown, UserRound, Users, WifiOff, Wrench, type LucideIcon,
} from 'lucide-react'
import { DIESEL_INR, IDLE_BURN_LPH } from '@/lib/sim'
import { CHAPTERS, type SlideKind } from '@/lib/story'

// Slides always render light, whatever the app theme, on a fixed 1600×900 canvas scaled to the display.
const W = 1600
const H = 900
const INK = '#111214'
const INK2 = '#44474d'
const INK3 = '#80838a'
const LINE = '#e4e2da'
const PAPER = '#f7f6f2'
const CAT = '#ffcd11'

function useFit(bottomReserve: number) {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const s = Math.min(vp.w / W, (vp.h - bottomReserve) / H)
  return { s, x: (vp.w - W * s) / 2, y: Math.max(0, (vp.h - bottomReserve - H * s) / 2) }
}

const rise = (i: number) => ({ animation: `rise-in 900ms var(--ease-out) ${120 + i * 90}ms both` })

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3" style={rise(0)}>
      <span className="h-[3px] w-10" style={{ background: CAT }} />
      <span className="font-display text-[20px] font-semibold tracking-[0.18em] uppercase" style={{ color: INK3 }}>{children}</span>
    </div>
  )
}

function Headline({ children, size = 68 }: { children: ReactNode; size?: number }) {
  return (
    <h1 className="mt-5 max-w-[1250px] font-display leading-[1.02] font-bold tracking-[-0.01em]"
      style={{ fontSize: size, color: INK, ...rise(1) }}>{children}</h1>
  )
}

function Mark({ children }: { children: ReactNode }) {
  return <span style={{ background: `linear-gradient(transparent 62%, ${CAT} 62%, ${CAT} 92%, transparent 92%)` }}>{children}</span>
}

function Card({ children, i = 2, className = '', style }: { children: ReactNode; i?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-[18px] bg-white p-7 ${className}`}
      style={{ boxShadow: '0 1px 0 rgb(0 0 0 / 0.04), 0 18px 40px -24px rgb(17 18 20 / 0.28)', border: `1px solid ${LINE}`, ...rise(i), ...style }}>
      {children}
    </div>
  )
}

function IconBox({ icon: Icon, dark }: { icon: LucideIcon; dark?: boolean }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
      style={{ background: dark ? INK : '#fff4c2', color: dark ? CAT : INK }}>
      <Icon size={24} strokeWidth={2} />
    </span>
  )
}

function Chip({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[17px] font-medium"
      style={dark ? { background: INK, color: '#fff' } : { background: '#fff', color: INK2, border: `1px solid ${LINE}` }}>{children}</span>
  )
}

/* ------------------------------------------------------------------ slides */

function TitleSlide() {
  return (
    <div className="grid h-full grid-cols-[1fr_620px] items-center gap-10">
      <div>
        <Eyebrow>Caterpillar hackathon 2026 · Smart operator assistant</Eyebrow>
        <h1 className="mt-6 font-display text-[124px] leading-[0.92] font-bold tracking-[-0.02em]" style={{ color: INK, ...rise(1) }}>
          Operator<br />Companion
        </h1>
        <p className="mt-8 max-w-[760px] text-[30px] leading-snug" style={{ color: INK2, ...rise(2) }}>
          One tablet per operator. <b style={{ color: INK }}>In hand</b> it is his companion. <b style={{ color: INK }}>Docked</b> it becomes the machine display.
          <b style={{ color: INK }}> Together</b>, the tablets see the whole site.
        </p>
        <div className="mt-10 flex gap-3" style={rise(3)}>
          <Chip dark>Me</Chip><Chip dark>My machine</Chip><Chip dark>My site</Chip>
        </div>
      </div>
      <div className="relative h-[620px]" style={rise(2)}>
        <div className="absolute inset-0 rounded-[28px]" style={{ background: `repeating-linear-gradient(135deg, ${CAT} 0 26px, ${INK} 26px 52px)` }} />
        <div className="absolute inset-[14px] overflow-hidden rounded-[20px] bg-white">
          <img src="/machines/excavator.webp" alt="Cat 320 excavator" className="h-full w-full object-cover" />
        </div>
        <div className="absolute -bottom-6 -left-8 rounded-2xl bg-white px-6 py-4" style={{ boxShadow: '0 20px 50px -20px rgb(0 0 0 / 0.35)', border: `1px solid ${LINE}` }}>
          <div className="font-mono text-[14px]" style={{ color: INK3 }}>DEMO · ONE DAY AS</div>
          <div className="font-display text-[34px] font-bold" style={{ color: INK }}>Ravi, excavator operator</div>
          <div className="text-[17px]" style={{ color: INK2 }}>NH-48 widening · rental Cat 320</div>
        </div>
      </div>
    </div>
  )
}

function Stat({ value, label, source, i }: { value: string; label: string; source: string; i: number }) {
  return (
    <Card i={i} className="flex flex-col">
      <div className="font-display text-[76px] leading-none font-bold" style={{ color: INK }}>{value}</div>
      <div className="mt-4 text-[21px] leading-snug" style={{ color: INK2 }}>{label}</div>
      <div className="mt-auto pt-5 font-mono text-[13px]" style={{ color: INK3 }}>{source}</div>
    </Card>
  )
}

function ProblemSlide() {
  return (
    <>
      <Eyebrow>The problem</Eyebrow>
      <Headline>The machine knows everything about itself. <Mark>Nothing on site knows the person driving it.</Mark></Headline>
      <div className="mt-14 grid grid-cols-3 gap-7">
        <Stat i={2} value="~30%" label="of an excavator’s engine hours are idle. Telematics shows how much, never why."
          source="Construction Equipment · North American average" />
        <Stat i={3} value="668,999" label="buried utilities were hit in the US in 2025, costing $83.2B. The operator rarely knows what is below."
          source="Common Ground Alliance · Aug 2026" />
        <Stat i={4} value="2 of 4" label="hours in the brief’s own sample had the seatbelt off. Both were long idles with almost no work."
          source="Problem statement telemetry · EXC001 / OP1001" />
      </div>
    </>
  )
}

const EXISTS: { icon: LucideIcon; name: string; does: string; gap: string }[] = [
  { icon: Mic, name: 'Cat AI Assistant', does: 'In-cab voice help and manuals', gap: 'Answers questions, doesn’t warn ahead' },
  { icon: Camera, name: 'Cat Detect', does: 'Camera people-detection zones', gap: 'Sees a person, not the day’s plan' },
  { icon: Gauge, name: 'Operator Coaching', does: 'Tips and an efficiency score', gap: 'Compares with a site threshold, not himself' },
  { icon: UserRound, name: 'Operator profile', does: 'Joystick and seat settings', gap: 'Lives in one machine, lost on a rental' },
  { icon: Map, name: '2D E-fence', does: 'Height and depth limits', gap: 'Typed in by hand' },
  { icon: LayoutDashboard, name: 'VisionLink', does: 'Fleet hours, idle, fuel, faults', gap: 'History for owners, no “why” for operators' },
]

function ExistsSlide() {
  return (
    <>
      <Eyebrow>What already exists</Eyebrow>
      <Headline size={60}>Cat already ships a lot for the <Mark>machine</Mark>. We don’t rebuild it.</Headline>
      <div className="mt-11 grid grid-cols-3 gap-5">
        {EXISTS.map((e, i) => (
          <Card key={e.name} i={i + 2} className="!p-6">
            <div className="flex items-center gap-3.5">
              <IconBox icon={e.icon} />
              <div className="font-display text-[27px] font-bold" style={{ color: INK }}>{e.name}</div>
            </div>
            <div className="mt-4 text-[19px]" style={{ color: INK2 }}>{e.does}</div>
            <div className="mt-3 flex items-start gap-2 border-t pt-3 text-[18px] font-medium" style={{ borderColor: LINE, color: '#b54708' }}>
              <span className="mt-[3px] font-mono text-[13px] font-bold tracking-wider">GAP</span>{e.gap}
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-8 rounded-2xl px-7 py-5 text-[25px] font-medium" style={{ background: INK, color: '#fff', ...rise(8) }}>
        All of it is machine-centric. <span style={{ color: CAT }}>Nothing follows the operator from machine to machine, predicts, or explains why.</span>
      </div>
    </>
  )
}

const OUTCOMES = ['Daily task dashboard', 'Safety features', 'Operator training hub', 'Unusual behaviour detection', 'Task time estimation']

function IdeaSlide() {
  const layers: { icon: LucideIcon; tag: string; name: string; items: string[] }[] = [
    { icon: Smartphone, tag: 'In hand', name: 'Me', items: ['Spoken morning briefing', 'Tasks with a time range', 'Walkaround ordered by prediction', 'Training from his own shifts', 'His own twin'] },
    { icon: Tablet, tag: 'Docked · CAN / J1939', name: 'My machine', items: ['Profile follows him to rentals', 'Idle with a reason', 'Swing hold + restart guard', 'Voice near-miss + black box', 'Help that lights up the cab'] },
    { icon: Users, tag: 'Supervisor', name: 'My site', items: ['Site Copilot: 5 decisions', 'Health + fuel predictions', 'Alert budget', 'Mixed fleet, one view', 'Official data scored'] },
  ]
  return (
    <>
      <Eyebrow>Our idea</Eyebrow>
      <Headline size={62}>One operator, <Mark>three layers</Mark>. The data follows the person, not the machine.</Headline>
      <div className="mt-11 grid grid-cols-3 gap-6">
        {layers.map((l, i) => (
          <Card key={l.name} i={i + 2} className="relative overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-2" style={{ background: `repeating-linear-gradient(135deg, ${CAT} 0 12px, ${INK} 12px 24px)` }} />
            <div className="flex items-center gap-3.5">
              <IconBox icon={l.icon} dark />
              <div>
                <div className="font-mono text-[13px] tracking-wider uppercase" style={{ color: INK3 }}>{l.tag}</div>
                <div className="font-display text-[38px] leading-none font-bold" style={{ color: INK }}>{l.name}</div>
              </div>
            </div>
            <ul className="mt-5 space-y-2.5">
              {l.items.map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-[20px]" style={{ color: INK2 }}>
                  <CircleCheck size={19} style={{ color: '#16a34a' }} className="shrink-0" />{t}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-2.5" style={rise(6)}>
        <span className="mr-2 font-mono text-[15px] tracking-wider" style={{ color: INK3 }}>ALL 5 OUTCOMES FROM THE BRIEF</span>
        {OUTCOMES.map((o) => <Chip key={o}>{o}</Chip>)}
      </div>
    </>
  )
}

function Flow({ title, icon, items, i, accent }: { title: string; icon: LucideIcon; items: string[]; i: number; accent?: boolean }) {
  return (
    <Card i={i} className="!p-6" style={accent ? { background: INK, border: `1px solid ${INK}` } : undefined}>
      <div className="flex items-center gap-3">
        <IconBox icon={icon} dark={!accent} />
        <div className="font-display text-[26px] font-bold" style={{ color: accent ? '#fff' : INK }}>{title}</div>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((t) => <li key={t} className="text-[18px] leading-snug" style={{ color: accent ? 'rgb(255 255 255 / 0.78)' : INK2 }}>{t}</li>)}
      </ul>
    </Card>
  )
}

function Arrow({ i }: { i: number }) {
  return <div className="flex items-center justify-center" style={rise(i)}><ArrowRight size={38} style={{ color: INK3 }} /></div>
}

function DataSlide() {
  return (
    <>
      <Eyebrow>How we use data</Eyebrow>
      <Headline size={58}>No screen shows one source. <Mark>Every answer is a join.</Mark></Headline>
      <div className="mt-8 grid grid-cols-[1.25fr_56px_1fr_56px_1fr] items-stretch gap-2">
        <div className="grid grid-cols-2 gap-4">
          <Flow i={2} icon={Cpu} title="Machine" items={['CAN / J1939: engine, fuel, hydraulics', 'Seatbelt, load cycles, faults']} />
          <Flow i={3} icon={Map} title="Plan & site" items={['Tasks, zones, trucks', 'Call Before u Dig, 11 kV lines']} />
          <Flow i={4} icon={Sun} title="Conditions" items={['Weather, heat index', 'Soil per zone']} />
          <Flow i={5} icon={Database} title="History" items={['3,000 past jobs', 'S·O·S oil samples, 900 shift-hours']} />
        </div>
        <Arrow i={6} />
        <Flow i={7} accent icon={Brain} title="Intelligence" items={[
          '5 ML models: time, idle reason, unusual hour, health, fuel',
          'Operator twin: his own baseline per condition',
          'Copilot engine: joins 2+ sources, ranks to 5',
          'Rules for interlocks, LLM only for wording',
        ]} />
        <Arrow i={8} />
        <div className="grid grid-rows-3 gap-4">
          <Flow i={9} icon={Smartphone} title="Operator tablet" items={['Briefing, ranges, walkaround']} />
          <Flow i={10} icon={Tablet} title="Cab display" items={['Interlocks, idle nudge, help']} />
          <Flow i={11} icon={LayoutDashboard} title="Supervisor" items={['Site Copilot, alert budget']} />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-5" style={rise(12)}>
        {[
          ['Air filter first', 'oil sample + sensors → health model → walkaround order'],
          ['Switch off now', 'truck ETA + temps + heat → idle-reason model → nudge'],
          ['Refuel before T103', 'fuel level × fuel-rate × task time → reserve at 14:43'],
        ].map(([a, b]) => (
          <div key={a} className="rounded-xl px-5 py-4" style={{ background: '#fff4c2' }}>
            <div className="font-display text-[23px] font-bold" style={{ color: INK }}>{a}</div>
            <div className="mt-1 font-mono text-[14px]" style={{ color: INK2 }}>{b}</div>
          </div>
        ))}
      </div>
    </>
  )
}

const MODELS: { icon: LucideIcon; q: string; name: string; algo: string; inputs: string; value: string; vs: string }[] = [
  { icon: Timer, q: 'How long will this job take?', name: 'Task time', inputs: 'task, volume, weather, soil, skill, age, heat', algo: 'Gradient boosting, quantile P10 / P50 / P90', value: '7.1 min', vs: 'error, vs 19.8 min for the planner · 82% range coverage' },
  { icon: Fuel, q: 'Why is the engine idling?', name: 'Idle reason', inputs: 'truck ETA, temps, rpm, heat, seat, shift clock', algo: 'Random forest, 5 reasons', value: '98.3%', vs: 'accuracy · top signal: next truck ETA' },
  { icon: HeartPulse, q: 'Will this machine fail soon?', name: 'Machine health', inputs: 'oil sample, temps, load, faults, hours since service', algo: 'Gradient boosting on sensors + oil sample', value: '0.83', vs: 'ROC AUC · top 10% riskiest: 75% fail vs 16.5% base' },
  { icon: Gauge, q: 'When does the tank hit reserve?', name: 'Fuel rate', inputs: 'job features × P50 minutes of the plan', algo: 'Gradient boosting × task time', value: '0.87 L/h', vs: 'error, vs 2.81 L/h for one flat rate' },
  { icon: ShieldAlert, q: 'Was this hour unusual?', name: 'Unusual behaviour', inputs: 'idle, cycles, fuel, belt-off, swings per hour', algo: 'Isolation forest + readable rules', value: '100%', vs: 'precision · 81% recall on planted anomalies' },
  { icon: UserRound, q: 'Unusual compared to whom?', name: 'Operator twin', inputs: 'his hours by task × weather × machine', algo: 'Per-condition baseline, updated live', value: '95%', vs: 'recall vs 81% for a site threshold, 60 flags vs 85' },
]

function ModelsSlide() {
  return (
    <>
      <Eyebrow>The models</Eyebrow>
      <Headline size={64}>Each model answers <Mark>one question on site</Mark>.</Headline>
      <p className="mt-3 text-[21px]" style={{ color: INK2, ...rise(2) }}>
        The models decide. Rules guard safety. The LLM only words the near-miss report. <span style={{ color: INK3 }}>Held-out test sets, synthetic data with planted patterns.</span>
      </p>
      <div className="mt-7 grid grid-cols-3 gap-4">
        {MODELS.map((m, i) => (
          <Card key={m.name} i={i + 2} className="!p-5">
            <div className="flex items-start justify-between gap-3">
              <IconBox icon={m.icon} dark />
              <div className="text-right font-display text-[42px] leading-none font-bold" style={{ color: INK }}>{m.value}</div>
            </div>
            <div className="mt-2 text-[16px] italic" style={{ color: INK3 }}>“{m.q}”</div>
            <div className="font-display text-[27px] leading-tight font-bold" style={{ color: INK }}>{m.name}</div>
            <div className="text-[16px]" style={{ color: INK2 }}>{m.algo}</div>
            <div className="mt-1 font-mono text-[12.5px] leading-snug" style={{ color: INK3 }}>IN · {m.inputs}</div>
            <div className="mt-2.5 border-t pt-2.5 text-[16px]" style={{ borderColor: LINE, color: INK2 }}>{m.vs}</div>
          </Card>
        ))}
      </div>
    </>
  )
}

const AI: { icon: LucideIcon; t: string; how: string; why: string }[] = [
  { icon: Database, t: 'Data with known answers', how: '3,000 jobs, 900 shift-hours, 3,000 machine-days, generated with planted patterns: skill, weather, soil, age, unbuckling in long idles.',
    why: 'Every metric is checkable. The brief’s own rows are kept and scored.' },
  { icon: Timer, t: 'Ranges you can trust', how: 'Quantile gradient boosting for P10 / P50 / P90, then conformal calibration on held-out jobs.',
    why: 'A time range that really covers 82% of outcomes, not a single guess.' },
  { icon: Lightbulb, t: 'Reasons in minutes', how: 'Re-predict with one factor set to its “easy day” value. The difference is that factor’s share.',
    why: '“+7 min: clay soil” instead of a black box. Same trick gives health-risk points.' },
  { icon: ShieldAlert, t: 'Unusual, with a why', how: 'Isolation forest flags the hour. Readable rules sit beside it and name the cause.',
    why: 'No flag goes out without a sentence someone can act on.' },
  { icon: UserRound, t: 'A twin that learns live', how: 'Running mean and variance per operator × task × weather, using the most specific context with 20+ hours.',
    why: 'Compares Ravi with himself. Learns after every shift, with no retraining.' },
  { icon: Layers, t: 'Copilot joins, not guesses', how: 'Rules join plan × forecast × model outputs × twin. Score = severity × urgency × confidence × reach; top five shown.',
    why: 'Every item names its sources. Dismissed items rank lower for that person.' },
  { icon: MessageSquareText, t: 'The LLM on a leash', how: 'Llama 3.3 70B on Groq turns the Hindi report into a fixed JSON schema, validated before use.',
    why: 'It only words the report. Severity comes from the black-box distance, by rule.' },
  { icon: Cpu, t: 'Fast and offline-safe', how: 'FastAPI loads every model at start and answers in milliseconds. The tablet keeps the last answer.',
    why: 'No network on site still means a working screen, clearly marked “cached”.' },
]

function AiSlide() {
  return (
    <>
      <Eyebrow>How the AI works</Eyebrow>
      <Headline size={62}>Explainable by construction. <Mark>AI decides where it can, rules where safety is at stake.</Mark></Headline>
      <div className="mt-9 grid grid-cols-4 gap-4">
        {AI.map((a, i) => (
          <Card key={a.t} i={i + 2} className="flex flex-col !p-5">
            <div className="flex items-center gap-3">
              <IconBox icon={a.icon} dark />
              <div className="font-display text-[23px] leading-tight font-bold" style={{ color: INK }}>{a.t}</div>
            </div>
            <div className="mt-3 text-[16px] leading-snug" style={{ color: INK2 }}>{a.how}</div>
            <div className="mt-auto border-t pt-3 text-[15.5px] leading-snug font-medium" style={{ borderColor: LINE, color: INK }}>
              <span className="mr-1.5 font-mono text-[12px] tracking-wider" style={{ color: '#b58900' }}>WHY</span>{a.why}
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

function StackSlide() {
  const rows: { icon: LucideIcon; layer: string; items: [string, string][] }[] = [
    { icon: MonitorSmartphone, layer: 'Experience', items: [
      ['React 19 + TypeScript', 'one app for the hand, the cab and the supervisor'],
      ['react-three-fiber', 'live 3D site, swing radius and cab on the tablet GPU'],
      ['Tailwind v4 + Radix UI', 'accessible, glove-sized controls in light and dark'],
      ['Recharts', 'idle, hours and risk at a glance'],
    ] },
    { icon: Layers, layer: 'State & data', items: [
      ['Zustand', 'one machine simulation shared by the 3D view and every panel'],
      ['TanStack Query', 'caching, retries and the offline fallback'],
      ['CAN / J1939 dock', 'machine data in the cab (simulated for the demo)'],
    ] },
    { icon: Brain, layer: 'Intelligence', items: [
      ['FastAPI', 'serves 5 models, the twin and both Copilots on one API'],
      ['scikit-learn', 'gradient boosting, random forest, isolation forest'],
      ['pandas + NumPy', 'features, synthetic history, the twin’s running stats'],
    ] },
    { icon: Radio, layer: 'Language & voice', items: [
      ['Groq · Llama 3.3 70B', 'words the near-miss report into a fixed schema'],
      ['ElevenLabs', 'a natural voice for the morning briefing'],
      ['Web Speech API', 'Hindi voice input, and a voice with no network'],
    ] },
  ]
  return (
    <>
      <Eyebrow>Tech stack</Eyebrow>
      <Headline size={60}>Every tool has <Mark>one job</Mark>. Built to run on a rugged tablet, offline-first.</Headline>
      <div className="mt-9 space-y-4">
        {rows.map((r, i) => (
          <div key={r.layer} className="grid grid-cols-[270px_1fr] items-stretch gap-4" style={rise(i + 2)}>
            <div className="flex items-center gap-3 rounded-2xl px-5" style={{ background: INK }}>
              <r.icon size={24} style={{ color: CAT }} />
              <span className="font-display text-[26px] font-bold text-white">{r.layer}</span>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${r.items.length}, minmax(0, 1fr))` }}>
              {r.items.map(([t, d]) => (
                <div key={t} className="rounded-xl bg-white px-4 py-3" style={{ border: `1px solid ${LINE}` }}>
                  <div className="text-[19px] font-semibold" style={{ color: INK }}>{t}</div>
                  <div className="text-[15.5px] leading-snug" style={{ color: INK2 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3 text-[19px]" style={{ color: INK2, ...rise(7) }}>
        <WifiOff size={22} style={{ color: INK }} /> If the API or network drops, every screen falls back to cached predictions and says so.
      </div>
    </>
  )
}

function DesignSlide() {
  const items: { icon: LucideIcon; t: string; d: string }[] = [
    { icon: Eye, t: 'Coaching, not surveillance', d: 'The operator sees his data first. The supervisor sees what needs a decision.' },
    { icon: Lightbulb, t: 'A reason next to every number', d: '“+7 min: clay soil”, “why this?” on every Copilot item.' },
    { icon: Moon, t: 'Light in hand, dark in the cab', d: 'Glare and night work in the cab; readable daylight on site.' },
    { icon: ShieldAlert, t: 'Alert budget', d: 'Only Critical reaches a phone. Caution waits on the tablet.' },
    { icon: Languages, t: 'Voice first, in his language', d: 'Hindi briefing and voice near-miss. No typing with gloves.' },
    { icon: HardHat, t: 'Built for gloves and sunlight', d: 'Big targets, condensed type, Cat yellow and hazard cues.' },
    { icon: Sparkles, t: 'Not a chatbot', d: 'AI where a decision is made, rules where safety is at stake.' },
    { icon: Layers, t: 'One risk lamp', d: 'Safe · Caution · Critical, fused from every signal in the cab.' },
  ]
  return (
    <>
      <Eyebrow>Design choices</Eyebrow>
      <Headline size={60}>Designed for a <Mark>cab at 41°C</Mark>, not a desk.</Headline>
      <div className="mt-11 grid grid-cols-4 gap-5">
        {items.map((it, i) => (
          <Card key={it.t} i={i + 2} className="!p-6">
            <IconBox icon={it.icon} />
            <div className="mt-4 font-display text-[25px] leading-tight font-bold" style={{ color: INK }}>{it.t}</div>
            <div className="mt-2 text-[17px] leading-snug" style={{ color: INK2 }}>{it.d}</div>
          </Card>
        ))}
      </div>
    </>
  )
}

// Impact estimate from stated assumptions: idle from the ~30% average to 20%, 1,000 engine hours a year.
const HOURS = 1000
const idleHoursSaved = Math.round(HOURS * (0.3 - 0.2))
const litresSaved = idleHoursSaved * IDLE_BURN_LPH
const rupeesSaved = litresSaved * DIESEL_INR

function ImpactSlide() {
  return (
    <>
      <Eyebrow>Impact</Eyebrow>
      <Headline size={62}>One tablet that follows the operator, <Mark>compares him with himself</Mark>, and coaches.</Headline>
      <div className="mt-12 grid grid-cols-3 gap-7">
        <Stat i={2} value={`₹${Math.round(rupeesSaved / 1000)}k`}
          label={`fuel saved a year per excavator if idle drops from 30% to 20%: ${idleHoursSaved} h, ${Math.round(litresSaved)} L of diesel.`}
          source={`Estimate · ${HOURS} h/yr · ${IDLE_BURN_LPH} L/h idle · ₹${DIESEL_INR}/L`} />
        <Stat i={3} value="3" label="interlocks from context: swing held for a person, restart guard for the belt, depth limit from the fibre route."
          source="Built and shown in this demo" />
        <Stat i={4} value="95%" label="of unusual hours caught by his own twin, against 81% for one site-wide threshold, with fewer false alarms."
          source="Held-out test · synthetic data · ml/train.py" />
      </div>
      <div className="mt-8 flex items-center gap-4 rounded-2xl px-7 py-5 text-[23px]" style={{ background: INK, color: '#fff', ...rise(5) }}>
        <TrendingDown size={28} style={{ color: CAT }} /> Across 100 machines: <b style={{ color: CAT }}>≈ ₹{((rupeesSaved * 100) / 1e5).toFixed(0)} lakh</b> of diesel a year, from idle alone.
      </div>
    </>
  )
}

function FutureSlide() {
  const phases: { when: string; icon: LucideIcon; items: string[] }[] = [
    { when: 'Next 3 months', icon: Wrench, items: ['Pilot on real J1939 telemetry', 'Retrain on real jobs', 'Offline sync on site Wi-Fi'] },
    { when: '6 months', icon: Radio, items: ['Site mesh between tablets', 'Auto E-fence from Call Before u Dig', 'Fusion with Cat Detect cameras'] },
    { when: '12 months', icon: Users, items: ['Mentor matching for new operators', 'Fatigue + whole-body vibration dose', 'Skill passport QR, verified hours for pay'] },
  ]
  return (
    <>
      <Eyebrow>What’s next</Eyebrow>
      <Headline size={62}>From demo to <Mark>pilot</Mark>.</Headline>
      <div className="relative mt-14 grid grid-cols-3 gap-7">
        <div className="absolute top-[26px] right-[16%] left-[16%] h-[3px]" style={{ background: `repeating-linear-gradient(90deg, ${INK} 0 14px, transparent 14px 24px)`, ...rise(2) }} />
        {phases.map((p, i) => (
          <div key={p.when} className="relative" style={rise(i + 3)}>
            <div className="mx-auto flex h-[56px] w-[56px] items-center justify-center rounded-full" style={{ background: CAT, color: INK, boxShadow: `0 0 0 8px ${PAPER}` }}>
              <p.icon size={26} />
            </div>
            <Card i={i + 3} className="mt-6">
              <div className="font-display text-[34px] font-bold" style={{ color: INK }}>{p.when}</div>
              <ul className="mt-4 space-y-3">
                {p.items.map((t) => <li key={t} className="flex items-start gap-2.5 text-[20px]" style={{ color: INK2 }}><ArrowRight size={20} className="mt-1 shrink-0" style={{ color: INK3 }} />{t}</li>)}
              </ul>
            </Card>
          </div>
        ))}
      </div>
      <div className="mt-10 grid grid-cols-[auto_1fr] items-center gap-8 rounded-2xl px-8 py-6" style={{ background: INK, ...rise(7) }}>
        <div className="font-display text-[34px] font-bold" style={{ color: CAT }}>The pilot ask</div>
        <div className="grid grid-cols-4 gap-6">
          {[['1 site', 'a live highway package'], ['10 tablets', 'operators + one supervisor'], ['J1939 access', 'read-only, through the dock'], ['3 months', 'vs a control crew']].map(([a, b]) => (
            <div key={a}>
              <div className="font-display text-[30px] leading-none font-bold text-white">{a}</div>
              <div className="mt-1.5 text-[16px]" style={{ color: 'rgb(255 255 255 / 0.7)' }}>{b}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 text-[19px]" style={{ color: INK2, ...rise(8) }}>
        Measured on what the site already counts: idle hours, fuel, near-misses reported, and seatbelt compliance.
      </div>
    </>
  )
}

const FAQ: [string, string][] = [
  ['Is the data real?', 'Synthetic, with planted patterns. The brief’s 4 official rows are scored by the same models.'],
  ['Where is the AI?', 'Five scikit-learn models and a per-operator twin. The LLM only words the near-miss report.'],
  ['Why not a chatbot?', 'Cat already has one in the cab. We put AI where a decision is made.'],
  ['How is it different from VisionLink?', 'It predicts, explains every number, and gives the operator the result first.'],
]

function ThanksSlide() {
  return (
    <div className="grid h-full grid-cols-[1fr_700px] items-center gap-14">
      <div>
        <Eyebrow>Thank you</Eyebrow>
        <h1 className="mt-6 font-display text-[132px] leading-[0.9] font-bold" style={{ color: INK, ...rise(1) }}>Questions?</h1>
        <p className="mt-8 max-w-[640px] text-[28px] leading-snug" style={{ color: INK2, ...rise(2) }}>
          The machine knows itself. <Mark><b style={{ color: INK }}>Now the site knows the operator.</b></Mark>
        </p>
        <div className="mt-10 font-mono text-[17px]" style={{ color: INK3, ...rise(3) }}>PRAKHAR JOSHI · KRRISH KUMAR</div>
      </div>
      <div className="space-y-4">
        {FAQ.map(([q, a], i) => (
          <Card key={q} i={i + 2} className="!p-6">
            <div className="flex items-center gap-2.5 font-display text-[26px] font-bold" style={{ color: INK }}>
              <MessageSquareText size={22} style={{ color: '#b58900' }} />{q}
            </div>
            <div className="mt-1.5 text-[19px] leading-snug" style={{ color: INK2 }}>{a}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}

const SLIDES: Record<SlideKind, () => ReactNode> = {
  title: TitleSlide, problem: ProblemSlide, exists: ExistsSlide, idea: IdeaSlide, data: DataSlide, models: ModelsSlide, ai: AiSlide,
  stack: StackSlide, design: DesignSlide, impact: ImpactSlide, future: FutureSlide, thanks: ThanksSlide,
}

/** Full-screen light slide between the live app chapters. */
export function StorySlide({ kind, index, bottomReserve }: { kind: SlideKind; index: number; bottomReserve: number }) {
  const { s, x, y } = useFit(bottomReserve)
  const Body = SLIDES[kind]
  const slideNo = CHAPTERS.slice(0, index + 1).filter((c) => c.slide).length
  const slideTotal = CHAPTERS.filter((c) => c.slide).length
  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: `radial-gradient(120% 90% at 20% 0%, #ffffff 0%, ${PAPER} 55%, #efede6 100%)` }}>
      <div className="absolute top-0 left-0 origin-top-left" style={{ width: W, height: H, transform: `translate(${x}px, ${y}px) scale(${s})` }}>
        <div key={index} className="flex h-full flex-col px-[88px] pt-[64px] pb-[56px]">
          <div className="min-h-0 flex-1">{Body()}</div>
          <div className="mt-6 flex items-center justify-between font-mono text-[14px] tracking-wider" style={{ color: INK3 }}>
            <span className="flex items-center gap-3">
              <span className="h-3.5 w-3.5 rounded-[3px]" style={{ background: CAT }} />
              OPERATOR COMPANION · CAT HACKATHON 2026
            </span>
            <span>{String(slideNo).padStart(2, '0')} / {String(slideTotal).padStart(2, '0')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
