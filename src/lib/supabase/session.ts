import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Claims of the session in the request cookies, decoded LOCALLY (S3): no call
 * to the Auth server unless the access token is about to expire, in which
 * case the SDK refreshes it once.
 *
 * NOT VERIFIED here. Use it only where the next step sends the same token to
 * the database (PostgREST verifies the signature and RLS uses auth.uid()), so a
 * forged or expired token gets no data: own profile, portfolio, orders. For
 * anything decided on the server alone (admin pages, grievance linking, auth
 * callbacks) use `supabase.auth.getClaims()`, which verifies (locally with
 * asymmetric signing keys, otherwise via the Auth server).
 */
export interface SessionClaims {
  sub: string;
  email?: string;
  aal?: string;
  exp?: number;
  app_metadata?: { provider?: string };
}

export async function unverifiedSessionClaims(supabase: SupabaseClient<any, any, any>): Promise<SessionClaims | null> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) return null;
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as SessionClaims;
    return typeof json.sub === "string" && json.sub ? json : null;
  } catch {
    return null;
  }
}
