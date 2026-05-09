import { createFileRoute } from "@tanstack/react-router";

import { buildSitemapXml } from "@/lib/sitemap.server";
import { resolvePublicOrigin } from "@/lib/site-url";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = resolvePublicOrigin(request);
        const xml = await buildSitemapXml(origin);
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=1800",
          },
        });
      },
    },
  },
});
