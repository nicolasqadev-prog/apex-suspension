import { z } from "zod";

/** PIN opcional: la sesión HttpOnly en cookie es el método preferido. */
export const AdminAuthSchema = z.object({
  adminPin: z.string().min(4).max(64).optional(),
});
