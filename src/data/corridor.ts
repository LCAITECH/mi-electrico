export type Branch = "ruta2" | "costa" | "off";

export type Place = {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lng: number;
  /** Km de ruta desde el Obelisco, por OSRM. No es el odómetro oficial. */
  km: number;
  branch: Branch;
  role: "origin" | "charger" | "destination";
  acKw: number | null;
  dcKw: number | null;
  /** El listado dice rápida o lenta aunque no publique el número de kW. */
  listed?: "fast" | "slow";
  powerNote: string;
  source: string;
  sourceUrl: string;
};

export const SPLIT_KM = 208.1;

export const PLACES: Place[] = [
  {
    id: "caba",
    name: "CABA",
    detail: "Salida desde el Obelisco. No es un cargador.",
    lat: -34.60371,
    lng: -58.38163,
    km: 0,
    branch: "ruta2",
    role: "origin",
    acKw: null,
    dcKw: null,
    powerNote: "",
    source: "Punto de partida elegido para el viaje",
    sourceUrl: "https://www.openstreetmap.org/",
  },
  {
    id: "atalaya",
    name: "Atalaya, Chascomús",
    detail: "RN 2 km 113 · Chargebox · AC",
    lat: -35.51072,
    lng: -58.02574,
    km: 118.2,
    branch: "ruta2",
    role: "charger",
    acKw: 22,
    dcKw: null,
    powerNote: "Chargebox dijo 2 puestos de 22 kW en enero 2026. El listado de octubre lo sigue como AC, sin repetir los kW.",
    source: "Chargebox, octubre 2026 y Autoblog 22/01/2026",
    sourceUrl: "https://chargeboxnet.com/puntos-de-carga-chargebox-net/",
  },
  {
    id: "mcd-chascomus",
    name: "McDonald's Chascomús",
    detail: "RP 2 km 115 · Chargebox · AC",
    lat: -35.52787,
    lng: -58.01313,
    km: 120.7,
    branch: "ruta2",
    role: "charger",
    acKw: 22,
    dcKw: null,
    powerNote: "22 kW según Chargebox en enero 2026.",
    source: "Chargebox, octubre 2026 y Autoblog 22/01/2026",
    sourceUrl: "https://autoblog.com.ar/chargebox-inauguro-su-estacion-de-carga-numero-100-y-anuncio-150-mas/",
  },
  {
    id: "puma-chascomus",
    name: "Puma Chascomús",
    detail: "RP 2 km 116,3 · Chargebox · DC",
    lat: -35.53181,
    lng: -58.00855,
    km: 121.4,
    branch: "ruta2",
    role: "charger",
    acKw: null,
    dcKw: 40,
    powerNote: "40 kW en enero 2026. Octubre confirma DC x2, sin repetir la potencia.",
    source: "Chargebox, octubre 2026 y Autoblog 22/01/2026",
    sourceUrl: "https://chargeboxnet.com/puntos-de-carga-chargebox-net/",
  },
  {
    id: "ypf-dolores",
    name: "YPF Dolores",
    detail: "Autovía 2, km 202",
    lat: -36.25751,
    lng: -57.70946,
    km: 208.1,
    branch: "ruta2",
    role: "charger",
    acKw: null,
    dcKw: null,
    powerNote: "Las fuentes no cierran el kW: Open Charge Map lista 30 kW DC y 22 kW AC; una guía de mayo habla de 50 y hasta 160. No fijo un número.",
    source: "Open Charge Map OCM-288087 y guía DóndeCargar, mayo 2026",
    sourceUrl: "https://openchargemap.org/poi/details/288087",
  },
  {
    id: "puma-dolores",
    name: "Puma Dolores",
    detail: "RP 63 km 3 · Chargebox · AC y DC",
    lat: -36.30073,
    lng: -57.66494,
    km: 215.9,
    branch: "ruta2",
    role: "charger",
    acKw: null,
    dcKw: 60,
    powerNote: "60 kW DC según Chargebox en enero 2026. Octubre confirma AC + DC x2.",
    source: "Chargebox, octubre 2026 y Autoblog 22/01/2026",
    sourceUrl: "https://chargeboxnet.com/puntos-de-carga-chargebox-net/",
  },
  {
    id: "hj-dolores",
    name: "Howard Johnson Dolores",
    detail: "Chargebox · AC, respaldo en el pueblo",
    lat: -36.31334,
    lng: -57.6526,
    km: 218,
    branch: "ruta2",
    role: "charger",
    acKw: null,
    dcKw: null,
    powerNote: "El listado lo da como semi-rápido y no publica kW. El km es un desvío corto desde el Puma, no un hito de la autovía.",
    source: "Chargebox, octubre 2026",
    sourceUrl: "https://chargeboxnet.com/puntos-de-carga-chargebox-net/",
  },
  {
    id: "carrefour-mdp",
    name: "Carrefour Mar del Plata",
    detail: "Av. Constitución · Chargebox · AC",
    lat: -37.95408,
    lng: -57.5795,
    km: 412,
    branch: "ruta2",
    role: "charger",
    acKw: null,
    dcKw: null,
    powerNote: "Semi-rápido. kW no publicados en el listado de octubre.",
    source: "Chargebox, octubre 2026",
    sourceUrl: "https://chargeboxnet.com/puntos-de-carga-chargebox-net/",
  },
  {
    id: "mcd-mdp",
    name: "McDonald's Mar del Plata",
    detail: "Constitución y RP 11 · Chargebox · AC",
    lat: -37.96018,
    lng: -57.5641,
    km: 414,
    branch: "ruta2",
    role: "charger",
    acKw: null,
    dcKw: null,
    powerNote: "Semi-rápido. kW no publicados en el listado de octubre.",
    source: "Chargebox, octubre 2026",
    sourceUrl: "https://chargeboxnet.com/puntos-de-carga-chargebox-net/",
  },
  {
    id: "puma-mdp",
    name: "Puma Mar del Plata",
    detail: "Juan B. Justo 3176 · Chargebox · AC",
    lat: -38.01927,
    lng: -57.57104,
    km: 422,
    branch: "ruta2",
    role: "charger",
    acKw: null,
    dcKw: null,
    powerNote: "Semi-rápido. kW no publicados en el listado de octubre.",
    source: "Chargebox, octubre 2026",
    sourceUrl: "https://chargeboxnet.com/puntos-de-carga-chargebox-net/",
  },
  {
    id: "mdp",
    name: "Mar del Plata",
    detail: "Centro. Destino, no es un cargador.",
    lat: -37.99943,
    lng: -57.55036,
    km: 418.3,
    branch: "ruta2",
    role: "destination",
    acKw: null,
    dcKw: null,
    powerNote: "",
    source: "Distancia de manejo OSRM desde el Obelisco: 418 km",
    sourceUrl: "https://www.openstreetmap.org/",
  },
  {
    id: "carrefour-costa",
    name: "Carrefour RP 11",
    detail: "Partido de General Madariaga · Chargebox · AC",
    lat: -37.10805,
    lng: -56.89253,
    km: 355,
    branch: "costa",
    role: "charger",
    acKw: null,
    dcKw: null,
    powerNote: "El listado dice Carrefour General Madariaga, ruta interbalnearia, AC x2, sin kW. El pin es el Carrefour de OpenStreetMap sobre la RP 11.",
    source: "Chargebox, octubre 2026",
    sourceUrl: "https://chargeboxnet.com/puntos-de-carga-chargebox-net/",
  },
  {
    id: "pinamar-carga",
    name: "Chargebox Pinamar",
    detail: "Noctilucas · AC y DC",
    lat: -37.11506,
    lng: -56.85661,
    km: 360.9,
    branch: "costa",
    role: "charger",
    acKw: 22,
    dcKw: 60,
    powerNote: "60 kW y 22 kW en la inauguración de enero 2026. Octubre confirma AC + DC.",
    source: "Chargebox, octubre 2026 y Autoblog 22/01/2026",
    sourceUrl: "https://autoblog.com.ar/chargebox-inauguro-su-estacion-de-carga-numero-100-y-anuncio-150-mas/",
  },
  {
    id: "pinamar",
    name: "Pinamar",
    detail: "Destino de costa.",
    lat: -37.10995,
    lng: -56.8539,
    km: 360.9,
    branch: "costa",
    role: "destination",
    acKw: null,
    dcKw: null,
    powerNote: "",
    source: "OSRM: Dolores a Pinamar por General Madariaga",
    sourceUrl: "https://www.openstreetmap.org/",
  },
  {
    id: "carilo",
    name: "Cariló Golf",
    detail: "Ñandú 964 · Chargebox · AC",
    lat: -37.15787,
    lng: -56.90888,
    km: 370.4,
    branch: "costa",
    role: "charger",
    acKw: null,
    dcKw: null,
    powerNote: "Semi-rápido. kW no publicados en octubre.",
    source: "Chargebox, octubre 2026",
    sourceUrl: "https://chargeboxnet.com/puntos-de-carga-chargebox-net/",
  },
  {
    id: "gesell",
    name: "Villa Gesell",
    detail: "Destino. No hay cargador verificado en el pueblo en el listado de octubre.",
    lat: -37.25584,
    lng: -56.97863,
    km: 387.3,
    branch: "costa",
    role: "destination",
    acKw: null,
    dcKw: null,
    powerNote: "",
    source: "Chargebox octubre 2026 no lista un punto en Gesell",
    sourceUrl: "https://chargeboxnet.com/puntos-de-carga-chargebox-net/",
  },
];

