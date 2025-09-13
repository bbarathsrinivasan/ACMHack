// Read-only build-time data imports
// These import JSON fixtures and export typed arrays for use in server or client components.

import courses from "@/data/courses.json"
import assignments from "@/data/assignments.json"
import milestones from "@/data/milestones.json"
import events from "@/data/events.json"
import planblocks from "@/data/planblocks.json"
import resources from "@/data/resources.json"

import type { Course, Assignment, Milestone, Event, PlanBlock, Resource } from "@/lib/types"

export const COURSES = courses as Course[]
export const ASSIGNMENTS = assignments as Assignment[]
export const MILESTONES = milestones as Milestone[]
export const EVENTS = events as Event[]
export const PLANBLOCKS = planblocks as PlanBlock[]
export const RESOURCES = resources as Resource[]

// Helper getters (read-only)
export function getCourseById(id: string) {
  return COURSES.find((c) => c.id === id)
}

export function getAssignmentsByCourse(courseId: string) {
  return ASSIGNMENTS.filter((a) => a.courseId === courseId)
}

export function getMilestonesByAssignment(assignmentId: string) {
  return MILESTONES.filter((m) => m.assignmentId === assignmentId)
}

export function getEventsByCourse(courseId: string) {
  return EVENTS.filter((e) => e.courseId === courseId)
}

export function getPlanBlocksByCourse(courseId: string) {
  return PLANBLOCKS.filter((p) => p.courseId === courseId)
}

export function getResourcesByCourse(courseId: string) {
  return RESOURCES.filter((r) => r.courseId === courseId)
}
