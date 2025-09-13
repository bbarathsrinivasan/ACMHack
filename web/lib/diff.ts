import { PlanBlock } from "@/lib/types"
import { DEFAULT_SETTINGS, UserSettings, loadUserSettings } from "@/lib/localStore"

export type ChangeType = "added" | "removed" | "moved"

export interface PlanChange {
  type: ChangeType
  dayKey: string
  block: PlanBlock
  from?: { start: string; end: string }
  reasons: string[]
}

export interface DayChanges {
  dayKey: string
  added: PlanChange[]
  removed: PlanChange[]
  moved: PlanChange[]
}

function toDayKeyLocal(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function minutesBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000))
}

function overlaps(a: PlanBlock, b: PlanBlock): boolean {
  const as = new Date(a.start).getTime()
  const ae = new Date(a.end).getTime()
  const bs = new Date(b.start).getTime()
  const be = new Date(b.end).getTime()
  return as < be && bs < ae
}

export function diffPlanBlocks(
  oldBlocks: PlanBlock[],
  newBlocks: PlanBlock[],
  settings?: UserSettings
): DayChanges[] {
  const cfg = settings ?? (typeof window !== "undefined" ? loadUserSettings() : DEFAULT_SETTINGS)
  const dailyCap = cfg.availability.maxMinutesPerDay || 0

  const byIdOld = new Map(oldBlocks.map((b) => [b.id, b]))
  const byIdNew = new Map(newBlocks.map((b) => [b.id, b]))

  const added: PlanChange[] = []
  const removed: PlanChange[] = []
  const moved: PlanChange[] = []

  // Helper to compute reasons for a block in the context of the new schedule
  function reasonsFor(block: PlanBlock): string[] {
    const reasons: string[] = []
    const day = toDayKeyLocal(block.start)
    const dayBlocks = newBlocks.filter((b) => toDayKeyLocal(b.start) === day)
    const overlapsCount = dayBlocks.filter((b) => b.id !== block.id && overlaps(block, b)).length
    if (overlapsCount > 0) reasons.push(`overlaps ${overlapsCount} block${overlapsCount > 1 ? "s" : ""}`)
    if (dailyCap > 0) {
      const total = dayBlocks.reduce((sum, b) => sum + minutesBetween(b.start, b.end), 0)
      if (total > dailyCap) reasons.push(`cap exceeded by ${total - dailyCap} min`)
    }
    return reasons
  }

  // Added & moved
  for (const nb of newBlocks) {
    const ob = byIdOld.get(nb.id)
    if (!ob) {
      added.push({ type: "added", dayKey: toDayKeyLocal(nb.start), block: nb, reasons: reasonsFor(nb) })
    } else {
      const movedDay = toDayKeyLocal(ob.start) !== toDayKeyLocal(nb.start)
      const movedTime = ob.start !== nb.start || ob.end !== nb.end
      if (movedDay || movedTime) {
        moved.push({
          type: "moved",
          dayKey: toDayKeyLocal(nb.start),
          block: nb,
          from: { start: ob.start, end: ob.end },
          reasons: reasonsFor(nb),
        })
      }
    }
  }

  // Removed
  for (const ob of oldBlocks) {
    if (!byIdNew.has(ob.id)) {
      removed.push({ type: "removed", dayKey: toDayKeyLocal(ob.start), block: ob, reasons: [] })
    }
  }

  // Group by day
  const daySet = new Set<string>([
    ...added.map((c) => c.dayKey),
    ...removed.map((c) => c.dayKey),
    ...moved.map((c) => c.dayKey),
  ])
  const days = Array.from(daySet).sort()
  const out: DayChanges[] = days.map((day) => ({
    dayKey: day,
    added: added.filter((c) => c.dayKey === day),
    removed: removed.filter((c) => c.dayKey === day),
    moved: moved.filter((c) => c.dayKey === day),
  }))
  return out
}
