import { AsyncLocalStorage } from "node:async_hooks";

/** Contexto de ejecución de Cloudflare (waitUntil) disponible durante el request. */
export const cloudflareExecutionCtx = new AsyncLocalStorage<ExecutionContext>();

/** Encola trabajo en segundo plano sin que el Worker lo mate al devolver 200. */
export function waitUntilBackground(promise: Promise<unknown>): void {
  const ctx = cloudflareExecutionCtx.getStore();
  if (ctx) {
    ctx.waitUntil(promise);
    return;
  }
  void promise;
}
