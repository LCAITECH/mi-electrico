# AGENTS.md — Mi eléctrico

Reglas para Grok y cualquier otro agente que trabaje en este repositorio.

## Producto

Mi eléctrico, de LCA ITECH. Comparador y planificador de viaje de autos eléctricos e híbridos en Argentina. Gratis, sin registro y sin paywall.

## Datos: no inventar

- Precio, autonomía, consumo, kW y estación salen de una fuente con fecha. Si no está publicado, el texto es "sin dato".
- Tesla Model 3 y Model Y se anuncian el 20/11/2026 y no tienen precio.
- YPF Dolores no tiene kW publicado. El rayo queda gris.
- Un híbrido no es un auto 100% eléctrico.
- Rayo verde: DC publicado o el listado dice rápida. Naranja: solo AC. Gris: no hay tipo ni kW.
- Si el tiempo de carga usa un kW supuesto, hay que decirlo.
- Nafta default CABA: $2.500 el litro, YPF Cabildo y Vilela, Saavedra, observación del 17/11/2026.
- kWh público de referencia: cerca de $650, pack YPF de 50 kWh a $39.900.
- No marques un cargador sobre el camino si no cae cerca de la ruta real. "Próximamente" no es un punto abierto.
- Español rioplatense, sin emojis, mobile first.

## Dónde está cada cosa

- Fichas: `src/data/market.ts`
- Ciudades y cargadores: `src/data/corridor.ts`
- Qué cargador cae sobre la línea: `src/data/along-route.ts`
- Planificador: `src/components/trip-planner.tsx`
- Comparador: `src/components/home-page.tsx`
- Memoria corta del producto: `.grok/project_memory.md`

## Cómo correrlo

```bash
npm ci
npm run dev
```

El servidor escucha en el puerto 8080. Las dependencias están fijadas en `package-lock.json`. No subas `node_modules`.

Auth apagada. El flag está en `.grok/app-env.json` (`VITE_AUTH_ENABLED` en `false`). No lo prendas y no agregues login ni base de datos.

`npm run dev` ya pasa por `scripts/with-app-env.mjs`. No arranques `vite` directo: si no, el flag de auth no entra.

## Qué no tocar

- No commitees `.env` ni secretos.
- No borres `startup.sh`, `public/__grok/` ni el plugin de PWA en `vite.config.ts`.
- No reescribas cifras "para que cierre" ni completes kW que la fuente no publicó.
