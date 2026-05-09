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
      <div className="max-w-xl mx-auto text-center space-y-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-medium">
          Powered by
        </p>
        <div className="flex justify-center pt-0.5">
          <img
            src="/ockham-systems-marca.png"
            alt="Ockham Systems — presencia técnica, claridad estratégica"
            width={280}
            height={120}
            className="h-auto w-full max-w-[min(260px,88vw)] object-contain rounded-lg shadow-lg shadow-black/30 ring-1 ring-white/10"
            loading="lazy"
            decoding="async"
          />
        </div>
        <p className="text-[10px] text-gray-600">
          Ockham Systems · plataforma y operación técnica
        </p>
      </div>
    </div>
  );
}
