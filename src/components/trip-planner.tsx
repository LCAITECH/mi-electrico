import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MODELS,
  ars,
  electricKwhPer100,
  num,
  plugsIn,
  type CarModel,
} from "@/data/market";
import { chargersNear, chargersOnLine } from "@/data/along-route";
import {
  COSTA,
  ENDPOINTS,
  PLACES,
  RUTA2,
  TRIP_ZONES,
  chargeSpeed,
  chargeSpeedLabel,
  citiesInZone,
  endpointLabel,
  passes,
  roadKm,
  routeLine,
  routeName,
  type ChargeSpeed,
  type Place,
  type TripZone,
} from "@/data/corridor";
import { searchPlaces, type GeoHit } from "@/lib/geocode";

type Stop = { id: string; target: number };
type NoteStatus = "" | "disponible" | "ocupado" | "no-anda";
type ChargerNote = { status: NoteStatus; text: string };
type CustomRoute = { key: string; line: [number, number][]; km: number };

type Leg = {
  from: Place;
  to: Place;
  km: number;
  driveMin: number;
  arriveSoc: number | null;
  reachable: boolean;
  shortKm: number;
  chargeMin: number | null;
  chargeKwh: number;
  chargeCost: number;
  departSoc: number | null;
  full: boolean;
  fuelCost: number;
  powerLabel: string;
};

type Live = {
  stopIds: string;
  onRoute: string;
  originId: string;
  destId: string;
  knownStart: boolean;
  knownDest: boolean;
  active: string;
  route: [number, number][];
  circleKm: number;
  circleSoc: number;
  lat: number;
  lng: number;
  notes: string;
  customStart: { lat: number; lng: number; name: string } | null;
  customDest: { lat: number; lng: number; name: string } | null;
};

const NOTES_KEY = "mielectrico-charger-notes-v1";
const STATUSES: { id: NoteStatus; label: string }[] = [
  { id: "disponible", label: "Disponible" },
  { id: "ocupado", label: "Ocupado" },
  { id: "no-anda", label: "No anda" },
];

const fieldClass =
  "h-11 w-full rounded-full border border-white/20 bg-white/10 px-3 text-sm text-ice outline-none backdrop-blur-sm transition focus:border-bolt";

const BOLT_PATH = "M13 2 3 14h9l-1 8 10-12h-9l1-8z";

function byId(id: string) {
  const found = PLACES.find((place) => place.id === id);
  if (!found) throw new Error(id);
  return found;
}

function minutes(value: number) {
  const total = Math.max(0, Math.round(value));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
}

function placeLabel(place: Place) {
  return endpointLabel(place.id) ?? place.name;
}

function shortPlace(label: string) {
  const cut = label.split(",")[0]?.trim() || label;
  return cut.length > 42 ? `${cut.slice(0, 40)}…` : cut;
}

