"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  ChevronDown,
  ChevronLeft,
  Languages,
  MessageSquare,
  Users,
  Wallet,
} from "lucide-react";
import type { Market } from "@/lib/types";
import { useMarketStore } from "@/store/useMarketStore";
import { useT } from "@/i18n/LanguageProvider";
import { NAV_KEY_BY_SLUG } from "@/i18n";
import { useMarketText } from "@/lib/market-text";
import { media, chartColor } from "@/lib/tokens";
import { Countdown } from "@/components/Countdown";
import { FlashValue } from "@/components/FlashValue";
import { TradeForm } from "@/components/TradeForm";
import { PriceChart, chartedOutcomes, type RecordedPoint } from "@/components/market/PriceChart";
import { OrderBook } from "@/components/market/OrderBook";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FOCUS_RING,
  TabPanel,
  Tabs,
} from "@/components/ui";
import { cn, formatChange, formatEndDate, formatPercent, formatVolumeFull } from "@/lib/utils";
import { getMarketActivity } from "@/services/markets/market-data";

type Section = "activity" | "holders" | "positions" | "comments";

/**
 * Market page. lg+: content on the left, sticky trade panel on the right.
 * Below lg: a fixed Yes/No bar opens the trade sheet (TradeModal).
 */
export function MarketDetail({ market: initial, history = [] }: { market: Market; history?: RecordedPoint[] }) {
  const markets = useMarketStore((s) => s.markets);
  const openTrade = useMarketStore((s) => s.openTrade);
  const market = markets.find((m) => m.id === initial.id) ?? initial;
  const { t, locale } = useT();
  const text = useMarketText(market);

  const [outcomeId, setOutcomeId] = useState(market.outcomes[0].id);
  const [amount, setAmount] = useState("500");
  const [section, setSection] = useState<Section>("activity");

  const category = t("nav", NAV_KEY_BY_SLUG[market.category]);
  const activity = getMarketActivity(market);

  /** Picks an outcome: in the panel on lg, in the trade sheet below. */
  const buy = (id: string) => {
    setOutcomeId(id);
    if (!window.matchMedia(media.lg).matches) openTrade(market, id);
  };

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/markets/${market.category}`}
        className={cn(
          "relative -ml-2 flex min-h-touch w-fit items-center gap-1 rounded-btn px-2 text-13 font-semibold text-secondary transition-colors duration-xs hover:text-primary",
          FOCUS_RING
        )}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {t("market", "back", { category })}
      </Link>

      <header className="-mt-2 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">
            {category} • {market.subcategory}
          </Badge>
          {market.isLive ? (
            <Badge tone="danger" dot="pulse">
              {t("card", "live")}{" "}
              <span className="tnum">
                <Countdown endDate={market.endDate} />
              </span>
            </Badge>
          ) : (
            <Badge>{t("market", "open")}</Badge>
          )}
        </div>
        <h1 className="text-20 font-bold tracking-tight text-primary sm:text-24">{text.title}</h1>
        {/* Saved AI translation, not yet reviewed by a native speaker. */}
        {text.translated && locale !== "en" && (
          <p
            data-testid="translated-note"
            className="flex w-fit items-center gap-1.5 rounded-chip bg-surface-3 px-2 py-1 text-11 font-medium text-secondary"
          >
            <Languages className="h-3 w-3" aria-hidden="true" />
            {t("market", "translatedNote")}
          </p>
        )}
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-13">
          <div className="flex gap-1.5">
            <dt className="text-secondary">{t("terms", "volume")}</dt>
            <dd className="tnum font-semibold text-primary">{formatVolumeFull(market.totalVolume)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-secondary">{t("terms", "marketCloses")}</dt>
            <dd className="tnum font-semibold text-primary">{formatEndDate(market.endDate)}</dd>
          </div>
        </dl>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-market">
        <div className="flex min-w-0 flex-col gap-5">
          <PriceChart market={market} recorded={history} />

          {!market.isBinary && (
            <OutcomeList market={market} selectedId={outcomeId} onBuy={buy} />
          )}

          <OrderBook market={market} outcomeId={outcomeId} onOutcomeChange={setOutcomeId} />

          <Rules market={market} description={text.description} />

          <Card as="section" padding="none" aria-label={t("market", "details")}>
            <div className="px-4 sm:px-5">
              <Tabs
                id="market"
                label={t("market", "details")}
                value={section}
                onValueChange={setSection}
                items={[
                  { value: "activity", label: t("market", "activity") },
                  { value: "holders", label: t("market", "holders") },
                  { value: "positions", label: t("market", "positions") },
                  { value: "comments", label: t("market", "comments") },
                ]}
              />
            </div>
            <div className="p-4 sm:p-5">
              <TabPanel id="market" value="activity" selected={section}>
                {activity.length === 0 && (
                  <EmptyState
                    size="compact"
                    icon={ActivityIcon}
                    title={t("market", "noActivity")}
                    body={t("market", "noActivityBody")}
                  />
                )}
              </TabPanel>
              <TabPanel id="market" value="holders" selected={section}>
                <EmptyState
                  size="compact"
                  icon={Users}
                  title={t("market", "noHolders")}
                  body={t("market", "noHoldersBody")}
                />
              </TabPanel>
              <TabPanel id="market" value="positions" selected={section}>
                <EmptyState
                  size="compact"
                  icon={Wallet}
                  title={t("market", "noPositions")}
                  body={t("market", "noPositionsBody")}
                />
              </TabPanel>
              <TabPanel id="market" value="comments" selected={section}>
                <EmptyState
                  size="compact"
                  icon={MessageSquare}
                  title={t("market", "noComments")}
                  body={t("market", "noCommentsBody")}
                />
              </TabPanel>
            </div>
          </Card>
        </div>

        {/* lg+: sticky trade panel. Below lg it is the trade sheet instead. */}
        <aside className="hidden lg:block" aria-labelledby="trade-panel-heading">
          <Card radius="panel" className="sticky top-32" data-testid="trade-panel">
            <h2 id="trade-panel-heading" className="mb-4 text-16 font-bold text-primary">
              {t("terms", "buy")}
            </h2>
            <TradeForm
              market={market}
              outcomeId={outcomeId}
              onOutcomeChange={setOutcomeId}
              amount={amount}
              onAmountChange={setAmount}
              amountId="detail-amount"
            />
          </Card>
        </aside>
      </div>

      {/* Room for the fixed bar so it never covers the last section. */}
      <div aria-hidden className="h-20 lg:hidden" />
      <MobileTradeBar market={market} onBuy={(id) => openTrade(market, id)} />
    </div>
  );
}

function OutcomeList({
  market,
  selectedId,
  onBuy,
}: {
  market: Market;
  selectedId: string;
  onBuy: (id: string) => void;
}) {
  const { t } = useT();
  const charted = chartedOutcomes(market).map((o) => o.id);
  const rows = [...market.outcomes].sort((a, b) => b.price - a.price);
  return (
    <Card as="section" padding="none" aria-labelledby="outcomes-heading" data-testid="outcome-list">
      <h2 id="outcomes-heading" className="px-4 pb-2 pt-4 text-16 font-bold text-primary sm:px-5">
        {t("market", "outcomes")}
      </h2>
      <ul className="divide-y divide-subtle">
        {rows.map((o) => {
          const colourIndex = charted.indexOf(o.id);
          const active = o.id === selectedId;
          return (
            <li
              key={o.id}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 sm:px-5",
                active && "bg-brand/5"
              )}
            >
              <span
                aria-hidden
                className={cn("h-2 w-2 shrink-0 rounded-full", colourIndex < 0 && "bg-surface-3")}
                style={colourIndex >= 0 ? { background: chartColor(colourIndex) } : undefined}
              />
              <span className="min-w-0 flex-1 truncate text-14 font-medium text-primary">{o.label}</span>
              <span
                className={cn(
                  "tnum hidden w-12 text-right text-12 font-semibold sm:block",
                  o.change24h >= 0 ? "text-success" : "text-danger"
                )}
              >
                {formatChange(o.change24h)}
              </span>
              <FlashValue value={o.price} className="w-14 text-right text-14 font-bold text-primary">
                {formatPercent(o.price, 1)}
              </FlashValue>
              <Button
                size="sm"
                variant={active ? "primary" : "secondary"}
                aria-pressed={active}
                onClick={() => onBuy(o.id)}
                aria-label={t("trade", "buy", { outcome: o.label })}
              >
                {t("terms", "buy")}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Rules({ market, description }: { market: Market; description: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <Card as="section" padding="none">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex min-h-touch w-full items-center gap-2 rounded-card px-4 py-3 text-left text-16 font-bold text-primary sm:px-5",
            FOCUS_RING
          )}
        >
          {t("market", "rules")}
          <ChevronDown
            aria-hidden
            className={cn(
              "ml-auto h-4 w-4 text-secondary transition-transform duration-sm ease-standard",
              open && "rotate-180"
            )}
          />
        </button>
      </h2>
      {/* Height animates via grid rows 0fr→1fr (220ms standard). Closed, the
          panel is visibility:hidden, so it leaves the tab order and the
          accessibility tree just as `hidden` would. */}
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows,visibility] duration-sm ease-standard",
          open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 border-t border-subtle px-4 py-4 text-14 text-secondary sm:px-5">
            <p>{description}</p>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-13 sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold text-primary">{t("market", "resolutionSource")}</dt>
              <dd>{market.resolutionSource}</dd>
              <dt className="font-semibold text-primary">{t("terms", "marketCloses")}</dt>
              <dd className="tnum">{formatEndDate(market.endDate)}</dd>
            </dl>
            <p>{t("market", "settlement")}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MobileTradeBar({ market, onBuy }: { market: Market; onBuy: (id: string) => void }) {
  const { t } = useT();
  const [yes, no] = market.outcomes;
  return (
    <div
      data-testid="mobile-trade-bar"
      className="fixed inset-x-0 z-30 border-t border-subtle bg-surface-1/95 px-gutter py-3 backdrop-blur-xl lg:hidden"
      style={{ bottom: "calc(var(--bottom-nav-h) + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-content gap-2">
        {market.isBinary ? (
          <>
            <Button variant="yes" size="lg" className="flex-1" onClick={() => onBuy(yes.id)}>
              {t("trade", "buy", { outcome: yes.label })}{" "}
              <span className="tnum">{formatPercent(yes.price, 1)}</span>
            </Button>
            <Button variant="no" size="lg" className="flex-1" onClick={() => onBuy(no.id)}>
              {t("trade", "buy", { outcome: no.label })}{" "}
              <span className="tnum">{formatPercent(no.price, 1)}</span>
            </Button>
          </>
        ) : (
          <Button size="lg" fullWidth onClick={() => onBuy(chartedOutcomes(market)[0].id)}>
            {t("market", "tradeBar")}
          </Button>
        )}
      </div>
    </div>
  );
}
