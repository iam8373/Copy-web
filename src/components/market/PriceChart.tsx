"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Market } from "@/lib/types";
import { useT } from "@/i18n/LanguageProvider";
import { AnimatedNumber, Badge, Card, Segmented, Tooltip } from "@/components/ui";
import { FlashValue } from "@/components/FlashValue";
import { chartColor, color, motion, size, tooltipStyle } from "@/lib/tokens";
import { cn, formatChange, formatPercent } from "@/lib/utils";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useFirstPaint } from "@/lib/useFirstPaint";
import {
  CHART_RANGES,
  getPriceHistory,
  type ChartRange,
} from "@/services/markets/market-data";

/** Multi-outcome charts plot at most this many lines (the rest stay in the list). */
const MAX_LINES = 4;

const fmtTime = (t: number, range: ChartRange) =>
  new Date(t).toLocaleString(
    "en-IN",
    range === "1D"
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
      : { day: "numeric", month: "short" }
  );

const fmtFull = (t: number) =>
  new Date(t).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

const DAY = 24 * 3600 * 1000;
/** Tick spacing per range, so the axis never repeats a date label. */
const TICK_STEP: Record<ChartRange, number> = {
  "1D": 4 * 3600 * 1000,
  "1W": DAY,
  "1M": 5 * DAY,
  ALL: 15 * DAY,
};

/** Evenly spaced ticks on whole hours/days inside [from, to]. */
function axisTicks(from: number, to: number, range: ChartRange) {
  const step = TICK_STEP[range];
  const out: number[] = [];
  for (let t = Math.ceil(from / step) * step; t <= to; t += step) out.push(t);
  return out;
}

/** Outcomes the chart plots, in palette order. Exported so the list matches. */
export function chartedOutcomes(market: Market) {
  if (market.isBinary) return [market.outcomes[0]];
  return [...market.outcomes].sort((a, b) => b.price - a.price).slice(0, MAX_LINES);
}