function pointKey(pin: GeoHit | null, id: string) {
  if (pin) return `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;
  const place = byId(id);
  return `${place.lat.toFixed(5)},${place.lng.toFixed(5)}`;
}

function endPlace(pin: GeoHit | null, id: string, role: "origin" | "destination"): Place {
  if (!pin) return byId(id);
  return {
    id: role === "origin" ? "addr-o" : "addr-d",
    name: shortPlace(pin.label),
    detail: pin.label,
    lat: pin.lat,
    lng: pin.lng,
    km: 0,
    branch: "ruta2",
    role,
    acKw: null,
    dcKw: null,
    powerNote: "",
    source: "Nominatim / OpenStreetMap",
    sourceUrl: "https://nominatim.openstreetmap.org/",
  };
}

function lineFeature(points: [number, number][]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: points.map(([lat, lng]) => [lng, lat]),
    },
  };
}

function rangeRing(lat: number, lng: number, km: number) {
  if (km < 1) return { type: "FeatureCollection" as const, features: [] };
  const earth = 6371;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const delta = km / earth;
  const coordinates: [number, number][] = [];
  for (let step = 0; step <= 72; step += 1) {
    const bearing = (step / 72) * Math.PI * 2;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(bearing));
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(delta) * Math.cos(lat1),
        Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2),
      );
    coordinates.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Polygon" as const, coordinates: [coordinates] },
      },
    ],
  };
}

function chargerPower(place: Place, car: CarModel, assumeKw: number) {
  if (place.dcKw && car.chargeDcKw) {
    return { kw: Math.min(place.dcKw, car.chargeDcKw), assumed: false, label: "el menor entre el punto y el auto" };
  }
  if (place.dcKw) return { kw: place.dcKw, assumed: false, label: "kW del punto. El auto no publica tope DC" };
  if (place.acKw && car.chargeAcKw) {
    return { kw: Math.min(place.acKw, car.chargeAcKw), assumed: false, label: "carga AC" };
  }
  if (place.acKw) return { kw: place.acKw, assumed: false, label: "AC del punto" };
  if (car.chargeDcKw) return { kw: car.chargeDcKw, assumed: true, label: "el punto no publica kW: uso el DC del auto" };
  return { kw: assumeKw, assumed: true, label: "supuesto: ni el punto ni el auto publican kW" };
}

function noteMark(sig: string, id: string) {
  const row = sig.split("|").find((item) => item.startsWith(`${id}:`));
  const status = row?.slice(id.length + 1);
  if (status === "disponible") return " noted-ok";
  if (status === "ocupado") return " noted-busy";
  if (status === "no-anda") return " noted-no";
  return "";
}

function parseNotes(raw: string | null) {
  if (!raw) return {} as Record<string, ChargerNote>;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return {};
    const out: Record<string, ChargerNote> = {};
    for (const [id, value] of Object.entries(data)) {
      if (!value || typeof value !== "object") continue;
      const status = (value as { status?: unknown }).status;
      const text = (value as { text?: unknown }).text;
      const ok = status === "disponible" || status === "ocupado" || status === "no-anda" || status === "";
      if (!ok || typeof text !== "string") continue;
      if (!status && !text.trim()) continue;
      out[id] = { status, text: text.slice(0, 280) };
    }
    return out;
  } catch {
    return {};
  }
}

function planTrip(input: {
  car: CarModel;
  start: Place;
  dest: Place;
  stops: Stop[];
  startSoc: number;
  factor: number;
  speed: number;
  kwhPrice: number;
  fuelPrice: number;
  assumeKw: number;
  fuelGuess: number;
  kmOf: (a: Place, b: Place) => number;
  onRoute: (place: Place) => boolean;
}) {
  const { car, start, dest, stops, startSoc, factor, speed, kwhPrice, fuelPrice, assumeKw, fuelGuess, kmOf, onRoute } = input;
  const electric = electricKwhPer100(car);
  const kwh100 = electric ? electric.value * factor : null;
  const plugs = plugsIn(car.kind) && Boolean(car.batteryKwh);
  const ordered = stops
    .map((stop) => {
      const place = PLACES.find((item) => item.id === stop.id);
      return place ? { ...stop, place } : null;
    })
    .filter((stop): stop is Stop & { place: Place } => Boolean(stop && onRoute(stop.place)))
    .sort((a, b) => kmOf(start, a.place) - kmOf(start, b.place));
  const chain = [start, ...ordered.map((stop) => stop.place), dest];
  const targets = new Map(ordered.map((stop) => [stop.id, stop.target]));
  let soc = plugs ? startSoc : null;
  let blocked = false;
  const legs: Leg[] = [];

  for (let index = 1; index < chain.length; index += 1) {
    const from = chain[index - 1];
    const to = chain[index];
    const km = Math.max(0, kmOf(from, to));
    const driveMin = (km / Math.max(40, speed)) * 60;
    let arriveSoc: number | null = soc;
    let reachable = !blocked;
    let shortKm = 0;
    let fuelL = 0;

    if (blocked) {
      arriveSoc = null;
      reachable = false;
    } else if (car.kind === "ev" && car.batteryKwh && kwh100 && soc !== null) {
      const need = (km / 100) * kwh100;
      const have = (soc / 100) * car.batteryKwh;
      if (need > have + 0.05) {
        reachable = false;
        blocked = true;
        arriveSoc = 0;
        shortKm = Math.max(0, km - have / (kwh100 / 100));
      } else {
        arriveSoc = ((have - need) / car.batteryKwh) * 100;
        soc = arriveSoc;
      }
    } else if (car.kind === "phev" && car.batteryKwh && kwh100 && soc !== null) {
      const have = (soc / 100) * car.batteryKwh;
      const evKm = Math.min(km, have / (kwh100 / 100));
      fuelL = ((km - evKm) / 100) * (car.fuelLPer100 ?? fuelGuess);
      arriveSoc = ((have - evKm * (kwh100 / 100)) / car.batteryKwh) * 100;
      soc = arriveSoc;
    } else if (car.kind !== "ev") {
      fuelL = (km / 100) * (car.fuelLPer100 ?? fuelGuess);
      arriveSoc = null;
    } else {
      reachable = false;
      blocked = true;
      arriveSoc = null;
    }

    let chargeMin: number | null = null;
    let chargeKwh = 0;
    let chargeCost = 0;
    let departSoc = soc;
    let full = false;
    let powerLabel = "";
    if (to.id !== dest.id && targets.has(to.id) && reachable && plugs && car.batteryKwh && soc !== null) {
      const target = Math.min(100, Math.max(soc, targets.get(to.id) ?? soc));
      chargeKwh = ((target - soc) / 100) * car.batteryKwh;
      const power = chargerPower(to, car, assumeKw);
      powerLabel = power.label;
      chargeMin = power.kw > 0 ? (chargeKwh / power.kw) * 60 : null;
      chargeCost = chargeKwh * kwhPrice;
      departSoc = target;
      soc = target;
      full = target >= 99.5;
    }

    legs.push({
      from,
      to,
      km,
      driveMin,
      arriveSoc,
      reachable,
      shortKm,
      chargeMin,
      chargeKwh,
      chargeCost,
      departSoc,
      full,
      fuelCost: fuelL * fuelPrice,
      powerLabel,
    });
  }

  return { legs, electric, plugs, kwh100 };
}

function BoltIcon({ kind }: { kind: ChargeSpeed }) {
  const color = kind === "fast" ? "text-fast" : kind === "slow" ? "text-slow" : "text-mist";
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 ${color}`} aria-hidden="true">
      <path fill="currentColor" d={BOLT_PATH} />
    </svg>
  );
}

