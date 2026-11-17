import { PLACES, type Place } from "@/data/corridor";

/** Un cargador cuenta si el camino pasa a esta distancia. Más lejos no lo invento. */
export const CHARGER_NEAR_KM = 2.5;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Distancia al trazado y km recorridos desde el primer punto. */
export function projectPoint(lat: number, lng: number, line: [number, number][]) {
  let bestDist = Infinity;
  let bestAlong = 0;
  let walked = 0;
  for (let index = 1; index < line.length; index += 1) {
    const [lat1, lng1] = line[index - 1];
    const [lat2, lng2] = line[index];
    const seg = haversineKm(lat1, lng1, lat2, lng2);
    if (seg < 0.001) continue;
    const kx = Math.cos((lat1 * Math.PI) / 180) * 111.32;
    const ky = 110.57;
    const bx = (lng2 - lng1) * kx;
    const by = (lat2 - lat1) * ky;
    const px = (lng - lng1) * kx;
    const py = (lat - lat1) * ky;
    const len2 = bx * bx + by * by;
    const t = len2 > 0 ? Math.min(1, Math.max(0, (px * bx + py * by) / len2)) : 0;
    const dist = Math.hypot(px - bx * t, py - by * t);
    if (dist < bestDist) {
      bestDist = dist;
      bestAlong = walked + seg * t;
    }
    walked += seg;
  }
  return { distKm: bestDist, alongKm: bestAlong, walkedKm: walked };
}

/** Cargadores ya verificados a pocos km del pueblo, no sobre toda la ruta. */
export function chargersNear(id: string, km = 12) {
  const place = PLACES.find((item) => item.id === id);
  if (!place) return [];
  return PLACES.filter(
    (item) => item.role === "charger" && haversineKm(place.lat, place.lng, item.lat, item.lng) <= km,
  );
}

/** Cargadores ya verificados que caen sobre una ruta calculada. Ordenados de salida a destino. */
export function chargersOnLine(line: [number, number][], totalKm: number) {
  if (line.length < 2 || totalKm < 3) return [] as { place: Place; alongKm: number }[];
  const scaleBase = projectPoint(line[0][0], line[0][1], line).walkedKm;
  const scale = scaleBase > 1 ? totalKm / scaleBase : 1;
  const hits: { place: Place; alongKm: number }[] = [];
  for (const place of PLACES) {
    if (place.role !== "charger") continue;
    const projected = projectPoint(place.lat, place.lng, line);
    if (projected.distKm > CHARGER_NEAR_KM) continue;
    const alongKm = projected.alongKm * scale;
    if (alongKm < 1.2 || alongKm > totalKm - 1.2) continue;
    hits.push({ place, alongKm });
  }
  hits.sort((a, b) => a.alongKm - b.alongKm);
  return hits;
}
