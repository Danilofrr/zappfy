import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type LatLng = { lat: number; lng: number };

type Props = {
  courier: LatLng | null;
  destination?: LatLng | null;
  heading?: number | null;
  primaryColor?: string;
  className?: string;
  height?: number | string;
  follow?: boolean;
};

function makeBikeIcon(color: string, heading: number | null | undefined) {
  const rot = typeof heading === "number" && !Number.isNaN(heading) ? heading : 0;
  const html = `
    <div style="transform: rotate(${rot}deg); transform-origin: center;">
      <div style="width:46px;height:46px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px ${color}aa, 0 0 0 4px ${color}33;">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 18a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm14 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM14.12 4l1.42 2H19l-1 2h-3.34l1 2H17l2 4h-2a4.99 4.99 0 0 0-3.46 1.4l-2.04-4.08L13.6 9l-2.6-2.6L8 9H5V7h2.59L11 3.59 14.12 4Z"/>
        </svg>
      </div>
    </div>`;
  return L.divIcon({ html, className: "tracking-bike-icon", iconSize: [46, 46], iconAnchor: [23, 23] });
}

function makePinIcon(color: string) {
  const html = `
    <div style="width:30px;height:38px;position:relative;">
      <svg viewBox="0 0 24 32" width="30" height="38" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.4 0 0 5.3 0 11.8 0 21 12 32 12 32s12-11 12-20.2C24 5.3 18.6 0 12 0Z" fill="${color}"/>
        <circle cx="12" cy="11.5" r="4.5" fill="white"/>
      </svg>
    </div>`;
  return L.divIcon({ html, className: "tracking-pin-icon", iconSize: [30, 38], iconAnchor: [15, 36] });
}

export function TrackingMap({
  courier,
  destination,
  heading,
  primaryColor = "#10b981",
  className,
  height = 320,
  follow = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const courierMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start = courier || destination || { lat: -8.05, lng: -34.9 };
    const map = L.map(containerRef.current, {
      center: [start.lat, start.lng],
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      courierMarkerRef.current = null;
      destMarkerRef.current = null;
      routeLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // courier marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !courier) return;
    const icon = makeBikeIcon(primaryColor, heading ?? null);
    if (!courierMarkerRef.current) {
      courierMarkerRef.current = L.marker([courier.lat, courier.lng], { icon }).addTo(map);
    } else {
      courierMarkerRef.current.setLatLng([courier.lat, courier.lng]);
      courierMarkerRef.current.setIcon(icon);
    }
    if (follow) {
      if (destination) {
        const bounds = L.latLngBounds([
          [courier.lat, courier.lng],
          [destination.lat, destination.lng],
        ]);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } else {
        map.panTo([courier.lat, courier.lng], { animate: true });
      }
    }
  }, [courier?.lat, courier?.lng, heading, primaryColor, follow, destination?.lat, destination?.lng]);

  // destination marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (destination) {
      const icon = makePinIcon(primaryColor);
      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([destination.lat, destination.lng], { icon }).addTo(map);
      } else {
        destMarkerRef.current.setLatLng([destination.lat, destination.lng]);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
  }, [destination?.lat, destination?.lng, primaryColor]);

  // route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (courier && destination) {
      const latlngs: L.LatLngTuple[] = [
        [courier.lat, courier.lng],
        [destination.lat, destination.lng],
      ];
      if (!routeLineRef.current) {
        routeLineRef.current = L.polyline(latlngs, {
          color: primaryColor,
          weight: 4,
          opacity: 0.7,
          dashArray: "8 10",
        }).addTo(map);
      } else {
        routeLineRef.current.setLatLngs(latlngs);
        routeLineRef.current.setStyle({ color: primaryColor });
      }
    } else if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }
  }, [courier?.lat, courier?.lng, destination?.lat, destination?.lng, primaryColor]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: "100%", borderRadius: 16, overflow: "hidden", background: "#0b1220" }}
    />
  );
}
