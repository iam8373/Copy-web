import Link from "next/link";
import { cookies } from "next/headers";
import { DICTIONARIES, LOCALE_COOKIE, localeFromCookie } from "@/i18n";
import { Wordmark } from "@/components/Wordmark";

/** 404 in the saved language (S4). */
export default function NotFound() {
  const e = DICTIONARIES[localeFromCookie(cookies().get(LOCALE_COOKIE)?.value)].errors;
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <Wordmark size="sm" className="mb-2" />
      <p className="text-13 font-bold uppercase tracking-wide text-brand">404</p>
      <h1 className="text-2xl font-bold tracking-tight text-primary">{e.notFoundTitle}</h1>
      <p className="max-w-md text-14 text-secondary">{e.notFoundBody}</p>
      <Link
        href="/"
        className="mt-2 rounded-btn bg-brand-fill px-4 py-2 text-14 font-bold text-white transition-colors hover:bg-brand-fill-hover"
      >
        {e.notFoundHome}
      </Link>
    </div>
  );
}
