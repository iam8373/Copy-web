import Link from "next/link";

const LINKS = [
  { label: "Predictions 101", href: "/learn" },
  { label: "Join the mailing list", href: "/learn#mailing-list" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Responsible play", href: "/responsible-play" },
  { label: "Grievance", href: "/grievance" },
];

export function Footer() {
  return (
    <footer className="mt-12 border-t border-subtle bg-bg-secondary">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent-blue text-[11px] font-bold text-white">
            B
          </span>
          <span className="text-[13px] text-content-secondary">
            India&apos;s prediction market — priced in ₹.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-[13px] text-content-secondary transition-colors hover:text-content-primary"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
