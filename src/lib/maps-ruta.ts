/** Abre Google Maps con paradas en orden (última = destino). Sin origin → usa ubicación actual. */
export function googleMapsRouteUrl(addresses: string[]): string | null {
  const cleaned = addresses.map((a) => a.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  const destination = cleaned[cleaned.length - 1]!;
  const waypoints = cleaned.slice(0, -1);
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", destination);
  if (waypoints.length) url.searchParams.set("waypoints", waypoints.join("|"));
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}
