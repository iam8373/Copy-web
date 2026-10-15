"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  CATEGORY_VALUES,
  editableFields,
  isoToIstLocal,
  istLocalToIso,
  type MarketInput,
  type MarketStatus,
} from "@/lib/admin/market-schema";
import { COPY, errorMessage } from "../_copy";
import { input, label, textarea } from "../_components/styles";
import { createMarket, updateMarket } from "./actions";

const C = COPY.markets;
const F = C.fields;

type Form = {
  slug: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  endLocal: string;
  resolutionSource: string;
  isBinary: boolean;
  outcomesText: string;
  liquidityB: string;
  isFeatured: boolean;
  isLive: boolean;
  tagsText: string;
  region: string;
};

function fromInput(v: MarketInput): Form {
  return {
    slug: v.slug,
    title: v.title,
    description: v.description,
    category: v.category,
    subcategory: v.subcategory,
    endLocal: v.endDate ? isoToIstLocal(v.endDate) : "",
    resolutionSource: v.resolutionSource,
    isBinary: v.isBinary,
    outcomesText: v.outcomes.join("\n"),
    liquidityB: String(v.liquidityB),
    isFeatured: v.isFeatured,
    isLive: v.isLive,
    tagsText: v.tags.join(", "),
    region: v.region,
  };
}