export const RUTA2: [number, number][] = [[-34.60359, -58.38164], [-34.60315, -58.37237], [-34.61462, -58.36682], [-34.62404, -58.3653], [-34.63167, -58.35386], [-34.64542, -58.35057], [-34.65726, -58.35051], [-34.67488, -58.33231], [-34.6917, -58.28496], [-34.70793, -58.25966], [-34.74381, -58.20367], [-34.78436, -58.15343], [-34.82955, -58.19228], [-34.87167, -58.17747], [-34.90921, -58.17146], [-34.94119, -58.16898], [-34.97277, -58.16078], [-35.00802, -58.11583], [-35.0559, -58.0916], [-35.11474, -58.06097], [-35.16649, -58.04008], [-35.24491, -58.06008], [-35.31558, -58.05221], [-35.36868, -58.04984], [-35.42609, -58.05005], [-35.509, -58.02499], [-35.52064, -58.02014], [-35.52674, -58.01532], [-35.53457, -58.00365], [-35.56885, -57.98077], [-35.5967, -57.97352], [-35.66308, -57.95861], [-35.70214, -57.94539], [-35.76452, -57.93156], [-35.86502, -57.90108], [-35.95015, -57.86028], [-35.9679, -57.85132], [-36.01359, -57.83859], [-36.08262, -57.81705], [-36.10593, -57.80366], [-36.17661, -57.76044], [-36.22847, -57.72016], [-36.25821, -57.70945], [-36.28649, -57.70323], [-36.29337, -57.70311], [-36.29629, -57.68874], [-36.30073, -57.66482], [-36.31709, -57.68933], [-36.31977, -57.69849], [-36.34784, -57.6969], [-36.45998, -57.72485], [-36.51671, -57.7188], [-36.63114, -57.78562], [-36.66186, -57.78794], [-36.66863, -57.7923], [-36.7899, -57.81097], [-36.84482, -57.86493], [-36.85388, -57.87073], [-36.91494, -57.87997], [-37.07522, -57.83516], [-37.08899, -57.82783], [-37.1578, -57.81197], [-37.26043, -57.783], [-37.27103, -57.76785], [-37.28128, -57.76607], [-37.31355, -57.76784], [-37.43192, -57.73395], [-37.45253, -57.72033], [-37.50489, -57.71375], [-37.61134, -57.68368], [-37.66737, -57.66405], [-37.76248, -57.64077], [-37.8091, -57.62736], [-37.87659, -57.60832], [-37.91925, -57.5916], [-37.94628, -57.58304], [-37.95651, -57.5806], [-37.96775, -57.57729], [-37.97548, -57.57899], [-37.9806, -57.58242], [-37.99144, -57.56038], [-37.99977, -57.55064]];
export const COSTA: [number, number][] = [[-36.25747, -57.70925], [-36.26139, -57.70855], [-36.26774, -57.70635], [-36.29108, -57.70317], [-36.29282, -57.70398], [-36.29395, -57.69997], [-36.29565, -57.69047], [-36.29619, -57.68849], [-36.29694, -57.67964], [-36.30325, -57.64789], [-36.3038, -57.64571], [-36.3113, -57.6063], [-36.31386, -57.50239], [-36.29444, -57.40795], [-36.30029, -57.38368], [-36.31399, -57.37833], [-36.35897, -57.36799], [-36.42572, -57.35122], [-36.45626, -57.34888], [-36.46433, -57.33985], [-36.47671, -57.33668], [-36.49442, -57.31649], [-36.50124, -57.30649], [-36.5336, -57.27536], [-36.59567, -57.25422], [-36.63544, -57.25183], [-36.67135, -57.26002], [-36.70795, -57.23918], [-36.73543, -57.23951], [-36.81095, -57.23192], [-36.87674, -57.19897], [-36.92372, -57.16319], [-36.94603, -57.13775], [-36.97301, -57.11695], [-36.98674, -57.12684], [-36.99696, -57.13698], [-37.00332, -57.12987], [-37.00493, -57.11775], [-37.01685, -57.12031], [-37.01785, -57.1198], [-37.01855, -57.10957], [-37.02092, -57.08698], [-37.02646, -57.07943], [-37.0575, -57.04705], [-37.07419, -57.03007], [-37.07742, -57.02294], [-37.07727, -57.00791], [-37.07905, -57.00186], [-37.09813, -56.9728], [-37.10067, -56.92205], [-37.10171, -56.89986], [-37.10153, -56.89276], [-37.10269, -56.88788], [-37.10348, -56.88468], [-37.1099, -56.8787], [-37.11141, -56.87379], [-37.11393, -56.86249], [-37.11429, -56.86041], [-37.11055, -56.85556], [-37.11279, -56.85873], [-37.11516, -56.86094], [-37.1194, -56.86286], [-37.1249, -56.86377], [-37.12896, -56.87348], [-37.1309, -56.87909], [-37.13896, -56.87993], [-37.14279, -56.88539], [-37.14809, -56.88705], [-37.15857, -56.89353], [-37.16118, -56.90716], [-37.16198, -56.91387], [-37.16043, -56.92219], [-37.15809, -56.92793], [-37.15695, -56.92986], [-37.17237, -56.94101], [-37.19137, -56.95674], [-37.20936, -56.9737], [-37.23599, -56.99119], [-37.23745, -56.99133], [-37.23829, -56.98054], [-37.24169, -56.97481], [-37.24811, -56.9744], [-37.25552, -56.97859], [-37.25574, -56.97884]];

