"use client";

import { useEffect, useMemo, useState } from "react";
import { useMarketStore } from "@/store/useMarketStore";
import { useT } from "@/i18n/LanguageProvider";
import { Dialog } from "@/components/ui";
import { TradeForm } from "@/components/TradeForm";
import { getMarketText } from "@/lib/market-text";
import { NAV_KEY_BY_SLUG } from "@/i18n";

/**
 * Quick-trade sheet: opened from market cards and from the market page's
 * mobile Yes/No bar. Bottom sheet below `sm`, centred dialog above.
 */
export function TradeModal() {
  const trade = useMarketStore((s) => s.trade);
  const markets = useMarketStore((s) => s.markets);
  const closeTrade = useMarketStore((s) => s.closeTrade);

  const [amount, setAmount] = useState("500");
  const [outcomeId, setOutcomeId] = useState<string | null>(null);
  const { t, locale } = useT();

  useEffect(() => {
    if (trade) {
      setOutcomeId(trade.outcomeId);
      setAmount("500");
    }
  }, [trade]);

  const market = useMemo(
    () => (trade ? markets.find((m) => m.id === trade.market.id) ?? trade.market : null),
    [markets, trade]
  );

  if (!trade || !market) return null;

  const selectedId = outcomeId ?? trade.outcomeId;
  const openedAt = trade.market.outcomes.find((o) => o.id === selectedId)?.price;

  return (
    <Dialog
      open
      onClose={closeTrade}
      data-testid="trade-modal"
      title={getMarketText(market, locale).title}
      description={`${t("nav", NAV_KEY_BY_SLUG[market.category])} • ${market.subcategory}`}
    >
      <TradeForm
        market={market}
        outcomeId={selectedId}
        onOutcomeChange={setOutcomeId}
        amount={amount}
        onAmountChange={setAmount}
        amountId="amount"
        openedPrice={openedAt}
      />
    </Dialog>
  );
}
