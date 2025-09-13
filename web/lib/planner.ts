import { Assignment, PlanBlock } from "@/lib/types"
import { DEFAULT_SETTINGS, DayKey, UserSettings, loadUserSettings } from "@/lib/localStore"

type BlockInput = Omit<PlanBlock, "id"> // what we'll POST

export type GeneratePlanOptions = {
  now?: Date
  settings?: UserSettings
}

// 30-minute slot length
const SLOT_MIN = 30

function parseHM(hm: string): number {
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10))
  return h * 60 + (m || 0)
}

function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}

function subtractWindow(base: [number, number], forbid: [number, number]): [number, number][] {
  const [a, b] = base
  const [c, d] = forbid
  if (d <= a || c >= b) return [base] // no overlap
  const out: [number, number][] = []
  if (c > a) out.push([a, clamp(c, a, b)])
  if (d < b) out.push([clamp(d, a, b), b])
  return out
}

function dailyAllowedWindows(avail: { start: string; end: string }, protectedHours?: { start: string; end: string }) {
  // start/end in minutes from 0..1440; assume avail.start < avail.end within same day
  let windows: [number, number][] = [[parseHM(avail.start), parseHM(avail.end)]]
  if (!protectedHours) return windows
  const ps = parseHM(protectedHours.start)
  const pe = parseHM(protectedHours.end)
  if (ps === pe) return windows // no-op
  if (ps < pe) {
    // simple same-day forbidden window
    windows = windows.flatMap((w) => subtractWindow(w, [ps, pe]))
  } else {
    // wraps midnight: forbid [ps, 1440) and [0, pe]
    windows = windows.flatMap((w) => subtractWindow(w, [ps, 1440]))
    windows = windows.flatMap((w) => subtractWindow(w, [0, pe]))
  }
  // normalize and filter invalid
  return windows
    .map(([s, e]) => [clamp(s, 0, 1440), clamp(e, 0, 1440)] as [number, number])
    .filter(([s, e]) => e - s >= SLOT_MIN)
}

function slotsFromWindows(windows: [number, number][]): [number, number][] {
  // Return 30-min slots as [startMin, endMin], end exclusive
  const out: [number, number][] = []
  for (const [s, e] of windows) {
    let t = s
    // align to slot grid
    if (t % SLOT_MIN !== 0) t = t + (SLOT_MIN - (t % SLOT_MIN))
    while (t + SLOT_MIN <= e) {
      out.push([t, t + SLOT_MIN])
      t += SLOT_MIN
    }
  }
  return out
}

function minutesSinceStartOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

export function generateGreedyPlan(assignments: Assignment[], opts: GeneratePlanOptions = {}): BlockInput[] {
  const now = opts.now ? new Date(opts.now) : new Date()
  const settings = opts.settings ?? (typeof window !== "undefined" ? loadUserSettings() : DEFAULT_SETTINGS)
  const dayOrder: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

  // Precompute allowed slots per day key (relative to weekday enable and windows)
  // We'll compute per concrete date on the fly to handle protected hours and caps per day.
  const dailyCap = settings.availability.maxMinutesPerDay > 0 ? settings.availability.maxMinutesPerDay : Infinity
  const protectedHours = settings.availability.protectedHours

  // Sort assignments by dueAt ascending, ignore those with <= 0 est
  const sorted = assignments
    .filter((a) => (a.estimatedMinutes ?? 0) > 0)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())

  const result: BlockInput[] = []
  const perDayUsed = new Map<string, number>() // yyyy-mm-dd -> minutes

  for (const asn of sorted) {
    const due = new Date(asn.dueAt)
    const latestEnd = new Date(due.getTime() - 24 * 60 * 60 * 1000) // finish ≥24h early
    if (latestEnd <= now) continue // cannot schedule in time
    let remaining = Math.ceil((asn.estimatedMinutes as number) * 1.15)

    // Walk days backwards from latestEnd date to today
    let day = startOfDay(latestEnd)
    while (remaining > 0 && day >= startOfDay(now)) {
      const dow = day.getDay() // 0=Sun
      const key = dayOrder[dow]
      const dayAvail = settings.availability.byDay[key]
      if (dayAvail?.enabled) {
        // derive allowed windows for the day and translate to slots
        let windows = dailyAllowedWindows({ start: dayAvail.start, end: dayAvail.end }, protectedHours)

        // If it's the latestEnd day, trim windows to not exceed its time-of-day
        if (dayKey(day) === dayKey(latestEnd)) {
          const cutoff = minutesSinceStartOfDay(latestEnd)
          windows = windows.map(([s, e]) => [s, Math.min(e, cutoff)] as [number, number]).filter(([s, e]) => e - s >= SLOT_MIN)
        }
        // If it's today, trim windows to not go into the past
        if (dayKey(day) === dayKey(now)) {
          const startCut = minutesSinceStartOfDay(now)
          windows = windows.map(([s, e]) => [Math.max(s, startCut), e] as [number, number]).filter(([s, e]) => e - s >= SLOT_MIN)
        }

        // Get slots and iterate backwards (end-first)
        const slots = slotsFromWindows(windows)
        let usedToday = perDayUsed.get(dayKey(day)) ?? 0
        const canUseToday = Math.max(0, dailyCap === Infinity ? Infinity : (dailyCap as number) - usedToday)

        for (let i = slots.length - 1; i >= 0 && remaining > 0 && usedToday < (dailyCap as number); i--) {
          const [sMin, eMin] = slots[i]
          // allocate one 30-min block
          if (usedToday + SLOT_MIN > (dailyCap as number)) break

          const start = new Date(day)
          start.setMinutes(sMin, 0, 0)
          const end = new Date(day)
          end.setMinutes(eMin, 0, 0)

          // Skip if end is <= now when same-day and past
          if (end <= now) continue

          result.push({
            title: `Study: ${asn.title}`,
            courseId: asn.courseId,
            relatedAssignmentId: asn.id,
            start: start.toISOString(),
            end: end.toISOString(),
          })
          remaining -= SLOT_MIN
          usedToday += SLOT_MIN
        }
        perDayUsed.set(dayKey(day), usedToday)
      }
      // go to previous day
      day = addDays(day, -1)
    }
  }

  // Sort chronologically before returning
  return result.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
}
