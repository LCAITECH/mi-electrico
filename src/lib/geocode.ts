import { createServerFn } from "@tanstack/react-start";

export type GeoHit = { label: string; lat: number; lng: number };

/** Nominatim no abre CORS al navegador. La búsqueda sale de acá, con User-Agent. */
export const searchPlaces = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = typeof input === "object" && input && "q" in input ? (input as { q: unknown }).q : "";
    const q = (typeof raw === "string" ? raw : "").replace(/[^\p{L}\p{N}\s,.'#-]/gu, "").trim().slice(0, 120);
    if (q.length < 3) throw new Error("Escribí al menos 3 letras");
    return { q };
  })
  .handler(async ({ data }): Promise<GeoHit[]> => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", data.q);
    url.searchParams.set("countrycodes", "ar");
    url.searchParams.set("limit", "5");
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "es",
        "User-Agent": "MiElectrico/1.0 (comparador de autos electricos, Argentina)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("No pude buscar direcciones");
    const body = (await response.json()) as unknown;
    if (!Array.isArray(body)) return [];
    const hits: GeoHit[] = [];
    for (const row of body) {
      if (!row || typeof row !== "object") continue;
      const label = "display_name" in row && typeof row.display_name === "string" ? row.display_name : "";
      const lat = "lat" in row ? Number(row.lat) : NaN;
      const lng = "lon" in row ? Number(row.lon) : NaN;
      if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      hits.push({ label, lat, lng });
    }
    return hits;
  });
