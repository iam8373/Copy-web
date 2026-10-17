import { test, expect, type Page } from "@playwright/test";
import { STORAGE_KEY } from "../../src/i18n";
import { localRest, localUserId, resetState, signInWithEmail, staffSession, uniqueEmail } from "./helpers";

/** Admin R4: resolution queue, public status, payout and void. */

type Seeded = { id: string; slug: string; yes: string; no: string };

/** A closed binary market straight in the database (trading has stopped). */
async function closedMarket(tag: string): Promise<Seeded> {
  const slug = `e2e-${tag}-${Date.now()}`;
  const [m] = await localRest<Array<{ id: string }>>("markets", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      slug, title: `Will the ${tag} resolution test pass?`, category: "cricket", subcategory: "IPL",
      end_date: new Date(Date.now() - 3600_000).toISOString(), status: "closed", resolution_source: "Official scorecard",
    }),
  });
  const outs = await localRest<Array<{ id: string; label: string }>>("outcomes", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify([
      { market_id: m.id, label: "Yes", sort_order: 0, price: 0.5 },
      { market_id: m.id, label: "No", sort_order: 1, price: 0.5 },
    ]),
  });
  return { id: m.id, slug, yes: outs.find((o) => o.label === "Yes")!.id, no: outs.find((o) => o.label === "No")!.id };
}

const balance = async (uid: string) =>
  Number((await localRest<Array<{ balance: number }>>(`wallets?user_id=eq.${uid}&select=balance`))[0].balance);

async function propose(page: Page, m: Seeded, choice: "Yes" | "No" | "void") {
  await page.goto(`/admin/resolutions/${m.id}`);
  const form = page.getByRole("form", { name: "Propose a result" });
  await form.getByLabel(choice === "void" ? /^Void/ : choice, { exact: choice !== "void" }).check();
  await form.getByLabel("Evidence URL").fill("https://example.org/scorecard");
  await form.getByLabel("Explanation").fill(`The source shows ${choice}.`);
  await form.getByRole("button", { name: "Propose" }).click();
  await expect(page.getByRole("heading", { name: "Current proposal" })).toBeVisible();
}

