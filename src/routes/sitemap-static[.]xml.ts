import { createFileRoute } from "@tanstack/react-router";

import { buildStaticSitemapXml, sitemapXmlResponse } from "@/lib/sitemap.server";
import { resolvePublicOrigin } from "@/lib/site-url";

export const Route = createFileRoute("/sitemap-static.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = resolvePublicOrigin(request);
        return sitemapXmlResponse(buildStaticSitemapXml(origin));
      },
    },
  },
});
