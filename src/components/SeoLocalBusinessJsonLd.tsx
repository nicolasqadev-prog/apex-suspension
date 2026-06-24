import { siteOriginForHead } from "@/lib/site-url";

/** Datos estructurados para Google (AutoPartsStore + área de servicio). */
export default function SeoLocalBusinessJsonLd() {
  const base = siteOriginForHead();
  if (!base) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    name: "Apex Suspensión",
    description:
      "Repuestos de suspensión y dirección para talleres en la Sabana de Bogotá. Catálogo en línea, stock referencial y entregas coordinadas.",
    url: `${base}/`,
    areaServed: [
      { "@type": "City", name: "Chía" },
      { "@type": "City", name: "Cajicá" },
      { "@type": "City", name: "Zipaquirá" },
      { "@type": "City", name: "Tocancipá" },
      { "@type": "AdministrativeArea", name: "Sabana de Bogotá, Colombia" },
    ],
    knowsAbout: [
      "Repuestos de suspensión",
      "Repuestos de dirección",
      "Amortiguadores",
      "Terminales",
      "Bieletas",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
