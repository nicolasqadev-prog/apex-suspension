/**
 * Firma de presencia técnica (Ockham Systems) — pie global discreto, alineado al look Apex.
 */
type Props = {
  /** Más aire arriba en páginas largas (catálogo, legal). */
  spacious?: boolean;
  /** Dentro de un `<footer>` que ya tiene padding (p. ej. landing). */
  nested?: boolean;
  /** Empuja la firma al final de un contenedor `min-h-screen flex flex-col`. */
  pinBottom?: boolean;
};

export default function StudioFooterSignature({
  spacious = false,
  nested = false,
  pinBottom = false,
}: Props) {
  let shell: string;
  if (nested) {
    shell = "mt-8 border-t border-white/10 pt-8 pb-2";
  } else if (pinBottom) {
    shell = `mt-auto border-t border-white/[0.06] px-4 ${spacious ? "pt-10 pb-10" : "pt-8 pb-8"}`;
  } else {
    shell = spacious
      ? "mt-16 border-t border-white/[0.06] px-4 pt-10 pb-10"
      : "mt-12 border-t border-white/[0.06] px-4 pt-8 pb-8";
  }

  return (
    <div className={shell}>
      <div className="max-w-xl mx-auto text-center space-y-2">
        <p className="text-[11px] text-gray-500 leading-relaxed max-w-md mx-auto">
          Copyright {new Date().getFullYear()} · presencia técnica y plataforma por
        </p>
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <img
            src="/ockham-systems-marca.png"
            alt="Ockham Systems"
            width={200}
            height={48}
            className="h-7 sm:h-8 w-auto max-w-[min(220px,85vw)] object-contain opacity-[0.72] [filter:brightness(0)_invert(1)] hover:opacity-90 transition-opacity"
            loading="lazy"
            decoding="async"
          />
          <p className="text-[9px] uppercase tracking-[0.2em] text-gray-600 font-medium">
            Presencia técnica, claridad estratégica
          </p>
        </div>
      </div>
    </div>
  );
}
