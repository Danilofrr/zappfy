import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type LatLng = { lat: number; lng: number };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: LatLng | null;
  fallbackAddress: string;
  onSave: (coords: LatLng) => Promise<void> | void;
};

export function DestinationPicker({ open, onOpenChange, initial, fallbackAddress, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [coords, setCoords] = useState<LatLng | null>(initial);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState(fallbackAddress);

  // (re)build map when dialog opens
  useEffect(() => {
    if (!open) return;
    setCoords(initial);
    setQuery(fallbackAddress);
    const t = setTimeout(() => {
      if (!containerRef.current || mapRef.current) return;
      const start = initial ?? { lat: -8.05, lng: -34.9 };
      const map = L.map(containerRef.current, {
        center: [start.lat, start.lng],
        zoom: initial ? 16 : 13,
        scrollWheelZoom: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      const icon = L.divIcon({
        className: "tracking-pin-icon",
        html: `<svg viewBox="0 0 24 32" width="34" height="42" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.3 0 11.8 0 21 12 32 12 32s12-11 12-20.2C24 5.3 18.6 0 12 0Z" fill="#ef4444"/><circle cx="12" cy="11.5" r="4.5" fill="white"/></svg>`,
        iconSize: [34, 42],
        iconAnchor: [17, 40],
      });
      const marker = L.marker([start.lat, start.lng], { icon, draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        setCoords({ lat: p.lat, lng: p.lng });
      });
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      mapRef.current = map;
      markerRef.current = marker;
      // ensure tiles render correctly after dialog animation
      setTimeout(() => map.invalidateSize(), 200);
    }, 80);
    return () => {
      clearTimeout(t);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [open, initial, fallbackAddress]);

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { "Accept-Language": "pt-BR" } },
      );
      const arr = await res.json();
      if (Array.isArray(arr) && arr[0]) {
        const lat = parseFloat(arr[0].lat);
        const lng = parseFloat(arr[0].lon);
        setCoords({ lat, lng });
        if (markerRef.current && mapRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          mapRef.current.setView([lat, lng], 16, { animate: true });
        }
      } else {
        toast.error("Endereço não encontrado");
      }
    } catch {
      toast.error("Falha ao buscar endereço");
    } finally {
      setSearching(false);
    }
  }

  async function handleSave() {
    if (!coords) {
      toast.error("Arraste o pino até o local correto");
      return;
    }
    setSaving(true);
    try {
      await onSave(coords);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Definir localização do destino</DialogTitle>
          <DialogDescription>
            Arraste o pino até o local exato da entrega. Você também pode buscar o endereço.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Endereço completo"
              className="pl-9"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
            />
          </div>
          <Button type="button" variant="outline" onClick={handleSearch} disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </Button>
        </div>

        <div
          ref={containerRef}
          style={{ height: 380, width: "100%", borderRadius: 12, overflow: "hidden", background: "#0b1220" }}
        />

        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {coords ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : "Toque no mapa ou arraste o pino"}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !coords}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MapPin className="h-4 w-4 mr-1" />}
            Salvar localização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