async function typed(page: Page, trigger: string, slug: string) {
  await page.getByRole("button", { name: trigger }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Market slug").fill(slug);
  await dialog.getByRole("button", { name: trigger }).click();
  await expect(dialog).toHaveCount(0);
}

test.describe("admin resolutions", () => {
  test.skip(({ isMobile }) => isMobile, "admin is desktop-first");

  test("single admin: propose, self-approve, public dispute notice, finalize pays 1 credit per share", async ({ page, browser }) => {
    const m = await closedMarket("win");
    // A trader holding 150.509 Yes shares (truncated to 150.50 on payout).
    const trader = await browser.newContext();
    const tp = await trader.newPage();
    await resetState(tp);
    const email = await signInWithEmail(tp, uniqueEmail("trader"));
    const uid = await localUserId(email);
    await localRest("positions", {
      method: "POST",
      body: JSON.stringify({ user_id: uid, market_id: m.id, outcome_id: m.yes, shares: 150.509, avg_price: 0.5 }),
    });
    const before = await balance(uid);

    await staffSession(page, "admin");
    await page.goto("/admin/resolutions");
    await expect(page.getByTestId("needs-row").filter({ hasText: m.slug })).toHaveCount(1);
    await page.goto(`/admin/resolutions/${m.id}`);
    await expect(page.getByRole("region", { name: "What each result would pay" })).toContainText("₹150.5");

    await propose(page, m, "Yes");
    await expect(page.getByTestId("proposal").first()).toContainText("Pending");
    await typed(page, "Approve", m.slug);
    const live = page.getByTestId("proposal").first();
    await expect(live).toContainText("Approved");
    await expect(live).toContainText("Self-approved (single admin)");
    await expect(live).toContainText("Dispute window ends");
    await expect(page.getByRole("button", { name: "Finalize and pay out" })).toHaveCount(0);

    // Public: resolving, proposed result, deadline, evidence, self-approval note.
    await tp.goto(`/market/${m.slug}`);
    await expect(tp.getByTestId("market-status")).toHaveText("Result pending");
    const notice = tp.getByTestId("resolution-notice");
    await expect(notice).toContainText("Proposed result: Yes. If you think it is wrong, raise a grievance before");
    await expect(notice.getByRole("link", { name: "Evidence" })).toHaveAttribute("href", "https://example.org/scorecard");
    await expect(notice.getByRole("link", { name: "Raise a grievance" })).toHaveAttribute("href", "/grievance");
    await expect(notice).toContainText("Approved by a single reviewer.");
    // Translated (Hindi).
    await tp.evaluate((k) => window.localStorage.setItem(k, "hi"), STORAGE_KEY);
    await tp.reload();
    await expect(tp.getByTestId("market-status")).toHaveText("नतीजा लंबित");
    await tp.evaluate((k) => window.localStorage.setItem(k, "en"), STORAGE_KEY);

    // Window over (moved back in the database), then finalize.
    await localRest(`resolution_proposals?market_id=eq.${m.id}&status=eq.approved`, {
      method: "PATCH",
      body: JSON.stringify({ dispute_ends_at: new Date(Date.now() - 60_000).toISOString() }),
    });
    await page.reload();
    await expect(page.getByText("Dispute window has ended — ready to finalize.")).toBeVisible();
    await typed(page, "Finalize and pay out", m.slug);
    await expect(page.getByTestId("admin-status")).toHaveText("Resolved");
    expect(await balance(uid)).toBeCloseTo(before + 150.5, 2);

    await tp.goto(`/market/${m.slug}`);
    await expect(tp.getByTestId("market-status")).toHaveText("Resolved: Yes");
    await expect(tp.getByTestId("resolution-notice")).toContainText("Each winning share paid ₹1 in play credits.");
    await trader.close();
  });

  test("reject with a reason, propose void, approve, withdraw during the window", async ({ page }) => {
    const m = await closedMarket("void");
    await staffSession(page, "admin");
    await propose(page, m, "No");
    await page.getByRole("button", { name: "Reject" }).click();
    const dialog = page.getByRole("dialog", { name: "Reject this proposal?" });
    await expect(dialog.getByRole("button", { name: "Reject" })).toBeDisabled();
    await dialog.getByLabel("Reason").fill("Wrong source used");
    await dialog.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByRole("form", { name: "Propose a result" })).toBeVisible();
    await expect(page.getByTestId("proposal").first()).toContainText("Reason: Wrong source used");

    await propose(page, m, "void");
    await expect(page.getByTestId("proposal-result").first()).toHaveText("Void (refund each trader's net cost)");
    await typed(page, "Approve", m.slug);
    const pub = await page.context().newPage();
    await pub.goto(`/market/${m.slug}`);
    await expect(pub.getByTestId("resolution-notice")).toContainText("Proposed: void this market and refund each trader's net cost (buys minus sales).");
    await pub.close();

    await page.getByRole("button", { name: "Withdraw (dispute upheld)" }).click();
    const w = page.getByRole("dialog", { name: "Withdraw the approved result?" });
    await w.getByLabel("Reason").fill("Grievance BP-TEST upheld");
    await w.getByRole("button", { name: "Withdraw (dispute upheld)" }).click();
    await expect(page.getByTestId("admin-status")).toHaveText("Closed");
    const rows = await localRest<Array<{ status: string }>>(`resolution_proposals?market_id=eq.${m.id}&select=status&order=created_at`);
    expect(rows.map((r) => r.status)).toEqual(["rejected", "cancelled"]);
  });

  test("a moderator proposes but cannot approve", async ({ page }) => {
    const m = await closedMarket("mod");
    await staffSession(page, "moderator");
    await propose(page, m, "Yes");
    await expect(page.getByText("Approving, rejecting and finalizing are admin actions.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  });
});

test("public cards and pages show a closed market's state", async ({ page }) => {
  await resetState(page);
  await page.goto("/market/will-india-win-the-2026-t20-world-cup");
  await expect(page.getByTestId("market-status")).toHaveText("Trading ended");
  await expect(page.getByTestId("resolution-notice")).toContainText("Trading has ended.");
  await page.goto("/");
  const open = page.getByTestId("market-status");
  // Open markets show no status badge on cards (their end date instead).
  for (const s of await open.evaluateAll((els) => els.map((e) => e.getAttribute("data-state")))) expect(s).not.toBe("open");
});
