import { SkeletonBlock, SkeletonRegion } from "@/components/Skeleton";

/** Stat cards across the top, then a list of position rows. */
export default function Loading() {
  return (
    <SkeletonRegion>
      <div className="flex flex-col gap-5">
        <SkeletonBlock className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonBlock key={i} className="h-24 rounded-card" />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonBlock key={i} className="h-14 rounded-card" />
        ))}
      </div>
    </SkeletonRegion>
  );
}
