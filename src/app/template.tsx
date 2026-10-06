/**
 * Re-mounted on every navigation (unlike layout.tsx), so each page fades in
 * over 220ms (docs/DESIGN.md → Motion). Opacity only: a transform here would
 * become the containing block for fixed children such as the market page's
 * mobile trade bar. The global reduced-motion rule shortens it to 1ms.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
