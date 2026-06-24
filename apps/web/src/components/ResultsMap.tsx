import { useEffect } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { ListingSearchItem } from '@genuine-homes/shared';
import { formatMoney } from '@/lib/format';

// Vite serves these as URLs; wire them up so default markers actually render.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const KAMPALA: [number, number] = [0.3476, 32.5825];

function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export function ResultsMap({
  items,
  center,
  radiusM,
}: {
  items: ListingSearchItem[];
  center?: [number, number] | null;
  radiusM?: number;
}) {
  const located = items.filter(
    (i) => i.property.latitude != null && i.property.longitude != null,
  );
  const fallback: [number, number] = located[0]
    ? [located[0].property.latitude as number, located[0].property.longitude as number]
    : KAMPALA;
  const focus = center ?? fallback;
  const zoom = center ? 12 : 11;

  return (
    <div className="h-72 overflow-hidden rounded-xl border border-stone-200">
      <MapContainer center={focus} zoom={zoom} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={focus} zoom={zoom} />
        {center && radiusM ? (
          <Circle center={center} radius={radiusM} pathOptions={{ color: '#2D6A4F', fillOpacity: 0.05 }} />
        ) : null}
        {located.map((i) => (
          <Marker
            key={i.id}
            position={[i.property.latitude as number, i.property.longitude as number]}
          >
            <Popup>
              <strong>{i.property.title}</strong>
              <br />
              {formatMoney(i.price, i.currency)}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
