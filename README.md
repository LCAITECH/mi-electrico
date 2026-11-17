# Mi eléctrico

Comparador y planificador de viaje de autos eléctricos e híbridos en Argentina. Hecho por [LCA ITECH](https://portfolio.lcaitech.com/).

Gratis, sin registro. Los precios, autonomías y cargadores salen de fichas y listados con fecha. Si un dato no está publicado, no se inventa.

## Qué hace

- Comparar hasta tres modelos, filtrando por marca y tipo de motorización.
- Calcular ahorro contra un naftero con la nafta y el kWh de tu zona.
- Armar un viaje: salida, destino, paradas de carga, batería al salir y al llegar.
- Ver cargadores del corredor verificado. El rayo verde es carga rápida publicada, el naranja es lenta y el gris no tiene potencia publicada.

## Cómo correrlo

```bash
npm install
npm run dev
```

El servidor de desarrollo escucha en el puerto 8080.

## Datos

Las fichas están en `src/data/market.ts` y los cargadores en `src/data/corridor.ts`. Cada cifra tiene fuente y fecha. El dólar para pasar listas en dólares a pesos lo carga quien usa la app.
