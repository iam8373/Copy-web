import { SkeletonBlock, SkeletonRegion } from "@/components/Skeleton";

/** Market detail: header, chart + order book, and the trade panel. */
export default function Loading() {
  return (
    <SkeletonRegion>
      <div className="flex flex-col gap-5">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-8 w-3/4" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">
            <SkeletonBlock className="h-72 rounded-card" />
            <SkeletonBlock className="h-64 rounded-card" />
          </div>
          <SkeletonBlock className="h-96 rounded-card" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
