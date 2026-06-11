/** Fecha calendario YYYY-MM-DD en zona Colombia. */
export function fechaCalendarioBogota(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

function esFechaCalendarioValida(fecha: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha);
}

/** Medianoche de hoy en Colombia (America/Bogota), en ISO para filtros Supabase. */
export function inicioDiaBogotaIso(ahora = new Date()): string {
  return `${fechaCalendarioBogota(ahora)}T00:00:00-05:00`;
}

export function rangoDiaBogotaIso(fechaYYYYMMDD: string): { desde: string; hasta: string } | null {
  if (!esFechaCalendarioValida(fechaYYYYMMDD)) return null;
  return {
    desde: `${fechaYYYYMMDD}T00:00:00-05:00`,
    hasta: `${fechaYYYYMMDD}T23:59:59.999-05:00`,
  };
}

export function restarDiasCalendarioBogota(dias: number, desde = fechaCalendarioBogota()): string {
  const [y, m, d] = desde.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - dias);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
