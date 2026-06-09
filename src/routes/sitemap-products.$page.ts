import { createFileRoute } from "@tanstack/react-router";

import {
  buildProductSitemapXml,
  countActiveProductSlugs,
  productSitemapPageCount,
  sitemapXmlResponse,
} from "@/lib/sitemap.server";
import { resolvePublicOrigin } from "@/lib/site-url";

export const Route = createFileRoute("/sitemap-products/$page")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const page = Number(params.page);
        if (!Number.isFinite(page) || page < 1) {
          return new Response("Not found", { status: 404 });
        }

        const total = await countActiveProductSlugs();
        const maxPage = productSitemapPageCount(total);
        if (page > maxPage) {
          return new Response("Not found", { status: 404 });
        }

        const origin = resolvePublicOrigin(request);
        const xml = await buildProductSitemapXml(origin, page);
        if (!xml) {
          return new Response("Not found", { status: 404 });
        }
        return sitemapXmlResponse(xml);
      },
    },
  },
});
