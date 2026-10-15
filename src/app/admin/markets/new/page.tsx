import Link from "next/link";
import { requireStaff } from "@/services/admin/auth";
import { defaultLiquidity } from "@/services/admin/markets";
import { COPY } from "../../_copy";
import { card } from "../../_components/styles";
import { MarketForm } from "../MarketForm";

export default async function NewMarket() {
  await requireStaff("moderator");
  const end = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  end.setUTCHours(18, 30, 0, 0); // midnight IST
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/admin/markets" className="text-13 text-secondary hover:underline">← {COPY.markets.title}</Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold text-primary">{COPY.markets.newTitle}</h1>
        <p className="text-14 text-secondary">{COPY.markets.newIntro}</p>
      </header>
      <div className={card}>
        <MarketForm
          mode="new"
          initial={{
            slug: "", title: "", description: "", category: "cricket", subcategory: "", endDate: end.toISOString(),
            resolutionSource: "", isBinary: true, outcomes: ["Yes", "No"], liquidityB: await defaultLiquidity(),
            isFeatured: false, isLive: false, tags: [], region: "India",
          }}
        />
      </div>
    </div>
  );
}
