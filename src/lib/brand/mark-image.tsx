import { BRAND_MARK_PATHS } from "@/components/Wordmark";
import { imageColor } from "@/lib/tokens";

/**
 * The brand mark for generated PNGs (icons, manifest, social preview), drawn
 * from the same shapes as <BrandMark>. `radius` is the corner rounding as a
 * share of the size (0 for maskable icons: the OS applies its own mask).
 */
export function MarkImage({ size, radius = 0.25, padding = 0 }: { size: number; radius?: number; padding?: number }) {
  const inner = size - padding * 2;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: imageColor.brandFill,
        borderRadius: size * radius,
      }}
    >
      <svg width={inner} height={inner} viewBox="0 0 32 32">
        {BRAND_MARK_PATHS.bars.map((b) => (
          <rect key={b.x} x={b.x} y={b.y} width={b.width} height={b.height} rx={b.rx} fill="white" fillOpacity={0.95} />
        ))}
        <path d={BRAND_MARK_PATHS.tick} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.7} />
      </svg>
    </div>
  );
}
