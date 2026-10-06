"use client";

import { useState } from "react";
import { ArrowRight, Flame, MessageSquare, Star, TrendingUp } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  IconButton,
  TabPanel,
  Tabs,
  Tooltip,
  type ButtonVariant,
} from "@/components/ui";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "outline", "ghost", "yes", "no"];
const SORTS = ["Trending", "Popular", "Starting Soon"] as const;
type Tab = "activity" | "holders" | "comments";

/** TEST-ONLY. See page.tsx. */
export default function Gallery() {
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Trending");
  const [tab, setTab] = useState<Tab>("activity");
  const [pill, setPill] = useState("1D");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col gap-8" data-testid="ui-gallery">
      <h1 className="text-24 font-bold text-primary">UI primitives</h1>

      <section className="flex flex-col gap-3" aria-labelledby="g-buttons">
        <h2 id="g-buttons" className="text-18 font-semibold text-primary">Buttons</h2>
        {(["sm", "md", "lg"] as const).map((size) => (
          <div key={size} className="flex flex-wrap items-center gap-3" data-testid={`buttons-${size}`}>
            {VARIANTS.map((v) => (
              <Button key={v} variant={v} size={size}>
                {v}
              </Button>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button trailingIcon={<ArrowRight className="h-4 w-4" />}>With icon</Button>
          <Button disabled>Disabled</Button>
          <Button
            data-testid="loading-button"
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            Place order
          </Button>
          <IconButton label="Trending" icon={<TrendingUp />} data-testid="icon-button" />
          <IconButton label="Comments" icon={<MessageSquare />} variant="secondary" size="md" />
        </div>
        <Button fullWidth size="lg" variant="primary">
          Full width
        </Button>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="g-chips">
        <h2 id="g-chips" className="text-18 font-semibold text-primary">Chips and badges</h2>
        <div className="flex flex-wrap gap-2" data-testid="sort-chips">
          {SORTS.map((s) => (
            <Chip key={s} selected={s === sort} onClick={() => setSort(s)}>
              {s}
            </Chip>
          ))}
          <Chip tone="highlight" icon={<Star />}>
            IPL 2026
          </Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="danger" dot="pulse">Live</Badge>
          <Badge tone="warning">Demo data</Badge>
          <Badge tone="success">Resolved Yes</Badge>
          <Badge tone="brand" icon={<Flame />}>Hot</Badge>
          <Badge dot>Closed</Badge>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="g-tabs">
        <h2 id="g-tabs" className="text-18 font-semibold text-primary">Tabs</h2>
        <Card padding="none" className="overflow-hidden">
          <div className="px-4">
            <Tabs
              id="g"
              label="Market sections"
              value={tab}
              onValueChange={setTab}
              items={[
                { value: "activity", label: "Activity" },
                { value: "holders", label: "Top holders", count: 0 },
                { value: "comments", label: "Comments", count: 0 },
              ]}
            />
          </div>
          <div className="p-4">
            <TabPanel id="g" value="activity" selected={tab}>
              <EmptyState size="compact" title="No trades yet" body="Trades appear here as they happen." />
            </TabPanel>
            <TabPanel id="g" value="holders" selected={tab}>
              <EmptyState size="compact" title="No holders yet" />
            </TabPanel>
            <TabPanel id="g" value="comments" selected={tab}>
              <EmptyState size="compact" icon={MessageSquare} title="No comments yet" />
            </TabPanel>
          </div>
        </Card>
        <Tabs
          id="range"
          variant="pill"
          label="Chart range"
          value={pill}
          onValueChange={setPill}
          className="self-start"
          items={["1H", "6H", "1D", "1W", "ALL"].map((v) => ({ value: v, label: v }))}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="g-tooltip">
        <h2 id="g-tooltip" className="text-18 font-semibold text-primary">Tooltip</h2>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-14 font-semibold text-primary">
            Order Book
            <Tooltip
              label="About the order book"
              content="Prices come from an automated market maker, not resting orders. Each row is the cost to buy that many shares now."
            />
          </p>
          {/* Right-edge trigger: the bubble must stay inside the viewport. */}
          <Tooltip label="Edge tooltip" content="This bubble is nudged back inside the screen edge." />
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="g-cards">
        <h2 id="g-cards" className="text-18 font-semibold text-primary">Cards and dialog</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <p className="text-16 font-semibold text-primary">Card</p>
            <p className="mt-1 text-13 text-secondary">Border in dark, soft shadow in light.</p>
          </Card>
          <Card radius="panel" interactive>
            <p className="text-16 font-semibold text-primary">Panel, interactive</p>
            <p className="mt-1 text-13 text-secondary">Hover shows a stronger border.</p>
          </Card>
        </div>
        <Button variant="outline" onClick={() => setOpen(true)} data-testid="open-dialog" className="self-start">
          Open dialog
        </Button>
        <EmptyState
          title="No markets here yet"
          body="Try a different filter or check back shortly."
          action={<Button size="sm" variant="secondary">Clear filters</Button>}
        />
      </section>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Buy Yes"
        description="India to win the 2026 T20 World Cup?"
        footer={
          <Button fullWidth size="lg" onClick={() => setOpen(false)} data-testid="dialog-confirm">
            Confirm
          </Button>
        }
      >
        <label className="flex flex-col gap-1.5 text-13 text-secondary">
          Amount
          <input
            data-autofocus
            data-testid="dialog-input"
            inputMode="decimal"
            defaultValue="500"
            className="h-11 rounded-chip border border-subtle bg-surface-3 px-3 text-16 text-primary outline-none focus:border-brand"
          />
        </label>
      </Dialog>
    </div>
  );
}
