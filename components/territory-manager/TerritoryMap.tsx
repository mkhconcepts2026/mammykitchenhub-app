"use client";

import { useEffect, useRef } from "react";

interface CurrentOrder {
  id: string;
  order_number: string | null;
  status: string;
  vendor_id: string | null;
  rider_id: string | null;
  total: number;
  created_at: string;
}

interface RiderLocation {
  id: string;
  rider_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  updated_at: string;

  profiles?: {
    full_name: string | null;
    status: string | null;
  };

  current_order: CurrentOrder | null;

  operational_status:
    | "available"
    | "assigned"
    | "delivering"
    | "offline";
}

interface Props {
  riders: RiderLocation[];
}

function formatOperationalStatus(status: string) {
  switch (status) {
    case "available":
      return "Available";

    case "assigned":
      return "Assigned";

    case "delivering":
      return "Delivering";

    case "offline":
      return "Offline";

    default:
      return status;
  }
}

function formatOrderStatus(status: string) {
  switch (status) {
    case "assigned":
      return "Assigned";

    case "picked_up":
      return "Picked Up";

    default:
      return status.replaceAll("_", " ");
  }
}

function getStatusColour(status: string) {
  switch (status) {
    case "available":
      return "#059669";

    case "assigned":
      return "#2563EB";

    case "delivering":
      return "#EA580C";

    case "offline":
      return "#64748B";

    default:
      return "#64748B";
  }
}

function getGpsFreshness(updatedAt: string) {
  const updatedTime = new Date(updatedAt).getTime();

  if (Number.isNaN(updatedTime)) {
    return "Unknown";
  }

  const ageSeconds = Math.floor(
    (Date.now() - updatedTime) / 1000
  );

  if (ageSeconds <= 15) {
    return "Live";
  }

  if (ageSeconds <= 60) {
    return `${ageSeconds}s ago`;
  }

  const ageMinutes = Math.floor(ageSeconds / 60);

  if (ageMinutes < 60) {
    return `${ageMinutes}m ago`;
  }

  return "Stale";
}

export default function TerritoryMap({ riders }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMap = useRef<any>(null);

  useEffect(() => {
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
          [6.5244, 3.3792],
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

      // Remove existing rider markers only.
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) {
          map.removeLayer(layer);
        }
      });

      // Draw riders and calculate map bounds.
      const bounds = L.latLngBounds([]);

      riders.forEach((rider) => {
        const latitude = Number(rider.latitude);
        const longitude = Number(rider.longitude);

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return;
        }

        const position: [number, number] = [
          latitude,
          longitude,
        ];

        bounds.extend(position);

        const riderName =
          rider.profiles?.full_name ?? "Unknown Rider";

        const operationalStatus =
          formatOperationalStatus(
            rider.operational_status
          );

        const statusColour = getStatusColour(
          rider.operational_status
        );

        const currentOrder =
          rider.current_order;

        const orderNumber =
          currentOrder?.order_number ??
          currentOrder?.id ??
          null;

        const orderStatus =
          currentOrder
            ? formatOrderStatus(
                currentOrder.status
              )
            : "No active delivery";

        const gpsFreshness =
          getGpsFreshness(
            rider.updated_at
          );

        L.marker(position, {
          icon: riderIcon,
        })
          .addTo(map)
          .bindPopup(`
            <div style="min-width: 230px;">
              <div style="margin-bottom: 8px;">
                <strong style="font-size: 16px;">
                  ${riderName}
                </strong>
              </div>

              <div style="margin-bottom: 6px;">
                <strong>Operational Status:</strong>
                <span style="color: ${statusColour}; font-weight: 700;">
                  ${operationalStatus}
                </span>
              </div>

              <div style="margin-bottom: 6px;">
                <strong>Current Delivery:</strong>
                ${orderNumber ?? "None"}
              </div>

              <div style="margin-bottom: 6px;">
                <strong>Delivery Status:</strong>
                ${orderStatus}
              </div>

              <div style="margin-bottom: 6px;">
                <strong>Speed:</strong>
                ${Math.round(rider.speed ?? 0)} km/h
              </div>

              <div style="margin-bottom: 6px;">
                <strong>GPS Accuracy:</strong>
                ${Math.round(rider.accuracy ?? 0)} m
              </div>

              <div>
                <strong>GPS:</strong>
                ${gpsFreshness}
              </div>
            </div>
          `);
      });

      // Automatically fit all riders.
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