"use client";

import { useMemo } from "react";
import type { Market } from "@/lib/types";
import { useT } from "@/i18n/LanguageProvider";
import { Card, Segmented, Tooltip } from "@/components/ui";
import { cn, formatPercent, formatRupees } from "@/lib/utils";
import { getOrderBook } from "@/services/markets/market-data";

/** Impact (percentage points) above which a row is flagged. */
const BIG_IMPACT_PTS = 5;

/**
 * Honest "order book" for an AMM market: no bids or asks exist, so it shows
 * what buying 10 / 50 / 100 / 500 shares would cost now and how far each order
 * would move the price. Titled "Order Book" because that is where traders look
 * for depth; the tooltip explains the market maker.
 */
export function OrderBook({
  market,
  outcomeId,
  onOutcomeChange,
}: {
  market: Market;
  outcomeId: string;
  onOutcomeChange: (id: string) => void;
}) {
  const { t } = useT();
  const book = useMemo(() => getOrderBook(market, outcomeId), [market, outcomeId]);
  const outcome = market.outcomes.find((o) => o.id === book.outcomeId) ?? market.outcomes[0];
  const yesNo = market.isBinary
    ? market.outcomes.map((o, i) => ({ value: o.id, label: o.label, tone: i === 0 ? ("yes" as const) : ("no" as const) }))
    : null;
  const captionId = "order-book-caption";

  return (
    <Card as="section" padding="none" aria-labelledby="order-book-heading" data-testid="order-book">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 sm:px-5">
        <h2 id="order-book-heading" className="flex items-center gap-1.5 text-16 font-bold text-primary">
          {t("market", "orderBook")}
          <Tooltip label={t("market", "aboutOrderBook")} content={t("market", "orderBookTip")} />
        </h2>
        {yesNo ? (
          <Segmented
            label={t("market", "pickOutcome")}
            value={outcome.id}
            onValueChange={onOutcomeChange}
            options={yesNo}
            className="ml-auto"
          />
        ) : (
          <span className="ml-auto max-w-full truncate text-13 font-semibold text-brand">
            {outcome.label}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-12 sm:text-13" aria-describedby={captionId}>
          <caption className="sr-only">{t("market", "orderBookFor", { outcome: outcome.label })}</caption>
          <thead>
            <tr className="border-y border-subtle text-12 text-muted">
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-left font-medium sm:px-5">
                {t("market", "colShares")}
              </th>
              <th scope="col" className="whitespace-nowrap px-2 py-2 text-right font-medium">
                {t("market", "colAvg")}
              </th>
              <th scope="col" className="whitespace-nowrap px-2 py-2 text-right font-medium">
                {t("market", "colCost")}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium sm:px-5">
                {t("market", "colAfter")}
              </th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {book.rows.map((r) => {
              const big = r.impactPts > BIG_IMPACT_PTS;
              return (
                <tr
                  key={r.shares}
                  data-testid="order-book-row"
                  className="border-b border-subtle last:border-b-0"
                >
                  <th scope="row" className="px-3 py-2.5 text-left font-medium text-primary sm:px-5">
                    {r.shares.toLocaleString("en-IN")}
                  </th>
                  <td className="px-2 py-2.5 text-right text-primary">{formatRupees(r.avgPrice)}</td>
                  <td className="px-2 py-2.5 text-right text-primary" data-testid="order-book-cost">
                    {formatRupees(r.cost)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right sm:px-5">
                    <span className="text-primary">{formatPercent(r.priceAfter, 1)}</span>{" "}
                    <span className={cn("text-12", big ? "text-warning" : "text-muted")}>
                      +{r.impactPts.toFixed(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p id={captionId} className="border-t border-subtle px-4 py-3 text-12 text-muted sm:px-5">
        {t("market", "orderBookNote", { b: book.liquidityB.toLocaleString("en-IN") })}
      </p>
    </Card>
  );
}
