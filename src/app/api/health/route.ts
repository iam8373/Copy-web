import { NextResponse } from "next/server";

/**
 * Railway healthcheck (B6). Public, constant, no data and no database call:
 * it only proves the server is up and serving. Never cached.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
