"use client";

import { useRouter } from "next/navigation";
import type { MarketStatus } from "@/lib/admin/market-schema";
import { COPY } from "../_copy";
import { ConfirmSlug } from "../_components/ConfirmSlug";
import { closeMarket, publishMarket } from "./actions";

const C = COPY.markets;

/** Publish (draft) / close early (open). Admin only; typed slug. */
export function StatusActions({ id, slug, status, isAdmin }: { id: string; slug: string; status: MarketStatus; isAdmin: boolean }) {
  const router = useRouter();
  if (status !== "draft" && status !== "open") return null;
  if (!isAdmin) return <p className="text-13 text-secondary">{C.adminOnly}</p>;
  const run = (fn: typeof publishMarket) => async (typed: string) => {
    const r = await fn(id, typed);
    if (!r.ok) return r.error;
    router.refresh();
    return null;
  };
  return status === "draft" ? (
    <ConfirmSlug slug={slug} trigger={C.publish} title={C.publishTitle} body={C.publishBody} onConfirm={run(publishMarket)} />
  ) : (
    <ConfirmSlug slug={slug} trigger={C.close} title={C.closeTitle} body={C.closeBody} variant="no" onConfirm={run(closeMarket)} />
  );
}
