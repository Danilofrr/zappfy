import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PIN_COLORS, VEHICLE_COLORS, vehicleSvgPath } from "@/lib/tracking";

export type LatLng = { lat: number; lng: number };

export type VehicleConfig = {
  type?: "moto" | "carro";
  color?: string; // key in VEHICLE_COLORS
  customUrl?: string | null;
};

export type PinConfig = {
  color?: string; // key in PIN_COLORS
  customUrl?: string | null;
};

type Props = {
  courier: LatLng | null;
  destination?: LatLng | null;
  heading?: number | null;
  primaryColor?: string;
  vehicle?: VehicleConfig;
  pin?: PinConfig;
  className?: string;
  height?: number | string;
  follow?: boolean;
};

function makeVehicleIcon(vehicle: VehicleConfig | undefined, fallbackColor: string, heading: number | null | undefined) {
  const rot = typeof heading === "number" && !Number.isNaN(heading) ? heading : 0;
  const type = (vehicle?.type ?? "moto") as "moto" | "carro";
  const color = vehicle?.color ? (VEHICLE_COLORS[vehicle.color] ?? fallbackColor) : fallbackColor;

  let inner: string;
  let size = 46;
  if (vehicle?.customUrl) {
    size = 58;
    // Premium 3D image: drop-shadow gives it weight on the map, no colored circle so the
    // illustration reads cleanly. Rotation is applied to the wrapper for direction.
    inner = `<img src="${vehicle.customUrl}" style="width:${size}px;height:${size}px;object-fit:contain;filter:drop-shadow(0 6px 10px rgba(0,0,0,0.35));" alt="" />`;
  } else {
    inner = `
      <div style="width:46px;height:46px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px ${color}aa, 0 0 0 4px ${color}33;">
        <svg viewBox="0 0 24 24" width="26" height="26" xmlns="http://www.w3.org/2000/svg">
          ${vehicleSvgPath(type)}
        </svg>
      </div>`;
  }
  const html = `<div style="transform: rotate(${rot}deg); transform-origin: center; display:flex;align-items:center;justify-content:center;transition: transform 0.6s ease;">${inner}</div>`;
  return L.divIcon({ html, className: "tracking-vehicle-icon", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function makePinIcon(pin: PinConfig | undefined, fallbackColor: string) {
  const color = pin?.color ? (PIN_COLORS[pin.color] ?? fallbackColor) : fallbackColor;
  let html: string;
  if (pin?.customUrl) {
    html = `<img src="${pin.customUrl}" style="width:36px;height:42px;object-fit:contain;" alt="" />`;
  } else {
    html = `
      <svg viewBox="0 0 24 32" width="30" height="38" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.4 0 0 5.3 0 11.8 0 21 12 32 12 32s12-11 12-20.2C24 5.3 18.6 0 12 0Z" fill="${color}"/>
        <circle cx="12" cy="11.5" r="4.5" fill="white"/>
      </svg>`;
  }
  return L.divIcon({ html, className: "tracking-pin-icon", iconSize: [30, 38], iconAnchor: [15, 36] });
}

export function TrackingMap({
  courier,
  destination,
  heading,
  primaryColor = "#10b981",
  vehicle,
  pin,
  className,
  height = 320,
  follow = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const courierMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const animRef = useRef<number | null>(null);
  const lastPosRef = useRef<LatLng | null>(null);

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
      if (animRef.current) cancelAnimationFrame(animRef.current);
      map.remove();
      mapRef.current = null;
      courierMarkerRef.current = null;
      destMarkerRef.current = null;
      routeLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // animate courier marker smoothly between positions
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !courier) return;
    const icon = makeVehicleIcon(vehicle, primaryColor, heading ?? null);

    if (!courierMarkerRef.current) {
      courierMarkerRef.current = L.marker([courier.lat, courier.lng], { icon }).addTo(map);
      lastPosRef.current = { ...courier };
    } else {
      courierMarkerRef.current.setIcon(icon);
      const from = lastPosRef.current ?? courier;
      const to = courier;
      const sameSpot = Math.abs(from.lat - to.lat) < 1e-7 && Math.abs(from.lng - to.lng) < 1e-7;
      if (sameSpot) {
        courierMarkerRef.current.setLatLng([to.lat, to.lng]);
      } else {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        const start = performance.now();
        const duration = 1200;
        const step = (t: number) => {
          const k = Math.min(1, (t - start) / duration);
          const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          const lat = from.lat + (to.lat - from.lat) * ease;
          const lng = from.lng + (to.lng - from.lng) * ease;
          courierMarkerRef.current?.setLatLng([lat, lng]);
          if (k < 1) {
            animRef.current = requestAnimationFrame(step);
          } else {
            lastPosRef.current = { ...to };
            animRef.current = null;
          }
        };
        animRef.current = requestAnimationFrame(step);
      }
      lastPosRef.current = { ...to };
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
  }, [courier?.lat, courier?.lng, heading, primaryColor, follow, destination?.lat, destination?.lng, vehicle?.type, vehicle?.color, vehicle?.customUrl]);

  // destination marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (destination) {
      const icon = makePinIcon(pin, primaryColor);
      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([destination.lat, destination.lng], { icon }).addTo(map);
      } else {
        destMarkerRef.current.setLatLng([destination.lat, destination.lng]);
        destMarkerRef.current.setIcon(icon);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
  }, [destination?.lat, destination?.lng, primaryColor, pin?.color, pin?.customUrl]);

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
