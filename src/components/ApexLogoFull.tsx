import markUrl from "@/assets/apex-icon.png";

type Size = "sm" | "md" | "lg";

interface Props {
  size?: Size;
  showTagline?: boolean;
  className?: string;
}

const sizes: Record<Size, {
  mark: string;
  apex: string;
  sub: string;
  tag: string;
  gap: string;
}> = {
  sm: {
    mark: "h-10",
    apex: "text-2xl",
    sub: "text-[0.6rem] tracking-[0.28em]",
    tag: "text-[9px]",
    gap: "gap-3",
  },
  md: {
    mark: "h-16",
    apex: "text-4xl",
    sub: "text-xs tracking-[0.28em]",
    tag: "text-[11px]",
    gap: "gap-4",
  },
  lg: {
    mark: "h-24",
    apex: "text-6xl",
    sub: "text-base tracking-[0.28em]",
    tag: "text-sm",
    gap: "gap-5",
  },
};

export default function ApexLogoFull({
  size = "md",
  showTagline = true,
  className = "",
}: Props) {
  const s = sizes[size];

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      {/* Isotipo: PNG transparente, sin contenedor, sin fondo */}
      <img
        src={markUrl}
        alt=""
        aria-hidden
        className={`${s.mark} w-auto select-none flex-shrink-0`}
        loading="eager"
        decoding="async"
      />

      {/* Texto tipográfico en blanco — natural sobre fondos oscuros */}
      <div className="flex flex-col leading-none">
        <span
          className={`${s.apex} font-black text-white tracking-[-0.04em] leading-none`}
        >
          APEX
        </span>

        {/* Línea naranja decorativa */}
        <span
          aria-hidden
          className="my-[3px] block h-[2px] w-full rounded-full bg-gradient-to-r from-orange-500 via-orange-400 to-amber-300"
        />

        <span
          className={`${s.sub} font-semibold uppercase text-white leading-none`}
        >
          Suspensión
        </span>

        {showTagline && (
          <span className={`${s.tag} text-slate-400 mt-2 leading-snug`}>
            El impulso exacto para no detenerte
          </span>
        )}
      </div>
    </div>
  );
}
