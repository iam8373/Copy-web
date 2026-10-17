import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/services/admin/auth";
import { getQuota, getTranslationDetail } from "@/services/admin/translations";
import { TARGET_LOCALES } from "@/services/translation/types";
import { COPY } from "../../_copy";
import { card } from "../../_components/styles";
import { StatusBadge } from "../../_components/StatusBadge";
import { StateChip } from "../StateChip";
import { GenerateButton } from "../GenerateButton";
import { LocaleEditor } from "../LocaleEditor";
import { machineTranslationConfigured } from "@/services/admin/machine-translate";

const C = COPY.translations;

export default async function TranslateMarket({ params }: { params: { marketId: string } }) {
  const staff = await requireStaff("moderator");
  const [d, quota] = await Promise.all([getTranslationDetail(staff, params.marketId), getQuota(staff)]);
  if (!d) notFound();
  const full = quota ? quota.used >= quota.cap : false;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/translations" className="text-13 text-secondary hover:underline">← {C.back}</Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-24 font-bold text-primary">{C.detailTitle}</h1>
        <p className="flex flex-wrap items-center gap-2 text-13 text-secondary">
          <StatusBadge status={d.status} />
          <span className="font-mono">{d.slug}</span>
        </p>
        {quota && <p data-testid="translation-quota" className="text-13 text-primary">{C.quota(quota.used, quota.cap)}</p>}
        <GenerateButton marketId={d.id} configured={machineTranslationConfigured()} disabled={full} />
        <p className="text-12 text-secondary">{C.keptNote}</p>
      </header>
      <section className={card} aria-labelledby="en-h" lang="en">
        <h2 id="en-h" className="text-16 font-bold text-primary">{C.english}</h2>
        <p className="mt-2 text-14 font-semibold text-primary">{d.title}</p>
        {d.description && <p className="mt-1 whitespace-pre-line text-13 text-secondary">{d.description}</p>}
        <p className="mt-2 text-13 text-secondary">{C.outcomesLabel}: {d.outcomes.map((o) => o.label).join(" · ")}</p>
      </section>
      {TARGET_LOCALES.map((l) => (
        <section key={l} className={card} aria-labelledby={`${l}-h`} data-testid={`locale-${l}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 id={`${l}-h`} className="text-16 font-bold text-primary">{C.locales[l]}</h2>
            <StateChip state={d.locales[l].state} />
          </div>
          <LocaleEditor
            key={l}
            marketId={d.id}
            locale={l}
            initial={{ title: d.locales[l].title, description: d.locales[l].description }}
            outcomes={d.outcomes.map((o) => ({ id: o.id, english: o.label, label: o.locales[l].label }))}
          />
        </section>
      ))}
    </div>
  );
}
