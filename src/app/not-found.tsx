import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-[13px] font-bold uppercase tracking-wide text-accent-blue">404</p>
      <h1 className="text-2xl font-bold tracking-tight text-content-primary">
        That market doesn&apos;t exist
      </h1>
      <p className="max-w-md text-[14px] text-content-secondary">
        It may have resolved and been archived, or the link is wrong.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-accent-blue px-4 py-2 text-[14px] font-bold text-white transition-colors hover:bg-blue-600"
      >
        Browse markets
      </Link>
    </div>
  );
}
