import { SkeletonBlock, SkeletonGrid, SkeletonRegion } from "@/components/Skeleton";

/** Category page: title, chip row, sort row, then the grid. */
export default function Loading() {
  return (
    <SkeletonRegion>
      <div className="flex flex-col gap-5">
        <SkeletonBlock className="h-7 w-40" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonBlock key={i} className="h-8 w-20" />
          ))}
        </div>
        <SkeletonBlock className="h-6 w-64" />
        <SkeletonGrid count={8} />
      </div>
    </SkeletonRegion>
  );
}
