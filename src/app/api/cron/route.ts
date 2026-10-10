import { NextResponse, type NextRequest } from "next/server";
import { cronSecret, secretsEqual } from "@/lib/server/env";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Scheduled jobs (R1): closes markets past their end date and finalizes
 * resolutions whose dispute window has ended. The database runs the same
 * function every minute with pg_cron when the project has it; this route is
 * the fallback for an external scheduler (e.g. a Railway cron service):
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron
 *
 * Refuses everything unless CRON_SECRET (32+ chars) is set and matches.
 */
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const secret = cronSecret();
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503, headers: noStore });
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secretsEqual(given, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  try {
    const { data, error } = await getAdminSupabase().rpc("run_scheduled_jobs");
    if (error) return NextResponse.json({ error: "failed" }, { status: 500, headers: noStore });
    return NextResponse.json({ ok: true, ...(data as Record<string, number>) }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500, headers: noStore });
  }
}