export function roadKm(a: Place, b: Place) {
  if (a.branch === "off" || b.branch === "off") return Number.NaN;
  if (a.branch === b.branch) return Math.abs(a.km - b.km);
  return Math.abs(a.km - SPLIT_KM) + Math.abs(b.km - SPLIT_KM);
}

export type TripZone = "costa" | "norte" | "oeste" | "interior";

export const TRIP_ZONES: { id: TripZone; label: string }[] = [
  { id: "costa", label: "Costa" },
  { id: "norte", label: "Zona norte" },
  { id: "oeste", label: "Zona oeste" },
  { id: "interior", label: "Interior" },
];

/** Pueblos desde los que se puede salir o llegar. */
export const ENDPOINTS: { id: string; label: string; zone: TripZone }[] = [
  { id: "caba", label: "CABA", zone: "norte" },
  { id: "puma-chascomus", label: "Chascomús", zone: "costa" },
  { id: "ypf-dolores", label: "Dolores", zone: "costa" },
  { id: "mdp", label: "Mar del Plata", zone: "costa" },
  { id: "pinamar", label: "Pinamar", zone: "costa" },
  { id: "gesell", label: "Villa Gesell", zone: "costa" },
];

export function citiesInZone(zone: TripZone) {
  return ENDPOINTS.filter((item) => item.id === "caba" || item.zone === zone);
}

