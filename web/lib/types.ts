export interface Policy {
  name: string
  description: string
  link?: string
}

export interface CourseScheduleEntry {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"
  start: string // ISO string with timezone offset
  end: string // ISO string with timezone offset
  location?: string
}

export interface CourseSchedule {
  lectures: CourseScheduleEntry[]
  sections: CourseScheduleEntry[]
}

export interface Course {
  id: string
  code: string
  name: string
  semester: string
  timezone: "America/New_York"
  instructor: { name: string; email: string }
  policies: Policy[]
  schedule: CourseSchedule
}

export interface Assignment {
  id: string
  courseId: Course["id"]
  title: string
  description?: string
  dueAt: string // ISO string
  points?: number
  estimatedMinutes?: number // estimated work time in minutes
  weight?: number // percentage weight towards course grade (0-100)
  url?: string
  tags?: string[]
  assignedAt?: string // ISO string
}

export interface Milestone {
  id: string
  assignmentId: Assignment["id"]
  title: string
  dueAt: string // ISO string
  description?: string
}

export type EventType = "lecture" | "lab" | "section" | "office_hours" | "exam" | "review" | "other"

export interface Event {
  id: string
  courseId: Course["id"]
  title: string
  start: string // ISO string
  end: string // ISO string
  location?: string
  type: EventType
}

export interface PlanBlock {
  id: string
  title: string
  courseId?: Course["id"]
  relatedAssignmentId?: Assignment["id"]
  start: string // ISO string
  end: string // ISO string
  location?: string
  notes?: string
}

export type ResourceType = "document" | "article" | "video" | "link" | "dataset"

export interface Resource {
  id: string
  courseId?: Course["id"]
  title: string
  type: ResourceType
  url: string
  addedAt: string // ISO string
  tags?: string[]
  snippet?: string
}
