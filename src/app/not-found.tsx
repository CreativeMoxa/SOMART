import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-28 text-center sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
        Error 404
      </p>
      <h1 className="text-5xl font-extrabold sm:text-6xl">
        Page <span className="text-gradient">not found</span>
      </h1>
      <p className="max-w-md text-lg leading-relaxed text-muted">
        The page you’re looking for doesn’t exist or may have moved. Let’s get you
        back to shopping.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="cursor-pointer rounded-full bg-gold-bright px-7 py-3.5 text-sm font-bold uppercase tracking-[0.12em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Go Home
        </Link>
        <Link
          href="/products"
          className="group flex cursor-pointer items-center gap-2 rounded-full border border-line px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] transition-colors duration-200 hover:border-gold hover:text-gold"
        >
          Browse the Collection
          <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
