import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, forbidden } from "./errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Reject cross-site mutating requests. Complements the SameSite=Lax session cookie. */
export function assertSameOrigin(request: NextRequest): void {
  if (SAFE_METHODS.has(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, tests) do not send Origin
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("Cross-site request blocked.");
  }
  if (originHost !== request.headers.get("host")) throw forbidden("Cross-site request blocked.");
}

type Handler<Context> = (request: NextRequest, context: Context) => Promise<Response>;

/** Wraps a route handler: origin check, then ApiError and ZodError mapped to JSON error responses. */
export function handle<Context = unknown>(handler: Handler<Context>): Handler<Context> {
  return async (request, context) => {
    try {
      assertSameOrigin(request);
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
      if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "That already exists." }, { status: 409 });
      }
      if (error instanceof ZodError) {
        return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
      }
      console.error(error);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
  };
}

export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Refuse oversized bodies before reading them into memory (the header is checked; browsers always send it). */
export function assertBodyUnder(request: NextRequest, maxBytes: number): void {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > maxBytes) throw new ApiError(413, "That request is too large.");
}

export async function readJson(request: NextRequest): Promise<unknown> {
  assertBodyUnder(request, 1_000_000);
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}
