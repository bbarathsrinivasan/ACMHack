import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLANBLOCKS, COURSES, ASSIGNMENTS, MILESTONES, EVENTS } from "@/lib/data";
import { CalendarWeekClient } from "@/components/calendar-week-client";

const TZ = "America/New_York" as const

function fmtTimeRange(startIso: string, endIso: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${fmt.format(new Date(startIso))} – ${fmt.format(new Date(endIso))}`
}

function dayKeyFrom(date: Date) {
  // Produces YYYY-MM-DD in the target TZ
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

function nyWeekdayIndex(date = new Date()) {
  const wk = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(
    date
  )
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wk)
}

function getWeekDayKeys(baseDate = new Date()) {
  // Build week keys from Sunday..Saturday for current week in TZ
  const dow = nyWeekdayIndex(baseDate) // 0..6
  const start = new Date(baseDate.getTime() - dow * 24 * 60 * 60 * 1000)
  const keys: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000)
    keys.push(dayKeyFrom(d))
  }
  return keys
}

type Risk = "Low" | "Medium" | "High"
function assignmentRisk(dueIso: string): Risk {
  const now = Date.now()
  const due = new Date(dueIso).getTime()
  const ms = due - now
  const days = ms / (24 * 60 * 60 * 1000)
  if (days < 2) return "High"
  if (days < 5) return "Medium"
  return "Low"
}

export default function Home() {
  const now = new Date()
  const todayKey = dayKeyFrom(now)

  const todaysBlocks = PLANBLOCKS.filter((p) => dayKeyFromISO(p.start) === todayKey).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  )

  const weekKeys = getWeekDayKeys(now)
  const assignments = ASSIGNMENTS.slice().sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  )

  return (
    <div className="space-y-8">
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Dashboard</h1>

      {/* Today’s Plan */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Today’s Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {todaysBlocks.length === 0 ? (
              <div className="text-muted-foreground">No plan blocks scheduled for today.</div>
            ) : (
              <ul className="space-y-4">
                {todaysBlocks.map((b) => {
                  const course = b.courseId ? COURSES.find((c) => c.id === b.courseId) : undefined
                  const related = b.relatedAssignmentId
                    ? MILESTONES.filter((m) => m.assignmentId === b.relatedAssignmentId)
                        .slice()
                        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0]
                    : undefined
                  return (
                    <li key={b.id} className="rounded-2xl border p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{b.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {fmtTimeRange(b.start, b.end)}
                            {course ? <> · {course.code}</> : null}
                            {related ? <> · Milestone: {related.title}</> : null}
                          </div>
                        </div>
                      </div>
                      {b.notes ? (
                        <div className="mt-2 text-sm text-muted-foreground">{b.notes}</div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Assignment Risk */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {assignments.map((a) => {
                const risk = assignmentRisk(a.dueAt)
                const variant: "destructive" | "default" | "secondary" =
                  risk === "High" ? "destructive" : risk === "Medium" ? "default" : "secondary"
                const course = COURSES.find((c) => c.id === a.courseId)
                const time = new Intl.DateTimeFormat("en-US", {
                  timeZone: TZ,
                  month: "short",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(a.dueAt))
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{a.title}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {course ? `${course.code} · ` : ""}
                        Due {time}
                      </div>
                    </div>
                    <Badge variant={variant}>{risk}</Badge>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

  {/* Week Calendar - stacked blocks, 24h scrollable */}
  <CalendarWeekClient weekKeys={weekKeys} />
    </div>
  );
}
