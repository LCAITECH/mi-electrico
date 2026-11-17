import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BatteryCharging,
  Fuel,
  Gauge,
  MapPin,
  PlugZap,
  Scale,
  Ship,
  Wrench,
  Zap,
} from "lucide-react";
import {
  JURISDICTIONS,
  MODELS,
  ars,
  kindLabel,
  num,
  usd,
  type CarModel,
  type JurisdictionId,
} from "@/data/market";
import { TripPlanner } from "@/components/trip-planner";

const MAX = 3;

function useCount(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const startValue = from.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const eased = 1 - (1 - t) ** 3;
      const next = startValue + (value - startValue) * eased;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ice">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-5 text-mist">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "h-12 w-full rounded-xl border border-line bg-night px-3 text-base text-ice outline-none transition focus:border-bolt";

function priced(car: CarModel, usdRate: number) {
  if (car.priceArs) {
    const dollars = usdRate > 0 ? car.priceArs / usdRate : null;
    const official = car.priceUsd ? `Lista también ${usd(car.priceUsd)}. ` : "";
    return {
      primary: ars(car.priceArs),
      secondary: `${official}${dollars ? `${usd(dollars)} al dólar que cargaste` : car.priceSource}`,
    };
  }
  if (car.priceUsd) {
    const pesos = usdRate > 0 ? car.priceUsd * usdRate : null;
    return {
      primary: usd(car.priceUsd),
      secondary: pesos ? `${ars(pesos)} al dólar que cargaste · lista en USD` : "Lista oficial en dólares",
    };
  }
  return { primary: "Sin precio", secondary: car.priceSource };
}

function ModelCard({ car, usdRate }: { car: CarModel; usdRate: number }) {
  const money = priced(car, usdRate);
  const hasSpec = car.batteryKwh || car.rangeKm || car.chargeAcKw || car.chargeDcKw;
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-panel">
      {car.image ? (
        <img src={car.image} alt={`${car.brand} ${car.name}`} className="h-44 w-full object-cover" />
      ) : (
        <div className="grid h-44 place-items-center bg-panel-2 px-6 text-center text-sm text-mist">
          Sin foto verificada. No pongo una imagen parecida.
        </div>
      )}
      <div className="flex flex-col gap-4 p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-bolt uppercase">{car.brand}</p>
            <h3 className="font-display text-xl font-semibold text-ice">{car.name}</h3>
          </div>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-mist">{kindLabel(car.kind)}</span>
        </header>
        <p className="font-display text-2xl font-semibold text-ice">{money.primary}</p>
        <p className="text-sm text-mist">{money.secondary}</p>
        {hasSpec ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-panel-2 p-3">
              <dt className="text-mist">Batería</dt>
              <dd className="mt-1 font-medium">{car.batteryKwh ? `${num(car.batteryKwh, 1)} kWh` : "Sin dato"}</dd>
            </div>
            <div className="rounded-xl bg-panel-2 p-3">
              <dt className="text-mist">Autonomía</dt>
              <dd className="mt-1 font-medium">
                {car.rangeKm ? `${num(car.rangeKm)} km ${car.rangeCycle ?? ""}` : "Sin dato"}
              </dd>
            </div>
            <div className="rounded-xl bg-panel-2 p-3">
              <dt className="text-mist">Carga AC</dt>
              <dd className="mt-1 font-medium">{car.chargeAcKw ? `${num(car.chargeAcKw)} kW` : "Sin dato"}</dd>
            </div>
            <div className="rounded-xl bg-panel-2 p-3">
              <dt className="text-mist">Carga DC</dt>
              <dd className="mt-1 font-medium">{car.chargeDcKw ? `${num(car.chargeDcKw)} kW` : "Sin dato"}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-mist">Batería, autonomía y carga: sin dato verificado.</p>
        )}
        {car.fuelLPer100 ? (
          <p className="text-sm text-mist">
            Nafta: {num(car.fuelLPer100, 1)} L/100 km {car.fuelCycle ? `(${car.fuelCycle})` : ""}.
          </p>
        ) : null}
        {car.note ? <p className="text-sm text-mist">{car.note}</p> : null}
        <p className="text-xs leading-5 text-mist">
          Precio: {car.priceSource}. Ficha: {car.specSource}. Actualizado {car.updated}.{" "}
          <a className="text-bolt underline-offset-2 hover:underline" href={car.priceUrl} target="_blank" rel="noreferrer">
            Ver fuente
          </a>
        </p>
        {car.image ? <p className="text-xs text-mist">Foto del auto real, no es un dibujo.</p> : null}
      </div>
    </article>
  );
}

