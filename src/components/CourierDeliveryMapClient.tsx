import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  CalendarDays,
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  Route,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getCourierSession } from "@/lib/courier-session";
import { orderShortNumber } from "@/lib/tracking";
import type {
  CourierDeliveryMapProps,
  CourierMapDelivery,
} from "@/components/CourierDeliveryMap";

type Precision = "exact" | "street" | "district" | "city";

type GeoPoint = {
  deliveryId: string;
  lat: number;
  lng: number;
  formattedAddress?: string | null;
  precision: Precision;
};

type CurrentLocation = { lat: number; lng: number };
type GeocodeCandidate = { query: string; precision: Precision };
type ProviderResult = {
  lat: number;
  lng: number;
  formattedAddress?: string | null;
  precision?: Precision;
};

const FINAL_STATUSES = new Set(["entregue", "devolvido", "cancelado"]);
const PRECISION_RANK: Record<Precision, number> = {
  exact: 0,
  street: 1,
  district: 2,
  city: 3,
};
let lastNominatimRequestAt = 0;

function safeColor(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
}

function deliveryAddress(delivery: CourierMapDelivery) {
  return [delivery.order.address, delivery.order.district, delivery.order.city]
    .filter(Boolean)
    .join(", ");
}

function normalizeCity(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s*[/,-]\s*(PE|PERNAMBUCO)\s*$/i, "")
    .trim();
}

function streetWithoutNumber(value: string | null | undefined) {
  return String(value || "")
    .replace(/,\s*\d+[\w\s-]*$/i, "")
    .replace(/\s+\d+[\w\s-]*$/i, "")
    .trim();
}

function buildGeocodeCandidates(delivery: CourierMapDelivery): GeocodeCandidate[] {
  const address = String(delivery.order.address || "").trim();
  const street = streetWithoutNumber(address);
  const district = String(delivery.order.district || "").trim();
  const city = normalizeCity(delivery.order.city);
  const state = "Pernambuco";
  const country = "Brasil";

  const candidates: GeocodeCandidate[] = [];
  const add = (query: string, precision: Precision) => {
    const normalized = query
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ");
    if (!normalized) return;
    if (!candidates.some((item) => item.query.toLowerCase() === normalized.toLowerCase())) {
      candidates.push({ query: normalized, precision });
    }
  };

  if (address && city) {
    add([address, district, city, state, country].filter(Boolean).join(", "), "exact");
    add([address, city, state, country].filter(Boolean).join(", "), "exact");
  }

  if (street && city) {
    add([street, district, city, state, country].filter(Boolean).join(", "), "street");
    add([street, city, state, country].filter(Boolean).join(", "), "street");
  }

  if (district && city) {
    add([district, city, state, country].join(", "), "district");
  }

  if (city) add([city, state, country].join(", "), "city");

  return candidates;
}

function weakerPrecision(a: Precision, b?: Precision): Precision {
  if (!b) return a;
  return PRECISION_RANK[a] >= PRECISION_RANK[b] ? a : b;
}

function precisionFromNominatim(value: string | undefined): Precision | undefined {
  const type = String(value || "").toLowerCase();
  if (["house", "building", "residential", "apartments"].includes(type)) return "exact";
  if (["road", "street", "pedestrian", "path"].includes(type)) return "street";
  if (["neighbourhood", "suburb", "quarter", "borough", "district"].includes(type)) {
    return "district";
  }
  if (["city", "town", "village", "municipality", "administrative"].includes(type)) {
    return "city";
  }
  return undefined;
}

function precisionFromArcGis(value: string | undefined): Precision | undefined {
  const type = String(value || "").toLowerCase();
  if (["subaddress", "pointaddress", "postalext"].includes(type)) return "exact";
  if (["streetaddress", "streetint", "streetname", "distanceMarker".toLowerCase()].includes(type)) {
    return "street";
  }
  if (["neighborhood", "district"].includes(type)) return "district";
  if (["city", "locality", "subregion", "region"].includes(type)) return "city";
  return undefined;
}

async function waitForNominatimSlot() {
  const elapsed = Date.now() - lastNominatimRequestAt;
  const wait = Math.max(0, 1050 - elapsed);
  if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
  lastNominatimRequestAt = Date.now();
}

async function searchNominatim(query: string): Promise<ProviderResult | null> {
  await waitForNominatimSlot();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "pt-BR");
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const result = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name?: string;
    addresstype?: string;
    type?: string;
  }>;
  const first = result[0];
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    lat,
    lng,
    formattedAddress: first?.display_name || query,
    precision: precisionFromNominatim(first?.addresstype || first?.type),
  };
}

