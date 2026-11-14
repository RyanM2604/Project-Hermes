"use client";

import { useEffect, useRef, useState } from "react";
import { Map as LibreMap, NavigationControl, type GeoJSONSource } from "maplibre-gl";
import { MapPin, RotateCw } from "lucide-react";
import { mapGeoJson, type MapGroup } from "@/lib/events/map";

export default function MapCanvas({ groups, selectedVenue, onSelect }: {
  groups: MapGroup[];
  selectedVenue: string | null;
  onSelect: (venueId: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const framed = useRef(false);
  const latest = useRef({ groups, onSelect });
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    latest.current = { groups, onSelect };
    const source = mapRef.current?.getSource("events") as GeoJSONSource | undefined;
    source?.setData(mapGeoJson(groups));
    const map = mapRef.current;
    if (map && loaded && !framed.current && groups.length) {
      const positions = groups.map(group => group.venue.coordinates);
      if (positions.length === 1) {
        map.jumpTo({ center: [...positions[0]], zoom: 13 });
      } else {
        map.fitBounds([
          [Math.min(...positions.map(point => point[0])), Math.min(...positions.map(point => point[1]))],
          [Math.max(...positions.map(point => point[0])), Math.max(...positions.map(point => point[1]))],
        ], { padding: 90, maxZoom: 14, duration: 0 });
      }
      framed.current = true;
    }
  }, [groups, onSelect, loaded]);

  useEffect(() => {
    if (!container.current) return;
    let map: LibreMap;
    const styleForTheme = () => `https://tiles.openfreemap.org/styles/${document.documentElement.classList.contains("dark") ? "dark" : "positron"}`;
    let currentStyle = styleForTheme();
    const timeout = window.setTimeout(() => setProblem("The map is taking longer to load. You can still browse the event list."), 15000);
    try {
      map = new LibreMap({
        container: container.current,
        style: currentStyle,
        center: [-80.535, 43.477], zoom: 12.8, minZoom: 9,
        attributionControl: { compact: true, customAttribution: 'Locations © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>' },
      });
      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      map.on("style.load", () => {
        window.clearTimeout(timeout);
        setLoaded(true);
        setProblem(null);
        map.addSource("events", { type: "geojson", data: mapGeoJson(latest.current.groups) });
        const layers = map.getStyle().layers;
        // Some provider styles interleave labels and buildings. Heat must sit
        // above every geometry layer so fills cannot punch holes in hotspots.
        const lastGeometry = layers.findLastIndex(layer => layer.type !== "symbol");
        const firstLabel = layers.slice(lastGeometry + 1).find(layer => layer.type === "symbol")?.id;
        if (document.documentElement.classList.contains("dark")) {
          for (const layer of layers) {
            if (layer.type === "symbol" && layer.layout?.["text-field"]) {
              map.setPaintProperty(layer.id, "text-color", "#b7c6b8");
              map.setPaintProperty(layer.id, "text-halo-color", "#171c19");
              map.setPaintProperty(layer.id, "text-halo-width", 1.5);
            }
          }
        }
        map.addLayer({
          id: "event-heat", type: "heatmap", source: "events",
          paint: {
            // Fixed RSVP scale: even small gatherings get a cool patch, while
            // larger gatherings develop warm cores. Filters never rescale it.
            "heatmap-weight": ["interpolate", ["linear"], ["get", "going"],
              0, 0, 1, 0.35, 5, 0.65, 15, 1.2, 30, 1.8, 60, 2.8, 100, 4],
            "heatmap-intensity": 1,
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 9, 30, 11, 55, 13, 90, 15, 125, 17, 160],
            "heatmap-opacity": 0.88,
            "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(36,98,255,0)", 0.03, "rgba(36,98,255,0.4)",
              0.12, "#189bff", 0.24, "#00d4ee", 0.36, "#3ee78a",
              0.5, "#f9ec38", 0.7, "#ff9c00", 0.85, "#ff4200", 1, "#ed1532"],
          },
        }, firstLabel);
        map.addLayer({
          id: "event-pins", type: "circle", source: "events",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 16, 7],
            "circle-color": "#242922", "circle-stroke-width": 2, "circle-stroke-color": "#fafbf8",
          },
        });
      });
      map.on("click", "event-pins", event => {
        const id = event.features?.[0]?.properties?.venueId;
        if (typeof id === "string") latest.current.onSelect(id);
      });
      map.on("mouseenter", "event-pins", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "event-pins", () => { map.getCanvas().style.cursor = ""; });
      map.on("error", () => setProblem("Some map details could not load. The event list is still available."));
    } catch {
      window.clearTimeout(timeout);
      // A browser without WebGL still gets the complete event list.
      const failure = window.setTimeout(() => setProblem("Your browser couldn’t open the map. Browse all events in the list, or retry."), 0);
      return () => window.clearTimeout(failure);
    }
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container.current);
    const theme = new MutationObserver(() => {
      const style = styleForTheme();
      if (style !== currentStyle) {
        currentStyle = style;
        setLoaded(false);
        map.setStyle(style);
      }
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.clearTimeout(timeout);
      resize.disconnect();
      theme.disconnect();
      mapRef.current = null;
      map.remove();
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !map.getLayer("event-pins")) return;
    map.setPaintProperty("event-pins", "circle-color", ["case", ["==", ["get", "venueId"], selectedVenue ?? ""], "#a34e29", "#242922"]);
    const venue = latest.current.groups.find(group => group.venue.id === selectedVenue)?.venue;
    if (venue) map.easeTo({ center: [...venue.coordinates], zoom: Math.max(map.getZoom(), 14), duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450 });
  }, [selectedVenue, loaded]);

  function retry() {
    framed.current = false;
    setProblem(null);
    setLoaded(false);
    setAttempt(value => value + 1);
  }

  return (
    <div className="hm-map-canvas-wrap">
      <div ref={container} className="hm-map-canvas" role="region" aria-label="Waterloo event locations. All events are also available in the list." />
      {!loaded && !problem && <div className="hm-map-loading" role="status"><MapPin size={22} /><span>Opening Waterloo…</span><button type="button" onClick={retry}>Retry map</button></div>}
      {problem && <div className="hm-map-problem" role="status"><p>{problem}</p><button type="button" onClick={retry}><RotateCw size={14} /> Retry map</button></div>}
      {loaded && !problem && groups.length > 0 && groups.every(group => group.events.every(event => event.goingCount === 0)) && <div className="hm-map-no-heat" role="status">No Going RSVPs at mapped events yet. Pins show where events are happening.</div>}
      <div className="hm-map-key" aria-label="Heat shows fewer to more Going RSVPs">
        <strong>Going heatmap</strong><div><span>Quiet</span><i aria-hidden="true" /><span>Busy</span></div>
        <small>Based on Hermes RSVPs</small>
      </div>
      <a className="hm-map-list-link" href="#map-events">Browse event list</a>
    </div>
  );
}