function toInput(f: Form): MarketInput {
  return {
    slug: f.slug.trim(),
    title: f.title.trim(),
    description: f.description,
    category: f.category as MarketInput["category"],
    subcategory: f.subcategory.trim(),
    endDate: istLocalToIso(f.endLocal),
    resolutionSource: f.resolutionSource.trim(),
    isBinary: f.isBinary,
    outcomes: f.isBinary ? ["Yes", "No"] : f.outcomesText.split("\n").map((s) => s.trim()).filter(Boolean),
    liquidityB: Number(f.liquidityB),
    isFeatured: f.isFeatured,
    isLive: f.isLive,
    tags: f.tagsText.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    region: f.region.trim(),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Create (mode "new") or edit; locked fields follow the market's status. */
export function MarketForm({
  mode,
  id,
  status = "draft",
  initial,
}: {
  mode: "new" | "edit";
  id?: string;
  status?: MarketStatus;
  initial: MarketInput;
}) {
  const router = useRouter();
  const [f, setF] = useState<Form>(() => fromInput(initial));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const editable = useMemo(() => (mode === "new" ? editableFields("draft") : editableFields(status)), [mode, status]);
  const can = (k: keyof MarketInput) => editable.has(k);
  // Compare against the initial values as the form would send them (minute
  // precision for dates), so untouched fields never count as changes.
  const baseline = useMemo(() => toInput(fromInput(initial)), [initial]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const next = toInput(f);
    if (!next.endDate) return setMsg({ tone: "err", text: errorMessage("BP_INVALID_INPUT") });
    setBusy(true);
    if (mode === "new") {
      const r = await createMarket(next);
      setBusy(false);
      if (!r.ok) return setMsg({ tone: "err", text: errorMessage(r.error) });
      router.push(`/admin/markets/${r.data}`);
      return;
    }
    const changes: Partial<MarketInput> = {};
    for (const k of Object.keys(next) as Array<keyof MarketInput>) {
      if (!can(k) || same(next[k], baseline[k])) continue;
      (changes as Record<string, unknown>)[k] = next[k];
    }
    // Outcomes only matter for multi-outcome drafts; the type change carries them.
    if (changes.isBinary !== undefined || (changes.outcomes && !next.isBinary)) {
      changes.isBinary = next.isBinary;
      changes.outcomes = next.outcomes;
    } else delete changes.outcomes;
    if (Object.keys(changes).length === 0) {
      setBusy(false);
      return setMsg({ tone: "ok", text: C.noChanges });
    }
    const r = await updateMarket(id, changes);
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "err", text: errorMessage(r.error) });
    setMsg({ tone: "ok", text: C.saved });
    router.refresh();
  };

  const lockNote = (k: keyof MarketInput) =>
    !can(k) ? <span className="text-12 text-muted"> · {C.locked}</span> : null;

  const field = (k: keyof MarketInput, id: string, text: string, control: React.ReactNode, hint?: string) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={label}>
        {text}
        {lockNote(k)}
      </label>
      {control}
      {hint && <p className="text-12 text-secondary">{hint}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-label={mode === "new" ? C.newTitle : C.editTitle}>
      {field("title", "m-title", F.title,
        <input id="m-title" className={input} value={f.title} disabled={!can("title")} onChange={(e) => set("title", e.target.value)} required minLength={3} maxLength={200} />,
        F.titleHint)}
      {field("slug", "m-slug", F.slug,
        <input id="m-slug" className={input + " font-mono"} value={f.slug} disabled={!can("slug")} onChange={(e) => set("slug", e.target.value.toLowerCase())} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={96} />,
        F.slugHint)}
      {field("description", "m-desc", F.description,
        <textarea id="m-desc" className={textarea} value={f.description} disabled={!can("description")} onChange={(e) => set("description", e.target.value)} maxLength={4000} />)}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("category", "m-cat", F.category,
          <select id="m-cat" className={input} value={f.category} disabled={!can("category")} onChange={(e) => set("category", e.target.value)}>
            {CATEGORY_VALUES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>)}
        {field("subcategory", "m-sub", F.subcategory,
          <input id="m-sub" className={input} value={f.subcategory} disabled={!can("subcategory")} onChange={(e) => set("subcategory", e.target.value)} required maxLength={60} />)}
        {field("endDate", "m-end", F.endDate,
          <input id="m-end" type="datetime-local" className={input} value={f.endLocal} disabled={!can("endDate")} onChange={(e) => set("endLocal", e.target.value)} required />)}
        {field("liquidityB", "m-liq", F.liquidity,
          <input id="m-liq" type="number" min={100} max={10000000} step="any" className={input} value={f.liquidityB} disabled={!can("liquidityB")} onChange={(e) => set("liquidityB", e.target.value)} required />,
          F.liquidityHint)}
      </div>
      {field("resolutionSource", "m-src", F.resolutionSource,
        <input id="m-src" className={input} value={f.resolutionSource} disabled={!can("resolutionSource")} onChange={(e) => set("resolutionSource", e.target.value)} maxLength={300} />,
        F.resolutionSourceHint)}
      <fieldset className="flex flex-col gap-2" disabled={!can("isBinary")}>
        <legend className={label}>
          {F.type}
          {lockNote("isBinary")}
        </legend>
        <div className="flex gap-4 text-14 text-primary">
          <label className="flex items-center gap-2">
            <input type="radio" name="m-type" checked={f.isBinary} onChange={() => set("isBinary", true)} /> {F.binary}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="m-type" checked={!f.isBinary} onChange={() => set("isBinary", false)} /> {F.multi}
          </label>
        </div>
      </fieldset>
      {!f.isBinary &&
        field("outcomes", "m-outcomes", F.outcomes,
          <textarea id="m-outcomes" className={textarea} value={f.outcomesText} disabled={!can("outcomes")} onChange={(e) => set("outcomesText", e.target.value)} />,
          F.outcomesHint)}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("tags", "m-tags", F.tags,
          <input id="m-tags" className={input} value={f.tagsText} disabled={!can("tags")} onChange={(e) => set("tagsText", e.target.value)} />,
          F.tagsHint)}
        {field("region", "m-region", F.region,
          <input id="m-region" className={input} value={f.region} disabled={!can("region")} onChange={(e) => set("region", e.target.value)} required maxLength={40} />)}
      </div>
      <div className="flex flex-wrap gap-6 text-14 text-primary">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.isFeatured} disabled={!can("isFeatured")} onChange={(e) => set("isFeatured", e.target.checked)} /> {F.featured}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.isLive} disabled={!can("isLive")} onChange={(e) => set("isLive", e.target.checked)} /> {F.live}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} disabled={editable.size === 0}>
          {mode === "new" ? C.create : C.save}
        </Button>
        <p role="status" aria-live="polite" className={msg?.tone === "err" ? "text-13 text-danger" : "text-13 text-success"}>
          {msg?.text}
        </p>
      </div>
    </form>
  );
}
