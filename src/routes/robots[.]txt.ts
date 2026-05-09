import { createFileRoute } from "@tanstack/react-router";

import { buildRobotsTxt } from "@/lib/sitemap.server";
import { resolvePublicOrigin } from "@/lib/site-url";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = resolvePublicOrigin(request);
        const body = buildRobotsTxt(origin);
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
