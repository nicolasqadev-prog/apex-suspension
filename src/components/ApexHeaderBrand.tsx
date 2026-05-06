import { Link } from "@tanstack/react-router";

import markUrl from "../assets/apex-mark.webp";

export default function ApexHeaderBrand() {
  return (
    <Link
      to="/"
      aria-label="Apex Suspensión — inicio"
      className="group relative flex flex-col items-start gap-1 rounded-lg py-0.5 pr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.7_0.2_40)]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[oklch(0.18_0.04_250)]"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-white/15 transition-transform duration-300 group-hover:scale-[1.02] sm:size-11">
          <img
            src={markUrl}
            alt=""
            className="h-7 w-auto select-none sm:h-8"
            loading="eager"
            decoding="async"
          />
        </span>

        <div className="flex flex-col items-start gap-1">
          <div className="relative inline-block">
            <span className="block text-[1.4rem] font-black leading-none tracking-[-0.06em] text-white transition-colors duration-300 group-hover:text-gray-50 sm:text-2xl">
              APEX
            </span>
            <span
              className="mt-1 block h-[2px] max-w-[4.5rem] rounded-full bg-gradient-to-r from-[oklch(0.7_0.2_40)] via-orange-400 to-amber-300/90 opacity-90 transition-all duration-300 group-hover:max-w-[5.75rem] group-hover:opacity-100"
              aria-hidden
            />
          </div>
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-gray-500 transition-colors duration-300 group-hover:text-gray-400 sm:text-[0.68rem] sm:tracking-[0.32em]">
            Suspensión
          </span>
        </div>
      </div>
      <span
        className="pointer-events-none absolute -inset-x-2 -inset-y-2 -z-10 rounded-2xl bg-gradient-to-br from-white/[0.04] via-transparent to-[oklch(0.7_0.2_40)]/[0.06] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  );
}
