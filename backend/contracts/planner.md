# Planner API Contract

This document describes the expected endpoints and JSON schemas for the Planner-related backend. These contracts mirror the file formats and behaviors currently used by the UI and route handlers.

All responses are JSON unless otherwise stated. All write operations use ETag-based optimistic concurrency.

Base path: `/api/planblocks`

## Common Types

- ISO DateTime: string in ISO 8601 with timezone offset, e.g. `2025-09-13T10:00:00.000-04:00`.

### PlanBlock
```
{
  "id": "string",
  "title": "string",
  "courseId": "string?",
  "relatedAssignmentId": "string?",
  "start": "ISO DateTime",
  "end": "ISO DateTime",
  "location": "string?",
  "notes": "string?"
}
```

### PlanBlockCreate
```
{
  // id optional; server will generate UUID if omitted
  "id": "string?",
  "title": "string",
  "courseId": "string?",
  "relatedAssignmentId": "string?",
  "start": "ISO DateTime",
  "end": "ISO DateTime",
  "location": "string?",
  "notes": "string?"
}
```

Constraints:
- `end` must be strictly after `start`.

## GET /api/planblocks

Returns the current list of plan blocks.

Request headers (optional):
- `If-None-Match: "<etag>"` to use conditional caching.

Responses:
- `200 OK`
  - Headers: `ETag: "<etag>"`, `Cache-Control: no-store`
  - Body: `PlanBlock[]`
- `304 Not Modified`
  - Headers: `ETag: "<etag>"`
  - Body: empty

## POST /api/planblocks

Create a new plan block.

Request headers:
- `Content-Type: application/json`
- Optional: `If-Match: "<etag>"` for optimistic concurrency.

Request body: `PlanBlockCreate`

Responses:
- `201 Created`
  - Headers: `ETag: "<etag>"`, `Cache-Control: no-store`
  - Body: `PlanBlock` (with `id`)
- `400 Bad Request` (invalid JSON or payload)
- `409 Conflict` when `If-Match` provided and does not match current ETag, or duplicate `id`.
  - Headers: `ETag: "<current-etag>"`
- `500 Internal Server Error` on write failure

## PATCH /api/planblocks

Update fields on an existing plan block.

Request headers:
- `Content-Type: application/json`
- Optional: `If-Match: "<etag>"`

Request body (partial fields allowed; `id` required):
```
{
  "id": "string",
  "title": "string?",
  "courseId": "string?",
  "relatedAssignmentId": "string?",
  "start": "ISO DateTime?",
  "end": "ISO DateTime?",
  "location": "string?",
  "notes": "string?"
}
```

Responses:
- `200 OK`
  - Headers: `ETag: "<etag>"`, `Cache-Control: no-store`
  - Body: updated `PlanBlock`
- `400 Bad Request` if invalid JSON or invalid result (e.g., `end <= start` when both provided)
- `404 Not Found` if block `id` not found
- `409 Conflict` on ETag mismatch
  - Headers: `ETag: "<current-etag>"`
- `500 Internal Server Error` on write failure

## DELETE /api/planblocks

Delete a plan block by id.

Request headers:
- `Content-Type: application/json`
- Optional: `If-Match: "<etag>"`

Request body:
```
{ "id": "string" }
```

Responses:
- `204 No Content`
  - Headers: `ETag: "<etag>"`, `Cache-Control: no-store`
- `400 Bad Request` for invalid JSON/payload
- `404 Not Found` when the id does not exist
- `409 Conflict` on ETag mismatch
  - Headers: `ETag: "<current-etag>"`
- `500 Internal Server Error` on write failure

## Planner (Client-side behavior reference)

The UI computes study plan blocks greedily and posts them here. Generated blocks follow the `PlanBlockCreate` schema and are 30-minute slices. The UI posts sequentially and updates the stored ETag after each success.