export function endpointLabel(id: string) {
  return ENDPOINTS.find((item) => item.id === id)?.label;
}

/** El cargador está sobre el camino entre salida y destino, no en un desvío. */
export function passes(place: Place, start: Place, end: Place) {
  if (place.role !== "charger" || place.branch === "off") return false;
  if (start.branch === "off" || end.branch === "off") return false;
  if (place.id === start.id || place.id === end.id) return false;
  const total = roadKm(start, end);
  if (total < 3) return false;
  const along = roadKm(start, place) + roadKm(place, end);
  return Math.abs(along - total) < 15;
}

export function routeName(start: Place, end: Place) {
  if (start.branch === end.branch) return start.branch === "ruta2" ? "Autovía 2" : "Costa atlántica";
  return "Autovía 2 y costa";
}

function nearest(line: [number, number][], place: Place) {
  let best = 0;
  let score = Infinity;
  line.forEach(([lat, lng], index) => {
    const delta = (lat - place.lat) ** 2 + (lng - place.lng) ** 2;
    if (delta < score) {
      score = delta;
      best = index;
    }
  });
  return best;
}

function sliceLine(line: [number, number][], a: Place, b: Place) {
  const i = nearest(line, a);
  const j = nearest(line, b);
  const [from, to] = i <= j ? [i, j] : [j, i];
  return line.slice(from, to + 1);
}

