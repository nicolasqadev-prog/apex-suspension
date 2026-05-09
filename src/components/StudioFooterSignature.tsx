/**
 * Atribución sutil: quién hizo la parte digital (no compite con la marca Apex).
 */
type Props = {
  spacious?: boolean;
  nested?: boolean;
  pinBottom?: boolean;
};

export default function StudioFooterSignature({
  spacious = false,
  nested = false,
  pinBottom = false,
}: Props) {
  let shell: string;
  if (nested) {
    shell = "mt-6 border-t border-white/[0.06] pt-6";
  } else if (pinBottom) {
    shell = `mt-auto border-t border-white/[0.06] px-4 ${spacious ? "pt-8 pb-8" : "pt-6 pb-6"}`;
  } else {
    shell = spacious
      ? "mt-12 border-t border-white/[0.06] px-4 pt-8 pb-8"
      : "mt-10 border-t border-white/[0.06] px-4 pt-6 pb-6";
  }

  return (
    <div className={shell}>
      <p className="mx-auto max-w-lg text-center text-[10px] sm:text-[11px] leading-relaxed text-gray-600">
        Experiencia digital y plataforma por{" "}
        <span className="font-medium text-gray-500">Ockham Systems</span>.
      </p>
    </div>
  );
}
