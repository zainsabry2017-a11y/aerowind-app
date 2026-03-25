import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";

import "leaflet/dist/leaflet.css";

type LatLon = { lat: number; lon: number };

function fixLeafletDefaultIcons() {
  // Vite + Leaflet requires explicit icon URLs (otherwise markers may be invisible)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Default = (L.Icon.Default as any);
  if (Default.__iconUrlPatched) return;

  Default.mergeOptions({
    iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
    iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
    shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
  });
  Default.__iconUrlPatched = true;
}

function ClickToSetMarker({ onPick }: { onPick: (pos: LatLon) => void }) {
  useMapEvents({
    click: (e) => onPick({ lat: e.latlng.lat, lon: e.latlng.lng }),
  });
  return null;
}

export default function CoordinatePickerMap(props: {
  value?: LatLon | null;
  onChange: (pos: LatLon) => void;
  height?: number;
}) {
  const { value, onChange, height = 260 } = props;
  const [internal, setInternal] = useState<LatLon | null>(value ?? null);

  useEffect(() => {
    fixLeafletDefaultIcons();
  }, []);

  useEffect(() => {
    if (value) setInternal(value);
  }, [value?.lat, value?.lon]);

  const center: [number, number] = useMemo(() => {
    if (internal) return [internal.lat, internal.lon];
    return [24.7136, 46.6753]; // sensible default (Riyadh)
  }, [internal]);

  return (
    <div className="border border-border rounded-sm overflow-hidden">
      <MapContainer center={center} zoom={internal ? 8 : 3} style={{ height }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToSetMarker
          onPick={(p) => {
            setInternal(p);
            onChange(p);
          }}
        />
        {internal && <Marker position={[internal.lat, internal.lon]} />}
      </MapContainer>
    </div>
  );
}

