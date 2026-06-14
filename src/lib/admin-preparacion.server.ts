/**
 * Reglas de borrador/preparación evaluadas en servidor (no confiar en el cliente).
 */
export function allowNoPublicadoEnServidor(): boolean {
  const operacionVivo =
    process.env.VITE_APEX_OPERACION_VIVO === "true" || process.env.APEX_OPERACION_VIVO === "true";
  if (operacionVivo) return false;
  return process.env.APEX_ALLOW_BORRADOR_TALLER === "true";
}
