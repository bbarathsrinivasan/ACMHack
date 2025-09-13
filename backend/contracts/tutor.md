# Tutor API Contract

This document describes the expected endpoints and JSON schemas for Tutor-related backend. These contracts mirror the file formats currently used by the UI. There is no backend implementation yet; the UI uses local data (`resources.json`, `courses.json`) and client-side matching.

## Resources

The UI reads `data/resources.json` using the `Resource` shape below.

### Resource
```
{
  "id": "string",
  "courseId": "string?", // course id such as "cs101"
  "title": "string",
  "type": "document" | "article" | "video" | "link" | "dataset",
  "url": "string",
  "addedAt": "ISO DateTime",
  "tags": string[]?,
  "snippet": "string?"
}
```

## (Planned) Endpoints

Base path: `/api/tutor`

> Note: The current UI does not call these endpoints; they are proposed to mirror client behavior and support future server-backed search.

### POST /api/tutor/hints

Generate a guided hint for a user question. The server should not provide direct answers, only guidance.

Request headers:
- `Content-Type: application/json`

Request body:
```
{
  "message": "string",         // user message
  "courseId": "string?"        // optional course context (e.g., parsed from message)
}
```

Response:
- `200 OK`
```
{
  "hint": "string"             // guided hint text
}
```

### POST /api/tutor/resources:search

Keyword search over `resources` to return top matches for a query, preferring the same course when provided.

Request headers:
- `Content-Type: application/json`

Request body:
```
{
  "query": "string",           // free text query
  "courseId": "string?",       // optional preferred course id
  "limit":  number?             // default 3
}
```

Response:
- `200 OK`
```
{
  "items": [
    {
      "id": "string",
      "title": "string",
      "url": "string",
      "courseId": "string?",
      "type": "document" | "article" | "video" | "link" | "dataset"
    }
  ]
}
```

Scoring/behavior (to mirror client):
- Tokenize to lowercase terms; score title matches higher than tags/snippet.
- Add a small bonus if `courseId` matches the preferred course.
- Return up to `limit` results with positive score.

### (Optional) GET /api/tutor/resources

Return all resources. Intended mainly for debugging or prefetch.

Response:
- `200 OK`: `Resource[]`

## Notes

- The client keeps a "Guided Mode" badge and shows link chips under the hint; this API returns raw data. The UI remains responsible for presentation.
- In the current app, course detection is done client-side by scanning the message for known course ids; the `courseId` field in the request is optional but recommended for better ranking.
