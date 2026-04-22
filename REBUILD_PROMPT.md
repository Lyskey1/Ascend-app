# ASCEND - Master Rebuild Prompt

> Paste this entire prompt into Claude to rebuild the ASCEND workout tracker app from scratch.

---

## Prompt Start

Build me a complete PWA workout tracker called **ASCEND**. The package name is `iron-workout-tracker`. This is a mobile-first, dark-themed fitness tracking app built as a single-page application. It must be fully client-side with zero backend -- all data lives in the browser via IndexedDB (Dexie.js) and localStorage.

---

### Tech Stack (exact)

- **React 19** with TypeScript
- **Vite** as bundler with `@vitejs/plugin-react`
- **Tailwind CSS v4** via `@tailwindcss/vite` (uses `@import "tailwindcss"` syntax, CSS custom properties for theming)
- **Dexie.js v4** for IndexedDB (with `dexie-react-hooks` for live queries)
- **Recharts** for all charts and visualizations
- **Framer Motion** for animations (sheets, drag-and-drop, confetti, transitions)
- **React Router v7** for client-side routing
- **Lucide React** for all icons
- **date-fns** for date manipulation
- **uuid** for ID generation
- Path alias: `@` maps to `./src`

---

### App Identity & Branding

- **Name**: ASCEND
- **PWA manifest**: `name: "ASCEND - Workout Tracker"`, `short_name: "ASCEND"`, `display: "standalone"`, `background_color: "#09090b"`, `theme_color: "#09090b"`
- **Logo**: SVG with 3 rising bars (ascending heights) plus an upward arrow/peak at the top. Left bar is zinc-500, center bar uses a blue gradient (#3b82f6 to #2563eb), right bar is zinc-400. The word "ASCEND" in font-extrabold tracking-tight text-zinc-50.
- **Logo sizes**: sm (20px icon), md (28px icon, text-2xl), lg (36px icon, text-3xl). Supports `full` (icon + text) and `icon` variants.
- **Favicon**: SVG
- **Attribution**: "Made by Lyskey" with link to https://x.com/Lyskey in the bottom nav

---

### Design System

**Dark-first theme with light mode support:**
- Default is dark mode (`.dark` class on `<html>`)
- Theme toggle via localStorage key `iron_theme` (values: `'dark'` or `'light'`)
- Light theme works by **inverting the zinc CSS custom properties** -- zinc-50 becomes near-black, zinc-950 becomes near-white. This means all component classes stay identical between themes.
- Custom color: `--color-zinc-925: #101013` (dark) / `#f9f9fa` (light)
- Theme-color meta tag updates dynamically: `#09090b` for dark, `#fafafa` for light
- Inline script in `<head>` prevents FOUC by reading localStorage before first paint

**Card system:**
- `Card`: `rounded-2xl border border-zinc-800/50 bg-zinc-900/50 p-4`. Clickable variant adds `cursor-pointer active:bg-zinc-800/50 transition-colors`
- `CardTitle`: `text-sm font-medium text-zinc-400`
- `CardValue`: `text-2xl font-bold text-zinc-50`

**Button variants:**
- `primary`: white bg, zinc-900 text, semibold, shadow-lg
- `secondary`: zinc-800 bg, zinc-100 text, border zinc-700
- `ghost`: zinc-400 text, transparent bg
- `danger`: red-500/15 bg, red-400 text
- Sizes: sm (text-xs, rounded-lg), md (text-sm, rounded-xl), lg (text-base, rounded-2xl)

**Badge variants:** default (zinc-800), success (emerald-500/15), warning (amber-500/15), danger (red-500/15), neutral (zinc-700/50). All are rounded-full pills.

**Sheet component (responsive):**
- Mobile: bottom sheet sliding up from bottom, rounded-t-3xl, max-h-[90dvh], with safe area padding
- Desktop (>640px): centered modal with scale animation, max-w-lg, max-h-[85vh], rounded-2xl
- Backdrop: black/60 with backdrop-blur-sm
- Body scroll locked when open
- Rendered via portal to document.body

**General patterns:**
- All corners are 2xl (16px) for cards, xl for inputs, full for badges/pills
- Touch interactions use `active:` states, not `hover:`
- Spacing is tight and mobile-optimized
- Font: system sans-serif
- Antialiased rendering globally
- Number input spinners are hidden
- Custom scrollbar: 4px wide, zinc-colored at 20% opacity
- Safe area insets respected (env(safe-area-inset-bottom))
- `-webkit-tap-highlight-color: transparent` and `overscroll-behavior: none`

---

### Layout & Navigation

**AppLayout wrapper:**
- `mx-auto min-h-dvh max-w-lg sm:max-w-2xl lg:max-w-4xl bg-zinc-950`
- Main content has `pb-20` for bottom nav clearance
- Contains `<Outlet />` and `<BottomNav />`

**Bottom navigation (5 tabs):**
| Path | Icon | Label |
|------|------|-------|
| `/` | Home | Home |
| `/programs` | Dumbbell | Programs |
| `/history` | Clock | History |
| `/health` | Heart | Health (also matches `/bodyweight`, `/steps`, `/sleep`) |
| `/stats` | BarChart3 | Stats |

- Fixed bottom, z-50, bg-zinc-950/90 with backdrop-blur-xl, border-t
- Active tab: `text-white`. Inactive: `text-zinc-500`
- Icons are h-5 w-5, labels are text-[10px]

**Routes:**
- `/` - Dashboard
- `/programs` - Programs (template management)
- `/history` - Session history list
- `/history/:id` - Session detail
- `/health` - Health hub
- `/bodyweight` - Bodyweight tracking
- `/steps` - Steps tracking
- `/sleep` - Sleep tracking
- `/stats` - Statistics & analytics
- `/trash` - Trash bin
- `/recap` - Weekly recap
- `/workout/:id` - Live workout (NO bottom nav, NOT inside AppLayout)

---

### Database Schema (Dexie/IndexedDB)

Database name: `IronDB`. Version 5 (with migration history).

**Tables:**

```
exercises:   id, name, primaryMuscle, category
templates:   id, name, category, *day  (multi-entry index on day)
sessions:    id, templateId, startedAt, status
bodyweight:  id, date
records:     id, exerciseId, type, date
trash:       id, itemType, deletedAt
steps:       &date  (unique primary key on date)
sleep:       &date  (unique primary key on date)
```

**Data Types:**

```typescript
MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs' | 'cardio' | 'full_body'

WorkoutCategory = 'upper_push' | 'upper_pull' | 'legs' | 'shoulders' | 'cardio' | 'full_body' | 'rest' | 'custom'

SessionTag = 'good_energy' | 'bad_sleep' | 'travel' | 'stomach_issues' | 'stress' | 'great_pump' | 'low_motivation' | 'gym_crowded' | 'different_gym' | 'pain_discomfort' | 'deload' | 'pr_day'

ExerciseType = 'compound' | 'isolation' | 'cardio' | 'bodyweight' | 'mobility'

Exercise {
  id, name, primaryMuscle: MuscleGroup, secondaryMuscle?: MuscleGroup,
  secondaryMuscles?: MuscleGroup[], category: WorkoutCategory,
  exerciseType?: ExerciseType, isCustom?: boolean, sortOrder?: number,
  mediaUrl?: string, mediaType?: 'image' | 'gif' | 'video'
}

WorkoutTemplate {
  id, name, emoji?: string, day?: string[] (day names like "Monday"),
  category: WorkoutCategory, exercises: WorkoutTemplateExercise[],
  createdAt, updatedAt
}

WorkoutTemplateExercise {
  id, exerciseId, order, targetSets, targetRepsMin, targetRepsMax,
  restSeconds, warmup?: string, notes?: string, machineSetup?: string,
  alternativeExerciseId?: string, progressionNote?: string,
  cardioDuration?: number, cardioDistance?: number,
  cardioPace?: string, cardioIntensity?: CardioIntensity
}

WorkoutSession {
  id, templateId, templateName, startedAt, completedAt?, duration?,
  exercises: WorkoutSessionExercise[], notes?, tags: SessionTag[],
  status: 'active' | 'completed' | 'cancelled', manualEntry?: boolean
}

WorkoutSessionExercise {
  id, exerciseId, exerciseName, templateExerciseId, order,
  sets: ExerciseSet[], skipped, replacedWithExerciseId?,
  replacedWithExerciseName?, skipReason?, notes?,
  targetSets, targetRepsMin, targetRepsMax, restSeconds,
  exerciseType?, cardioDuration?, cardioDistance?, cardioPace?,
  cardioIntensity?, warmupSets?: WarmupSet[]
}

WarmupSet { id, weight: number | null, reps: number | null }

ExerciseSet {
  id, setNumber, weight: number | null, reps: number | null,
  completed: boolean, note?: string
}

BodyweightEntry { id, date, weight, note?, tags?: string[] }
StepEntry { date (PK), stepCount, note? }
SleepEntry { date (PK), sleepScore (1-100), sleepDuration (minutes), bedtime?, wakeUpTime?, interruptions?, note? }

PersonalRecord {
  id, exerciseId, exerciseName, type: 'max_weight' | 'max_reps' | 'max_volume' | 'max_session_volume',
  value, weight?, reps?, date, sessionId
}

TrashItem {
  id, itemType: 'session' | 'template' | 'exercise' | 'bodyweight' | 'program_group',
  itemId, name, context?, data: string (JSON), deletedAt
}
```

---

### localStorage Keys (complete list)

| Key | Purpose | Format |
|-----|---------|--------|
| `iron_theme` | Dark/light mode | `'dark'` or `'light'` |
| `iron_template_order` | Template sort order | JSON string[] of template IDs |
| `iron_exercise_order` | Exercise library sort order | JSON string[] of exercise IDs |
| `iron_program_groups` | Program group layout | JSON `{groups: [{id,name,emoji?}], assignments: {templateId: groupId}}` |
| `iron_program_start` | Program start date | `'YYYY-MM-DD'` string or absent |
| `iron_rest_day` | Weekly rest day | Day name string, default `'Sunday'` |
| `iron_vacations` | Vacation periods | JSON `[{id, start, end, note?}]` |
| `iron_bw_target_range` | Bodyweight target | JSON `{min, max}` |
| `iron_bw_tag_configs` | Bodyweight tag configs | JSON `[{id, label, color}]` |
| `iron_bw_custom_tags` | Legacy custom tags (migrated) | JSON string[] |
| `iron_bw_chart_mode` | Chart display mode | `'both'`, `'raw'`, or `'ma'` |
| `iron_exercise_library_v` | Exercise library sync version | `'3'` (bump when library changes) |

---

### Exercise Library

Include a comprehensive exercise library of ~187 exercises organized by muscle group:
- **Chest** (~7): Bench Press, Incline Dumbbell Press, Cable Fly, Dips, Pec Deck, Incline Barbell Press, etc.
- **Back** (~12): Pull-up, Barbell Row, Cable Row, Face Pull, Lat Pulldown, T-Bar Row, etc.
- **Shoulders** (~10): OHP, Arnold Press, Lateral Raise, Rear Delt Fly, etc.
- **Biceps** (~8): Barbell Curl, Hammer Curl, etc.
- **Triceps** (~7): Tricep Pushdown, Overhead Extension, etc.
- **Forearms** (~4)
- **Quads** (~10): Squat, Leg Press, Leg Extension, Walking Lunge, etc.
- **Hamstrings** (~6): RDL, Leg Curl, etc.
- **Glutes** (~6): Hip Thrust, etc.
- **Calves** (~4): Calf Raise, etc.
- **Abs** (~10): Hanging Leg Raise, Cable Crunch, etc.
- **Cardio** (~15): Rowing, Stairmaster, Incline Walking, Jump Rope, Running variations, Cycling, Swimming, etc.
- **Full Body** (~8)
- **Mobility** (~5)

Each exercise has: id (format `ex-slug`), name, primaryMuscle, optionally secondaryMuscles array, category, exerciseType. The library sync system runs on every app start, adding missing exercises and updating existing non-custom exercises.

---

### Seed Data

On first launch (when exercises table is empty), seed the database with:
- All exercises from the library
- 5 workout templates: Upper Body Chest Focus (Monday), Legs (Tuesday), Cardio (Wednesday), Upper Body Back Focus (Thursday), Shoulders + Light Legs (Friday)
- 6 weeks of realistic session history with progressive overload
- 90 days of bodyweight entries with slight downward trend
- Automatically generated personal records from session data

Each template has detailed exercise configurations including notes, machine setup instructions, progression notes, and alternative exercises.

---

### Page: Dashboard (`/`)

**Header:** Date in format "EEEE, MMM d", ASCEND logo, theme toggle (Sun/Moon icon), flame icon with "X this week" counter.

**Active session banner:** If a workout is in progress, show a pulsing green dot with template name and "Workout in progress". Tapping resumes.

**Start workout button:** White, full-width, with Plus icon. Opens a mode chooser sheet with two options:
1. **Start now** -- real-time tracking
2. **Log previous workout** -- backdate a workout (date picker + duration inputs for hours/minutes)

Both open a template selector sheet listing all templates with their emoji, name, category, days, and exercise count.

**Bodyweight card:** Shows latest weight in kg, 7-day trend (up/down with colored icon), and a sparkline (Recharts LineChart, last 30 days, no dots, zinc-400 stroke).

**Next planned workout card:** Shows the template scheduled for today (or first template as fallback). Tappable to open template selector.

**Last workout card:** Shows template name, date, duration. Tappable to navigate to history detail.

**Progress this week section:** 4 cards in a 2x2 grid:
1. **Workouts**: completed/planned count
2. **Volume**: total kg (formats to tonnes at 1000+), with % change vs last week (green/red)
3. **Exercises**: count of improved (green), with stalled/declined counts below. Comparison logic: for each exercise in this week's sessions, compare best set (by weight, then reps) against previous session of same template.
4. **Consistency**: streak count (consecutive training days where rest days and vacation periods don't break the streak). Falls back to "On track" if week complete, or "---" placeholder.

**Weekly summary sentence:** Contextual text below the grid analyzing pace, volume trend, exercise progress, and streak.

**Weekly Recap button:** Gradient amber-to-orange card with Trophy icon, links to `/recap`.

**Trash link:** Only shown if trash has items. Shows count.

**Streak calculation logic (critical):**
- Walk backwards from today
- A day with a workout adds to streak
- Rest day (configurable) and vacation periods are skipped (don't break streak)
- Days before program start date are ignored
- Any other day without a workout breaks the streak

---

### Page: Programs (`/programs`)

A comprehensive template/program management page with:

**Program Groups:**
- Templates can be organized into named groups with optional emoji
- Groups are stored in localStorage (`iron_program_groups`) as `{groups: [{id, name, emoji}], assignments: {templateId: groupId}}`
- Create group: inline form with emoji picker and name input
- Edit group: inline rename with emoji change
- Delete group: trashes the group and all its assigned templates
- Drag-to-reorder groups (pointer-based, not HTML5 drag)

**Template list:**
- Flat integrated list mixing group headers and template cards
- Each template card shows: drag handle, emoji/category icon, name, category badge, day chips (3-letter abbreviations), exercise count, chevron
- Drag-to-reorder templates across groups (pointer-based drag with auto-scroll near viewport edges, smooth CSS transitions, scale-up effect on dragged item)
- Tapping a card opens the template editor

**Template editor (Sheet):**
- Emoji picker (grid of ~80 workout-related emojis)
- Template name input
- Category dropdown (all WorkoutCategory values)
- Day multi-select (Mon-Sun toggle buttons)
- Group assignment dropdown (when groups exist)
- Exercise list with Framer Motion Reorder.Group for drag sorting
- Each exercise row shows: drag handle, media thumbnail, exercise name (tappable to edit exercise), muscle chips, delete button
- **Strength exercises**: warm-up text field, 4-column grid (sets, min reps, max reps, rest in minutes stored as seconds), notes textarea
- **Cardio exercises**: duration (min), distance (km), pace (auto-computed from duration/distance unless manually edited), intensity dropdown (auto-inferred unless manually edited), notes
- Add Exercise button opens exercise picker
- Save and Delete buttons at bottom

**Exercise picker (Sheet):**
- Search input with clear button
- Muscle group filter pills (14 options)
- Reorder mode: drag exercises to customize library order (persisted to localStorage)
- Create custom exercise inline form: name, primary muscle, category, exercise type, media upload (image/gif/video, max 10MB, stored as base64)
- Exercise list: thumbnail, name, muscle chips, tap to add

**Exercise editor (Sheet):**
- Edit name, primary muscle, secondary muscles (multi-select toggles)
- Media upload/remove
- Save button

**Media viewer:** Fullscreen overlay for viewing exercise images/gifs/videos.

**Delete confirmation:** Modal with template name, "moved to Trash" message, Cancel/Delete buttons.

---

### Page: Live Workout (`/workout/:id`)

The core workout experience. NO bottom nav. NOT inside AppLayout.

**Header (sticky):**
- Back to home button
- Template name
- Elapsed timer (live, 1-second interval) or date + duration (manual entries)
- Green "Finish" button
- Progress bar (thin line below header, white default, emerald at 100%)

**Tags bar:** Horizontal scroll with Tags button + existing tags as removable badges.

**100% completion:** Confetti burst animation (24 particles in 6 colors with random trajectories, 2.5s duration) and emerald banner with random motivational message (deterministic from session ID).

**Exercise cards:**
- **Strength (ExerciseCard):**
  - Header: name (or replacement name), target sets x reps range, rest time, completion counter
  - Template notes and machine setup (collapsible)
  - Warm-up system: prompt (Yes/No), then weight/reps inputs per warm-up set with add/remove
  - Working sets table: Set number, Previous (from last session, ghost text), Weight input (kg, decimal), Reps input (numeric), Complete button (circular)
  - **Progression indicators per set:** After completing a set, compare vs previous session's same set. Show colored pills: green "+Xkg" or "+X reps", red "-Xkg" or "-X reps", gray "= same". Reps comparison only shown when weight is identical (critical: don't penalize fewer reps at higher weight).
  - Rest timer: circular SVG progress ring, countdown display, play/pause/reset/skip controls. Auto-starts on set completion. Vibrates (200ms-100ms-200ms pattern) when timer hits zero.
  - Actions drawer: note input, Skip button (prompts for reason), Replace button (opens exercise picker)

- **Cardio (CardioExerciseCard):**
  - Duration, distance inputs
  - Auto-computed pace display
  - Intensity toggle pills (color-coded: blue=very_easy/easy, emerald/amber=moderate, orange/red=hard/very_hard, purple=intervals)
  - Complete toggle button
  - Actions drawer same as strength

**Bottom action bar (fixed):**
- Cancel button (red, confirms via browser confirm dialog)
- Center: completed/total sets, percentage, total weight moved (formats to tonnes at 1000+) with diff vs previous session
- Finish button (green)

**Finish sheet:** Summary (duration, sets, volume), notes textarea, Complete Workout button.

**Session completion logic:**
- Marks session as completed with duration calculation
- Checks for personal records: for each non-skipped exercise, compares max weight and total volume against existing PRs in the records table. New PRs are written to the database.

---

### Page: History (`/history`)

**Search and filters:**
- Text search (matches template name or exercise names)
- Date filter pills: All, 7d, 30d, 90d
- Template dropdown filter
- Filter sheet with reset button

**Interactive frequency counters:**
- "Total" pill + one pill per template name with session count
- Counts derived from date+template filtered results (not affected by name filter)
- Clicking a pill toggles a name filter; active pill turns blue

**Session list (grouped by date):**
- Date headers: "Monday, Apr 21" format
- Each session card: template name, duration, exercise count, total volume, session tags, edit/delete buttons, chevron
- Volume = sum of weight * reps across all sets

**Edit session (Sheet):** Date, duration (h + m), notes. Preserves original time-of-day on save.

**Delete:** Soft-delete to trash with animated confirmation modal. 5-second undo toast at bottom.

---

### Page: History Detail (`/history/:id`)

**Sticky header:** Back button, template name, date.

**Stats bar:** Duration, total sets (completed), total volume (or distance for cardio-only sessions).

**Tags and notes** sections (if present).

**Exercise cards:**
- Skipped exercises shown at 40% opacity
- Replaced exercises show both original and replacement names
- **Cardio:** Duration, distance, pace in sub-cards, intensity tag
- **Strength:** Warm-up sets (amber colored, W1/W2... numbering), working sets table (set/kg/reps/note), per-exercise volume total
- Exercise notes in footer

---

### Page: Health Hub (`/health`)

A dashboard linking to the three health sub-pages with summary cards:

**Bodyweight card:** Latest weight, 7-day trend comparison (using `trendIcon` with +/-3% thresholds), 14-point sparkline (LineChart).

**Steps card:** Today's steps (or 7-day avg), trend comparison, 14-point sparkline (BarChart).

**Sleep card:** Last score (colored by thresholds: 80+=emerald, 60+=amber, <60=red), duration, trend, 14-point sparkline (LineChart).

**Recovery Snapshot card (conditional):** Only shown when both sleep and steps data exist. Contextual message based on: avg sleep score >= 70 AND steps >= 7000 = "Recovering well"; sleep < 60 = quality concern; steps < 5000 = movement concern.

---

### Page: Bodyweight (`/bodyweight`)

**Current weight card:** Latest weight, date, target range status (above/below/within), period change with trend icon.

**Range selector:** 7d, 30d, 90d, 180d, 365d, 2y, 3y, all.

**Chart (Recharts LineChart):**
- Raw weight line with dots
- 7-day moving average line (purple, dashed in "both" mode, solid in MA-only)
- Chart mode toggle (cycles: Raw+MA / Raw only / MA only)
- Target range: green ReferenceArea band with dashed border lines labeled min/max
- Average ReferenceLine dashed
- Dots colored by target range: red (above max), blue (below min), green (within)

**Stats grid:** Min, Avg, Max, Change over selected period.

**History list:** Swipeable rows (swipe left reveals delete). Each shows: date, note, tags (colored pills), weight, diff from previous entry (green for loss, amber for gain).

**Add weight (Sheet):** Quick Add (just weight) or Advanced (weight, date, note, tags). Handles duplicate dates with a 3-option dialog: Replace / Keep Both / Cancel.

**Edit entry (Sheet):** Weight, date, note, tags, Save + Delete.

**Target range (Sheet):** Min/max inputs, Save, Clear.

**Tag manager (Sheet):**
- Create tag form
- Reorderable tag list (Framer Motion Reorder)
- Per-tag: drag handle, color dot (expandable to color picker), label, usage count, delete
- Color picker: 16 preset colors + custom hex input
- Delete tag confirmation with usage count

**Bodyweight tag system:** 10 default tags (cheat_meal, travel, bad_sleep, stomach_issues, after_workout, morning_fasted, creatine, dehydrated, bloated, sick) with customizable colors and labels.

---

### Page: Steps (`/steps`)

**Today highlight card** with step count (if logged today).

**Summary cards (2x2):** 7-day avg with trend, best day with date, 10k+ streak (consecutive days), total logged days.

**Main chart (Recharts ComposedChart):**
- Color-coded bars by step count: red (<5k), amber (5k-7.5k), green (7.5k-10k), dark green (10k+)
- 7-day moving average line (blue, hidden for 7d range)
- Average reference line (dashed)
- Fills in all calendar days between first and last entry (gaps = 0)

**Comparison cards:** This week avg vs last week, this month avg vs last month (with % change).

**Monthly trend card:** Natural language sentence about month-over-month change.

**History list:** Up to 30 entries, each with colored dot, count, date, note, edit/delete buttons.

**Add/Edit sheet:** Date, step count, note.

---

### Page: Sleep (`/sleep`)

**Last Night card:** Large score (0-100, color-coded), duration, quality label, bedtime-to-wake-up times.

**Score color thresholds:** 90+ = teal/cyan, 85+ = emerald, 80+ = green, 60+ = amber, <60 = red.

**Summary cards (2x2):** Avg score with trend, avg duration with quality label, avg bedtime with variance (green<=30min, amber<=60min, red>60min bedtime std dev), best night.

**Sleep Score Trend chart (LineChart):** Custom dots colored by individual score. Legend shows 5 color tiers. Average reference line.

**Sleep Duration chart (BarChart):** Bars colored by score (not duration). Average duration reference line.

**Bedtime Consistency chart (LineChart, shown when >=3 entries with bedtime):** Amber line, reversed Y-axis (earlier times at top), ticks formatted as times, average bedtime reference line.

**Weekly comparison:** Score and duration vs last week.

**History list:** Score dot (colored), score (large), duration, bedtime-wake-up, date, interruptions, note, edit/delete.

**Add/Edit sheet:** Date, score (1-100), duration (hours + minutes). Optional section: bedtime (time picker, auto-calculated wake-up), interruptions, note.

**Bedtime normalization logic (critical):** Times after 6pm are normalized to negative values for chart continuity (e.g., 23:00 = -60 minutes from midnight, 01:00 = 60). This ensures the chart line doesn't jump wildly between PM and AM bedtimes.

---

### Page: Stats (`/stats`)

**Range:** 7d, 30d, 90d, 1y, 2y, 3y, all.

**Consistency Heatmap:**
- Grid of small colored squares, one per day
- Colors: emerald=workout, red=missed (scheduled day with no workout), sky=vacation, faint zinc=before program start, default=rest
- Cell size adapts to range (smaller for longer ranges)
- Legend below the grid
- Settings gear opens Schedule Settings sheet

**Schedule Settings (Sheet):**
- Program start date picker
- Rest day (7 day-of-week buttons, single select)
- Vacation periods: add form (start date, end date, optional note), existing list with remove buttons

**Bodyweight Evolution chart (LineChart):** Shown if >2 data points.

**Weekly Training Volume chart (BarChart):** Volume per week in kg (Y-axis formats to tonnes). Sessions bucketed by `eachWeekOfInterval` (Monday start).

**Workouts Per Week chart (BarChart):** Session count per week, purple bars.

**Muscle Balance (the most complex computation):**

Radar chart (shown if >=3 muscles with data) plus detailed breakdown list.

For each muscle group, compute a composite score (0-100) from three sub-scores:
1. **Sets Score (40%):** Effective sets (primary=1.0 credit, secondary=0.5 credit per set) normalized against the best muscle.
2. **Frequency Score (30%):** Unique training days, normalized.
3. **Progression Score (30%):** Compare average best-set-weight in second half of time range vs first half. Maps -20% to 0, 0% to 50, +20% to 100.

Apply a **recency multiplier:** If trained in most recent 25% of the range, no penalty. Linear decay to 0.4 at full range age.

Final: `(setsScore * 0.4 + freqScore * 0.3 + progressionScore * 0.3) * recencyMultiplier`, clamped 0-100.

Each muscle also gets a trend label (up/down/stable based on 3% threshold).

**Muscle Breakdown list:** Name, trend arrow, effective sets count, training days, horizontal progress bar.

**Exercise Progression (per-exercise):** Dropdown to select exercise. When selected with >=2 sessions:
- Best Weight chart (LineChart, emerald)
- Session Volume chart (BarChart, indigo)

---

### Page: Weekly Recap (`/recap`)

**Navigation:** Left/right chevrons to browse weeks (Monday-Sunday). Current week is the default. Right button disabled on current week.

**Three composite scores (0-100):**

1. **Training Score** = 50% adherence + 25% volume trend + 25% session count
   - Adherence = sessions / planned days * 100
   - Volume trend = 50 + (volumeChange% * 50), clamped 0-100
   - Count score: 5+=100, 4=85, 3=70, 2=50, 1=30, 0=0

2. **Recovery Score** = 50% sleep score + 25% duration + 25% consistency
   - Sleep score = average score (already 0-100)
   - Duration = (avgMinutes / 480) * 100 (8h = perfect)
   - Consistency = 100 - bedtimeStdDev * 1.5

3. **Weekly Score** = 35% training + 30% recovery + 20% movement + 15% BW stability
   - Movement = (avgSteps / 10000) * 100
   - BW stability = 100 - stdDev * 20

**Score tier coloring:** 80+ = emerald, 60+ = amber, <60 = red.

**Content sections:**
- **Hero scores:** 3 score cards (Weekly/Training/Recovery)
- **Main Takeaways:** Up to 5 bullet points about training, volume, sleep, steps, bodyweight
- **Coach Summary:** Paragraph-style assessment (darker card, Zap icon)
- **Training Breakdown:** Strength/cardio counts, volume with % change, adherence %, most productive session, progression signal
- **Sleep Breakdown:** Sparkline, avg score/duration with % changes, bedtime/variance, best/worst nights
- **Movement Breakdown:** Sparkline, daily avg with % change, weekly total, best/lowest days
- **Bodyweight Breakdown:** Sparkline, week avg, vs last week change
- **Recovery Readiness:** Contextual paragraph (4 tiers by recovery score, or "not enough data")
- **Went Well / Needs Attention:** Two side-by-side cards listing positives and concerns
- **Next Week Focus:** 2-3 actionable bullet points

**Insight generators (5 pure functions):** Each takes the computed data and returns an array of contextual strings based on thresholds. They cover training adherence, volume trends, sleep quality, bedtime consistency, step trends, bodyweight stability, and specific session highlights.

---

### Page: Trash (`/trash`)

- Filter pills by type (session, template, exercise, bodyweight, program_group)
- Each item shows: type icon (colored), name, type badge, context, deletion timestamp
- Two actions per item: Restore (gray) and Delete Forever (red)
- Permanent delete confirmation modal
- Empty Trash button with confirmation (shows total count)
- Restore logic is type-aware: sessions/templates/exercises/bodyweight go back to their Dexie table; program_group restore re-adds the group to localStorage and re-links templates that still exist

---

### Critical Business Logic

**Set Progression Comparison:**
- Weight comparison: straightforward up/down/same
- Reps comparison: ONLY evaluated when weight is identical. This prevents penalizing a user who increased weight but did fewer reps.

**Volume calculation:** Always `weight * reps` per set, summed. Formats to tonnes (t) at >= 1000 kg.

**Trash system:** Soft-delete with JSON serialization. Template trashing cascades to clean up program group assignments. Program group trashing also trashes all assigned templates. Restore is defensive about orphaned references.

**Exercise library sync:** Runs on every app start. Compares a version string in localStorage. Adds missing exercises, updates non-custom exercises with latest data (name, muscles, category, type).

**Database migrations:** 5 versions. Key migrations: v2 adds new exercises, v3 migrates template `day` from string to string[], v4 adds trash table, v5 adds steps and sleep tables.

---

### What Must Be Preserved If Rebuilding

1. The exact scoring formulas for Weekly Recap (training score, recovery score, weekly score)
2. The muscle balance composite scoring with recency multiplier
3. The set progression comparison logic (reps only compared at same weight)
4. The streak calculation with rest day and vacation exemptions
5. The bodyweight chart with target range coloring and moving average
6. The sleep bedtime normalization for chart continuity
7. The trash system with type-aware restore
8. The responsive Sheet (bottom sheet on mobile, centered modal on desktop)
9. The dark/light theme via CSS variable inversion
10. The PWA configuration (manifest, meta tags, standalone display)
11. The exercise library with secondary muscles and exercise types
12. The warm-up set system in exercise cards
13. The rest timer with circular progress and vibration
14. The confetti animation on workout completion
15. The program group system with drag-and-drop reordering
16. All localStorage keys and their formats

---

## Prompt End
