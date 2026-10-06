import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-13 font-bold uppercase tracking-wide text-brand">404</p>
      <h1 className="text-2xl font-bold tracking-tight text-primary">
        That market doesn&apos;t exist
      </h1>
      <p className="max-w-md text-14 text-secondary">
        It may have resolved and been archived, or the link is wrong.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-btn bg-brand-fill px-4 py-2 text-14 font-bold text-white transition-colors hover:bg-brand-fill-hover"
      >
        Browse markets
      </Link>
    </div>
  );
}
