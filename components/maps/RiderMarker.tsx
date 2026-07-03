"use client";

import { Marker } from "@react-google-maps/api";

type Props = {

  rider_id: string;

  latitude: number;

  longitude: number;

  status?: string;

  onClick?: () => void;

};

export default function RiderMarker({

  rider_id,

  latitude,

  longitude,

  status = "Available",

  onClick

}: Props) {

const markerColor =

  status === "Assigned"

    ? "#3B82F6"

    : status === "Picked Up"

    ? "#8B5CF6"

    : status === "Offline"

    ? "#EF4444"

    : "#F97316";

  return (

    <Marker

      position={{

        lat: Number(latitude),

        lng: Number(longitude)

      }}

      title={`MKH Rider ${rider_id}`}

onClick={onClick}

      icon={{

        path: window.google.maps.SymbolPath.CIRCLE,

        scale: 10,

        fillColor: markerColor,

        fillOpacity: 1,

        strokeColor: "#ffffff",

        strokeWeight: 3

      }}

    />

  );

}