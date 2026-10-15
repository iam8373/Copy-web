import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaff, hasRole } from "@/services/admin/auth";
import { AdminNav } from "./_components/AdminNav";
import { COPY, NAV } from "./_copy";

// Never indexed, whatever ALLOW_INDEXING says; the middleware also sends
// X-Robots-Tag and no-store, and robots.txt disallows /admin.
export const metadata: Metadata = {
  title: "Admin — BharatPredict",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

/**
 * Admin shell (R2). Staff only; anyone else gets a plain 404. Each page also
 * calls requireStaff(min), which enforces MFA (aal2) and the page's role.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  if (!staff) notFound();
  const items = NAV.filter((n) => hasRole(staff, n.min));

  return (
    <div data-admin className="flex flex-col gap-4 lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-8">
      <aside className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
        <div className="flex flex-col gap-0.5">
          <p className="text-14 font-bold text-primary">{COPY.brand}</p>
          <p className="text-12 text-secondary">{COPY.signedInAs(staff.handle, staff.role)}</p>
        </div>
        {staff.aal === "aal2" && <AdminNav items={items.map(({ href, label }) => ({ href, label }))} />}
        <Link href="/" className="text-13 text-secondary underline-offset-2 hover:text-primary hover:underline">
          {COPY.backToSite}
        </Link>
        <p className="text-12 text-muted">{COPY.playCredits}</p>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
