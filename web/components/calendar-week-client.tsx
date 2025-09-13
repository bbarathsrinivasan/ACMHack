"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { COURSES, EVENTS, MILESTONES, PLANBLOCKS } from "@/lib/data"
import { generateGreedyPlan } from "@/lib/planner"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { diffPlanBlocks, type DayChanges } from "@/lib/diff"

const TZ = "America/New_York" as const

type CalItem = {
  id: string
  title: string
  start: string
  end: string
  dayKey: string
  startH: number
  endH: number
  courseCode?: string
  kind: "plan" | "event"
}

type LaidOut = CalItem & { lane: number; lanes: number }

function dayKeyFrom(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const y = parts.find((p) => p.type === "year")?.value
  const m = parts.find((p) => p.type === "month")?.value
  const d = parts.find((p) => p.type === "day")?.value
  return `${y}-${m}-${d}`
}

function dayKeyFromISO(iso: string) {
  return dayKeyFrom(new Date(iso))
}

function toHourDecimal(iso: string) {
  const hh = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "2-digit",
      hour12: false,
    }).format(new Date(iso)),
    10
  )
  const mm = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, minute: "2-digit" }).format(new Date(iso)),
    10
  )
  return hh + mm / 60
}

function layoutDay(items: CalItem[]): LaidOut[] {
  const sorted = items.slice().sort((a, b) => a.startH - b.startH)
  const lanesEnd: number[] = []
  const out: LaidOut[] = []
  for (const it of sorted) {
    let placed = false
    for (let lane = 0; lane < lanesEnd.length; lane++) {
      if (it.startH >= lanesEnd[lane]) {
        lanesEnd[lane] = it.endH
        out.push({ ...it, lane, lanes: 0 })
        placed = true
        break
      }
    }
    if (!placed) {
      const lane = lanesEnd.length
      lanesEnd.push(it.endH)
      out.push({ ...it, lane, lanes: 0 })
    }
  }
  const laneCount = Math.max(1, lanesEnd.length)
  return out.map((x) => ({ ...x, lanes: laneCount }))
}

