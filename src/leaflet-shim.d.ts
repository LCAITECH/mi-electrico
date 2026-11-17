declare module "leaflet" {
  const L: {
    map: (el: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
    tileLayer: (url: string, options?: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
    circle: (latlng: [number, number], options?: Record<string, unknown>) => LeafletLayer;
    polyline: (latlngs: [number, number][], options?: Record<string, unknown>) => LeafletLayer;
    marker: (latlng: [number, number], options?: Record<string, unknown>) => LeafletLayer;
    divIcon: (options?: Record<string, unknown>) => unknown;
    latLngBounds: (latlngs: [number, number][]) => unknown;
  };
  export default L;

  interface LeafletMap {
    remove: () => void;
    setView: (center: [number, number], zoom: number) => void;
    fitBounds: (bounds: unknown, options?: Record<string, unknown>) => void;
    invalidateSize: () => void;
  }

  interface LeafletLayer {
    addTo: (map: LeafletMap) => LeafletLayer;
    remove: () => void;
    on: (event: string, handler: () => void) => void;
    bindTooltip: (text: string, options?: Record<string, unknown>) => void;
  }
}