export function HomePage() {
  const [picked, setPicked] = useState<string[]>(["dolphin-mini-gs", "territory-hev", "tesla-y"]);
  const [filter, setFilter] = useState<"all" | "ev" | "hybrid">("all");
  const [zone, setZone] = useState<JurisdictionId>("CABA");
  const [km, setKm] = useState(1000);
  const [fuel, setFuel] = useState(2500);
  const [homeKwh, setHomeKwh] = useState(255);
  const [publicKwh, setPublicKwh] = useState(650);
  const [publicShare, setPublicShare] = useState(15);
  const [liters, setLiters] = useState(8);
  const [hybridLiters, setHybridLiters] = useState(5.5);
  const [kwh100, setKwh100] = useState(15.1);
  const [electricShare, setElectricShare] = useState(50);
  const [usdRate, setUsdRate] = useState(1500);
  const [brand, setBrand] = useState("");
  const [calcModel, setCalcModel] = useState("dolphin-mini-gs");
  const [ran, setRan] = useState(false);
  const [copied, setCopied] = useState(false);
  const [limitMsg, setLimitMsg] = useState("");

  const jurisdiction = JURISDICTIONS.find((item) => item.id === zone) ?? JURISDICTIONS[0];
  const model = MODELS.find((item) => item.id === calcModel) ?? MODELS[1];
  const plugs = model.kind === "ev" || model.kind === "phev";

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mielectrico-v1");
      if (!raw) return;
      const saved = JSON.parse(raw) as { zone?: JurisdictionId; fuel?: number };
      if (saved.zone) setZone(saved.zone);
      if (typeof saved.fuel === "number") setFuel(saved.fuel);
    } catch {
      /* ignore broken local data */
    }
  }, []);

  function applyZone(next: JurisdictionId) {
    const found = JURISDICTIONS.find((item) => item.id === next);
    setZone(next);
    if (!found) return;
    setFuel(found.fuelDefault);
    setHomeKwh(found.homeKwh);
    setPublicKwh(found.publicKwh);
  }

  function chooseModel(id: string) {
    setCalcModel(id);
    const found = MODELS.find((item) => item.id === id);
    if (found?.testKwhPer100) setKwh100(found.testKwhPer100);
    else if (found?.kind === "ev") setKwh100(15);
    if (found?.fuelLPer100) setHybridLiters(found.fuelLPer100);
  }

  function toggle(id: string) {
    setPicked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX) {
        setLimitMsg("Podés comparar hasta 3 modelos. Sacá uno para sumar otro.");
        return current;
      }
      setLimitMsg("");
      return [...current, id];
    });
  }

  const allBrands = [...new Set(MODELS.map((item) => item.brand))].sort((a, b) => a.localeCompare(b, "es"));
  const brands = [
    ...new Set(
      MODELS.filter((item) => {
        if (filter === "ev") return item.kind === "ev";
        if (filter === "hybrid") return item.kind !== "ev";
        return true;
      }).map((item) => item.brand),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));
  const brandOn = brands.includes(brand) ? brand : "";
  const visible = MODELS.filter((item) => {
    if (!brandOn || item.brand !== brandOn) return false;
    if (filter === "ev") return item.kind === "ev";
    if (filter === "hybrid") return item.kind !== "ev";
    return true;
  });
  const selected = picked
    .map((id) => MODELS.find((item) => item.id === id))
    .filter((item): item is CarModel => Boolean(item));

  const math = useMemo(() => {
    const share = Math.min(100, Math.max(0, publicShare)) / 100;
    const kwhPrice = homeKwh * (1 - share) + publicKwh * share;
    const gasMonth = (km / 100) * liters * fuel;
    const isPhev = model.kind === "phev";
    const electricKm = model.kind === "ev" ? km : isPhev ? km * (electricShare / 100) : 0;
    const fuelKm = km - electricKm;
    const altMonth = (electricKm / 100) * kwh100 * kwhPrice + (fuelKm / 100) * hybridLiters * fuel;
    return {
      kwhPrice,
      gasMonth,
      altMonth,
      monthSave: gasMonth - altMonth,
      yearSave: (gasMonth - altMonth) * 12,
      plugs,
      electricKm,
    };
  }, [publicShare, homeKwh, publicKwh, km, liters, fuel, model.kind, electricShare, kwh100, hybridLiters, plugs]);

  const monthShown = useCount(ran ? math.monthSave : 0);
  const yearShown = useCount(ran ? math.yearSave : 0);

  function persist() {
    localStorage.setItem("mielectrico-v1", JSON.stringify({ zone, fuel }));
    setRan(true);
  }

  async function copyNote() {
    const text = "Hola, vi Mi eléctrico y quiero algo así para mi negocio o agencia. ¿Lo charlamos por escrito?";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-night text-ice">
      <header className="sticky top-0 z-20 border-b border-line bg-night/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <a href="#inicio" className="font-display text-lg font-bold tracking-tight">
            Mi eléctrico
          </a>
          <nav className="hidden gap-6 text-sm text-mist md:flex">
            <a href="#comparar">Comparar</a>
            <a href="#viaje">Viaje</a>
            <a href="#ahorro">Ahorro</a>
            <a href="#patente">Patente</a>
          </nav>
          <a
            href="#viaje"
            className="inline-flex h-11 items-center rounded-full bg-bolt px-4 text-sm font-semibold text-night transition active:scale-[0.96]"
          >
            Armar el viaje
          </a>
        </div>
      </header>

      <main id="inicio">
        <section className="relative isolate min-h-[88vh] overflow-hidden">
          <img
            src="/hero.jpg"
            alt="Hatch eléctrico de noche, con estela de luz azul sobre el asfalto mojado"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-night via-night/80 to-night/30" />
          <div className="streak pointer-events-none absolute top-1/3 h-px w-1/2 bg-gradient-to-r from-transparent via-bolt to-transparent opacity-80" />
          <div className="streak pointer-events-none absolute top-1/2 h-px w-2/5 bg-gradient-to-r from-transparent via-bolt to-transparent opacity-50 [animation-delay:1.8s]" />
          <div className="glow-pulse pointer-events-none absolute bottom-16 left-1/2 h-24 w-64 -translate-x-1/2 rounded-full bg-bolt/30 blur-3xl" />
          <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 md:py-28">
            <p className="rise text-sm font-medium tracking-wide text-bolt uppercase">Argentina · noviembre 2026</p>
            <h1 className="rise rise-2 font-display max-w-3xl text-4xl leading-tight font-bold md:text-6xl">
              El eléctrico, con la nafta de tu cuadra.
            </h1>
            <p className="rise rise-3 max-w-xl text-lg text-ice/90">
              Compará hasta tres modelos, armá el viaje a la costa y calculá el ahorro contra un naftero. Cada número trae fecha y fuente.
            </p>
            <div className="rise rise-4 flex flex-wrap gap-3">
              <a href="#viaje" className="inline-flex h-12 items-center rounded-full bg-bolt px-5 font-semibold text-night transition active:scale-[0.96]">
                Viaje a la costa
              </a>
              <a href="#comparar" className="inline-flex h-12 items-center rounded-full border border-line bg-night/60 px-5 font-semibold text-ice transition active:scale-[0.96]">
                Comparar modelos
              </a>
            </div>
            <div className="mt-6 flex items-center gap-4">
              <div className="charge-meter grid h-20 w-20 place-items-center rounded-full" aria-hidden="true">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-night text-sm font-semibold text-bolt">78%</div>
              </div>
              <p className="max-w-xs text-sm text-mist">
                Carga de ejemplo. En el viaje de abajo el círculo cambia con la batería que te queda.
              </p>
            </div>
          </div>
        </section>

        <section id="comparar" className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-8 flex flex-col gap-3">
            <p className="text-sm font-medium tracking-wide text-bolt uppercase">Comparador</p>
            <h2 className="font-display text-3xl font-bold md:text-4xl">Hasta tres, lado a lado</h2>
            <p className="max-w-2xl text-mist">
              Fichas actualizadas al 17/11/2026. Si la lista está en dólares, los pesos salen del cambio que cargás. Tesla sigue sin precio: se anuncia el 20/11.
            </p>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "Todos"],
                ["ev", "Eléctricos"],
                ["hybrid", "Híbridos"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`h-11 rounded-full px-4 text-sm font-medium transition active:scale-[0.96] ${
                  filter === id ? "bg-bolt text-night" : "border border-line text-mist"
                }`}
              >
                {label}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-sm text-mist">
              Pesos por dólar
              <input
                className={`${inputClass} w-28`}
                inputMode="decimal"
                type="number"
                min={1}
                aria-label="Pesos por dólar, el cambio que usás"
                value={usdRate}
                onChange={(event) => setUsdRate(Number(event.target.value))}
              />
            </label>
          </div>
          <p className="mb-4 text-sm text-mist">
            Primero la marca, después el modelo. El cambio no es cotización oficial: solo pasa a pesos las listas que están en dólares.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {brands.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setBrand(name)}
                className={`h-11 rounded-full border px-4 text-sm font-medium transition active:scale-[0.96] ${
                  brandOn === name ? "border-bolt bg-bolt text-night" : "border-line text-ice"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          {brandOn ? (
            <div className="mb-6 flex flex-wrap gap-2">
              {visible.map((car) => {
                const on = picked.includes(car.id);
                return (
                  <button
                    key={car.id}
                    type="button"
                    onClick={() => toggle(car.id)}
                    aria-pressed={on}
                    className={`h-11 rounded-full border px-4 text-sm transition active:scale-[0.96] ${
                      on ? "border-bolt bg-panel-2 text-ice" : "border-line text-mist"
                    }`}
                  >
                    {car.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mb-6 text-sm text-mist">Elegí una marca para ver sus modelos. Abajo siguen los tres que ya estás comparando.</p>
          )}
          {limitMsg ? <p className="mb-4 text-sm text-bolt">{limitMsg}</p> : null}
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {selected.length === 0 ? (
              <p className="text-mist">Elegí al menos un modelo para ver la ficha.</p>
            ) : (
              selected.map((car) => <ModelCard key={car.id} car={car} usdRate={usdRate} />)
            )}
          </div>
        </section>

        <TripPlanner />

        <section id="ahorro" className="border-y border-line bg-panel">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-sm font-medium tracking-wide text-bolt uppercase">Calculadora</p>
              <h2 className="font-display mt-2 text-3xl font-bold md:text-4xl">¿Cuánto está la nafta en tu zona?</h2>
              <p className="mt-3 max-w-xl text-mist">
                El default de CABA es real: $2.500 la súper en la YPF de Cabildo y Vilela, Saavedra. Si en tu estación está distinto, cambialo.
              </p>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <Field label="Jurisdicción">
                  <select className={inputClass} value={zone} onChange={(event) => applyZone(event.target.value as JurisdictionId)}>
                    {JURISDICTIONS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Modelo a comparar">
                  <select className={inputClass} value={calcModel} onChange={(event) => chooseModel(event.target.value)}>
                    {allBrands.map((name) => (
                      <optgroup key={name} label={name}>
                        {MODELS.filter((item) => item.brand === name).map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <Field label="Nafta súper en tu zona" hint={jurisdiction.fuelExample}>
                  <input className={inputClass} type="number" min={0} value={fuel} onChange={(event) => setFuel(Number(event.target.value))} />
                </Field>
                <Field label="Kilómetros por mes">
                  <input className={inputClass} type="number" min={0} value={km} onChange={(event) => setKm(Number(event.target.value))} />
                </Field>
                {plugs ? (
                  <>
                    <Field label="kWh en casa" hint={jurisdiction.powerNote}>
                      <input className={inputClass} type="number" min={0} value={homeKwh} onChange={(event) => setHomeKwh(Number(event.target.value))} />
                    </Field>
                    <Field label="kWh en cargador público">
                      <input className={inputClass} type="number" min={0} value={publicKwh} onChange={(event) => setPublicKwh(Number(event.target.value))} />
                    </Field>
                    <Field label={`% de la carga en la calle: ${publicShare}`}>
                      <input className="h-12 w-full accent-bolt" type="range" min={0} max={100} value={publicShare} onChange={(event) => setPublicShare(Number(event.target.value))} />
                    </Field>
                    <Field
                      label="Consumo eléctrico (kWh/100 km)"
                      hint={
                        model.testKwhPer100
                          ? "Precargado con una prueba a 100 km/h del Dolphin Mini GS. No es el ciclo oficial."
                          : "Supuesto editable. No es un dato de ficha."
                      }
                    >
                      <input
                        className={inputClass}
                        type="number"
                        min={0}
                        step="0.1"
                        value={Number(kwh100.toFixed(1))}
                        onChange={(event) => setKwh100(Number(event.target.value))}
                      />
                    </Field>
                  </>
                ) : null}
                <Field label="Naftero de comparación (L/100 km)">
                  <input className={inputClass} type="number" min={0} step="0.1" value={liters} onChange={(event) => setLiters(Number(event.target.value))} />
                </Field>
                {model.kind === "phev" ? (
                  <Field label={`% de km en modo eléctrico: ${electricShare}`}>
                    <input className="h-12 w-full accent-bolt" type="range" min={0} max={100} value={electricShare} onChange={(event) => setElectricShare(Number(event.target.value))} />
                  </Field>
                ) : null}
                {model.kind !== "ev" ? (
                  <Field
                    label="Consumo a nafta del híbrido (L/100 km)"
                    hint={
                      model.kind === "phev"
                        ? "Solo para los kilómetros que no hacés en eléctrico. Supuesto editable."
                        : "No se enchufa: toda la cuenta sale de este consumo. Es un supuesto, no una ficha."
                    }
                  >
                    <input className={inputClass} type="number" min={0} step="0.1" value={hybridLiters} onChange={(event) => setHybridLiters(Number(event.target.value))} />
                  </Field>
                ) : null}
              </div>
              <button type="button" onClick={persist} className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-bolt px-5 font-semibold text-night transition active:scale-[0.96]">
                <Gauge className="size-4" />
                Ver cuánto ahorro
              </button>
            </div>
            <aside className="flex flex-col justify-between gap-6 rounded-2xl border border-line bg-night p-6">
              <div>
                <p className="text-sm text-mist">Ahorro contra el naftero</p>
                <p className="font-display mt-2 text-4xl font-bold text-bolt md:text-5xl">{ars(Math.round(monthShown))}</p>
                <p className="mt-1 text-mist">por mes</p>
                <p className="font-display mt-6 text-2xl font-semibold">{ars(Math.round(yearShown))}</p>
                <p className="text-mist">por año</p>
              </div>
              <dl className="grid gap-3 text-sm">
                <div className="flex justify-between gap-4 border-t border-line pt-3">
                  <dt className="text-mist">Naftero</dt>
                  <dd>{ars(Math.round(math.gasMonth))}/mes</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-mist">{kindLabel(model.kind)}</dt>
                  <dd>{ars(Math.round(math.altMonth))}/mes</dd>
                </div>
                {math.plugs ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-mist">kWh mixto</dt>
                    <dd>{ars(Math.round(math.kwhPrice))}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="text-xs leading-5 text-mist">
                Energía, no patente ni service. El ciclo de autonomía del auto no es el consumo de esta cuenta. {model.name}. Si el resultado es negativo, con estos precios el naftero sigue saliendo más barato de mover.
              </p>
              {ran ? (
                <div className="rounded-2xl border border-line bg-panel p-4">
                  <p className="font-medium">¿Te sirve algo así para tu negocio o agencia?</p>
                  <p className="mt-1 text-sm text-mist">Lo armé yo. Escribime. Sin teléfono ni WhatsApp.</p>
                  <button type="button" onClick={copyNote} className="mt-3 inline-flex h-11 items-center rounded-full border border-line px-4 text-sm font-medium transition active:scale-[0.96]">
                    {copied ? "Texto copiado" : "Copiar mensaje"}
                  </button>
                </div>
              ) : null}
            </aside>
          </div>
        </section>

        <section id="patente" className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-8">
            <p className="text-sm font-medium tracking-wide text-bolt uppercase">Patente</p>
            <h2 className="font-display mt-2 text-3xl font-bold md:text-4xl">No es igual en todos lados</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {JURISDICTIONS.map((item) => (
              <article key={item.id} className="rounded-2xl border border-line bg-panel p-5">
                <MapPin className="size-5 text-bolt" />
                <h3 className="font-display mt-4 text-xl font-semibold">{item.name}</h3>
                <p className="mt-2 font-medium text-bolt">{item.patentTitle}</p>
                <p className="mt-3 text-sm leading-6 text-mist">{item.patentBody}</p>
                <p className="mt-4 text-xs text-mist">{item.patentSource}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-line bg-panel">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-16 md:grid-cols-3">
            <article className="rounded-2xl border border-line bg-night p-5">
              <Wrench className="size-5 text-bolt" />
              <h3 className="font-display mt-4 text-xl font-semibold">Service</h3>
              <p className="mt-3 text-sm leading-6 text-mist">
                Un eléctrico se saltea aceite, filtros de combustible y, en uso urbano, gasta menos pastillas por el freno regenerativo. El híbrido queda en el medio: sigue teniendo motor térmico. No hay un arancel oficial de service para publicar, así que esto no es un presupuesto.
              </p>
            </article>
            <article className="rounded-2xl border border-line bg-night p-5">
              <BatteryCharging className="size-5 text-bolt" />
              <h3 className="font-display mt-4 text-xl font-semibold">Qué sí se compara</h3>
              <ul className="mt-3 space-y-2 text-sm text-mist">
                <li className="flex gap-2">
                  <Fuel className="mt-0.5 size-4 shrink-0 text-bolt" /> Nafta de tu estación, no un promedio nacional.
                </li>
                <li className="flex gap-2">
                  <PlugZap className="mt-0.5 size-4 shrink-0 text-bolt" /> kWh de casa y de la calle, por separado.
                </li>
                <li className="flex gap-2">
                  <Scale className="mt-0.5 size-4 shrink-0 text-bolt" /> Patente según dónde lo radicás.
                </li>
              </ul>
            </article>
            <article id="cupo" className="rounded-2xl border border-line bg-night p-5">
              <Ship className="size-5 text-bolt" />
              <h3 className="font-display mt-4 text-xl font-semibold">Importación y cupo</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-mist">
                <li>Dentro del cupo el arancel es 0%. Fuera, 35%.</li>
                <li>Cupo 2027: 50.000 unidades.</li>
                <li>Tope FOB: USD 35.000 eléctricos, 18.000 híbridos, 16.000 microhíbridos.</li>
                <li>Tesla Model 3 y Model Y: venta desde el 20/11/2026, sin precio ni cupo asignado al 17/11.</li>
                <li>Changan, Lynk & Co y Dongfeng ya tienen ficha cuando el sitio oficial publica precio. Geely EX5 sigue sin precio de noviembre confirmado.</li>
              </ul>
              <p className="mt-4 text-xs text-mist">
                Siomaa, primer semestre 2026: híbridos y eléctricos fueron el 15,2% de los patentamientos, no el 16%. El Territory HEV lideró con 4.903 unidades.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-mist md:flex-row md:items-center md:justify-between">
          <p className="inline-flex items-center gap-2">
            <Zap className="size-4 text-bolt" />
            Hecho por LCA ITECH
          </p>
          <p>Gratis. Sin membresía. Contacto por escrito.</p>
        </div>
      </footer>
    </div>
  );
}