async function searchArcGis(query: string): Promise<ProviderResult | null> {
  const url = new URL(
    "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
  );
  url.searchParams.set("f", "json");
  url.searchParams.set("SingleLine", query);
  url.searchParams.set("countryCode", "BRA");
  url.searchParams.set("maxLocations", "1");
  url.searchParams.set("outFields", "Addr_type");

  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`ArcGIS ${response.status}`);
  const payload = (await response.json()) as {
    candidates?: Array<{
      address?: string;
      score?: number;
      location?: { x?: number; y?: number };
      attributes?: { Addr_type?: string };
    }>;
  };
  const first = payload.candidates?.[0];
  const lat = Number(first?.location?.y);
  const lng = Number(first?.location?.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Number(first?.score || 0) < 60) {
    return null;
  }

  return {
    lat,
    lng,
    formattedAddress: first?.address || query,
    precision: precisionFromArcGis(first?.attributes?.Addr_type),
  };
}

function deterministicOffset(deliveryId: string, meters: number) {
  let hash = 0;
  for (const char of deliveryId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const angle = ((hash % 360) * Math.PI) / 180;
  const radius = meters * (0.55 + ((hash >>> 8) % 45) / 100);
  return {
    northMeters: Math.sin(angle) * radius,
    eastMeters: Math.cos(angle) * radius,
  };
}

function gentlySeparateApproximatePoint(
  deliveryId: string,
  lat: number,
  lng: number,
  precision: Precision,
) {
  const meters = precision === "city" ? 140 : precision === "district" ? 70 : 0;
  if (!meters) return { lat, lng };
  const offset = deterministicOffset(deliveryId, meters);
  return {
    lat: lat + offset.northMeters / 111_320,
    lng: lng + offset.eastMeters / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180))),
  };
}

function precisionLabel(precision: Precision) {
  const labels: Record<Precision, string> = {
    exact: "Localização encontrada",
    street: "Rua aproximada",
    district: "Bairro aproximado",
    city: "Região aproximada",
  };
  return labels[precision];
}

function decorateAddress(address: string | null | undefined, precision: Precision) {
  const clean = String(address || "").replace(/^≈\s*(Rua|Bairro|Região) aproximad[ao]:\s*/i, "");
  return precision === "exact" ? clean : `≈ ${precisionLabel(precision)}: ${clean}`;
}

function inferStoredPrecision(address: string | null | undefined): Precision {
  const value = String(address || "").toLowerCase();
  if (value.startsWith("≈ rua aproximada:")) return "street";
  if (value.startsWith("≈ bairro aproximado:")) return "district";
  if (value.startsWith("≈ região aproximada:")) return "city";
  return "exact";
}

function storageKey(deliveryId: string) {
  return `zappfy:delivery-geocode:${deliveryId}`;
}

function readStoredPoint(deliveryId: string): GeoPoint | null {
  try {
    const raw = window.localStorage.getItem(storageKey(deliveryId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GeoPoint>;
    const lat = Number(parsed.lat);
    const lng = Number(parsed.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      deliveryId,
      lat,
      lng,
      formattedAddress: parsed.formattedAddress || null,
      precision: parsed.precision || inferStoredPrecision(parsed.formattedAddress),
    };
  } catch {
    return null;
  }
}

function writeStoredPoint(point: GeoPoint) {
  try {
    window.localStorage.setItem(storageKey(point.deliveryId), JSON.stringify(point));
  } catch {
    // Cache local é opcional; o banco continua sendo a fonte persistente.
  }
}

function pointFromDelivery(delivery: CourierMapDelivery): GeoPoint | null {
  const lat = Number(delivery.delivery_latitude);
  const lng = Number(delivery.delivery_longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
    return {
      deliveryId: delivery.id,
      lat,
      lng,
      formattedAddress: delivery.delivery_geocoded_address,
      precision: inferStoredPrecision(delivery.delivery_geocoded_address),
    };
  }
  return readStoredPoint(delivery.id);
}

async function resolveDeliveryPoint(delivery: CourierMapDelivery): Promise<GeoPoint | null> {
  const candidates = buildGeocodeCandidates(delivery);

  for (const candidate of candidates) {
    const providers = candidate.precision === "exact" || candidate.precision === "street"
      ? [searchArcGis, searchNominatim]
      : [searchNominatim, searchArcGis];

    for (const provider of providers) {
      try {
        const result = await provider(candidate.query);
        if (!result) continue;
        const precision = weakerPrecision(candidate.precision, result.precision);
        const separated = gentlySeparateApproximatePoint(
          delivery.id,
          result.lat,
          result.lng,
          precision,
        );
        return {
          deliveryId: delivery.id,
          lat: separated.lat,
          lng: separated.lng,
          formattedAddress: decorateAddress(result.formattedAddress || candidate.query, precision),
          precision,
        };
      } catch (error) {
        console.warn("Falha em uma tentativa de geocodificação", error);
      }
    }
  }

  return null;
}

function haversineKm(a: CurrentLocation, b: CurrentLocation) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    preparando: "Atribuído",
    aguardando_motoboy: "Aguardando aceite",
    saiu_para_entrega: "Em rota",
    chegando: "Chegando",
    nao_entregue: "Não entregue",
    retornando: "Retornando",
  };
  return labels[status] || status.replaceAll("_", " ");
}

