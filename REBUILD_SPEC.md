# ASCEND - Rebuild Specification & Technical Blueprint

> Complete technical documentation for reconstructing the ASCEND workout tracker with high fidelity.

---

## A. Product Overview

### What It Is
ASCEND is a Progressive Web App (PWA) workout tracker designed for serious gym-goers who want a premium, data-rich training companion on their phone. It replaces paper notes and basic tracking apps with a comprehensive system that covers workout logging, bodyweight tracking, health metrics (sleep, steps), analytics, and weekly coaching-style recaps.

### Target User
A dedicated lifter who trains 4-5 days per week on a structured program (e.g., push/pull/legs split). They care about progressive overload, tracking their bodyweight trend, monitoring recovery via sleep and steps, and getting a weekly overview of their training quality. They want the app to feel native and premium, not like a web page.

### Core Purpose
- Log workouts in real-time or retroactively with per-set tracking
- Track bodyweight with trend analysis, target ranges, and tags
- Monitor health indicators (sleep score, steps)
- Analyze training balance, volume trends, and exercise progression
- Generate weekly coaching recaps with scores and actionable insights
- All data stays on-device (IndexedDB + localStorage), zero backend

---

## B. App Structure

### Pages / Routes

| Route | Component | In AppLayout? | Bottom Nav? |
|-------|-----------|---------------|-------------|
| `/` | Dashboard | Yes | Yes |
| `/programs` | Programs | Yes | Yes |
| `/history` | History | Yes | Yes |
| `/history/:id` | HistoryDetail | Yes | Yes |
| `/health` | Health | Yes | Yes |
| `/bodyweight` | Bodyweight | Yes | Yes |
| `/steps` | Steps | Yes | Yes |
| `/sleep` | Sleep | Yes | Yes |
| `/stats` | Stats | Yes | Yes |
| `/trash` | Trash | Yes | Yes |
| `/recap` | WeeklyRecap | Yes | Yes |
| `/workout/:id` | LiveWorkout | **No** | **No** |

### Navigation Structure

**Bottom Tab Bar (5 tabs):**
1. Home (`/`) - Home icon
2. Programs (`/programs`) - Dumbbell icon
3. History (`/history`) - Clock icon
4. Health (`/health`) - Heart icon (also highlights for `/bodyweight`, `/steps`, `/sleep`)
5. Stats (`/stats`) - BarChart3 icon

**Hierarchical navigation:**
- Dashboard -> Live Workout (separate layout, no nav)
- Dashboard -> Weekly Recap
- Dashboard -> Trash
- Health -> Bodyweight
- Health -> Steps
- Health -> Sleep
- History -> History Detail

### What Each Page Does

**Dashboard:** The home screen. Shows current date, bodyweight sparkline, next/last workout, weekly progress grid (workouts/volume/exercises/consistency), start workout button, weekly recap link.

**Programs:** Full template CRUD. Organize templates into groups. Edit exercises per template with sets/reps/rest/notes. Manage the exercise library (search, filter, create custom, attach media, reorder). Drag-to-reorder templates and groups.

**Live Workout:** The active workout tracking interface. Timer, exercise cards with set logging, warm-up sets, rest timer with circular progress, progression indicators vs previous session, tags, skip/replace exercises, finish with summary.

**History:** Searchable, filterable list of completed sessions grouped by date. Interactive frequency counters per template. Inline edit (date, duration, notes). Soft-delete to trash with undo.

**History Detail:** Read-only view of a completed session. Stats summary, exercise-by-exercise breakdown with sets/weights/reps, warm-up sets, cardio details, tags, notes.

**Health:** Hub page with summary cards for bodyweight, steps, and sleep. Each shows latest value, trend comparison, and sparkline. Recovery snapshot synthesizes sleep + steps.

**Bodyweight:** Full bodyweight tracking with configurable chart (raw + moving average + target range), stats (min/avg/max/change), swipeable history rows, tag system with customizable colors, duplicate date handling.

**Steps:** Step tracking with color-coded bar chart (red/amber/green by count), 7-day moving average, comparisons (week-over-week, month-over-month), streak tracking, history list.

**Sleep:** Sleep tracking with score trend (color-coded dots by score), duration chart, bedtime consistency chart (reversed Y-axis), weekly comparisons, comprehensive entry form (score, duration, bedtime, interruptions).

**Stats:** Deep analytics. Consistency heatmap (with schedule settings for rest days, vacation, program start). Volume/frequency charts. Muscle balance radar with composite scoring. Per-exercise progression charts.

**Trash:** Recover or permanently delete trashed items. Filter by type. Bulk empty.

**Weekly Recap:** Week-by-week analysis with three composite scores (Training, Recovery, Weekly). Detailed breakdowns for training, sleep, steps, bodyweight. AI-style coaching insights, went well/needs attention lists, next week focus.

---

## C. Features by Module

