import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_PATH = path.join(process.cwd(), "data", "planblocks.json");

const isoString = z
  .string()
  .datetime({ offset: true })
  .describe("ISO string with timezone offset");

const PlanBlockBase = z.object({
  title: z.string().min(1),
  courseId: z.string().min(1).optional(),
  relatedAssignmentId: z.string().min(1).optional(),
  start: isoString,
  end: isoString,
  location: z.string().min(1).optional(),
  notes: z.string().optional(),
});

const PlanBlockCreateSchema = PlanBlockBase.extend({
  id: z.string().min(1).optional(),
}).superRefine((v: z.infer<typeof PlanBlockCreateSchema>, ctx: z.RefinementCtx) => {
  if (new Date(v.end).getTime() <= new Date(v.start).getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "end must be after start", path: ["end"] });
  }
});

const PlanBlockSchema = PlanBlockBase.extend({ id: z.string().min(1) }).superRefine(
  (v: z.infer<typeof PlanBlockSchema>, ctx: z.RefinementCtx) => {
    if (new Date(v.end).getTime() <= new Date(v.start).getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "end must be after start", path: ["end"] });
    }
  }
);
type PlanBlock = z.infer<typeof PlanBlockSchema>;

async function readFileWithEtag() {
  const content = await fs.readFile(DATA_PATH, "utf8");
  const etag = '"' + crypto.createHash("sha256").update(content).digest("hex") + '"';
  const data = JSON.parse(content) as unknown[];
  return { content, data, etag } as const;
}

async function atomicWriteJSON(filePath: string, obj: unknown) {
  const dir = path.dirname(filePath);
  const tmp = path.join(
    dir,
    `.planblocks.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  const content = JSON.stringify(obj, null, 2) + "\n";
  await fs.writeFile(tmp, content, "utf8");
  // Atomic replace
  await fs.rename(tmp, filePath);
  return content;
}

export async function GET(req: NextRequest) {
  try {
    const { content, data, etag } = await readFileWithEtag();
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ETag: etag,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    if (isNodeErr(err) && err.code === "ENOENT") {
      // Initialize empty file on first read
      const content = await atomicWriteJSON(DATA_PATH, []);
      const etag = '"' + crypto.createHash("sha256").update(content).digest("hex") + '"';
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ETag: etag,
          "Cache-Control": "no-store",
        },
      });
    }
    return Response.json({ error: "read_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parse = PlanBlockCreateSchema.safeParse(body);
  if (!parse.success) {
    return Response.json({ error: "invalid_payload", details: parse.error.format() }, { status: 400 });
  }

  try {
    const { data, etag } = await readFileWithEtag();
    const ifMatch = req.headers.get("if-match");
    if (ifMatch && ifMatch !== etag) {
      return Response.json(
        { error: "etag_mismatch", expected: etag },
        { status: 409, headers: { ETag: etag } }
      );
    }

    const blocks = (Array.isArray(data) ? (data as PlanBlock[]) : []);
    let newBlock = parse.data as Omit<PlanBlock, "id"> & { id?: string };
    if (!newBlock.id) {
      newBlock = { ...newBlock, id: crypto.randomUUID() } as PlanBlock;
    }
    if (blocks.some((b) => b.id === (newBlock as PlanBlock).id)) {
      return Response.json({ error: "duplicate_id" }, { status: 409, headers: { ETag: etag } });
    }

    const next = [...blocks, newBlock as PlanBlock];
    const written = await atomicWriteJSON(DATA_PATH, next);
    const newEtag = '"' + crypto.createHash("sha256").update(written).digest("hex") + '"';

    return new Response(JSON.stringify(newBlock), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        ETag: newEtag,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    return Response.json({ error: "write_failed" }, { status: 500 });
  }
}

const PatchSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  courseId: z.string().min(1).optional(),
  relatedAssignmentId: z.string().min(1).optional(),
  start: isoString.optional(),
  end: isoString.optional(),
  location: z.string().min(1).optional(),
  notes: z.string().optional(),
}).superRefine((v: z.infer<typeof PatchSchema>, ctx: z.RefinementCtx) => {
  if (v.start && v.end) {
    if (new Date(v.end).getTime() <= new Date(v.start).getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "end must be after start", path: ["end"] });
    }
  }
});

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_payload", details: parsed.error.format() }, { status: 400 });
  }
  try {
    const { data, etag } = await readFileWithEtag();
    const ifMatch = req.headers.get("if-match");
    if (ifMatch && ifMatch !== etag) {
      return Response.json(
        { error: "etag_mismatch", expected: etag },
        { status: 409, headers: { ETag: etag } }
      );
    }
    const blocks = (Array.isArray(data) ? (data as PlanBlock[]) : []);
    const idx = blocks.findIndex((b) => b.id === parsed.data.id);
    if (idx === -1) {
      return Response.json({ error: "not_found" }, { status: 404, headers: { ETag: etag } });
    }
    const original = blocks[idx];
    const updated: PlanBlock = { ...original, ...parsed.data } as PlanBlock;
    // Validate full updated object
    const fullCheck = PlanBlockSchema.safeParse(updated);
    if (!fullCheck.success) {
      return Response.json(
        { error: "invalid_result", details: fullCheck.error.format() },
        { status: 400, headers: { ETag: etag } }
      );
    }
    const next = [...blocks];
    next[idx] = updated;
    const written = await atomicWriteJSON(DATA_PATH, next);
    const newEtag = '"' + crypto.createHash("sha256").update(written).digest("hex") + '"';
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json", ETag: newEtag, "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    return Response.json({ error: "write_failed" }, { status: 500 });
  }
}

const DeleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_payload", details: parsed.error.format() }, { status: 400 });
  }
  try {
    const { data, etag } = await readFileWithEtag();
    const ifMatch = req.headers.get("if-match");
    if (ifMatch && ifMatch !== etag) {
      return Response.json(
        { error: "etag_mismatch", expected: etag },
        { status: 409, headers: { ETag: etag } }
      );
    }
    const blocks = (Array.isArray(data) ? (data as PlanBlock[]) : []);
    const idx = blocks.findIndex((b) => b.id === parsed.data.id);
    if (idx === -1) {
      return Response.json({ error: "not_found" }, { status: 404, headers: { ETag: etag } });
    }
    const next = [...blocks.slice(0, idx), ...blocks.slice(idx + 1)];
    const written = await atomicWriteJSON(DATA_PATH, next);
    const newEtag = '"' + crypto.createHash("sha256").update(written).digest("hex") + '"';
    return new Response(null, { status: 204, headers: { ETag: newEtag, "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    return Response.json({ error: "write_failed" }, { status: 500 });
  }
}

function isNodeErr(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && typeof (e as NodeJS.ErrnoException).code === "string";
}