function scheduledLabel(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : null;
}

function numberedIcon(number: number, color: string, approximate: boolean) {
  const safe = safeColor(approximate ? "#f59e0b" : color, "#10b981");
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;border-radius:9999px;background:${safe};color:#fff;border:3px ${approximate ? "dashed" : "solid"} #fff;box-shadow:0 4px 12px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">${number}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function courierIcon() {
  return L.divIcon({
    className: "",
    html: '<div style="width:22px;height:22px;border-radius:9999px;background:#2563eb;border:4px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35)"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

function FitMap({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(positions), { padding: [28, 28], maxZoom: 15 });
  }, [map, positions]);
  return null;
}

function googleDestination(delivery: CourierMapDelivery, point: GeoPoint) {
  const address = deliveryAddress(delivery);
  return point.precision === "exact" || !address ? `${point.lat},${point.lng}` : address;
}

export function CourierDeliveryMapClient({
  deliveries,
  storeSlug,
  theme,
  onOpenDeliveries,
}: CourierDeliveryMapProps) {
  const mapDeliveries = useMemo(
    () => deliveries.filter((delivery) => !FINAL_STATUSES.has(delivery.status)),
    [deliveries],
  );
  const deliveryKey = useMemo(
    () =>
      mapDeliveries
        .map(
          (delivery) =>
            `${delivery.id}:${delivery.delivery_latitude ?? ""}:${delivery.delivery_longitude ?? ""}:${delivery.order.address}:${delivery.order.district}:${delivery.order.city}`,
        )
        .join("|"),
    [mapDeliveries],
  );
  const [points, setPoints] = useState<Record<string, GeoPoint>>({});
  const [geocoding, setGeocoding] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function syncAndGeocode() {
      const initial: Record<string, GeoPoint> = {};
      const missing: CourierMapDelivery[] = [];

      for (const delivery of mapDeliveries) {
        const known = pointFromDelivery(delivery);
        if (known) initial[delivery.id] = known;
        else missing.push(delivery);
      }

      if (!cancelled) setPoints(initial);
      if (missing.length === 0) {
        if (!cancelled) setGeocoding(false);
        return;
      }

      setGeocoding(true);
      for (const delivery of missing) {
        if (cancelled) return;
        const point = await resolveDeliveryPoint(delivery);
        if (!point) continue;

        writeStoredPoint(point);
        if (!cancelled) setPoints((current) => ({ ...current, [delivery.id]: point }));

        const session = getCourierSession(storeSlug);
        if (session) {
          void (supabase as any).rpc("courier_cache_delivery_geocode", {
            _session: session,
            _tracking_id: delivery.id,
            _lat: point.lat,
            _lng: point.lng,
            _formatted_address: point.formattedAddress,
          });
        }
      }

      if (!cancelled) setGeocoding(false);
    }

    void syncAndGeocode();
    return () => {
      cancelled = true;
    };
    // mapDeliveries é representado por deliveryKey para não reiniciar a fila a cada atualização.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryKey, retryNonce, storeSlug]);

  function locateCourier(showError = true) {
    if (!navigator.geolocation) {
      if (showError) window.alert("Seu aparelho não disponibilizou a localização.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        if (showError) {
          window.alert(
            "Não consegui acessar sua localização. Você ainda pode ver os pedidos no mapa e abrir cada rota.",
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  useEffect(() => {
    if (mapDeliveries.length > 0) locateCourier(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolved = useMemo(
    () =>
      mapDeliveries
        .map((delivery) => (points[delivery.id] ? { delivery, point: points[delivery.id] } : null))
        .filter(Boolean) as Array<{ delivery: CourierMapDelivery; point: GeoPoint }>,
    [mapDeliveries, points],
  );

  const ordered = useMemo(() => {
    if (resolved.length <= 1 || !currentLocation) return resolved;
    const remaining = [...resolved];
    const result: typeof resolved = [];
    let cursor: CurrentLocation = currentLocation;
    while (remaining.length > 0) {
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      remaining.forEach((candidate, index) => {
        const distance = haversineKm(cursor, candidate.point);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      const [next] = remaining.splice(bestIndex, 1);
      result.push(next);
      cursor = { lat: next.point.lat, lng: next.point.lng };
    }
    return result;
  }, [resolved, currentLocation]);

  const positions = useMemo<[number, number][]>(() => {
    const list = ordered.map(({ point }) => [point.lat, point.lng] as [number, number]);
    if (currentLocation) list.unshift([currentLocation.lat, currentLocation.lng]);
    return list;
  }, [ordered, currentLocation]);

  function openCompleteRoute() {
    if (ordered.length === 0) return;
    const routeStops = ordered.slice(0, 10);
    const destinationEntry = routeStops[routeStops.length - 1];
    const params = new URLSearchParams({
      api: "1",
      destination: googleDestination(destinationEntry.delivery, destinationEntry.point),
      travelmode: "driving",
    });
    if (currentLocation) params.set("origin", `${currentLocation.lat},${currentLocation.lng}`);
    if (routeStops.length > 1) {
      params.set(
        "waypoints",
        routeStops
          .slice(0, -1)
          .map(({ delivery, point }) => googleDestination(delivery, point))
          .join("|"),
      );
    }
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  const mapCardStyle = {
    background: theme.cardColor,
    borderColor: theme.cardBorderColor,
    borderRadius: theme.radius,
    color: theme.textColor,
  };
  const routeColor = safeColor(theme.buttonColor, "#10b981");
  const unresolvedCount = Math.max(0, mapDeliveries.length - resolved.length);
  const approximateCount = resolved.filter(({ point }) => point.precision !== "exact").length;

  if (mapDeliveries.length === 0) {
    return (
      <section className="border p-6 text-center" style={mapCardStyle}>
        <MapPin className="mx-auto mb-2 h-8 w-8 opacity-50" style={{ color: theme.iconColor }} />
        <div className="font-semibold" style={{ color: theme.titleColor }}>
          Nenhuma entrega para mostrar no mapa
        </div>
        <div className="mt-1 text-xs opacity-70">
          Assim que houver pedidos atribuídos, os destinos aparecerão aqui.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="border p-4" style={mapCardStyle}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-bold" style={{ color: theme.titleColor }}>
              <Route className="h-5 w-5" style={{ color: theme.iconColor }} />
              Mapa das minhas entregas
            </div>
            <div className="mt-1 text-xs opacity-70">
              Veja todos os destinos juntos e organize qual cliente atender primeiro.
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => locateCourier(true)}
            disabled={locating}
          >
            {locating ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Crosshair className="mr-1 h-4 w-4" />
            )}
            Minha localização
          </Button>
        </div>

        {geocoding && (
          <div
            className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: theme.cardBorderColor }}
          >
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: theme.iconColor }} />
            Localizando endereços. Se o número exato não existir no mapa, vou usar rua, bairro ou região como referência.
          </div>
        )}

        {approximateCount > 0 && !geocoding && (
          <div
            className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: "#f59e0b88", background: "#f59e0b10" }}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#f59e0b" }} />
            <span>
              {approximateCount} endereço(s) aparecem com pino aproximado. O pino laranja serve como referência quando o número ou a rua exata não é encontrada; ao abrir no Google Maps, o endereço escrito é enviado para ele tentar localizar com mais precisão.
            </span>
          </div>
        )}

        {unresolvedCount > 0 && !geocoding && (
          <div
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: theme.cardBorderColor }}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {unresolvedCount} endereço(s) não puderam ser posicionados. Confira se cidade ou endereço estão preenchidos.
            </span>
            <button
              type="button"
              onClick={() => setRetryNonce((value) => value + 1)}
              className="font-semibold underline underline-offset-2"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden border" style={{ ...mapCardStyle, height: 430 }}>
        <MapContainer
          center={(positions[0] || [-8.0476, -34.877]) as [number, number]}
          zoom={12}
          scrollWheelZoom
          style={{ height: "100%", width: "100%", background: "#e5e7eb" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitMap positions={positions} />

          {currentLocation && (
            <Marker position={[currentLocation.lat, currentLocation.lng]} icon={courierIcon()}>
              <Popup>Você está aqui</Popup>
            </Marker>
          )}

          {ordered.map(({ delivery, point }, index) => (
            <Marker
              key={delivery.id}
              position={[point.lat, point.lng]}
              icon={numberedIcon(index + 1, routeColor, point.precision !== "exact")}
            >
              <Popup>
                <div style={{ minWidth: 190 }}>
                  <strong>
                    {index + 1}. {delivery.order.customer}
                  </strong>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Pedido #{orderShortNumber(delivery.order.id)}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{deliveryAddress(delivery)}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{statusLabel(delivery.status)}</div>
                  {point.precision !== "exact" && (
                    <div style={{ fontSize: 11, marginTop: 6, color: "#b45309", fontWeight: 700 }}>
                      {precisionLabel(point.precision)} — use como referência
                    </div>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      point.precision === "exact"
                        ? `${point.lat},${point.lng}`
                        : deliveryAddress(delivery),
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "inline-block", marginTop: 8, fontWeight: 700 }}
                  >
                    Abrir no Google Maps
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}

          {positions.length > 1 && (
            <Polyline positions={positions} pathOptions={{ color: routeColor, weight: 4, opacity: 0.72 }} />
          )}
        </MapContainer>
      </div>

      <div className="border p-4" style={mapCardStyle}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-bold" style={{ color: theme.titleColor }}>
              {currentLocation ? "Rota sugerida por proximidade" : "Sequência dos pedidos"}
            </div>
            <div className="mt-1 text-xs opacity-70">
              {currentLocation
                ? "A ordem abaixo começa pelos destinos mais próximos da sua posição atual."
                : "Ative sua localização para eu sugerir a sequência mais próxima para começar."}
            </div>
          </div>
          <div
            className="rounded-full border px-2 py-1 text-xs"
            style={{ borderColor: theme.cardBorderColor }}
          >
            {resolved.length}/{mapDeliveries.length} no mapa
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {ordered.map(({ delivery, point }, index) => {
            const schedule = scheduledLabel(delivery.scheduled_for);
            const distance = currentLocation
              ? haversineKm(currentLocation, { lat: point.lat, lng: point.lng })
              : null;
            return (
              <div
                key={delivery.id}
                className="flex items-start gap-3 rounded-xl border p-3"
                style={{ borderColor: theme.cardBorderColor }}
              >
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold"
                  style={{
                    background: point.precision === "exact" ? routeColor : "#f59e0b",
                    color: theme.buttonTextColor,
                  }}
                >
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <strong className="truncate" style={{ color: theme.titleColor }}>
                      {delivery.order.customer}
                    </strong>
                    <span className="text-[11px] opacity-65">
                      #{orderShortNumber(delivery.order.id)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs opacity-75">{deliveryAddress(delivery)}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] opacity-70">
                    <span>{statusLabel(delivery.status)}</span>
                    {schedule && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {schedule}
                      </span>
                    )}
                    {point.precision !== "exact" && (
                      <span style={{ color: "#d97706", fontWeight: 700 }}>
                        {precisionLabel(point.precision)}
                      </span>
                    )}
                    {distance !== null && <span>≈ {distance.toFixed(1)} km da sua posição</span>}
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    point.precision === "exact"
                      ? `${point.lat},${point.lng}`
                      : deliveryAddress(delivery),
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border"
                  style={{ borderColor: theme.cardBorderColor, color: theme.iconColor }}
                  aria-label={`Abrir rota para ${delivery.order.customer}`}
                >
                  <Navigation className="h-4 w-4" />
                </a>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            disabled={ordered.length === 0}
            onClick={openCompleteRoute}
            style={{ background: theme.buttonColor, color: theme.buttonTextColor }}
          >
            <Navigation className="mr-2 h-4 w-4" />
            Abrir rota completa no Google Maps
          </Button>
          {onOpenDeliveries && (
            <Button type="button" variant="outline" onClick={onOpenDeliveries}>
              Ver detalhes dos pedidos
            </Button>
          )}
        </div>

        {ordered.length > 10 && (
          <div className="mt-2 text-[11px] opacity-60">
            O Google Maps será aberto com os 10 primeiros destinos da sequência. Os demais continuam visíveis aqui no mapa.
          </div>
        )}
        {currentLocation && ordered.length > 1 && (
          <div className="mt-2 text-[11px] opacity-60">
            A sugestão usa proximidade geográfica para organizar a sequência. Pinos laranja são aproximados; o Google Maps recebe o endereço escrito para tentar refinar a rota.
          </div>
        )}
      </div>
    </section>
  );
}
