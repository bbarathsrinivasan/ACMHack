// Simple keyword/regex-based guardrails

export function isGradedWork(text: string): boolean {
  const t = text.toLowerCase()
  const words = [
    "pset",
    "problem set",
    "assignment",
    "homework",
    "hw",
    "quiz",
    "midterm",
    "final exam",
    "final",
    "exam",
    "test",
    "lab report",
    "project report",
    "take-home",
    "graded",
    "for credit",
    "due",
    "deadline",
  ]
  if (words.some((w) => t.includes(w))) return true
  // simple patterns like A1, HW2, PSET3
  if (/\b(?:a|hw|pset)\s*\d+\b/i.test(text)) return true
  return false
}

export function isDirectAnswerDemand(text: string): boolean {
  const t = text.toLowerCase()
  const phrases = [
    "final answer",
    "give answer",
    "just answer",
    "the answer is",
    "solve it for me",
    "what is the answer",
    "provide the answer",
    "send the solution",
    "full solution",
  ]
  return phrases.some((p) => t.includes(p))
}

export function refusalTemplate(): string {
  return (
    "I can’t provide direct answers for graded work. Let’s keep this guided.\n\n" +
    "Choose a hint level: Restate, Concept, Outline, Example, Next Step."
  )
}

export type HintLevel = "Restate" | "Concept" | "Outline" | "Example" | "Next Step"

export function generateHint(level: HintLevel, userMsg: string): string {
  const trimmed = userMsg.trim()
  switch (level) {
    case "Restate":
      return `Restating your question to clarify scope: "${trimmed}". What are the inputs, constraints, and the goal?`
    case "Concept":
      return "Key concepts to review: definitions involved, related theorems/properties, and why they apply here."
    case "Outline":
      return "Outline of a solution path: 1) Identify knowns/unknowns. 2) Pick an approach. 3) Break into subproblems. 4) Check edge cases."
    case "Example":
      return "Try a small example (simple numbers or a tiny graph). Walk through the steps and observe patterns before generalizing."
    case "Next Step":
      return "Next actionable step: write down the relevant formula/definition and substitute the variables from your problem."
  }
}
