"use client";

import { InfoWindow } from "@react-google-maps/api";

type Props = {

  rider: any;

  onClose: () => void;

};

export default function DispatchInfoWindow({

  rider,

  onClose

}: Props) {

  return (

    <InfoWindow

      position={{

        lat: Number(rider.latitude),

        lng: Number(rider.longitude)

      }}

      onCloseClick={onClose}

    >

      <div className="min-w-[220px] p-2">

     <div className="space-y-4">

  <div>

    <h3 className="text-xl font-bold text-slate-800">

      🛵 {rider.rider?.full_name || "MKH Rider"}

    </h3>

    <p className="text-sm text-gray-500">

      Live Dispatch Status

    </p>

  </div>

  <div className="border-t pt-3 space-y-2">

    <div className="flex justify-between">

      <span className="text-gray-500">

        Phone

      </span>

      <span className="font-medium">

        {rider.rider?.phone || "--"}

      </span>

    </div>

    <div className="flex justify-between">

      <span className="text-gray-500">

        Status

      </span>

      <span className="font-semibold text-green-600">

        {rider.rider?.currentStatus || "Available"}

      </span>

    </div>

    <div className="flex justify-between">

      <span className="text-gray-500">

        Score

      </span>

      <span>

        {rider.rider?.score ?? 0}%

      </span>

    </div>

    <div className="flex justify-between">

      <span className="text-gray-500">

        Revenue

      </span>

      <span>

        ₦{Number(rider.rider?.revenue || 0).toLocaleString()}

      </span>

    </div>

  </div>

</div>
      </div>

    </InfoWindow>

  );

}