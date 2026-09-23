# Operator Companion: design system

What the UI is built from, and the rules that keep new screens consistent with it. Tokens live in `src/styles/globals.css`; this file explains them.

## Design read

| | |
|---|---|
| Product | One tablet per operator. Handheld: their own dashboard. Docked in the cab: the machine display. Supervisors get a site view. |
| Users | Excavator operators (gloves, sunlight, a glance between cycles), site supervisors, safety officers |
| Visual language | Industrial information design: safety yellow on black, road-signage type, dense but calm. Closer to an OEM machine display than to a SaaS dashboard. |
| Density | High on supervisor screens, medium on handheld, low and large in the cab |
| Motion | Low. Motion only confirms an action or shows a change of state. |

## Themes

The same semantic tokens resolve to two palettes.

- **Light (`:root`)**: the handheld and supervisor screens. High contrast for outdoor daylight.
- **Dark (`.dark`)**: the docked cab display, always. Operators can also choose it for the handheld (sidebar toggle, saved per device).

Components use only role tokens (`bg-surface`, `text-fg-2`, `border-border`, `bg-brand`…). Never write a raw hex in a component.

| Role | Use |
|---|---|
| `bg` / `surface` / `surface-2` / `surface-3` | page, card, inset well, hover/selected |
| `fg` / `fg-2` / `fg-3` | primary text, secondary text, muted labels (all pass WCAG AA on `surface`) |
| `border` / `border-strong` | hairlines, control outlines |
| `brand` (#FFCD11) | the primary action and the machine identity. Not used for data. |
| `good` / `warning` / `serious` / `critical` / `info` | status only. Each has a fill, a `-text` step that passes contrast, and a `-soft` background |
| `s1`–`s5`, `s8` | chart series, in fixed order (see Charts) |

## Type

| Family | Role |
|---|---|
| Barlow | UI and body text |
| Barlow Condensed | page titles, card titles (uppercase, tracked), big numbers |
| JetBrains Mono | machine IDs, timestamps, telemetry, table numbers (`tabular`) |

Fonts are bundled through `@fontsource`, so the app works offline on site. Body text is 15–16 px; operator-facing numbers are 26–44 px.

## Shape, space, elevation

- Radius: 4 px (chips), 6 px (controls), 10 px (cards), 14 px (dialogs). The corners are small on purpose.
- Spacing on a 4 px grid. Cards are 20 px inside, and grids have 16–24 px gaps.
- Elevation comes mostly from hairline borders. `shadow-1` goes on cards and `shadow-3` only on dialogs.
- The hazard stripe (`hazard-stripe`) marks the dock action and the machine card. It appears at most once per screen, so it keeps its meaning.

## Components (`src/components/ui`)

| Component | Notes |
|---|---|
| `Button` | variants primary / secondary / ghost / danger / success / inverse. `md` and up are ≥ 44 px (glove targets). Press = `scale(0.97)`. |
| `Card`, `CardHeader`, `CardBody` | `CardHeader` takes `outcomes`, which renders an `OutcomeTag` for each |
| `OutcomeTag` | names the problem-statement outcome a block covers, in the brief's exact words |
| `StatusBadge` | the only way to show a status. It always pairs an icon with a label, never colour alone |
| `ModelStatus` | "Model live" when the ML API computed the value, "Cached" when it fell back |
| `Kpi` | label, value, unit, sub-line. No invented trends: if there is no prior-period data, there is no trend arrow |
| `Segmented` | single choice (what-if weather, skill, soil). Fewer taps than a select |
| `Meter`, `Skeleton`, `EmptyState`, `Kbd`, `Tooltip` | as named |
| `Dialog` | Radix-based. It traps focus and stays centred. `locked` removes Escape and outside-click, for interlocks such as the restart guard |

App chrome is in `src/components/shared`: `AppShell`, `Sidebar` (workspace switcher, grouped nav, dock action, theme, collapse), `TopBar` (breadcrumbs, ⌘K search, live model status), `CommandPalette`, `PageHeader`, `TelemetryTable`.

## Charts

- Categorical order is fixed: blue, orange, aqua, yellow, magenta. It passes the CVD and normal-vision checks in both themes.
- Idle reasons have their own fixed order, with **waste first**: red, blue, orange, aqua, yellow. Waste goes first because red next to yellow fails the normal-vision floor on the dark surface.
- There is a legend whenever a chart has two or more series, plus direct labels or a values list. Colour is never the only way to tell series apart.
- Chart heights are fixed so nothing jumps while data loads. The hover tooltip uses surface tokens.
- Prefer sorted bars over donuts for shares.

## Motion

| Case | Rule |
|---|---|
| Page enter | 260 ms fade and 6 px rise with a 40 ms stagger, on first paint only |
| Buttons | `scale(0.97)` on press, 150 ms |
| Dialogs | 200 ms fade and scale from 0.97, `cubic-bezier(0.23, 1, 0.32, 1)` |
| Command palette | no animation (it is opened hundreds of times a day) |
| Cab hotkeys (W, B, V, H) | no animation |
| `prefers-reduced-motion` | all motion is turned off |

Never use `transition: all`. List the properties that change.

## Accessibility

- Landmarks: skip link, `aside` sidebar, `nav` with `aria-current`, `header`, `main`, breadcrumb `nav`.
- Every icon-only button has an `aria-label`. Charts have a text alternative (`role="img"` with a label, or a list).
- A visible `:focus-visible` ring on everything: `fg` on light, `brand` on dark.
- Tables use `scope="col"` headers and sticky headers where they scroll.
- Live values (task estimate, briefing caption, listening state) use `aria-live` / `role="status"`.

## Honesty rules (content)

- Every model number carries `ModelStatus`, so viewers can see whether it is live or cached.
- No fabricated metrics, trends or testimonials. The data is synthetic, and the README says so.
- The LLM only formats the near-miss report. The models and rules make every decision.

## Code layout

```
src/
  components/ui        primitives (no app state)
  components/shared    app chrome and cross-feature pieces
  components/operator  handheld pages: Today, Site & safety, Training, Hours & activity, briefing
  components/docked    dock sequence, in-cab display, 3D site scene
  components/fleet     supervisor: Site overview, Telemetry audit
  hooks/queries.ts     React Query hooks; every query falls back to cached data instead of failing
  store/app.ts         Zustand: workspace, page (hash-synced), device mode, theme, shift summary
  lib/                 api, sim, voice, tones, constants, utils (cn)
  types/               domain types that mirror ml/api.py
```

## Where the rules came from

- **Universal AI Architect** (sam-vish): F-pattern shell, KPI row on top, grouped sidebar that collapses to icons, breadcrumbs, ⌘K grouped by category, sticky table headers with right-pinned row actions, WCAG AA contrast, 44 px targets, focus trap in modals, `cn()` + atomic `ui / shared / feature` folders, TypeScript strict. We kept Vite rather than moving to Next.js, because the app is a client-side 3D simulation with nothing to render on the server.
- **Garden `web-design-engineer`**: design read with dials, no AI clichés (no purple gradients, emoji icons or fabricated stats), information-architecture school for operational UI, data-ink over decoration.
- **Tastemaker**: tokens only (no inline hex), status never by colour alone, real app states (loading, empty, offline), at most three font families.
- **Emil Kowalski**: animation decision framework (frequency decides whether something animates), custom ease-out, press feedback, no animation on keyboard actions, Sonner for toasts.
- **Owl-Listener designer-skills**: Fitts's law (big dock and switch-off targets), Hick's law (segmented what-if), error-handling UX (graceful ML fallbacks), dark-mode design as a separate palette rather than an inversion.
- **elayadesign**: type scale and spacing rhythm.
