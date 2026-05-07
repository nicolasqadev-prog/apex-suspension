import { Link } from "@tanstack/react-router";

import logoUrl from "../assets/apex-logo-full.png";

export default function ApexHeaderBrand() {
  return (
    <Link
      to="/"
      aria-label="Apex Suspensión — inicio"
      className="group relative flex flex-col items-start gap-1 rounded-lg py-0.5 pr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.7_0.2_40)]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[oklch(0.18_0.04_250)]"
    >
      <img
        src={logoUrl}
        alt="Apex Suspensión"
        className="h-11 w-auto select-none transition-transform duration-300 group-hover:scale-[1.01] sm:h-12"
        loading="eager"
        decoding="async"
      />
      <span
        className="pointer-events-none absolute -inset-x-2 -inset-y-2 -z-10 rounded-2xl bg-gradient-to-br from-white/[0.04] via-transparent to-[oklch(0.7_0.2_40)]/[0.06] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  );
}
