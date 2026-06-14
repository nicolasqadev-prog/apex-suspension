import { useEffect, useState } from "react";

import IosPwaInstallSheet from "@/components/IosPwaInstallSheet";

/** Escucha el evento global y muestra la guía iOS en cualquier ruta. */
export default function IosInstallGuideHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("apex-pwa-open-ios-guide", onOpen);
    return () => window.removeEventListener("apex-pwa-open-ios-guide", onOpen);
  }, []);

  return <IosPwaInstallSheet open={open} onOpenChange={setOpen} />;
}