export function PriceChart({ market }: { market: Market }) {
  const { t } = useT();
  const reduced = useReducedMotion();
  const [range, setRange] = useState<ChartRange>("1W");
  // The demo series depends on "now", so it is built after mount: server and
  // client then never disagree (the page is statically generated).
  const [now, setNow] = useState<number | null>(null);
  const firstPaint = useFirstPaint();
  // Anchor the generated history to the prices at mount, so live ticks move
  // only the last point instead of shifting the whole line.
  const anchor = useRef(market);

  useEffect(() => setNow(Date.now()), []);

  const lines = chartedOutcomes(market);
  const history = useMemo(
    () => (now === null ? null : getPriceHistory(anchor.current, range, now)),
    [now, range]
  );
  const data = useMemo(() => {
    if (!history) return [];
    const pts = history.points.map((p) => ({ ...p }));
    const last = pts[pts.length - 1];
    market.outcomes.forEach((o) => (last[o.id] = Number((o.price * 100).toFixed(1))));
    return pts;
  }, [history, market.outcomes]);

  const yMax = market.isBinary
    ? 100
    : Math.min(100, Math.ceil((Math.max(...data.flatMap((d) => lines.map((o) => d[o.id] ?? 0)), 10) + 5) / 10) * 10);

  const lead = market.outcomes[0];
  const up = lead.change24h >= 0;
  const rangeLabel = (r: ChartRange) => (r === "ALL" ? t("market", "rangeAll") : r);
  const first = data[0];
  const summary = lines
    .map((o) =>
      t("market", "chartSummary", {
        outcome: o.label,
        from: first ? `${first[o.id]}%` : "",
        to: formatPercent(o.price, 1),
        range: rangeLabel(range),
      })
    )
    .join("; ");
  const animate = firstPaint && !reduced;
  const ticks = data.length ? axisTicks(data[0].t, data[data.length - 1].t, range) : [];

  return (
    <Card radius="panel" padding="none" as="section" aria-labelledby="chart-heading" data-testid="price-chart">
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {market.isBinary ? (
            <div className="flex flex-col">
              <h2 id="chart-heading" className="text-13 font-semibold text-secondary">
                {lead.label} {t("market", "chance")}
              </h2>
              <div className="flex items-baseline gap-2">
                <FlashValue value={lead.price} className="text-32 font-bold text-primary">
                  <AnimatedNumber
                    value={lead.price}
                    duration={motion.md}
                    format={(n) => formatPercent(n, 1)}
                    data-testid="chart-headline"
                  />
                </FlashValue>
                <span className={cn("tnum whitespace-nowrap text-13 font-semibold", up ? "text-success" : "text-danger")}>
                  {formatChange(lead.change24h)} {t("card", "pts24h")}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-2">
              <h2 id="chart-heading" className="text-13 font-semibold text-secondary">
                {t("terms", "probability")}
              </h2>
              <ul className="flex flex-wrap gap-x-4 gap-y-1" data-testid="chart-legend">
                {lines.map((o, i) => (
                  <li key={o.id} className="flex min-w-0 items-center gap-1.5 text-13">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: chartColor(i) }}
                    />
                    <span className="max-w-40 truncate text-secondary">{o.label}</span>
                    <FlashValue value={o.price} className="font-semibold text-primary">
                      {formatPercent(o.price, 1)}
                    </FlashValue>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            <Badge tone="warning" data-testid="demo-data-badge">
              {t("market", "demoData")}
            </Badge>
            <Tooltip label={t("market", "aboutDemoData")} content={t("market", "demoDataTip")} />
          </span>
        </div>

        <div
          role="img"
          aria-label={summary}
          className="h-56 w-full sm:h-64"
          data-testid="chart-canvas"
        >
          {data.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              {market.isBinary ? (
                <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={color.borderSubtle} vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    ticks={ticks}
                    tickFormatter={(v) => fmtTime(v, range)}
                    tick={{ fill: color.textMuted, fontSize: size.axisFont }}
                    stroke={color.borderSubtle}
                    minTickGap={48}
                    tickMargin={8}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: color.textMuted, fontSize: size.axisFont }}
                    stroke={color.borderSubtle}
                    width={size.axisWidth}
                    orientation="right"
                  />
                  <ChartTooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(v) => fmtFull(Number(v))}
                    formatter={(v) => [`${v}%`, lead.label]}
                  />
                  <Area
                    type="monotone"
                    dataKey={lead.id}
                    stroke={color.brand}
                    strokeWidth={size.lineWidth}
                    fill={color.alpha("--brand", 0.12)}
                    dot={false}
                    activeDot={{ r: size.dotRadius }}
                    isAnimationActive={animate}
                    animationDuration={motion.md}
                  />
                </AreaChart>
              ) : (
                <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={color.borderSubtle} vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    ticks={ticks}
                    tickFormatter={(v) => fmtTime(v, range)}
                    tick={{ fill: color.textMuted, fontSize: size.axisFont }}
                    stroke={color.borderSubtle}
                    minTickGap={48}
                    tickMargin={8}
                  />
                  <YAxis
                    domain={[0, yMax]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: color.textMuted, fontSize: size.axisFont }}
                    stroke={color.borderSubtle}
                    width={size.axisWidth}
                    orientation="right"
                  />
                  <ChartTooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(v) => fmtFull(Number(v))}
                    formatter={(v, key) => [
                      `${v}%`,
                      market.outcomes.find((o) => o.id === key)?.label ?? String(key),
                    ]}
                  />
                  {lines.map((o, i) => (
                    <Line
                      key={o.id}
                      type="monotone"
                      dataKey={o.id}
                      stroke={chartColor(i)}
                      strokeWidth={size.lineWidth}
                      dot={false}
                      activeDot={{ r: size.dotRadius }}
                      isAnimationActive={animate}
                      animationDuration={motion.md}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        <Segmented
          label={t("market", "chartRange")}
          value={range}
          onValueChange={setRange}
          options={CHART_RANGES.map((r) => ({ value: r, label: rangeLabel(r) }))}
          optionProps={(r) => ({ "data-testid": "chart-range", "data-range": r })}
          className="self-start"
        />
      </div>
    </Card>
  );
}
