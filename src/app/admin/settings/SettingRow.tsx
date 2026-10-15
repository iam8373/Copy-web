"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { COPY, errorMessage } from "../_copy";
import { input } from "../_components/styles";
import { updateSetting } from "./actions";

const C = COPY.settings;

export function SettingRow({ k, value }: { k: string; value: unknown }) {
  const router = useRouter();
  const isBool = typeof value === "boolean";
  const [v, setV] = useState<string>(isBool ? String(value) : value === null ? "" : String(value));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [title] = C.items[k] ?? [k, ""];
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await updateSetting(k, isBool ? v === "true" : Number(v));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: errorMessage(r.error) });
    setMsg({ ok: true, text: C.saved });
    router.refresh();
  };
  const changed = isBool ? v !== String(value) : v !== String(value ?? "");
  return (
    <form onSubmit={save} aria-label={title} className="flex flex-wrap items-center gap-2" data-testid={`setting-${k}`}>
      <label htmlFor={`s-${k}`} className="sr-only">{title}</label>
      {isBool ? (
        <select id={`s-${k}`} className={input + " w-32"} value={v} onChange={(e) => setV(e.target.value)}>
          <option value="true">{C.on}</option>
          <option value="false">{C.off}</option>
        </select>
      ) : (
        <input id={`s-${k}`} type="number" step="any" className={input + " w-40 font-mono"} value={v} onChange={(e) => setV(e.target.value)} required />
      )}
      <Button type="submit" size="sm" variant="outline" loading={busy} disabled={!changed}>{C.save}</Button>
      <span role="status" className={msg?.ok ? "text-12 text-success" : "text-12 text-danger"}>{msg?.text}</span>
    </form>
  );
}
