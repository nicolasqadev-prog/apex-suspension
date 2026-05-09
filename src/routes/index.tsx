import { createFileRoute } from "@tanstack/react-router";
import ApexLandingPage from "@/components/ApexLandingPage";
import { canonicalHref } from "@/lib/site-url";

export const Route = createFileRoute("/")({
  component: ApexLandingPage,
  head: () => {
    const href = canonicalHref("/");
    return {
      meta: [
        { title: "Apex Suspensión — repuestos con entrega rápida" },
        {
          name: "description",
          content:
            "Repuestos de suspensión y dirección en la Sabana. Entregas rápidas cuando hay stock y ruta disponible (Chía y alrededores).",
        },
      ],
      links: href ? [{ rel: "canonical", href }] : [],
    };
  },
});