function fmtTimeRange(startIso: string, endIso: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${fmt.format(new Date(startIso))} – ${fmt.format(new Date(endIso))}`
}

export function CalendarWeekClient({ weekKeys }: { weekKeys: string[] }) {
  const { push } = useToast()
  const [etag, setEtag] = useState<string | null>(null)
  const [blocks, setBlocks] = useState(() => PLANBLOCKS)
  const [changesOpen, setChangesOpen] = useState(false)
  const [lastDiff, setLastDiff] = useState<DayChanges[] | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    title: "",
    courseId: "",
    relatedAssignmentId: "",
    milestoneId: "",
    date: dayKeyFrom(new Date()),
    start: "10:00",
    end: "11:00",
  })
  const ROW_H = 48
  const TOTAL_H = ROW_H * 24

  useEffect(() => {
    const fetcher = async () => {
      try {
        const r = await fetch("/api/planblocks", { cache: "no-store" })
        const et = r.headers.get("etag")
        setEtag(et)
        if (r.ok) {
          const data = (await r.json()) as typeof PLANBLOCKS
          setBlocks(data)
        }
      } catch {}
    }
    fetcher()
  }, [])

  async function handleGeneratePlan() {
    try {
      const before = blocks
      // Use all assignments from data source; planner reads user settings from localStorage
      const planInputs = generateGreedyPlan(
        // Pull assignments via milestones/planblocks context not imported here; re-use events import path
        // We don't have assignments directly here; import lazily to avoid bundle bloat
        (await import("@/lib/data")).ASSIGNMENTS
      )
      if (planInputs.length === 0) {
        push({ title: "No plan generated", description: "Nothing to schedule or no available time" })
        return
      }
      // POST sequentially to respect If-Match; refresh etag each time. Batch update state at end.
      let curEtag = etag
      const created: typeof PLANBLOCKS = []
      for (const p of planInputs) {
        const r = await fetch("/api/planblocks", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(curEtag ? { "If-Match": curEtag } : {}) },
          body: JSON.stringify(p),
        })
        const newEtag = r.headers.get("etag")
        if (newEtag) curEtag = newEtag
        if (!r.ok) throw new Error(`POST failed: ${r.status}`)
        const saved = await r.json()
        created.push(saved)
      }
      if (curEtag) setEtag(curEtag)
      setBlocks((prev) => {
        const next = [...prev, ...created]
        const d = diffPlanBlocks(before, next)
        setLastDiff(d)
        setChangesOpen(true)
        return next
      })
      push({ title: "Plan generated", description: `${planInputs.length} blocks created` })
    } catch (e) {
      push({ title: "Failed to generate plan", variant: "destructive" })
    }
  }

  const items = useMemo(() => {
    const items: CalItem[] = []
    for (const p of blocks) {
      const dk = dayKeyFromISO(p.start)
      if (!weekKeys.includes(dk)) continue
      items.push({
        id: p.id,
        title: p.title,
        start: p.start,
        end: p.end,
        dayKey: dk,
        startH: toHourDecimal(p.start),
        endH: toHourDecimal(p.end),
        courseCode: p.courseId ? COURSES.find((c) => c.id === p.courseId)?.code : undefined,
        kind: "plan",
      })
    }
    for (const e of EVENTS) {
      const dk = dayKeyFromISO(e.start)
      if (!weekKeys.includes(dk)) continue
      items.push({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        dayKey: dk,
        startH: toHourDecimal(e.start),
        endH: toHourDecimal(e.end),
        courseCode: COURSES.find((c) => c.id === e.courseId)?.code,
        kind: "event",
      })
    }
    return items
  }, [blocks, weekKeys])

  const byDay = useMemo(() => {
    const map = new Map<string, LaidOut[]>()
    for (const key of weekKeys) {
      const dayItems = items.filter((i) => i.dayKey === key)
      map.set(key, layoutDay(dayItems))
    }
    return map
  }, [items, weekKeys])

  async function handleSaveNew() {
    const before = blocks
    const date = new Date(form.date)
    const [sh, sm] = form.start.split(":").map((n) => parseInt(n, 10))
    const [eh, em] = form.end.split(":").map((n) => parseInt(n, 10))
    const start = new Date(date); start.setHours(sh, sm, 0, 0)
    const end = new Date(date); end.setHours(eh, em, 0, 0)
    const relAssign = form.milestoneId
      ? MILESTONES.find((m) => m.id === form.milestoneId)?.assignmentId
      : form.relatedAssignmentId || undefined
    const payload = {
      title: form.title || "Study Block",
      courseId: form.courseId || undefined,
      relatedAssignmentId: relAssign,
      start: start.toISOString(),
      end: end.toISOString(),
    }
    const optimisticId = `temp-${Date.now()}`
    setBlocks((prev) => [
      ...prev,
      { id: optimisticId, title: payload.title, courseId: payload.courseId, relatedAssignmentId: payload.relatedAssignmentId, start: payload.start, end: payload.end },
    ])
    setOpen(false)
    try {
      const r = await fetch("/api/planblocks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(etag ? { "If-Match": etag } : {}) },
        body: JSON.stringify(payload),
      })
      const newEtag = r.headers.get("etag")
      if (newEtag) setEtag(newEtag)
      if (!r.ok) throw new Error(`POST failed: ${r.status}`)
      const saved = await r.json()
      setBlocks((prev) => {
        const next = prev.map((b) => (b.id === optimisticId ? saved : b))
        const d = diffPlanBlocks(before, next)
        setLastDiff(d)
        setChangesOpen(true)
        return next
      })
      push({ title: "Block added", description: payload.title })
    } catch (e) {
      setBlocks((prev) => prev.filter((b) => b.id !== optimisticId))
      push({ title: "Failed to add block", variant: "destructive" })
    }
  }

  function onDragResizeStart(e: React.MouseEvent, id: string, mode: "move" | "resize") {
    e.preventDefault()
    const startY = e.clientY
    const prev = blocks.find((b) => b.id === id)
    if (!prev) return
    const beforeBlocks = blocks
    const prevStart = new Date(prev.start)
    const prevEnd = new Date(prev.end)
    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY
      const dHours = dy / ROW_H
      const ms = Math.round(dHours * 60) * 60 * 1000
      let nextStart = new Date(prevStart)
      let nextEnd = new Date(prevEnd)
      if (mode === "move") {
        nextStart = new Date(prevStart.getTime() + ms)
        nextEnd = new Date(prevEnd.getTime() + ms)
      } else {
        nextEnd = new Date(prevEnd.getTime() + ms)
      }
      if (nextEnd <= nextStart) return
      setBlocks((cur) => cur.map((b) => (b.id === id ? { ...b, start: nextStart.toISOString(), end: nextEnd.toISOString() } : b)))
    }
    const onUp = async () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      const latest = blocks.find((b) => b.id === id)
      if (!latest) return
      try {
        const r = await fetch("/api/planblocks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...(etag ? { "If-Match": etag } : {}) },
          body: JSON.stringify({ id, start: latest.start, end: latest.end }),
        })
        const newEtag = r.headers.get("etag")
        if (newEtag) setEtag(newEtag)
        if (!r.ok) throw new Error(`PATCH failed: ${r.status}`)
        setBlocks((prev) => {
          const d = diffPlanBlocks(beforeBlocks, prev)
          setLastDiff(d)
          setChangesOpen(true)
          return prev
        })
        push({ title: mode === "move" ? "Block moved" : "Block resized" })
      } catch (e) {
        push({ title: "Failed to save changes", variant: "destructive" })
      }
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">This Week</CardTitle>
        <div className="mt-2">
          <div className="flex gap-2 items-center">
            <Button className="rounded-xl" variant="secondary" onClick={handleGeneratePlan}>Generate Plan</Button>
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl">Add Block</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Plan Block</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3">
                <Input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                <div className="grid grid-cols-3 gap-2">
                  <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                  <Input type="time" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} />
                  <Input type="time" value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Course id (optional)" value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))} />
                  <Input placeholder="Assignment id (optional)" value={form.relatedAssignmentId} onChange={(e) => setForm((f) => ({ ...f, relatedAssignmentId: e.target.value }))} />
                  <Input placeholder="Milestone id (optional)" value={form.milestoneId} onChange={(e) => setForm((f) => ({ ...f, milestoneId: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveNew}>Save</Button>
                </div>
              </div>
            </DialogContent>
            </Dialog>
            <Sheet open={changesOpen} onOpenChange={setChangesOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" className="rounded-xl">Changes</Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Changes</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-4 space-y-4">
                  {!lastDiff || lastDiff.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No changes</div>
                  ) : (
                    lastDiff.map((day) => (
                      <div key={day.dayKey}>
                        <div className="text-sm font-medium mb-1">{new Date(day.dayKey).toLocaleDateString()}</div>
                        {[{k:"added", items: day.added},{k:"moved", items: day.moved},{k:"removed", items: day.removed}].map(({k, items}) => (
                          items.length > 0 ? (
                            <div key={k} className="mb-2">
                              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{k}</div>
                              <div className="space-y-1">
                                {items.map((ch, i) => (
                                  <div key={i} className="rounded-lg border p-2 text-xs">
                                    <div className="font-medium truncate">{ch.block.title}</div>
                                    <div className="text-muted-foreground">
                                      {new Date(ch.block.start).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                      {" – "}
                                      {new Date(ch.block.end).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                      {ch.type === 'moved' && ch.from ? (
                                        <span> (from {new Date(ch.from.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}–{new Date(ch.from.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})})</span>
                                      ) : null}
                                    </div>
                                    {ch.reasons.length > 0 ? (
                                      <div className="mt-1 text-[11px] text-amber-700">Reasons: {ch.reasons.join(", ")}</div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-px rounded-xl border bg-border">
              <div className="bg-background p-2 text-xs text-muted-foreground">Time</div>
              {weekKeys.map((key) => {
                const label = new Intl.DateTimeFormat("en-US", {
                  timeZone: TZ,
                  weekday: "short",
                  month: "numeric",
                  day: "numeric",
                }).format(new Date(key))
                return (
                  <div key={key} className="bg-background p-2 text-center text-xs font-medium">
                    {label}
                  </div>
                )
              })}
            </div>
            <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-x border-b rounded-b-xl">
              <div className="sticky left-0 z-10 bg-background">
                <div className="max-h-[560px] overflow-y-auto">
                  <div style={{ height: TOTAL_H }} className="relative">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="absolute right-1 text-right text-xs text-muted-foreground" style={{ top: h * ROW_H }}>
                        {String(h).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {weekKeys.map((key) => {
                const dayItems = byDay.get(key) ?? []
                return (
                  <div key={key} className="border-l">
                    <div className="max-h-[560px] overflow-y-auto">
                      <div className="relative" style={{ height: TOTAL_H }}>
                        {Array.from({ length: 24 }, (_, h) => (
                          <div key={h} className="absolute left-0 right-0 border-t border-border" style={{ top: h * ROW_H }} />
                        ))}
                        {dayItems.map((it) => {
                          const top = it.startH * ROW_H
                          const height = Math.max(ROW_H * (it.endH - it.startH) - 4, 20)
                          const laneWidth = 100 / it.lanes
                          const left = it.lane * laneWidth
                          const isPlan = it.kind === "plan"
                          return (
                            <div
                              key={it.id}
                              className={
                                "absolute rounded-md border px-2 py-1 text-xs shadow-sm overflow-hidden" +
                                (isPlan ? " bg-primary/15 border-primary/30" : " bg-secondary/20 border-secondary")
                              }
                              style={{ top, height, left: `${left}%`, width: `${laneWidth}%` }}
                              title={`${it.title}`}
                            >
                              <div className="truncate font-medium">{it.title}</div>
                              <div className="truncate text-[11px] text-muted-foreground">
                                {it.courseCode ? `${it.courseCode} · ` : ""}
                                {fmtTimeRange(it.start, it.end)}
                              </div>
                              {isPlan ? (
                                <div className="absolute inset-x-0 -top-1 h-2 cursor-move" onMouseDown={(e) => onDragResizeStart(e, it.id, "move")} />
                              ) : null}
                              {isPlan ? (
                                <div className="absolute inset-x-0 -bottom-1 h-2 cursor-ns-resize" onMouseDown={(e) => onDragResizeStart(e, it.id, "resize")} />
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
