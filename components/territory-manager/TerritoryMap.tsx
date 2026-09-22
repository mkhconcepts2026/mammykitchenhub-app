"use client";

import { useEffect, useRef } from "react";


interface RiderLocation {
  id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  updated_at: string;
  profiles?: {
    full_name: string;
    status: string;
  };
}

interface Props {
  riders: RiderLocation[];
}

export default function TerritoryMap({ riders }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMap = useRef<any>(null);

 useEffect(() => {
  let map: any;

 async function initialiseMap() {
  if (!mapRef.current) return;

  const L = await import("leaflet");
  await import("leaflet/dist/leaflet.css");

  // MKH Rider Marker
  const riderIcon = L.icon({
    iconUrl: "/icons/rider-marker.png",
    iconRetinaUrl: "/icons/rider-marker.png",
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -36],
  });

  // Create map once
  if (!leafletMap.current) {
    leafletMap.current = L.map(mapRef.current).setView(
      [6.5244, 3.3792], // Lagos
      12
    );

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenStreetMap contributors",
      }
    ).addTo(leafletMap.current);
  }

  const map = leafletMap.current;

  // Remove existing rider markers only
  map.eachLayer((layer: any) => {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });

  // Draw riders and calculate map bounds
const bounds = L.latLngBounds([]);

riders.forEach((rider) => {
  if (!rider.latitude || !rider.longitude) return;

  const position: [number, number] = [
    Number(rider.latitude),
    Number(rider.longitude),
  ];

  bounds.extend(position);

  L.marker(position, {
    icon: riderIcon,
  })
    .addTo(map)
    .bindPopup(`
      <strong>${rider.profiles?.full_name ?? "Unknown Rider"}</strong><br/>
      Status: ${rider.profiles?.status ?? "Unknown"}<br/>
      Speed: ${Math.round(rider.speed ?? 0)} km/h
    `);
});

// Automatically fit all riders
if (bounds.isValid()) {
  map.fitBounds(bounds, {
    padding: [60, 60],
    maxZoom: 16,
  });
}
}

  initialiseMap();

}, [riders]);

  return (
    <div
      ref={mapRef}
      className="h-[650px] w-full rounded-3xl border border-slate-200"
    />
  );
}