/** Tramo de las rutas que sí tienen cargadores, entre los dos pueblos. */
export function routeLine(start: Place, end: Place): [number, number][] {
  if (start.id === end.id) return [[start.lat, start.lng]];
  if (start.branch === end.branch) return sliceLine(start.branch === "ruta2" ? RUTA2 : COSTA, start, end);
  const split = PLACES.find((place) => place.id === "ypf-dolores");
  if (!split) return [];
  const rutaEnd = start.branch === "ruta2" ? start : end;
  const costaEnd = start.branch === "costa" ? start : end;
  const ruta = sliceLine(RUTA2, rutaEnd, split);
  const costa = sliceLine(COSTA, split, costaEnd);
  return start.branch === "ruta2" ? [...ruta, ...costa] : [...costa, ...ruta];
}

export function onTheWay(place: Place, dest: Place) {
  if (place.role !== "charger") return false;
  if (dest.branch === "ruta2") return place.branch === "ruta2" && place.km > 1 && place.km < dest.km + 8;
  if (place.branch === "ruta2") return place.km <= SPLIT_KM + 12;
  return place.km < dest.km + 8;
}

export type ChargeSpeed = "fast" | "slow" | "unknown";

/** Verde si hay DC o el listado lo marca como rápida. Naranja si es solo AC. Gris si no dice el tipo. */
export function chargeSpeed(place: Place): ChargeSpeed | null {
  if (place.role !== "charger") return null;
  if (place.dcKw != null || place.listed === "fast") return "fast";
  if (place.acKw != null || place.listed === "slow") return "slow";
  return "unknown";
}

export function chargeSpeedLabel(speed: ChargeSpeed | null) {
  if (speed === "fast") return "Carga rápida";
  if (speed === "slow") return "Carga lenta";
  if (speed === "unknown") return "Potencia no publicada";
  return "";
}
