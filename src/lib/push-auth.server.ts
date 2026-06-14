import { telefonoAdminApex } from "./pedidos-alerta.server";
import { getTallerFidelizadoByWhatsapp, normalizeWhatsapp } from "./talleres.server";

/** Solo vincula push a teléfonos registrados (taller activo u operador Apex). */
export async function telefonoAutorizadoParaPush(
  rawTelefono: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const telefono = normalizeWhatsapp(rawTelefono);
  if (!telefono || telefono.length < 10) {
    return { ok: false, reason: "Teléfono inválido" };
  }

  const adminTel = telefonoAdminApex();
  if (adminTel && telefono === adminTel) {
    return { ok: true };
  }

  const taller = await getTallerFidelizadoByWhatsapp(telefono);
  if (!taller || !taller.activo) {
    return { ok: false, reason: "Teléfono no autorizado para notificaciones" };
  }

  return { ok: true };
}
