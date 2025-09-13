"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ASSIGNMENTS, COURSES, MILESTONES, PLANBLOCKS } from "@/lib/data"
import type { Assignment } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const TZ = "America/New_York" as const

type Risk = "Low" | "Medium" | "High"
function assignmentRisk(dueIso: string): Risk {
  const now = Date.now()
  const due = new Date(dueIso).getTime()
  const days = (due - now) / (24 * 60 * 60 * 1000)
  if (days < 2) return "High"
  if (days < 5) return "Medium"
  return "Low"
}

const riskOptions: Risk[] = ["Low", "Medium", "High"]

export default function AssignmentsPage() {
  const [sortAsc, setSortAsc] = useState(true)
  const [courseFilter, setCourseFilter] = useState<string | "">("")
  const [riskFilter, setRiskFilter] = useState<Risk | "">("")
  const [selected, setSelected] = useState<Assignment | null>(null)

  const courses = useMemo(() => COURSES, [])
  const rows = useMemo(() => {
    let list = ASSIGNMENTS.slice()
    if (courseFilter) list = list.filter((a) => a.courseId === courseFilter)
    if (riskFilter) list = list.filter((a) => assignmentRisk(a.dueAt) === riskFilter)
    list.sort((a, b) =>
      sortAsc
        ? new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
        : new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime()
    )
    return list
  }, [sortAsc, courseFilter, riskFilter])

  return (
    <div className="space-y-6">
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Assignments</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Course</span>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="">All</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Risk</span>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={riskFilter}
            onChange={(e) => setRiskFilter((e.target.value as Risk) || "")}
          >
            <option value="">All</option>
            {riskOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <Separator className="mx-1 hidden md:block" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortAsc((s) => !s)}
          className="rounded-lg"
        >
          Sort by Due {sortAsc ? "↑" : "↓"}
        </Button>
      </div>

      {/* Table */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium">Course</th>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Due</th>
                  <th className="px-4 py-3 text-left font-medium">Est. Time</th>
                  <th className="px-4 py-3 text-left font-medium">Risk</th>
                  <th className="px-4 py-3 text-left font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const course = COURSES.find((c) => c.id === a.courseId)
                  const risk = assignmentRisk(a.dueAt)
                  const variant: "destructive" | "default" | "secondary" =
                    risk === "High" ? "destructive" : risk === "Medium" ? "default" : "secondary"
                  const due = new Intl.DateTimeFormat("en-US", {
                    timeZone: TZ,
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(a.dueAt))
                  const est = a.estimatedMinutes ? `${Math.round(a.estimatedMinutes / 60)}h` : "—"
                  const weight = a.weight != null ? `${a.weight}%` : a.points ? `${a.points} pts` : "—"
                  return (
                    <tr
                      key={a.id}
                      className="cursor-pointer border-b hover:bg-accent/40"
                      onClick={() => setSelected(a)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">{course?.code ?? a.courseId}</td>
                      <td className="px-4 py-3">
                        <div className="truncate font-medium">{a.title}</div>
                        {a.url ? (
                          <div className="truncate text-xs text-muted-foreground">
                            <Link href={a.url} className="underline" target="_blank">
                              {a.url}
                            </Link>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{due}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{est}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={variant}>{risk}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{weight}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <DetailsDrawer assignment={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  )
}

function DetailsDrawer({
  assignment,
  onOpenChange,
}: {
  assignment: Assignment | null
  onOpenChange: (open: boolean) => void
}) {
  const open = !!assignment
  const course = assignment ? COURSES.find((c) => c.id === assignment.courseId) : undefined
  const milestones = assignment
    ? MILESTONES.filter((m) => m.assignmentId === assignment.id).sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      )
    : []
  const planned = assignment
    ? PLANBLOCKS.filter((p) => p.relatedAssignmentId === assignment.id).sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      )
    : []

  const dueText = assignment
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(assignment.dueAt))
    : ""

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{assignment?.title}</SheetTitle>
          <SheetDescription>
            {course ? `${course.code} • ` : ""}
            Due {dueText}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Links */}
          {assignment?.url ? (
            <div>
              <div className="text-sm font-medium">Links</div>
              <div className="text-sm text-muted-foreground">
                <Link href={assignment.url} className="underline" target="_blank">
                  {assignment.url}
                </Link>
              </div>
            </div>
          ) : null}

          {/* Milestones */}
          <div>
            <div className="text-sm font-medium">Milestones</div>
            {milestones.length === 0 ? (
              <div className="text-sm text-muted-foreground">No milestones.</div>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {milestones.map((m) => (
                  <li key={m.id} className="rounded-md border p-2">
                    <div className="font-medium">{m.title}</div>
                    <div className="text-muted-foreground">
                      Due {new Intl.DateTimeFormat("en-US", {
                        timeZone: TZ,
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(m.dueAt))}
                    </div>
                    {m.description ? (
                      <div className="mt-1 text-muted-foreground">{m.description}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Planned blocks */}
          <div>
            <div className="text-sm font-medium">Planned blocks</div>
            {planned.length === 0 ? (
              <div className="text-sm text-muted-foreground">No plan blocks yet.</div>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {planned.map((p) => (
                  <li key={p.id} className="rounded-md border p-2">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-muted-foreground">
                      {new Intl.DateTimeFormat("en-US", {
                        timeZone: TZ,
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(p.start))}
                      {" – "}
                      {new Intl.DateTimeFormat("en-US", {
                        timeZone: TZ,
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(p.end))}
                    </div>
                    {p.location ? (
                      <div className="mt-1 text-muted-foreground">{p.location}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
