"use client";

import DispatchInfoWindow from "./DispatchInfoWindow";
import RiderMarker from "./RiderMarker";

import {

  GoogleMap,

  LoadScript,

  Marker

} from "@react-google-maps/api";

import {

  useCallback,

  useRef,

  useState

} from "react";

type RiderLocation = {
  rider_id: string;
  latitude: number;
  longitude: number;
};

type Props = {

  riderLocations: RiderLocation[];

  riders: any[];

};

const containerStyle = {
  width: "100%",
  height: "650px",
  borderRadius: "24px"
};

const defaultCenter = {
  lat: 6.5244,
  lng: 3.3792
};

export default function LiveDispatchMap({

  riderLocations,

  riders

}: Props) {

    const mapRef =

  useRef<google.maps.Map | null>(null);

const onLoad =

  useCallback(

    (map: google.maps.Map) => {

      mapRef.current = map;

    },

    []

  );

const [

  selectedRider,

  setSelectedRider

] =

useState<any>(null);

  const center =

    riderLocations.length > 0

      ? {

          lat: Number(riderLocations[0].latitude),

          lng: Number(riderLocations[0].longitude)

        }

      : defaultCenter;

  return (

    <LoadScript

      googleMapsApiKey={
        process.env
          .NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!
      }

    >

     <GoogleMap

  mapContainerStyle={containerStyle}

  center={center}

  zoom={13}

  onLoad={onLoad}

  onTilesLoaded={() => {

    if (

      !mapRef.current ||

      riderLocations.length === 0

    ) return;

    const bounds =

      new google.maps.LatLngBounds();

    riderLocations.forEach(

      (location) => {

        bounds.extend({

          lat: Number(location.latitude),

          lng: Number(location.longitude)

        });

      }

    );

    mapRef.current.fitBounds(bounds);

  }}

>

        {

          riderLocations.map((location) => (

       <RiderMarker

  key={location.rider_id}

  rider_id={location.rider_id}

  latitude={Number(location.latitude)}

  longitude={Number(location.longitude)}

  status={

    riders.find(

      (r) => r.id === location.rider_id

    )?.currentStatus

  }

  onClick={() => {

    const rider = riders.find(

      (r) => r.id === location.rider_id

    );

    setSelectedRider({

      ...location,

      rider

    });

  }}

/>

          ))

        }

{

  selectedRider && (

    <DispatchInfoWindow

      rider={selectedRider}

      onClose={() =>

        setSelectedRider(null)

      }

    />

  )

}

      </GoogleMap>

    </LoadScript>

  );

}