"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { COPY, errorMessage } from "../_copy";
import { generateTranslations } from "./actions";

const C = COPY.translations;

/** `configured` comes from the server (machineTranslationConfigured()). */
export function GenerateButton({
  marketId,
  configured,
  disabled,
  size = "md",
}: {
  marketId: string;
  configured: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const go = async () => {
    setBusy(true);
    setMsg(null);
    const r = await generateTranslations(marketId);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: errorMessage(r.error) });
    const extra = r.data.skipped.length ? C.skipped(r.data.skipped.join(" and ")) : "";
    setMsg({ ok: true, text: C.generated(r.data.saved, r.data.kept) + extra });
    router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size={size} variant="outline" onClick={go} loading={busy} disabled={disabled || !configured}>
        {C.generate}
      </Button>
      {!configured && size === "md" && <span className="text-12 text-secondary">{C.notConfigured}</span>}
      <span role="status" aria-live="polite" className={msg?.ok ? "text-12 text-success" : "text-12 text-danger"}>
        {msg?.text}
      </span>
    </div>
  );
}