### Dashboard
- Current date display (format: "EEEE, MMM d")
- ASCEND logo with SVG icon
- Dark/light theme toggle button
- Weekly session count with flame icon
- Active workout resume banner (pulsing green dot, template name)
- Start workout button -> mode chooser (live vs past) -> template selector
- Past workout entry: date picker + duration (hours + minutes)
- Bodyweight card with latest weight, 7-day trend, 30-day sparkline
- Next planned workout card (based on today's day matching template schedules)
- Last workout card (name, date, duration)
- Progress this week: 4-card grid (workouts completed/planned, volume with % change, exercises improved/stalled/declined, consistency streak)
- Weekly summary sentence (contextual text)
- Weekly Recap link (gradient card)
- Trash link (conditional, only if items in trash)

### Programs
- Template list with program group sections
- Program group CRUD (create, rename with emoji, delete with cascade)
- Group emoji picker (~200+ curated emojis across 15+ categories)
- Drag-to-reorder templates across groups (pointer-based, auto-scroll, scale animation)
- Drag-to-reorder groups (entire section moves together)
- Template editor sheet: emoji, name, category, multi-day selection, group assignment
- Exercise management per template: add, remove, reorder (Framer Motion Reorder)
- Strength exercise config: warm-up text, sets, rep range (min/max), rest time (input in minutes, stored as seconds), notes
- Cardio exercise config: duration, distance, auto-computed pace, auto-inferred intensity, notes
- Exercise picker: search, muscle filter, reorder mode, create custom exercise
- Custom exercise: name, primary muscle, category, type, media upload (base64, max 10MB)
- Exercise editor: rename, change muscles, upload/remove media
- Media viewer: fullscreen overlay for images/gifs/videos
- Delete template to trash with confirmation
- Template emoji picker (~80 workout/fitness emojis)

### Live Workout
- Real-time elapsed timer (1-second interval)
- Manual entry mode (shows date + fixed duration instead of timer)
- Progress bar (percentage of sets completed)
- Session tags: quick-add bar, tag selector sheet with all 12 SessionTag values
- Strength exercise cards: warm-up system (prompt -> logging -> dismiss), working sets with previous session comparison, per-set progression indicators, rest timer, notes, skip with reason, replace with another exercise
- Cardio exercise cards: duration/distance inputs, auto-pace, intensity pills, complete toggle
- Rest timer: circular SVG progress, countdown, play/pause/reset/skip, vibration on completion
- Confetti animation at 100% completion (24 particles, 6 colors, 2.5s)
- Motivational completion message (5 options, deterministic from session ID)
- Bottom action bar: cancel, set counter with percentage, total weight moved with diff vs previous
- Finish sheet: summary stats, notes textarea, complete button
- Personal record detection on completion (max_weight and max_volume per exercise)

### History
- Text search across template names and exercise names
- Date range filter: All, 7d, 30d, 90d
- Template dropdown filter
- Interactive frequency counter pills (total + per template name)
- Sessions grouped by date with formatted headers
- Session cards: name, duration, exercise count, volume, tags, edit/delete buttons
- Inline edit sheet: date, duration, notes (preserves original time-of-day)
- Soft-delete with animated confirmation modal
- 5-second undo toast after deletion

### History Detail
- Sticky header with back button, template name, date
- Stats bar: duration, total sets (completed), total volume (or distance for cardio)
- Session tags as colored badges
- Session notes section
- Per-exercise cards: warm-up sets (amber, W1/W2 numbering), working sets table, volume, cardio details (duration/distance/pace/intensity), exercise notes
- Replaced exercise display (original + replacement names)
- Skipped exercises at 40% opacity

### Health Hub
- Bodyweight summary: latest weight, 7-day avg trend comparison, 14-point sparkline
- Steps summary: today's count (or 7-day avg), trend, 14-point bar sparkline
- Sleep summary: last score (color-coded), duration, trend, 14-point sparkline
- Recovery Snapshot: conditional message based on avg sleep score and avg steps

### Bodyweight
- Current weight card with target range status
- Range selector: 7d, 30d, 90d, 180d, 365d, 2y, 3y, all
- Chart mode toggle: Raw+MA, Raw only, MA only
- Recharts LineChart: raw line, 7-day moving average line (purple), target range band (green ReferenceArea), average ReferenceLine, target-colored dots
- Stats grid: min, avg, max, change
- Swipeable history rows (touch + mouse) with delete-on-swipe
- Diff from previous entry per row (green for loss, amber for gain)
- Add: Quick mode (weight only) vs Advanced (weight, date, note, tags)
- Duplicate date handling: Replace / Keep Both / Cancel dialog
- Edit entry: weight, date, note, tags, save/delete
- Target range: min/max, save/clear
- Tag manager: create tags, reorder (drag), per-tag color picker (16 presets + custom hex), delete with usage count warning
- 10 default bodyweight tags with predefined colors

### Steps
- Today highlight card
- Summary cards: 7-day avg with trend, best day, 10k+ streak, total logged
- ComposedChart: color-coded bars (red<5k, amber<7.5k, green<10k, dark green>=10k), 7-day MA line, average reference line
- Gap filling: all calendar days between first and last entry shown (gaps = 0)
- Comparison cards: week-over-week, month-over-month with % change
- Monthly trend sentence
- History list (30 items) with colored dots, edit/delete
- Add/edit sheet: date, step count, note

### Sleep
- Last Night card: score (0-100, color-coded), duration, quality label, bedtime-to-wake-up
- Score color system: 90+=teal/cyan, 85+=emerald, 80+=green, 60+=amber, <60=red
- Summary cards: avg score with trend, avg duration, avg bedtime with variance, best night
- Bedtime variance coloring: green<=30min std dev, amber<=60min, red>60min
- Sleep Score Trend LineChart: custom ScoreDot (each dot colored by its score value), 5-tier legend, average reference line
- Duration BarChart: bars colored by score, average duration reference line
- Bedtime Consistency LineChart: amber line, reversed Y-axis (earlier=top), time-formatted ticks, average bedtime reference line
- Weekly comparison: score and duration vs last week
- History list (30 items): colored score dot, score, duration, bedtime-wake-up, date, interruptions, note
- Add/edit sheet: date, score, duration (h+m), optional bedtime (with auto wake-up calc), interruptions, note
- Bedtime normalization: PM times mapped to negative minutes for chart continuity

### Stats
- Range selector: 7d, 30d, 90d, 1y, 2y, 3y, all
- Consistency heatmap: colored grid (emerald=workout, red=missed, sky=vacation, faint=before program), adaptive cell size, legend
- Schedule Settings sheet: program start date, rest day selector (7 buttons), vacation period manager (add/list/remove)
- Bodyweight Evolution LineChart
- Weekly Training Volume BarChart (kg, formatted to tonnes)
- Workouts Per Week BarChart (purple bars)
- Muscle Balance RadarChart (top 8 muscles by composite score)
- Muscle Breakdown list: name, trend arrow, effective sets, training days, progress bar
- Exercise Progression: dropdown selector, Best Weight LineChart, Session Volume BarChart
- Composite muscle score formula: (setsScore*0.4 + freqScore*0.3 + progressionScore*0.3) * recencyMultiplier

### Weekly Recap
- Week navigation (offset-based, Monday-Sunday)
- Three composite scores: Weekly, Training, Recovery
- Score tier coloring: 80+=emerald, 60+=amber, <60=red
- Main Takeaways (up to 5 bullets)
- Coach Summary (paragraph, darker card)
- Training Breakdown: strength/cardio counts, volume %, adherence, best session, progression signal
- Sleep Breakdown: sparkline, avg score/duration with %, bedtime/variance, best/worst nights
- Movement Breakdown: sparkline, daily avg with %, total, best/lowest days
- Bodyweight Breakdown: sparkline, avg, vs last week
- Recovery Readiness (4 tiers by score)
- Went Well / Needs Attention side-by-side cards
- Next Week Focus (2-3 actions)

### Trash
- Filter by type: session, template, exercise, bodyweight, program_group
- Per-item: restore or delete forever
- Permanent delete confirmation
- Empty Trash with confirmation (shows count)

---

## D. Data Model

### Dexie Tables (IndexedDB)

**exercises**
| Field | Type | Notes |
|-------|------|-------|
| id | string (PK) | Format: `ex-slug` |
| name | string | Indexed |
| primaryMuscle | MuscleGroup | Indexed |
| secondaryMuscle | MuscleGroup? | Legacy, optional |
| secondaryMuscles | MuscleGroup[]? | Preferred |
| category | WorkoutCategory | Indexed |
| exerciseType | ExerciseType? | |
| isCustom | boolean? | True for user-created |
| sortOrder | number? | |
| mediaUrl | string? | Base64 data URL |
| mediaType | 'image'\|'gif'\|'video'? | |

**templates**
| Field | Type | Notes |
|-------|------|-------|
| id | string (PK) | Format: `tpl-slug` |
| name | string | |
| emoji | string? | Single emoji character |
| day | string[]? | Multi-entry index, e.g. ["Monday","Thursday"] |
| category | WorkoutCategory | |
| exercises | WorkoutTemplateExercise[] | Embedded array |
| createdAt | string | ISO date |
| updatedAt | string | ISO date |

**sessions**
| Field | Type | Notes |
|-------|------|-------|
| id | string (PK) | UUID |
| templateId | string | Indexed |
| templateName | string | Denormalized |
| startedAt | string | ISO datetime, indexed |
| completedAt | string? | ISO datetime |
| duration | number? | Seconds |
| exercises | WorkoutSessionExercise[] | Embedded |
| notes | string? | |
| tags | SessionTag[] | |
| status | 'active'\|'completed'\|'cancelled' | Indexed |
| manualEntry | boolean? | For backdated entries |

**bodyweight**
| Field | Type | Notes |
|-------|------|-------|
| id | string (PK) | UUID |
| date | string | 'YYYY-MM-DD', indexed |
| weight | number | kg |
| note | string? | |
| tags | string[]? | Tag IDs |

**records** (Personal Records)
| Field | Type | Notes |
|-------|------|-------|
| id | string (PK) | UUID |
| exerciseId | string | Indexed |
| exerciseName | string | Denormalized |
| type | PRType | 'max_weight'\|'max_volume' |
| value | number | |
| weight | number? | |
| reps | number? | |
| date | string | ISO datetime |
| sessionId | string | |

**trash**
| Field | Type | Notes |
|-------|------|-------|
| id | string (PK) | UUID |
| itemType | TrashItemType | Indexed |
| itemId | string | Original item's ID |
| name | string | Display name |
| context | string? | Summary text |
| data | string | Full JSON snapshot |
| deletedAt | string | ISO datetime, indexed |

**steps**
| Field | Type | Notes |
|-------|------|-------|
| date | string (PK) | 'YYYY-MM-DD', unique |
| stepCount | number | |
| note | string? | |

**sleep**
| Field | Type | Notes |
|-------|------|-------|
| date | string (PK) | 'YYYY-MM-DD', unique |
| sleepScore | number | 1-100 |
| sleepDuration | number | Minutes |
| bedtime | string? | 'HH:MM' |
| wakeUpTime | string? | 'HH:MM' |
| interruptions | number? | |
| note | string? | |

### localStorage Data

**Template and exercise ordering:**
- `iron_template_order`: `string[]` of template IDs
- `iron_exercise_order`: `string[]` of exercise IDs

**Program groups:**
- `iron_program_groups`: `{ groups: Array<{id: string, name: string, emoji?: string}>, assignments: Record<string, string> }`

**Schedule settings:**
- `iron_program_start`: `'YYYY-MM-DD'` or absent
- `iron_rest_day`: day name string (default `'Sunday'`)
- `iron_vacations`: `Array<{id: string, start: string, end: string, note?: string}>`

**Bodyweight settings:**
- `iron_bw_target_range`: `{min: number, max: number}` or absent
- `iron_bw_tag_configs`: `Array<{id: string, label: string, color: string}>` (hex colors)
- `iron_bw_chart_mode`: `'both'` | `'raw'` | `'ma'`

**App settings:**
- `iron_theme`: `'dark'` | `'light'`
- `iron_exercise_library_v`: `'3'` (version string, bump when library changes)

---

## E. Persistence Logic

### IndexedDB (via Dexie.js)
- **Database name:** `IronDB`
- **Current schema version:** 5
- All structured data (exercises, templates, sessions, bodyweight, records, trash, steps, sleep) stored in IndexedDB
- Accessed via `dexie-react-hooks`' `useLiveQuery` for reactive UI updates
- Dexie transactions used for bulk operations (seeding, library sync)
- Steps and sleep tables use `&date` (unique constraint on date field) enabling upsert with `put()`

### localStorage
- Used for user preferences and lightweight configuration that doesn't need indexing
- Template/exercise sort orders, program group layout, schedule settings, bodyweight chart preferences, theme choice
- Exercise library version tracking

### Data Lifecycle
- Templates and exercises are the core configuration layer
- Sessions are created from templates (copying exercise structure) and become independent records
- Personal records are derived from session data on completion
- Trash items store a full JSON snapshot of the original data for potential restoration
- No server sync, no cloud backup -- all data is browser-local

### Migration History
1. **v1:** Initial schema (exercises, templates, sessions, bodyweight, records)
2. **v2:** Exercise library expansion (adds missing exercises from updated library)
3. **v3:** Template `day` field migrated from `string` to `string[]`; multi-entry index; exercise library updates (new exercises, name corrections, secondary muscles)
4. **v4:** Added `trash` table
5. **v5:** Added `steps` and `sleep` tables with unique date primary keys

### Library Sync (runs every app start)
- Compares `iron_exercise_library_v` in localStorage against current version
- If different: adds missing exercises, updates all non-custom exercises with latest data (name, primaryMuscle, secondaryMuscles, category, exerciseType)
- Ensures the exercise library is always complete regardless of migration state

---

## F. Core Logic / Rules

### Workout Session Flow
1. User selects template -> session created with `status: 'active'`
2. For live workouts: timer starts from `startedAt`, increments each second
3. For manual entries: `startedAt` is set to chosen date at noon, duration is pre-set
4. User logs sets, skips/replaces exercises, adds tags
5. On finish: `completeSession()` marks as completed, calculates duration, scans for PRs
6. On cancel: `cancelSession()` marks as cancelled (stays in DB but filtered out of queries)

### Personal Record Detection
On session completion, for each non-skipped exercise:
- **max_weight:** Compares each completed set's weight against all existing `max_weight` records for that exercise. If higher, creates a new PR.
- **max_volume:** Sums `weight * reps` across all completed sets for the exercise. Compares against existing `max_volume` record. If higher, creates a new PR.

### Set Progression Comparison
`compareSetProgress(currentWeight, currentReps, prevWeight, prevReps)`:
- Weight: straightforward comparison (up/down/same/none)
- **Reps: only compared when weight is identical.** This is critical -- if a user increased weight but did fewer reps, that's progress, not regression. The reps field returns `'none'` when weights differ.
- Returns `{ weight, reps, weightDiff, repsDiff }`

### Volume Calculation
- Per-set: `weight * reps`
- Per-exercise: sum of all completed sets
- Per-session: sum of all exercises
- Display: raw kg if < 1000, formatted as `X.Xt` (tonnes) if >= 1000

### Consistency Streak
Walk backwards from today:
1. If today has a workout: count it
2. If today has no workout AND today isn't a rest day AND today isn't in a vacation period: start from yesterday
3. For each day going back:
   - Has workout -> increment count
   - Is rest day (configurable, default Sunday) -> skip (doesn't break streak)
   - Is in a vacation period -> skip
   - Is before program start date -> stop
   - Otherwise -> break streak

### Exercise Progress Comparison (Dashboard)
For each session this week:
1. Find the previous completed session for the same template
2. For each non-skipped, non-cardio exercise that exists in both sessions:
3. Compare best completed set (sort by weight desc, then reps desc)
4. Weight up -> improved; same weight + more reps -> improved; same weight + same reps -> stalled; weight down OR (same weight + fewer reps) -> declined

### Muscle Balance Scoring (Stats)
For each muscle group across all sessions in the time range:
1. **Effective sets:** Primary muscle gets 1.0 credit per set, secondary muscles get 0.5 credit
2. **Training days:** Count unique calendar days the muscle was trained
3. **Progression:** Compare average best-set-weight in the second half of the time range vs the first half
4. Sub-scores:
   - Sets Score (40%): normalized against the muscle with the most effective sets
   - Frequency Score (30%): normalized against the muscle with the most training days
   - Progression Score (30%): maps -20% change to 0, 0% to 50, +20% to 100 (linear interpolation)
5. Recency multiplier: if the muscle was trained in the most recent 25% of the time range, multiplier = 1.0; otherwise linear decay down to 0.4
6. Final: `(setsScore * 0.4 + freqScore * 0.3 + progressionScore * 0.3) * recencyMultiplier`, clamped 0-100

### Weekly Recap Scoring

**Training Score** = adherence * 0.5 + volumeTrend * 0.25 + countScore * 0.25
- Adherence = (sessionsThisWeek / plannedDays) * 100
- Volume trend = 50 + ((thisWeekVolume - lastWeekVolume) / lastWeekVolume * 100) * 0.5, clamped 0-100
- Count score: tiered (5+=100, 4=85, 3=70, 2=50, 1=30, 0=0)

**Recovery Score** = sleepScore * 0.5 + durationScore * 0.25 + consistencyScore * 0.25
- Sleep score = average of all sleep scores for the week
- Duration score = (avgDurationMinutes / 480) * 100 (8 hours = perfect score)
- Consistency = 100 - bedtimeStdDevMinutes * 1.5, clamped 0-100

**Weekly Score** = training * 0.35 + recovery * 0.30 + movement * 0.20 + bwStability * 0.15
- Movement = (avgDailySteps / 10000) * 100
- BW stability = 100 - bodyweightStdDev * 20, clamped 0-100

### Rest Day and Vacation Logic
- Rest day: a single day of the week (stored as day name like "Sunday")
- Vacation periods: array of `{start, end}` date ranges
- `isDateInVacation(dateStr, periods)`: returns true if dateStr >= any period.start AND dateStr <= any period.end
- These affect: streak calculation (excused days), heatmap coloring (vacation=sky, rest=gray)

### Bodyweight Target Range
- Optional min/max range (kg)
- Chart dots colored: red (above max), blue (below min), green (within)
- Green ReferenceArea band on chart with dashed border lines
- Status text on current weight card

### Moving Average Calculation (Bodyweight)
7-day simple moving average: for each data point, average the weight of that point and up to 6 preceding points.

### Sleep Bedtime Normalization
`normalizeBedtime(timeStr)`: Converts "HH:MM" to minutes relative to midnight, but wraps times between 18:00-23:59 to negative values (e.g., 23:00 = -60, 22:00 = -120). This ensures chart lines flow naturally from late evening to early morning without jumps.

### Step Bar Color Thresholds
- < 5,000: red (#ef4444)
- 5,000 - 7,499: amber (#f59e0b)
- 7,500 - 9,999: green (#22c55e)
- >= 10,000: dark green (#16a34a)

### Sleep Score Color Thresholds
- >= 90: teal/cyan
- >= 85: emerald
- >= 80: green
- >= 60: amber
- < 60: red

### Trend Comparison Logic (Health hub)
`trendIcon(current, previous, invert?)`:
- Computes percentage change
- >= +3%: up (green arrow, or amber if `invert`)
- <= -3%: down (amber arrow, or green if `invert`)
- Otherwise: stable (gray minus icon)

---

## G. UI / Design System

### Theme Architecture
- CSS custom properties define the zinc color scale
- `.dark` class on `<html>` activates the dark palette (standard zinc)
- Absence of `.dark` activates the light palette (inverted zinc -- zinc-50 becomes dark, zinc-950 becomes light)
- All component classes use the same zinc tokens regardless of theme
- `--color-zinc-925: #101013` (dark) / `#f9f9fa` (light) -- custom intermediate

### Color System
| Purpose | Colors |
|---------|--------|
| Background | zinc-950 (page), zinc-900/50 (cards), zinc-800 (elevated) |
| Text | zinc-50 (primary), zinc-300-400 (secondary), zinc-500-600 (tertiary) |
| Borders | zinc-800/50 (cards), zinc-700 (inputs), zinc-600 (focus) |
| Brand | Blue gradient #3b82f6 to #2563eb (logo) |
| Success | emerald-400/500 (text/bg at 15-20% opacity) |
| Warning | amber-400/500 |
| Danger | red-400/500 |
| Info | blue-400/500 |
| Purple accents | violet-400/500 (moving average, specific charts) |

### Card Style
- `rounded-2xl` (16px border radius)
- `border border-zinc-800/50` (subtle border at 50% opacity)
- `bg-zinc-900/50` (semi-transparent dark background)
- `p-4` padding
- Clickable variant adds hover/active states

### Typography
- System sans-serif font stack
- Antialiased rendering (`-webkit-font-smoothing: antialiased`)
- Size scale: text-[9px] (attribution) to text-3xl (logo)
- Font weights: medium (400), semibold (600), bold (700), extrabold (800)
- tracking-tight for headings, tracking-wider for label caps

### Spacing
- Page padding: `px-4 pt-14 pb-4` (dashboard), `pb-20` (main content area for nav clearance)
- Card spacing: `space-y-4` between cards
- Grid gaps: `gap-2.5` (stat grids), `gap-3` (card lists)
- Input padding: `px-4 py-3` (standard), `px-2 py-1.5` (compact)

### Chart Style (Recharts)
- Dark tooltip: bg zinc-900, border zinc-800, radius 8px, shadow
- Grid lines: zinc-800 at 30% opacity
- Axis labels: zinc-500/600, text-xs
- Line strokes: 1.5-2px
- Bar radius: rounded tops
- Dots: 3-4px radius
- All charts in ResponsiveContainer

### Animation Patterns (Framer Motion)
- Sheets: spring animation (damping 25-30, stiffness 300-350)
- Lists: AnimatePresence with opacity + height transitions
- Drag-and-drop: pointer-based with smooth CSS transitions (200ms cubic-bezier)
- Confetti: 24 particles with random trajectories, Framer Motion keyframes
- Completion banner: shimmer keyframe animation (translateX -100% to 100%)

### Mobile-First Patterns
- `active:` pseudo-classes instead of `hover:` for touch
- `dvh` (dynamic viewport height) units
- Safe area insets for notch/home indicator
- `-webkit-tap-highlight-color: transparent`
- `overscroll-behavior: none`
- Number input spinners hidden
- Touch-friendly hit targets (minimum 44px)
- Bottom sheet on mobile, centered modal on desktop (640px breakpoint)

### Branding
- **App name:** ASCEND
- **Logo:** Three ascending bars with upward arrow, blue gradient accent
- **Loading screen:** Centered "ASCEND" text with "Loading..." on zinc-950 background
- **Attribution:** "Made by Lyskey" in bottom nav

---

## H. Charts / Analytics

### Dashboard Charts
| Chart | Type | Data | Details |
|-------|------|------|---------|
| Bodyweight sparkline | LineChart | Last 30 days | No axes, no dots, zinc-400 stroke, 24x48px |

### Bodyweight Charts
| Chart | Type | Data | Details |
|-------|------|------|---------|
| Weight trend | LineChart | Filtered by range | Raw line + 7-day MA (purple), target range band (green), average line (dashed), target-colored dots |

### Steps Charts
| Chart | Type | Data | Details |
|-------|------|------|---------|
| Daily steps | ComposedChart | All days in range (gap-filled) | Color-coded bars (red/amber/green by count), 7-day MA line (blue, hidden for 7d), average reference line |

### Sleep Charts
| Chart | Type | Data | Details |
|-------|------|------|---------|
| Score trend | LineChart | Filtered entries | Custom ScoreDot colored by score value, 5-tier legend, average reference line |
| Duration | BarChart | Filtered entries | Bars colored by score (not duration), avg duration reference line |
| Bedtime consistency | LineChart | Entries with bedtime | Amber line, reversed Y-axis, time-formatted ticks, avg bedtime reference |

### Stats Charts
| Chart | Type | Data | Details |
|-------|------|------|---------|
| Consistency heatmap | Custom grid | Daily classification | Emerald=workout, red=missed, sky=vacation, adaptive cell size |
| Bodyweight evolution | LineChart | Filtered entries | Standard line chart |
| Weekly volume | BarChart | Weekly buckets | Volume in kg, Y-axis formats to tonnes |
| Workouts/week | BarChart | Weekly buckets | Purple bars, session count |
| Muscle balance | RadarChart | Top 8 muscles | Composite score 0-100 |
| Exercise weight | LineChart | Per-exercise sessions | Emerald, best weight per session |
| Exercise volume | BarChart | Per-exercise sessions | Indigo, total volume per session |

### Health Hub Sparklines
| Chart | Data | Type |
|-------|------|------|
| Bodyweight | Last 14 entries | LineChart, no dots |
| Steps | Last 14 entries | BarChart |
| Sleep | Last 14 entries | LineChart, no dots |

### Weekly Recap Sparklines
- Sleep: MiniLine (score trend for the week)
- Steps: MiniBar (daily steps for the week)
- Bodyweight: MiniLine (daily weights for the week)

---

## I. Weekly Recap Logic (Detailed)

### Data Collection (`useWeekData` hook)
- Takes `weekOffset` (0 = current, -1 = last, etc.)
- Week boundaries: Monday 00:00 to Sunday 23:59
- Collects: sessions, sleep entries, step entries, bodyweight entries for both current and previous week
- `plannedDays`: unique days from template schedules, falling back to actual session count

### Training Score
```
adherence = min(100, (sessions.length / plannedDays) * 100)
volumeChange = (thisWeekVolume - lastWeekVolume) / lastWeekVolume
volumeTrend = clamp(0, 100, 50 + volumeChange * 100 * 0.5)
countScore = {0:0, 1:30, 2:50, 3:70, 4:85, 5+:100}
trainingScore = adherence * 0.5 + volumeTrend * 0.25 + countScore * 0.25
```

Additional training data:
- strengthSessionCount / cardioSessionCount
- totalVolume, volumeChangePercent
- bestSession (by volume, name included)
- progressionSignal: 'up' if volume increased by >3%, 'down' if decreased by >3%, else 'stable'

### Recovery Score
```
sleepAvgScore = average of all sleepScore values for the week
durationScore = min(100, (avgDurationMinutes / 480) * 100)
bedtimeStdDev = standard deviation of normalized bedtime minutes
consistencyScore = clamp(0, 100, 100 - bedtimeStdDev * 1.5)
recoveryScore = sleepAvgScore * 0.5 + durationScore * 0.25 + consistencyScore * 0.25
```

Additional recovery data:
- avgSleepDuration, bedtimeConsistency (std dev in minutes)
- bestNight / worstNight (by score, with day names)

### Weekly Score
```
movementScore = min(100, (avgDailySteps / 10000) * 100)
bwEntries = bodyweight entries for the week
bwStdDev = standard deviation of weights
bwStability = clamp(0, 100, 100 - bwStdDev * 20)
weeklyScore = trainingScore * 0.35 + recoveryScore * 0.30 + movementScore * 0.20 + bwStability * 0.15
```

### Score Tier Colors
| Score | Color | Label |
|-------|-------|-------|
| >= 80 | emerald | Excellent / Strong |
| >= 60 | amber | Good / Moderate |
| < 60 | red | Needs Work / Low |

### Insight Generators

**Main Takeaways** (up to 5 items):
1. Training adherence vs planned (e.g., "Completed 4/5 planned sessions")
2. Volume progression (e.g., "Training volume increased 12% from last week")
3. Sleep quality (e.g., "Average sleep score was 82 -- good recovery") + bedtime consistency note
4. Steps trend (e.g., "Daily steps averaged 8,500")
5. Bodyweight stability (e.g., "Weight held steady around 81.2 kg")

**Coach Summary** (single paragraph):
- Opens with overall assessment based on weekly score tier
- Covers training (adherence, volume trend), recovery (sleep, bedtime), movement (steps), bodyweight
- Tone is analytical and actionable, not cheerful

**Went Well** (up to 4 items): Checks training adherence >= 80%, volume increase, sleep score >= 75, bedtime consistency <= 30min, steps >= 8000, BW stability (std dev < 0.5), best session name.

**Needs Attention** (up to 4 items): Checks training adherence < 70%, sleep score < 65, bedtime variance > 45min, sleep duration < 420min (7h), steps < 6000.

**Next Week Focus** (up to 3 items): Actionable based on weakest areas. E.g., "Aim to complete all 5 planned sessions", "Prioritize sleep quality -- target 7.5+ hours", "Stabilize bedtime within a 30-minute window", "Raise daily steps to at least 8,000".

### Missing Data Handling
- If no sessions: training score = 0, show "No workouts logged"
- If no sleep entries: recovery score is training score * 0.5 (degraded), show "Log sleep for recovery insights"
- If no step entries: movement component = 0
- If no bodyweight entries: BW stability component = 50 (neutral)
- If no data at all for the week: show empty state card instead of all sections

---

## J. Rebuild Priorities

### Critical (Must Preserve Exactly)
1. **Database schema and migration path** -- data integrity depends on correct Dexie versions
2. **Set progression comparison logic** -- reps only compared at same weight
3. **Weekly Recap scoring formulas** -- exact weights and thresholds
4. **Muscle balance composite scoring** -- the most complex computation
5. **Streak calculation** -- rest day and vacation exemptions
6. **Trash system** -- type-aware soft-delete with JSON serialization and defensive restore
7. **Exercise library sync** -- version-based, updates non-custom exercises

### High Priority (Core UX)
8. **Live workout flow** -- timer, set logging, warm-up system, rest timer with vibration, progression indicators
9. **Sheet component** -- responsive (bottom sheet mobile, modal desktop), portal rendering, scroll lock
10. **Theme system** -- CSS variable inversion, FOUC prevention script
11. **Program groups with drag-and-drop** -- pointer-based, auto-scroll, cross-group moves
12. **Bodyweight chart** -- target range coloring, moving average, chart mode toggle

### Important (Full Feature Set)
13. **Sleep bedtime normalization** for chart continuity
14. **Step color coding** by count thresholds
15. **Health hub** with trend comparisons and sparklines
16. **Confetti animation** on workout completion
17. **Template seeding** with 5 realistic programs and 6 weeks of history
18. **PWA manifest** and mobile-web-app meta tags

### Nice to Have (Polish)
19. Custom exercise media upload (base64)
20. Exercise library reorder mode
21. History edit (date/duration/notes)
22. Tag manager with color picker
23. Shimmer animation on completion banner

---

## K. Recommended Tech Stack

### Current Stack (recommended for rebuild)

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | React | 19 | UI library |
| Language | TypeScript | 6 | Type safety |
| Bundler | Vite | 8 | Fast dev/build |
| Styling | Tailwind CSS | 4 | Utility-first CSS |
| Storage | Dexie.js | 4 | IndexedDB wrapper |
| Reactive queries | dexie-react-hooks | 4 | Live query hooks |
| Charts | Recharts | 3 | Data visualization |
| Animation | Framer Motion | 12 | UI animations |
| Routing | React Router | 7 | Client-side routing |
| Icons | Lucide React | 1 | Icon library |
| Dates | date-fns | 4 | Date utilities |
| IDs | uuid | 13 | UUID generation |

### Tailwind CSS v4 Setup
- Uses `@import "tailwindcss"` syntax (not `@tailwind` directives)
- Integrated via `@tailwindcss/vite` plugin (not PostCSS)
- Custom properties defined in `@theme` blocks
- Dark mode via CSS class strategy (`.dark` on html)

### Important Patterns
- Path alias `@` -> `./src` (configured in vite.config.ts resolve.alias)
- All Dexie queries wrapped in `useLiveQuery` for automatic re-rendering
- localStorage used for lightweight config (not for structured data)
- Components are colocated by domain (pages, components/ui, components/layout, components/workout, components/brand)
- Hooks are the data access layer (no service classes, no Redux)

---

## L. File / Code Architecture

### Recommended Directory Structure

```
src/
├── main.tsx                          # Entry point
├── App.tsx                           # Router + providers + seed
├── index.css                         # Tailwind + theme + global styles
├── vite-env.d.ts                     # Vite type declarations
│
├── db/
│   ├── database.ts                   # Dexie DB class, schema, migrations, sync
│   ├── types.ts                      # All TypeScript types, enums, constants, color maps
│   ├── exerciseLibrary.ts            # Full exercise library (~187 exercises)
│   └── seed.ts                       # Seed data generator (templates, sessions, bodyweight, PRs)
│
├── hooks/
│   ├── useWorkout.ts                 # Core data layer: all CRUD, queries, session logic, PR detection
│   ├── useScheduleSettings.ts        # localStorage: program start, rest day, vacations
│   ├── useTrash.ts                   # Trash system: soft delete, restore, empty
│   ├── useTheme.tsx                  # Theme context provider + toggle
│   ├── useTimer.ts                   # Countdown rest timer with vibration
│   └── useMediaQuery.ts             # Responsive breakpoint detection
│
├── components/
│   ├── brand/
│   │   └── AscendLogo.tsx            # SVG logo + text
│   ├── layout/
│   │   ├── AppLayout.tsx             # Max-width wrapper + Outlet + BottomNav
│   │   └── BottomNav.tsx             # Fixed 5-tab navigation
│   ├── ui/
│   │   ├── Card.tsx                  # Card + CardTitle + CardValue
│   │   ├── Button.tsx                # 4 variants, 3 sizes
│   │   ├── Badge.tsx                 # 5 variants
│   │   ├── EmptyState.tsx            # Zero-data placeholder
│   │   └── Sheet.tsx                 # Responsive bottom sheet / modal
│   └── workout/
│       ├── ExerciseCard.tsx           # Strength exercise card (sets, warm-up, timer, progression)
│       ├── CardioExerciseCard.tsx     # Cardio exercise card (duration, distance, intensity)
│       ├── RestTimer.tsx              # Circular progress rest timer
│       ├── SetRow.tsx                 # Single set row with inputs + completion + progression
│       └── TemplateSelector.tsx       # Template picker sheet
│
├── pages/
│   ├── Dashboard.tsx                 # Home page
│   ├── Programs.tsx                  # Template + exercise management (largest file)
│   ├── LiveWorkout.tsx               # Active workout tracking
│   ├── History.tsx                   # Session history list
│   ├── HistoryDetail.tsx             # Single session view
│   ├── Health.tsx                    # Health hub
│   ├── Bodyweight.tsx                # Bodyweight tracking
│   ├── Steps.tsx                     # Steps tracking
│   ├── Sleep.tsx                     # Sleep tracking
│   ├── Stats.tsx                     # Analytics + heatmap + muscle balance
│   ├── Trash.tsx                     # Trash management
│   └── WeeklyRecap.tsx              # Weekly coaching recap
│
public/
├── manifest.json                     # PWA manifest
├── favicon.svg                       # SVG favicon
└── icons.svg                         # Additional icons

index.html                            # SPA entry with dark mode FOUC prevention
vite.config.ts                        # Vite + React + Tailwind plugins + @ alias
package.json                          # Dependencies
tsconfig.json / tsconfig.app.json     # TypeScript config
```

### Build Order (if rebuilding from scratch)

1. **Foundation:** Vite + React + TypeScript + Tailwind setup, path aliases
2. **Types + Database:** `types.ts` -> `database.ts` -> `exerciseLibrary.ts`
3. **Core hooks:** `useWorkout.ts` (data layer) -> `useTheme.tsx` -> `useTimer.ts` -> `useMediaQuery.ts`
4. **UI primitives:** Card, Button, Badge, EmptyState, Sheet
5. **Layout:** AppLayout, BottomNav, AscendLogo
6. **Workout components:** SetRow -> ExerciseCard -> CardioExerciseCard -> RestTimer -> TemplateSelector
7. **Pages (in order of dependency):**
   - Dashboard (needs sessions, bodyweight, templates hooks)
   - Programs (needs templates, exercises, full template editor)
   - LiveWorkout (needs session management, exercise cards, timer)
   - History + HistoryDetail
   - Health hub
   - Bodyweight, Steps, Sleep
   - Stats (needs all data, most complex computations)
   - Weekly Recap (needs all data, complex scoring)
   - Trash
8. **Seed data:** `seed.ts` for demo data
9. **Polish:** PWA manifest, FOUC prevention, theme toggle, global CSS

---

## M. Code Recovery / Rebuild Support

### Most Important Files to Preserve (Priority Order)

| Priority | File | Reason |
|----------|------|--------|
| 1 | `src/db/types.ts` | All type definitions, constants, color maps -- foundational |
| 2 | `src/db/database.ts` | Schema definition, migrations, library sync |
| 3 | `src/hooks/useWorkout.ts` | Entire data access layer, PR detection, session management |
| 4 | `src/db/exerciseLibrary.ts` | 187 exercises with muscles and categories |
| 5 | `src/hooks/useTrash.ts` | Trash system with type-aware restore |
| 6 | `src/pages/WeeklyRecap.tsx` | Complex scoring engine, insight generators |
| 7 | `src/pages/Stats.tsx` | Muscle balance computation, heatmap, schedule settings |
| 8 | `src/pages/Programs.tsx` | Template editor, exercise picker, drag-and-drop, groups |
| 9 | `src/pages/LiveWorkout.tsx` | Live workout flow, confetti, completion logic |
| 10 | `src/components/workout/ExerciseCard.tsx` | Warm-up system, progression indicators |
| 11 | `src/pages/Bodyweight.tsx` | Chart with MA + target range, tag system, swipeable rows |
| 12 | `src/pages/Sleep.tsx` | Bedtime normalization, score coloring |
| 13 | `src/pages/Steps.tsx` | Color-coded bars, gap filling |
| 14 | `src/index.css` | Theme system (CSS variable inversion), global styles |
| 15 | `src/components/ui/Sheet.tsx` | Responsive modal/bottom-sheet |
| 16 | `src/hooks/useScheduleSettings.ts` | Schedule settings (rest day, vacation, program start) |
| 17 | `src/hooks/useTheme.tsx` | Theme context |
| 18 | `src/hooks/useTimer.ts` | Rest timer with vibration |
| 19 | `src/components/workout/SetRow.tsx` | Set input row with progression pills |
| 20 | `src/db/seed.ts` | Demo data generator |

### Files Containing Critical Business Logic

| File | Logic |
|------|-------|
| `useWorkout.ts` | `compareSetProgress()` -- reps only compared at same weight |
| `useWorkout.ts` | `completeSession()` -- PR detection (max_weight, max_volume) |
| `useWorkout.ts` | `buildSessionExercises()` -- template-to-session exercise mapping |
| `WeeklyRecap.tsx` | `computeScores()` -- Training/Recovery/Weekly score formulas |
| `WeeklyRecap.tsx` | `generateTakeaways/CoachSummary/WentWell/NeedsAttention/NextWeekFocus` |
| `Stats.tsx` | Muscle balance composite scoring with recency multiplier |
| `Stats.tsx` | Consistency heatmap day classification |
| `Dashboard.tsx` | Streak calculation with rest day/vacation exemptions |
| `Dashboard.tsx` | Exercise progress comparison (improved/stalled/declined) |
| `useTrash.ts` | Type-aware trash/restore with cascade logic |
| `database.ts` | Exercise library sync with version checking |
| `Sleep.tsx` | `normalizeBedtime()` -- PM-to-negative conversion for chart continuity |
| `Bodyweight.tsx` | Moving average calculation, target range dot coloring |

### Rebuild Order (If Restoring from Code Fragments)

**Phase 1 -- Data Layer (get data in/out first)**
1. Install dependencies (`npm create vite@latest` with React+TS template, then add all packages)
2. Copy `types.ts` -- everything depends on these types
3. Copy `database.ts` -- establishes the DB schema
4. Copy `exerciseLibrary.ts` -- the exercise catalog
5. Copy `useWorkout.ts` -- all CRUD operations
6. Copy `useScheduleSettings.ts`, `useTrash.ts`, `useTheme.tsx`, `useTimer.ts`, `useMediaQuery.ts`
7. Copy `seed.ts` -- to have demo data on first launch

**Phase 2 -- UI Framework (get something visible)**
8. Copy `index.css` -- theme system, global styles
9. Copy `index.html` -- FOUC prevention, PWA meta tags
10. Copy `vite.config.ts` -- plugins, path alias
11. Copy UI primitives: Card, Button, Badge, EmptyState, Sheet
12. Copy layout: AppLayout, BottomNav, AscendLogo
13. Copy `App.tsx` and `main.tsx` -- routing, providers

**Phase 3 -- Core Pages (in dependency order)**
14. Copy `Dashboard.tsx` -- verify it renders with data
15. Copy workout components: SetRow, ExerciseCard, CardioExerciseCard, RestTimer, TemplateSelector
16. Copy `LiveWorkout.tsx` -- verify workout flow works end-to-end
17. Copy `Programs.tsx` -- template editing, exercise management
18. Copy `History.tsx` + `HistoryDetail.tsx`

**Phase 4 -- Health & Analytics**
19. Copy `Health.tsx`, `Bodyweight.tsx`, `Steps.tsx`, `Sleep.tsx`
20. Copy `Stats.tsx` -- most complex analytics
21. Copy `WeeklyRecap.tsx` -- most complex scoring
22. Copy `Trash.tsx`

**Phase 5 -- Polish**
23. Verify PWA (manifest.json, icons)
24. Test theme toggle
25. Test all charts render correctly
26. Verify seed data generates properly

### Setup Steps (Fresh Machine)

```bash
# 1. Create project
npm create vite@latest iron-workout-tracker -- --template react-ts
cd iron-workout-tracker

# 2. Install dependencies
npm install react-router-dom dexie dexie-react-hooks recharts framer-motion lucide-react date-fns uuid
npm install -D @tailwindcss/vite @types/uuid @types/node tailwindcss

# 3. Configure vite.config.ts
# - Add @vitejs/plugin-react and @tailwindcss/vite plugins
# - Add resolve.alias: { '@': './src' }

# 4. Configure tsconfig.app.json
# - Add "paths": { "@/*": ["./src/*"] }

# 5. Copy source files in the order described above

# 6. Add public files (manifest.json, favicon.svg)

# 7. Run
npm run dev
```

### Key Dependencies Between Files

```
types.ts ← database.ts ← exerciseLibrary.ts ← seed.ts
types.ts ← useWorkout.ts ← (all pages)
types.ts ← useTrash.ts ← (History, Programs, Trash, Dashboard)
useScheduleSettings.ts ← (Dashboard streak, Stats heatmap)
useTheme.tsx ← App.tsx, Dashboard.tsx
useTimer.ts ← RestTimer.tsx ← ExerciseCard.tsx ← LiveWorkout.tsx
useMediaQuery.ts ← Sheet.tsx ← (many pages)
Sheet.tsx ← (almost every page uses sheets)
Card/Button/Badge ← (almost every page)
```