function AddressBox({
  placeholder,
  query,
  onQuery,
  onPick,
}: {
  placeholder: string;
  query: string;
  onQuery: (value: string) => void;
  onPick: (hit: GeoHit) => void;
}) {
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [status, setStatus] = useState<"" | "busca" | "vacio" | "error">("");
  const locked = useRef("");

  useEffect(() => {
    const q = query.trim();
    if (!q) locked.current = "";
    if (q.length < 3 || q === locked.current) {
      setHits([]);
      setStatus("");
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus("busca");
      searchPlaces({ data: { q } })
        .then((rows) => {
          if (ac.signal.aborted) return;
          setHits(rows);
          setStatus(rows.length ? "" : "vacio");
        })
        .catch(() => {
          if (ac.signal.aborted) return;
          setHits([]);
          setStatus("error");
        });
    }, 450);
    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="mt-1">
      <input
        className={fieldClass}
        value={query}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        maxLength={120}
        onChange={(event) => onQuery(event.target.value)}
      />
      {status === "busca" ? <p className="mt-1 text-xs text-white/60">Buscando…</p> : null}
      {status === "vacio" ? <p className="mt-1 text-xs text-white/60">No encontré esa dirección en Argentina.</p> : null}
      {status === "error" ? <p className="mt-1 text-xs text-white/60">No pude buscar ahora. Probá de nuevo.</p> : null}
      {hits.length > 0 ? (
        <ul className="mt-1 max-h-36 overflow-y-auto rounded-2xl border border-white/15 bg-white/10">
          {hits.map((hit) => (
            <li key={`${hit.lat},${hit.lng}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-ice hover:bg-white/10"
                onClick={() => {
                  locked.current = hit.label;
                  setHits([]);
                  setStatus("");
                  onPick(hit);
                }}
              >
                {hit.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Battery({ soc, full }: { soc: number; full: boolean }) {
  const shown = Math.max(0, Math.min(100, soc));
  return (
    <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 ${full ? "bat-full border-emerald-300 text-emerald-300" : "border-bolt text-bolt"}`}>
      <span className="text-sm font-semibold">{num(shown, 0)}%</span>
    </div>
  );
}

export function TripPlanner() {
  const [carId, setCarId] = useState("dolphin-mini-gs");
  const [originId, setOriginId] = useState("caba");
  const [destId, setDestId] = useState("mdp");
  const [fromZone, setFromZone] = useState<TripZone>("costa");
  const [toZone, setToZone] = useState<TripZone>("costa");
  const [originPin, setOriginPin] = useState<GeoHit | null>(null);
  const [destPin, setDestPin] = useState<GeoHit | null>(null);
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [startSoc, setStartSoc] = useState(100);
  const [factor, setFactor] = useState(1);
  const [speed, setSpeed] = useState(90);
  const [kwhPrice, setKwhPrice] = useState(650);
  const [fuelPrice, setFuelPrice] = useState(2500);
  const [assumeKw, setAssumeKw] = useState(40);
  const [fuelGuess, setFuelGuess] = useState(6);
  const [stops, setStops] = useState<Stop[]>([{ id: "puma-dolores", target: 80 }]);
  const [active, setActive] = useState("puma-dolores");
  const [notes, setNotes] = useState<Record<string, ChargerNote> | null>(null);
  const [custom, setCustom] = useState<CustomRoute | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const mapNode = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const notesReady = useRef(false);
  const live = useRef<Live>(null!);
  const actions = useRef({ pick: (_id: string) => {}, aim: (_id: string) => {} });

  const car = MODELS.find((item) => item.id === carId) ?? MODELS[1];
  const originTown = byId(originId);
  const destTown = byId(destId);
  const corridorPair = !originPin && !destPin && originTown.branch !== "off" && destTown.branch !== "off";
  const customKey = `${pointKey(originPin, originId)}|${pointKey(destPin, destId)}`;

  const routeModel = useMemo(() => {
    if (!corridorPair) {
      if (!custom || custom.key !== customKey) return null;
      const start = endPlace(originPin, originId, "origin");
      const dest = endPlace(destPin, destId, "destination");
      const found = chargersOnLine(custom.line, custom.km);
      const table = new Map<string, number>([
        [start.id, 0],
        [dest.id, custom.km],
      ]);
      for (const item of found) table.set(item.place.id, item.alongKm);
      const kmOf = (a: Place, b: Place) => {
        const left = table.get(a.id);
        const right = table.get(b.id);
        if (left === undefined || right === undefined) return 0;
        return Math.abs(left - right);
      };
      return {
        start,
        dest,
        line: custom.line,
        name: "Camino por calles",
        custom: true,
        chargers: found.map((item) => item.place),
        kmOf,
        note:
          found.length > 0
            ? "Solo marco cargadores ya verificados, a menos de 2,5 km de este camino."
            : "En este camino no hay cargadores verificados. No invento otros.",
      };
    }
    const start = byId(originId);
    const dest = byId(destId);
    const chargers = PLACES.filter((place) => passes(place, start, dest)).sort(
      (a, b) => roadKm(start, a) - roadKm(start, b),
    );
    return {
      start,
      dest,
      line: routeLine(start, dest),
      name: routeName(start, dest),
      custom: false,
      chargers,
      kmOf: roadKm,
      note: "Kilómetros de ruta del corredor, no el odómetro del auto.",
    };
  }, [corridorPair, custom, customKey, originId, destId, originPin, destPin]);

  const plan = useMemo(() => {
    if (!routeModel) return null;
    return planTrip({
      car,
      start: routeModel.start,
      dest: routeModel.dest,
      stops,
      startSoc,
      factor,
      speed,
      kwhPrice,
      fuelPrice,
      assumeKw,
      fuelGuess,
      kmOf: routeModel.kmOf,
      onRoute: (place) => routeModel.chargers.some((item) => item.id === place.id),
    });
  }, [routeModel, car, stops, startSoc, factor, speed, kwhPrice, fuelPrice, assumeKw, fuelGuess]);

  const allowedKey = routeModel ? routeModel.chargers.map((item) => item.id).join("|") : null;
  useEffect(() => {
    if (allowedKey === null) return;
    const allowed = new Set(allowedKey.split("|").filter(Boolean));
    setStops((current) => {
      const next = current.filter((stop) => allowed.has(stop.id));
      return next.length === current.length ? current : next;
    });
  }, [allowedKey]);

  useEffect(() => {
    if (!routeModel) return;
    const known = stops.some((stop) => stop.id === active) || active === routeModel.dest.id;
    if (known) return;
    setActive(stops[0]?.id ?? routeModel.dest.id);
  }, [stops, routeModel, active]);

  useEffect(() => {
    setNotes(parseNotes(localStorage.getItem(NOTES_KEY)));
    notesReady.current = true;
  }, []);

  useEffect(() => {
    if (!notesReady.current || !notes) return;
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    if (!originPin && !destPin && byId(originId).branch !== "off" && byId(destId).branch !== "off") {
      setCustom(null);
      setRouteError(null);
      setRouting(false);
      return;
    }
    const start = originPin ?? { label: byId(originId).name, lat: byId(originId).lat, lng: byId(originId).lng };
    const end = destPin ?? { label: byId(destId).name, lat: byId(destId).lat, lng: byId(destId).lng };
    if (Math.abs(start.lat - end.lat) < 0.0008 && Math.abs(start.lng - end.lng) < 0.0008) {
      setCustom(null);
      setRouting(false);
      setRouteError("Elegí una salida y un destino distintos.");
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), 12000);
    let cancel = false;
    setRouting(true);
    setRouteError(null);
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    fetch(url, { signal: ac.signal })
      .then((response) => {
        if (!response.ok) throw new Error("ruta");
        return response.json() as Promise<{ code?: string; routes?: { distance?: number; geometry?: { coordinates?: [number, number][] } }[] }>;
      })
      .then((body) => {
        if (cancel) return;
        const coords = body.routes?.[0]?.geometry?.coordinates;
        const meters = body.routes?.[0]?.distance;
        if (body.code !== "Ok" || !coords || coords.length < 2 || !meters) throw new Error("ruta");
        setCustom({
          key: `${start.lat.toFixed(5)},${start.lng.toFixed(5)}|${end.lat.toFixed(5)},${end.lng.toFixed(5)}`,
          line: coords.map(([lng, lat]) => [lat, lng]),
          km: meters / 1000,
        });
      })
      .catch(() => {
        if (cancel) return;
        setCustom(null);
        setRouteError("No pude trazar ese camino. Probá otra dirección.");
      })
      .finally(() => {
        if (!cancel) setRouting(false);
      });
    return () => {
      cancel = true;
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [originPin, destPin, originId, destId]);

  function rangeAt(soc: number | null) {
    if (!plan?.plugs || !car.batteryKwh || !plan.kwh100 || soc === null) return null;
    return ((soc / 100) * car.batteryKwh) / (plan.kwh100 / 100);
  }

  function arriveAfter(soc: number, km: number) {
    if (!plan?.kwh100 || !car.batteryKwh) return null;
    const need = (km / 100) * plan.kwh100;
    const have = (soc / 100) * car.batteryKwh;
    if (need > have + 0.05) {
      return { ok: false as const, soc: 0, shortKm: Math.max(0, km - have / (plan.kwh100 / 100)) };
    }
    return { ok: true as const, soc: ((have - need) / car.batteryKwh) * 100, shortKm: 0 };
  }

  function chooseStart(id: string) {
    setOriginPin(null);
    setOriginQuery("");
    if (id === destId && !destPin) setDestId(originId);
    setOriginId(id);
  }

  function chooseDest(id: string) {
    setDestPin(null);
    setDestQuery("");
    if (id === originId && !originPin) setOriginId(destId);
    setDestId(id);
    setActive(id);
  }

  function focusStop(id: string) {
    window.requestAnimationFrame(() => {
      const card = document.getElementById(`stop-${id}`);
      const panel = panelRef.current;
      if (!card || !panel) return;
      panel.scrollTo({ top: Math.max(0, card.offsetTop - 96), behavior: "smooth" });
    });
  }

  function pickCharger(id: string) {
    setActive(id);
    setStops((current) => (current.some((stop) => stop.id === id) ? current : [...current, { id, target: 80 }]));
    focusStop(id);
  }

  function removeStop(id: string) {
    setStops((current) => current.filter((stop) => stop.id !== id));
    setActive((current) => (current === id ? destId : current));
  }

  function setTarget(id: string, target: number) {
    setActive(id);
    setStops((current) => current.map((stop) => (stop.id === id ? { ...stop, target } : stop)));
  }

  function saveNote(id: string, note: ChargerNote) {
    setNotes((current) => {
      const base = { ...(current ?? {}) };
      if (!note.status && !note.text.trim()) {
        delete base[id];
        return base;
      }
      base[id] = { status: note.status, text: note.text.slice(0, 280) };
      return base;
    });
  }

  const activeLeg = plan?.legs.find((leg) => leg.to.id === active && stops.some((stop) => stop.id === leg.to.id));
  const usable = activeLeg?.reachable ? activeLeg : null;
  const circlePlace = usable?.to ?? routeModel?.start ?? byId("caba");
  const circleSoc = usable?.departSoc ?? (plan?.plugs ? startSoc : null);
  const circleKm = rangeAt(circleSoc);
  const notesSig = notes
    ? Object.entries(notes)
        .map(([id, note]) => `${id}:${note.status}`)
        .sort()
        .join("|")
    : "";

  live.current = {
    stopIds: stops.map((stop) => stop.id).join(","),
    onRoute: routeModel?.chargers.map((place) => place.id).join(",") ?? "",
    originId,
    destId,
    knownStart: !originPin,
    knownDest: !destPin,
    active,
    route: routeModel?.line ?? [],
    circleKm: circleKm ?? 0,
    circleSoc: circleSoc ?? 0,
    lat: circlePlace.lat,
    lng: circlePlace.lng,
    notes: notesSig,
    customStart: originPin ? { lat: originPin.lat, lng: originPin.lng, name: shortPlace(originPin.label) } : null,
    customDest: destPin ? { lat: destPin.lat, lng: destPin.lng, name: shortPlace(destPin.label) } : null,
  };

  actions.current = {
    pick: pickCharger,
    aim: (id: string) => {
      const now = live.current;
      if (now.knownStart && now.knownDest && id === now.originId) {
        setOriginId(now.destId);
        setOriginQuery("");
      }
      setDestPin(null);
      setDestQuery("");
      setDestId(id);
      setActive(id);
    },
  };

  useEffect(() => {
    const node = mapNode.current;
    if (!node) return;
    let dead = false;
    let markerSig = "";
    let routeSig = "";
    let onRedraw: (() => void) | null = null;
    const markers: Marker[] = [];
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (dead || !mapNode.current) return;
      maplibregl.setWorkerUrl(maplibreWorkerUrl);
      const map = new maplibregl.Map({
        container: mapNode.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [-57.95, -36.4],
        zoom: 6,
        scrollZoom: true,
        cooperativeGestures: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: { compact: true },
      }) as MlMap;
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        if (dead) return;
        map.addSource("range", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "range-fill",
          type: "fill",
          source: "range",
          paint: { "fill-color": "#3ec6ff", "fill-opacity": 0.14 },
        });
        map.addLayer({
          id: "range-line",
          type: "line",
          source: "range",
          paint: { "line-color": "#3ec6ff", "line-width": 2 },
        });
        map.addSource("ruta", { type: "geojson", data: lineFeature(RUTA2) });
        map.addLayer({
          id: "ruta",
          type: "line",
          source: "ruta",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#5b7c99", "line-width": 3, "line-opacity": 0.55 },
        });
        map.addSource("costa", { type: "geojson", data: lineFeature(COSTA) });
        map.addLayer({
          id: "costa",
          type: "line",
          source: "costa",
          paint: { "line-color": "#5b7c99", "line-width": 3, "line-opacity": 0.7, "line-dasharray": [1.2, 1.4] },
        });
        map.addSource("active", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "active",
          type: "line",
          source: "active",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#0b63ce", "line-width": 5 },
        });
        const draw = () => {
          const now = live.current;
          const full = now.circleSoc >= 99.5;
          const color = full ? "#34d399" : "#3ec6ff";
          (map.getSource("range") as GeoJSONSource | undefined)?.setData(rangeRing(now.lat, now.lng, now.circleKm));
          map.setPaintProperty("range-fill", "fill-color", color);
          map.setPaintProperty("range-line", "line-color", color);
          const activeSource = map.getSource("active") as GeoJSONSource | undefined;
          activeSource?.setData(
            now.route.length >= 2
              ? { type: "FeatureCollection", features: [lineFeature(now.route)] }
              : { type: "FeatureCollection", features: [] },
          );
          const nextRoute = `${now.customStart ? `${now.customStart.lat.toFixed(4)},${now.customStart.lng.toFixed(4)}` : now.originId}|${now.customDest ? `${now.customDest.lat.toFixed(4)},${now.customDest.lng.toFixed(4)}` : now.destId}|${now.route.length}`;
          if (nextRoute !== routeSig && now.route.length >= 2) {
            routeSig = nextRoute;
            const bounds = new maplibregl.LngLatBounds();
            for (const [lat, lng] of now.route) bounds.extend([lng, lat]);
            const wide = node.clientWidth >= 768;
            map.fitBounds(bounds, {
              padding: wide
                ? { top: 40, bottom: 40, left: 430, right: 48 }
                : { top: 28, bottom: Math.round(node.clientHeight * 0.64), left: 16, right: 16 },
              maxZoom: 13,
            });
          } else if (nextRoute !== routeSig) {
            routeSig = nextRoute;
          }
          const sig = `${nextRoute}|${now.active}|${now.stopIds}|${now.onRoute}|${now.notes}|${now.knownStart}|${now.knownDest}|${now.customStart?.lng ?? ""}|${now.customDest?.lng ?? ""}`;
          if (sig === markerSig) return;
          markerSig = sig;
          markers.splice(0).forEach((marker) => marker.remove());
          const onRoute = new Set(now.onRoute.split(",").filter(Boolean));
          const picked = new Set(now.stopIds.split(",").filter(Boolean));
          const boltSvg = (cls: string) => {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 24 24");
            svg.setAttribute("class", cls);
            svg.setAttribute("aria-hidden", "true");
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("fill", "currentColor");
            path.setAttribute("d", BOLT_PATH);
            svg.append(path);
            return svg;
          };
          const addMarker = (lng: number, lat: number, element: HTMLElement) => {
            markers.push(new maplibregl.Marker({ element, anchor: "center" }).setLngLat([lng, lat]).addTo(map));
          };
          for (const place of PLACES) {
            const isStart = now.knownStart && place.id === now.originId;
            const isDest = now.knownDest && place.id === now.destId;
            const speed = chargeSpeed(place);
            const on = onRoute.has(place.id);
            const selected = picked.has(place.id);
            const pin = document.createElement("button");
            pin.type = "button";
            if (isStart || !speed) {
              pin.className = `map-pin${isStart ? " start" : ""}${!isStart && isDest ? " on" : ""}${
                place.role === "charger" && !on && !isDest ? " dim" : ""
              }`;
            } else {
              pin.className = `map-bolt ${speed}${selected ? " picked" : ""}${!on && !isDest ? " dim" : ""}${noteMark(now.notes, place.id)}`;
              const core = document.createElement("span");
              core.className = "bolt-core";
              core.append(boltSvg("bolt-spark"), boltSvg("bolt-body"));
              pin.append(core);
            }
            const speedName = chargeSpeedLabel(speed);
            pin.title = speed ? `${place.name}. ${speedName}${on || isDest ? "" : ". Fuera de este camino"}` : place.name;
            pin.setAttribute("aria-label", pin.title);
            if (isStart || isDest || place.id === now.active) {
              const label = document.createElement("span");
              label.className = "pin-label";
              label.textContent = endpointLabel(place.id) ?? place.name;
              pin.append(label);
            }
            pin.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              const current = live.current;
              const along = new Set(current.onRoute.split(",").filter(Boolean));
              if (place.role === "charger" && along.has(place.id) && place.id !== current.originId && place.id !== current.destId) {
                actions.current.pick(place.id);
                return;
              }
              if (!ENDPOINTS.some((item) => item.id === place.id)) return;
              if (current.knownDest && place.id === current.destId) return;
              actions.current.aim(place.id);
            });
            addMarker(place.lng, place.lat, pin);
          }
          for (const end of [now.customStart ? { ...now.customStart, role: "start" as const } : null, now.customDest ? { ...now.customDest, role: "dest" as const } : null]) {
            if (!end) continue;
            const pin = document.createElement("button");
            pin.type = "button";
            pin.className = end.role === "start" ? "map-pin start" : "map-pin on";
            pin.title = end.name;
            const label = document.createElement("span");
            label.className = "pin-label";
            label.textContent = end.name;
            pin.append(label);
            addMarker(end.lng, end.lat, pin);
          }
        };
        draw();
        onRedraw = draw;
        node.addEventListener("trip-redraw", draw);
        map.resize();
      });
    })();
    return () => {
      dead = true;
      if (onRedraw) node.removeEventListener("trip-redraw", onRedraw);
      markers.forEach((marker) => marker.remove());
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const redrawKey = [
    live.current.stopIds,
    live.current.onRoute,
    live.current.active,
    live.current.circleKm.toFixed(1),
    live.current.circleSoc.toFixed(1),
    live.current.lat.toFixed(4),
    live.current.lng.toFixed(4),
    live.current.notes,
    live.current.route.length,
    live.current.knownStart,
    live.current.knownDest,
    originPin?.lat ?? "",
    destPin?.lat ?? "",
    originId,
    destId,
  ].join("~");

  useEffect(() => {
    mapNode.current?.dispatchEvent(new Event("trip-redraw"));
  }, [redrawKey]);

  const last = plan?.legs[plan.legs.length - 1];
  const canFinish = Boolean(last?.reachable);
  const stopLegs = plan?.legs.filter((leg) => stops.some((stop) => stop.id === leg.to.id)) ?? [];
  let driveMin = 0;
  let ranOut = false;
  for (const leg of plan?.legs ?? []) {
    if (ranOut) break;
    driveMin += leg.driveMin;
    if (!leg.reachable) ranOut = true;
  }
  const chargeMin = (plan?.legs ?? []).reduce((sum, leg) => sum + (leg.reachable ? (leg.chargeMin ?? 0) : 0), 0);
  const energyCost = (plan?.legs ?? []).reduce((sum, leg) => sum + leg.chargeCost + leg.fuelCost, 0);
  const totalKm = routeModel ? routeModel.kmOf(routeModel.start, routeModel.dest) : 0;
  const failed = plan?.legs.find((leg) => !leg.reachable);
  const destSoc = canFinish ? last?.arriveSoc ?? null : null;
  const fromName = routeModel ? placeLabel(routeModel.start) : "Salida";
  const toName = routeModel ? placeLabel(routeModel.dest) : "Destino";

  function gapText(km: number) {
    return km > 0.5 ? `Te faltan ${num(km, 0)} km. ` : "";
  }

  let verdict = "Trazando el camino…";
  if (routeError) verdict = routeError;
  else if (plan && car.kind === "ev" && !car.batteryKwh) verdict = "Sin batería publicada no calculo si llegás.";
  else if (plan && !plan.plugs) verdict = `A nafta, sin enchufar. ${num(totalKm, 0)} km.`;
  else if (plan && canFinish && destSoc !== null && car.kind === "phev" && destSoc < 1) verdict = `Llegás a ${toName}. La batería se acaba y seguís a nafta.`;
  else if (plan && canFinish && destSoc !== null) verdict = `Llegás a ${toName} con ${num(destSoc, 0)}%`;
  else if (plan && failed && failed.to.id === routeModel?.dest.id) {
    const gap = gapText(failed.shortKm);
    if (stops.length) verdict = `${gap}Con esta carga no alcanza: te falta una parada más.`;
    else if ((routeModel?.chargers.length ?? 0) === 0) verdict = `${gap}No llegás directo y este camino no tiene un cargador verificado.`;
    else verdict = `${gap}No llegás directo. Tocá un rayo del mapa para cargar.`;
  } else if (plan && failed) verdict = `${gapText(failed.shortKm)}Ni llegás a ${placeLabel(failed.to)}. Elegí una parada anterior.`;

  return (
    <section id="viaje" className="scroll-mt-14 border-t border-line bg-night">
      <div className="trip-map trip-stage">
        <div ref={mapNode} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 z-10">
          <div
            ref={panelRef}
            className="trip-glass pointer-events-auto absolute inset-x-3 bottom-3 max-h-[64%] overflow-y-auto overscroll-contain rounded-3xl p-3 text-ice md:inset-y-3 md:right-auto md:left-3 md:w-96 md:max-h-none"
          >
            <div className="sticky top-0 z-10 -mx-3 mb-3 border-b border-white/10 bg-night/80 px-3 py-3 backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs tracking-wide text-white/70 uppercase">Al destino</p>
                  <p className={`font-display text-2xl font-semibold ${plan && !canFinish && plan.plugs ? "text-slow" : "text-ice"}`}>{verdict}</p>
                  {plan ? (
                    <p className="text-xs text-white/70">
                      {fromName} → {toName} · {num(totalKm, 0)} km · {minutes(driveMin)}
                      {chargeMin > 0 ? ` + ${minutes(chargeMin)} de carga` : ""} · {ars(Math.round(energyCost))}
                    </p>
                  ) : null}
                </div>
                {plan?.plugs && destSoc !== null ? <Battery soc={destSoc} full={destSoc >= 99.5} /> : null}
              </div>
              {plan?.plugs ? (
                <p className="mt-2 text-xs text-white/75">
                  Salida {startSoc}%
                  {stopLegs.map((leg) => (
                    <span key={leg.to.id}>
                      {" → "}
                      {placeLabel(leg.to)}{" "}
                      {leg.reachable && leg.arriveSoc !== null ? `${num(leg.arriveSoc, 0)}→${num(leg.departSoc ?? leg.arriveSoc, 0)}%` : "no llega"}
                    </span>
                  ))}
                  {" → "}
                  {toName} {canFinish && destSoc !== null ? `${num(destSoc, 0)}%` : "no llega"}
                </p>
              ) : null}
            </div>

            <p className="text-xs text-white/70">Salís de</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {TRIP_ZONES.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => setFromZone(zone.id)}
                  className={`h-9 rounded-full px-3 text-xs ${fromZone === zone.id ? "bg-white/25 text-ice" : "bg-white/10 text-white/70"}`}
                >
                  {zone.label}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {citiesInZone(fromZone).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseStart(item.id)}
                  className={`h-11 rounded-full px-3 text-sm ${!originPin && originId === item.id ? "bg-bolt text-night" : "bg-white/10 text-ice"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <AddressBox
              placeholder="O una dirección de salida"
              query={originQuery}
              onQuery={(value) => {
                setOriginQuery(value);
                if (!value.trim()) setOriginPin(null);
              }}
              onPick={(hit) => {
                setOriginPin(hit);
                setOriginQuery(hit.label);
              }}
            />

            <p className="mt-3 text-xs text-white/70">Vas a</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {TRIP_ZONES.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => setToZone(zone.id)}
                  className={`h-9 rounded-full px-3 text-xs ${toZone === zone.id ? "bg-white/25 text-ice" : "bg-white/10 text-white/70"}`}
                >
                  {zone.label}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {citiesInZone(toZone).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseDest(item.id)}
                  className={`h-11 rounded-full px-3 text-sm ${!destPin && destId === item.id ? "bg-bolt text-night" : "bg-white/10 text-ice"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {!destPin ? (
              <p className="mt-1 text-xs text-white/60">
                {chargersNear(destId).length > 0
                  ? `${endpointLabel(destId) ?? destTown.name}: ${chargersNear(destId).length} cargador${chargersNear(destId).length === 1 ? "" : "es"} verificado${chargersNear(destId).length === 1 ? "" : "s"} en el pueblo.`
                  : `${endpointLabel(destId) ?? destTown.name}: el listado de octubre 2026 no publica un cargador en el pueblo.`}
              </p>
            ) : null}
            <AddressBox
              placeholder="O una dirección de destino"
              query={destQuery}
              onQuery={(value) => {
                setDestQuery(value);
                if (!value.trim()) setDestPin(null);
              }}
              onPick={(hit) => {
                setDestPin(hit);
                setDestQuery(hit.label);
              }}
            />

            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/75">
              <span className="inline-flex items-center gap-1"><BoltIcon kind="fast" /> rápida</span>
              <span className="inline-flex items-center gap-1"><BoltIcon kind="slow" /> lenta</span>
              <span className="inline-flex items-center gap-1"><BoltIcon kind="unknown" /> sin kW publicado</span>
            </p>
            {routeModel ? (
              <p className="mt-1 text-xs text-white/60">
                {routeModel.name} · {routeModel.chargers.length} cargadores en el camino. {routeModel.note}
              </p>
            ) : routing ? (
              <p className="mt-1 text-xs text-white/60">Trazando el camino…</p>
            ) : null}

            <label className="mt-3 block text-sm">
              <span className="text-white/70">Auto</span>
              <select className={`${fieldClass} mt-1`} value={carId} onChange={(event) => setCarId(event.target.value)}>
                {[...new Set(MODELS.map((item) => item.brand))].sort((a, b) => a.localeCompare(b, "es")).map((brand) => (
                  <optgroup key={brand} label={brand}>
                    {MODELS.filter((item) => item.brand === brand).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            {plan?.plugs ? (
              <label className="mt-3 block text-sm">
                Salís de {fromName} con {startSoc}%
                <input
                  className="mt-1 h-8 w-full accent-bolt"
                  type="range"
                  min={10}
                  max={100}
                  value={startSoc}
                  onChange={(event) => setStartSoc(Number(event.target.value))}
                />
                <span className="mt-1 block text-xs text-white/65">
                  Autonomía al salir: {rangeAt(startSoc) !== null ? `${num(rangeAt(startSoc) ?? 0, 0)} km` : "sin dato"}.
                  {plan.electric ? ` ${plan.electric.basis}.` : ""}
                </span>
              </label>
            ) : null}

            {plan?.plugs
              ? stopLegs.map((leg) => {
                  const speed = chargeSpeed(leg.to);
                  const chosen = stops.find((stop) => stop.id === leg.to.id);
                  const arriveFloor = Math.min(100, Math.max(0, Math.ceil(leg.arriveSoc ?? 0)));
                  const sliderValue = Math.min(100, Math.max(arriveFloor, chosen?.target ?? arriveFloor));
                  const depart = leg.departSoc;
                  const range = depart !== null ? rangeAt(depart) : null;
                  const toDest = routeModel ? routeModel.kmOf(leg.to, routeModel.dest) : 0;
                  const after = leg.reachable && depart !== null ? arriveAfter(depart, toDest) : null;
                  const open = active === leg.to.id;
                  const note = notes?.[leg.to.id];
                  const statusLabel = STATUSES.find((item) => item.id === note?.status)?.label;
                  return (
                    <article key={leg.to.id} id={`stop-${leg.to.id}`} className={`mt-3 rounded-2xl border p-3 ${open ? "border-white/35 bg-white/10" : "border-white/15"}`}>
                      <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setActive(leg.to.id)}>
                        <BoltIcon kind={speed ?? "unknown"} />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{leg.to.name}</span>
                          <span className="block text-xs text-white/65">
                            {chargeSpeedLabel(speed)} · {num(leg.km, 0)} km desde {placeLabel(leg.from)}
                          </span>
                        </span>
                      </button>
                      {!leg.reachable || leg.arriveSoc === null ? (
                        <p className="mt-2 text-sm text-slow">
                          {gapText(leg.shortKm)}No llegás a esta parada. Salí con más batería o elegí una parada anterior.
                        </p>
                      ) : (
                        <>
                          <p className="mt-2 text-sm">
                            Llegás con <span className="font-semibold">{num(leg.arriveSoc, 0)}%</span> desde {placeLabel(leg.from)}.
                          </p>
                          <label className="mt-1 block text-sm">
                            Cargar hasta {sliderValue}%
                            <input
                              className="mt-1 h-8 w-full accent-bolt"
                              type="range"
                              min={arriveFloor}
                              max={100}
                              value={sliderValue}
                              onChange={(event) => setTarget(leg.to.id, Number(event.target.value))}
                            />
                          </label>
                          <p className="mt-1 text-sm">
                            Salís de acá con {num(depart ?? sliderValue, 0)}%
                            {range !== null ? ` · ${num(range, 0)} km de autonomía` : ""}. Hasta {toName} hay {num(toDest, 0)} km.
                          </p>
                          {after?.ok ? (
                            <p className="mt-1 text-sm text-fast">Si no cargás de nuevo, llegás a {toName} con {num(after.soc, 0)}%.</p>
                          ) : after ? (
                            <p className="mt-1 text-sm text-slow">
                              {gapText(after.shortKm)}Si no cargás de nuevo, no llegás a {toName}. Te falta una parada más.
                            </p>
                          ) : null}
                          {leg.chargeKwh > 0 ? (
                            <p className="mt-1 text-xs text-white/70">
                              +{num(leg.chargeKwh, 1)} kWh · {leg.chargeMin !== null ? minutes(leg.chargeMin) : "sin kW"} · {ars(Math.round(leg.chargeCost))}
                              {leg.powerLabel ? ` · ${leg.powerLabel}` : ""}
                              {leg.full ? " · batería al 100%" : ""}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-white/60">Sin sumar energía: seguís con lo que llegaste.</p>
                          )}
                        </>
                      )}
                      {note && !open ? (
                        <p className="mt-2 text-xs text-white/70">
                          Tu marca: {statusLabel || "nota"}
                          {note.text ? ` · ${note.text}` : ""}
                        </p>
                      ) : null}
                      {open ? (
                        <div className="mt-2">
                          <p className="text-xs text-white/60">¿Cómo está ahora? Queda en este dispositivo. Todavía no es en vivo.</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {STATUSES.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={`h-11 rounded-full px-3 text-sm ${note?.status === item.id ? "bg-bolt text-night" : "bg-white/10 text-ice"}`}
                                onClick={() => saveNote(leg.to.id, { status: note?.status === item.id ? "" : item.id, text: note?.text ?? "" })}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                          <textarea
                            className="mt-2 w-full resize-none rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-ice outline-none"
                            rows={2}
                            maxLength={280}
                            placeholder="Lo que ves: fila, fuera de servicio, libre…"
                            value={note?.text ?? ""}
                            onChange={(event) => saveNote(leg.to.id, { status: note?.status ?? "", text: event.target.value })}
                          />
                        </div>
                      ) : null}
                      <button type="button" className="mt-2 text-xs text-white/70 underline" onClick={() => removeStop(leg.to.id)}>
                        Sacar esta parada
                      </button>
                    </article>
                  );
                })
              : null}

            {plan?.plugs && routeModel && routeModel.chargers.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {routeModel.chargers.map((place) => {
                  const on = stops.some((stop) => stop.id === place.id);
                  const speed = chargeSpeed(place) ?? "unknown";
                  return (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => pickCharger(place.id)}
                      className={`flex h-11 items-center gap-1 rounded-full px-3 text-sm ${on ? "bg-white/20 text-ice" : "bg-white/10 text-ice"}`}
                    >
                      <BoltIcon kind={speed} />
                      {place.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {plan?.plugs && stopLegs.length === 0 ? (
              <p className="mt-3 text-sm text-white/75">Tocá un rayo del mapa para elegir dónde parar. El verde es carga rápida y el naranja, lenta.</p>
            ) : null}
            {plan?.plugs && usable && circleKm !== null ? (
              <p className="mt-2 text-xs text-white/60">El círculo es la autonomía al salir de {placeLabel(usable.to)}, con la carga que elegiste.</p>
            ) : plan?.plugs && circleKm !== null ? (
              <p className="mt-2 text-xs text-white/60">El círculo es hasta dónde llegás con la batería de salida, antes de cargar.</p>
            ) : null}
            {car.kind !== "ev" && !car.fuelLPer100 ? (
              <p className="mt-2 text-xs text-white/60">La ficha no cierra el consumo. Uso {num(fuelGuess, 1)} L/100 hasta que lo cambies.</p>
            ) : null}

            <details className="mt-3 text-sm text-white/75">
              <summary className="cursor-pointer">Velocidad y precios</summary>
              <label className="mt-2 block text-ice">
                {factor === 1
                  ? "Gasta lo de la ficha"
                  : factor > 1
                    ? `Gasta ${num((factor - 1) * 100, 0)}% más que la ficha`
                    : `Gasta ${num((1 - factor) * 100, 0)}% menos que la ficha`}
                <input
                  className="mt-1 h-8 w-full accent-bolt"
                  type="range"
                  min={80}
                  max={160}
                  value={Math.round(factor * 100)}
                  onChange={(event) => setFactor(Number(event.target.value) / 100)}
                />
                <span className="mt-1 block text-xs text-white/60">
                  1 es la ficha o la prueba. Subilo si vas con frío, cargado o más rápido: en la ruta se gasta distinto.
                </span>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label>
                  Velocidad
                  <input className={fieldClass} type="number" min={40} max={130} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
                </label>
                <label>
                  $ el kWh
                  <input className={fieldClass} type="number" min={0} value={kwhPrice} onChange={(event) => setKwhPrice(Number(event.target.value))} />
                </label>
              </div>
              {car.kind !== "ev" ? (
                <label className="mt-2 block">
                  Nafta de tu zona
                  <input className={fieldClass} type="number" min={0} value={fuelPrice} onChange={(event) => setFuelPrice(Number(event.target.value))} />
                </label>
              ) : null}
              {car.kind !== "ev" && !car.fuelLPer100 ? (
                <label className="mt-2 block">
                  L/100 supuesto
                  <input className={fieldClass} type="number" step="0.1" min={1} value={fuelGuess} onChange={(event) => setFuelGuess(Number(event.target.value))} />
                </label>
              ) : null}
              {plan?.legs.some((leg) => leg.powerLabel.includes("supuesto")) ? (
                <label className="mt-2 block">
                  kW supuesto
                  <input className={fieldClass} type="number" min={1} value={assumeKw} onChange={(event) => setAssumeKw(Number(event.target.value))} />
                </label>
              ) : null}
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}
