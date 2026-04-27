import { createFileRoute } from "@tanstack/react-router";
import ApexLandingPage from "@/components/ApexLandingPage";

export const Route = createFileRoute("/")({
  component: ApexLandingPage,
  head: () => ({
    meta: [
      { title: "Apex Suspensión – Repuestos KTC en menos de 45 min" },
      {
        name: "description",
        content:
          "Entregas flash de repuestos de suspensión KTC directo en tu taller. Logística de precisión en Chía, Cajicá y Tocancipá.",
      },
    ],
  }),
});
