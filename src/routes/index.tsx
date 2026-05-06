import { createFileRoute } from "@tanstack/react-router";
import ApexLandingPage from "@/components/ApexLandingPage";

export const Route = createFileRoute("/")({
  component: ApexLandingPage,
  head: () => ({
    meta: [
      { title: "Apex Suspensión — repuestos con entrega rápida" },
      {
        name: "description",
        content:
          "Repuestos de suspensión y dirección para tu taller en la Sabana. Entregas rápidas cuando hay stock y ruta disponible (Chía y alrededores).",
      },
    ],
  }),
});
