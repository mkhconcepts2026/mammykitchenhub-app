"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  GoogleMap,
  LoadScript,
  Marker,
  Polyline,
} from "@react-google-maps/api";

type Point = {
  latitude: number;
  longitude: number;
};

type Props = {
  destination: Point & { address?: string | null };
  riderLocation: Point & {
    isLive: boolean;
    ageSeconds: number;
    updatedAt: string;
  } | null;
  encodedPolyline?: string | null;
};

const mapContainerStyle = {
  width: "100%",
  height: "min(62vh, 460px)",
};

const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#202124" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9aa0a6" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#202124" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#4b5563" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#242a30" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#9aa0a6" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#343a40" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1c1f22" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#bdc1c6" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4a5159" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2d3338" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#111827" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
];

function decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
  const points: google.maps.LatLngLiteral[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    const latitudeChange = (result & 1) ? ~(result >> 1) : result >> 1;
    latitude += latitudeChange;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    const longitudeChange = (result & 1) ? ~(result >> 1) : result >> 1;
    longitude += longitudeChange;

    points.push({
      lat: latitude / 1e5,
      lng: longitude / 1e5,
    });
  }

  return points;
}

export default function CustomerOrderTrackingMap({
  destination,
  riderLocation,
  encodedPolyline,
}: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const routePath = useMemo(
    () => (encodedPolyline ? decodePolyline(encodedPolyline) : []),
    [encodedPolyline]
  );
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const destinationPosition = {
    lat: destination.latitude,
    lng: destination.longitude,
  };
  const riderPosition = riderLocation
    ? { lat: riderLocation.latitude, lng: riderLocation.longitude }
    : null;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(destinationPosition);
    if (riderPosition) bounds.extend(riderPosition);
    routePath.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 54);
  }, [
    destination.latitude,
    destination.longitude,
    riderLocation?.latitude,
    riderLocation?.longitude,
    routePath,
  ]);

  if (!googleMapsKey) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl bg-slate-900 p-6 text-center text-sm text-white">
        Google Maps is not configured for this page. Your order status is still available below.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-[#17191c]">
      <LoadScript googleMapsApiKey={googleMapsKey}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={destinationPosition}
          zoom={14}
          onLoad={(map) => {
            mapRef.current = map;
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(destinationPosition);
            if (riderPosition) bounds.extend(riderPosition);
            routePath.forEach((point) => bounds.extend(point));
            map.fitBounds(bounds, 54);
          }}
          options={{
            styles: darkMapStyles,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            gestureHandling: "greedy",
            backgroundColor: "#202124",
          }}
        >
          {routePath.length > 1 && (
            <Polyline
              path={routePath}
              options={{
                strokeColor: "#ffffff",
                strokeOpacity: 0.96,
                strokeWeight: 5,
                geodesic: true,
                zIndex: 2,
              }}
            />
          )}

          <Marker
            position={destinationPosition}
            title="Your delivery address"
            label={{
              text: "YOU",
              color: "#111827",
              fontWeight: "700",
              fontSize: "10px",
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 13,
              fillColor: "#10bfa7",
              fillOpacity: 1,
              strokeColor: "#eafffb",
              strokeWeight: 3,
            }}
            zIndex={5}
          />

          {riderPosition && (
            <Marker
              position={riderPosition}
              title={
                riderLocation?.isLive
                  ? "Rider's live location"
                  : "Rider's last known location"
              }
              label={{
                text: "RIDER",
                color: "#ffffff",
                fontWeight: "700",
                fontSize: "10px",
              }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: riderLocation?.isLive ? 10 : 8,
                fillColor: riderLocation?.isLive ? "#f97316" : "#9ca3af",
                fillOpacity: riderLocation?.isLive ? 1 : 0.65,
                strokeColor: "#ffffff",
                strokeWeight: 3,
              }}
              zIndex={6}
            />
          )}
        </GoogleMap>
      </LoadScript>
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-xs text-gray-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-teal-400" /> Your delivery address
        </span>
        {riderLocation && (
          <span className="inline-flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${riderLocation.isLive ? "bg-orange-500" : "bg-gray-400"}`} />
            {riderLocation.isLive ? "Rider live GPS" : "Rider last known position"}
          </span>
        )}
        {routePath.length > 1 && <span>Google Maps route</span>}
      </div>
    </div>
  );
}
