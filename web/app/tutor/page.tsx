"use client"

import { useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RESOURCES, COURSES } from "@/lib/data"
import { isDirectAnswerDemand, isGradedWork, refusalTemplate, generateHint, type HintLevel } from "@/lib/guardrails"

type Msg = { role: "user" | "assistant"; content: string }

function guidedHint(userMsg: string) {
  const trimmed = userMsg.trim()
  const restate = trimmed ? `Let’s restate the problem: "${trimmed}".` : "Let’s restate your question."
  const hint =
    "What do we already know, and what are we trying to prove or compute? Identify definitions, break it into smaller subgoals, and test a simple example first."
  return `${restate}\n\nHint: ${hint}`
}

function pickCourseId(text: string): string | undefined {
  const lower = text.toLowerCase()
  const ids = COURSES.map((c) => c.id)
  return ids.find((id) => lower.includes(id))
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

function resourceScore(r: (typeof RESOURCES)[number], terms: string[], preferCourseId?: string): number {
  const hay = [r.title, ...(r.tags ?? []), r.snippet ?? ""].join(" ").toLowerCase()
  let score = 0
  for (const t of terms) {
    if (!t) continue
    // title match weight 3, tag/snippet weight 1
    const inTitle = r.title.toLowerCase().includes(t)
    const inOther = !inTitle && hay.includes(t)
    score += inTitle ? 3 : inOther ? 1 : 0
  }
  if (preferCourseId && r.courseId === preferCourseId) score += 2
  return score
}

function topResources(query: string, preferCourseId?: string, limit = 3) {
  const terms = tokenize(query)
  if (terms.length === 0) return [] as typeof RESOURCES
  return RESOURCES
    .map((r) => ({ r, s: resourceScore(r, terms, preferCourseId) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r)
}

export default function TutorPage() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const viewportRef = useRef<HTMLDivElement>(null)
  const [pendingGuidedSource, setPendingGuidedSource] = useState<string | null>(null)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const content = input.trim()
    if (!content) return
    const user: Msg = { role: "user", content }
    // Guardrail checks
    if (isGradedWork(content) || isDirectAnswerDemand(content)) {
      const assistant: Msg = { role: "assistant", content: refusalTemplate() }
      setMessages((prev) => [...prev, user, assistant])
      setPendingGuidedSource(content)
    } else {
      const courseId = pickCourseId(content)
      const resources = topResources(content, courseId, 3)
      const links = resources.map((r) => `• ${r.title} — ${r.url}`).join("\n")
      const assistant: Msg = {
        role: "assistant",
        content: `${guidedHint(content)}${links ? "\n\nTry these resources:\n" + links : ""}`,
      }
      setMessages((prev) => [...prev, user, assistant])
      setPendingGuidedSource(null)
    }
    setInput("")
    setTimeout(() => viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" }), 0)
  }

  function onPickHint(level: HintLevel, source: string) {
    const reply: Msg = { role: "assistant", content: generateHint(level, source) }
    setMessages((prev) => [...prev, reply])
    setPendingGuidedSource(null)
    setTimeout(() => viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" }), 0)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Tutor</h1>
        <Badge variant="secondary">Guided Mode (no direct answers)</Badge>
      </div>

      <Card className="rounded-2xl shadow-sm p-0" style={{ height: "80dvh" }}>
        <div
          ref={viewportRef}
          className="h-[calc(80dvh-52px-48px)] overflow-y-auto p-4"
          aria-label="Chat transcript"
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-[48ch] text-center text-sm text-muted-foreground">
                Ask a question and I&apos;ll respond with a guiding hint. Include a course id like
                {" "}
                <code className="px-1 rounded bg-muted">cs101</code> or {" "}
                <code className="px-1 rounded bg-muted">math221</code>
                {" "}
                to get relevant resources.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, idx) => {
                const isAssistant = m.role === "assistant"
                // Try to derive the user's course context from the previous user message, if any
                const prevUser = idx > 0 ? messages[idx - 1] : undefined
                const courseIdCtx = prevUser?.role === "user" ? pickCourseId(prevUser.content) : undefined
                const chips = isAssistant ? topResources(prevUser?.role === "user" ? prevUser.content : "", courseIdCtx, 3) : []
                return (
                  <div key={idx} className={isAssistant ? "text-left" : "text-right"}>
                    <div
                      className={
                        "inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm " +
                        (isAssistant ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground")
                      }
                    >
                      {m.content}
                    </div>
                    {isAssistant && pendingGuidedSource && idx === messages.length - 1 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(["Restate","Concept","Outline","Example","Next Step"] as HintLevel[]).map((label) => (
                          <button
                            key={label}
                            onClick={() => onPickHint(label, pendingGuidedSource)}
                            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs hover:bg-muted"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {isAssistant && chips.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {chips.map((r) => (
                          <a
                            key={r.id}
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs hover:bg-muted"
                          >
                            <span className="truncate max-w-[22ch]">{r.title}</span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="flex items-center gap-2 border-t p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question (e.g., 'cs101 How does minimax pruning work?')"
            className="rounded-xl"
          />
          <Button type="submit" className="rounded-xl">Send</Button>
        </form>
      </Card>
    </div>
  )
}
