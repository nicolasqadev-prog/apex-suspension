import handler from "@tanstack/react-start/server-entry";

import { handleWhatsAppWebhookRequest } from "./lib/whatsapp-webhook-http.server";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://wa.me https://api.whatsapp.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

function withSecurityHeaders(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }

  const path = new URL(request.url).pathname;
  if (path.startsWith("/admin")) {
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    headers.set("Pragma", "no-cache");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname;
    if (path === "/api/whatsapp/webhook") {
      const response = await handleWhatsAppWebhookRequest(request, ctx);
      return withSecurityHeaders(request, response);
    }

    const response = await handler.fetch(request, env as never, ctx);
    return withSecurityHeaders(request, response);
  },
};
