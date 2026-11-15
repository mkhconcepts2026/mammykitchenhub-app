"use client";

import { useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";

export type GoogleDestination = {
  placeId: string | null;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  captureMethod: "google_place" | "map_pin";
};

type Props = {
  selectedLocation: GoogleDestination | null;
  disabled?: boolean;
  onLocationSelected: (location: GoogleDestination) => void;
  onSelectionCleared: () => void;
};

const GOOGLE_MAPS_LIBRARIES: ("places")[] = ["places"];

const DEFAULT_LAGOS_CENTER = {
  lat: 6.5244,
  lng: 3.3792,
};

const ACCEPTED_DELIVERY_PLACE_TYPES = new Set([
  "street_address",
  "premise",
  "subpremise",
]);

function isCompleteNigeriaDeliveryAddress(
  placeTypes: unknown,
  addressComponents: unknown,
  formattedAddress: unknown,
): boolean {
  const types = Array.isArray(placeTypes)
    ? placeTypes.map((type) => String(type).toLowerCase())
    : [];
  const components = Array.isArray(addressComponents) ? addressComponents : [];
  const hasComponent = (expected: string) => components.some((component: any) =>
    Array.isArray(component?.types) && component.types.includes(expected)
  );
  const country = components.find((component: any) =>
    Array.isArray(component?.types) && component.types.includes("country")
  );
  const countryCode = String(country?.shortText ?? country?.short_name ?? "").toUpperCase();
  const countryName = String(country?.longText ?? country?.long_name ?? "").trim().toLowerCase();
  const addressText = typeof formattedAddress === "string" ? formattedAddress.trim() : "";
  const hasStreetNumber = hasComponent("street_number") ||
    /^\s*(?:no\.?\s*)?\d+[a-z]?\b/i.test(addressText);
  const hasStreetRoute = hasComponent("route");
  const hasSubpremise = types.includes("subpremise") || hasComponent("subpremise");
  const hasAddressType = types.some((type) => ACCEPTED_DELIVERY_PLACE_TYPES.has(type));

  return (countryCode === "NG" || countryName === "nigeria") &&
    hasAddressType && hasStreetRoute && (hasStreetNumber || hasSubpremise);
}

const mapContainerStyle = {
  width: "100%",
  height: "min(62vh, 520px)",
};

export default function GoogleDeliveryAddressPicker({
  selectedLocation,
  disabled = false,
  onLocationSelected,
  onSelectionCleared,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded, loadError } = useJsApiLoader({
    id: "mkh-customer-google-maps",
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: "weekly",
  });

  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);
  const callbacksRef = useRef({
    onLocationSelected,
    onSelectionCleared,
  });

  callbacksRef.current = {
    onLocationSelected,
    onSelectionCleared,
  };

  const [widgetError, setWidgetError] = useState("");
  const [mapError, setMapError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapBusy, setMapBusy] = useState(false);
  const [mapCenter, setMapCenter] = useState(DEFAULT_LAGOS_CENTER);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

  // Mount Google's current Place Autocomplete element into React's host.
  useEffect(() => {
    if (!isLoaded || !widgetHostRef.current || disabled) return;

    let active = true;
    let widget: any = null;

    const handleInput = () => {
      if (widget?.dataset?.mkhHasSelection === "true") {
        widget.dataset.mkhHasSelection = "false";
        callbacksRef.current.onSelectionCleared();
      }
    };

    const handleSelect = async (event: Event) => {
      setWidgetError("");

      try {
        const selectionEvent = event as any;
        const prediction = selectionEvent.placePrediction;

        if (!prediction || typeof prediction.toPlace !== "function") {
          throw new Error("Google did not return a selected place.");
        }

        const place = prediction.toPlace();

        await place.fetchFields({
          fields: ["id", "formattedAddress", "location", "types", "addressComponents"],
        });

        const placeTypes = Array.isArray(place.types) ? place.types : [];
        const addressComponents = Array.isArray(place.addressComponents)
          ? place.addressComponents
          : [];
        const googleFormattedAddress =
          typeof place.formattedAddress === "string"
            ? place.formattedAddress.trim()
            : "";

        if (!isCompleteNigeriaDeliveryAddress(
          placeTypes,
          addressComponents,
          googleFormattedAddress,
        )) {
          throw new Error(
            "Google found only an estate/area or an incomplete address. Search with your house number and street name, then select a result containing both. If Google does not list your exact address, pin the delivery entrance on the map."
          );
        }

        const location = place.location;
        const latitude =
          typeof location?.lat === "function"
            ? Number(location.lat())
            : Number(location?.latitude);

        const longitude =
          typeof location?.lng === "function"
            ? Number(location.lng())
            : Number(location?.longitude);

        const placeId =
          typeof place.id === "string" ? place.id.trim() : "";

        const formattedAddress =
          typeof place.formattedAddress === "string"
            ? place.formattedAddress.trim()
            : "";

        if (
          !placeId ||
          !formattedAddress ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          throw new Error("Google could not confirm the selected address.");
        }

        if (!active) return;

        if (widget) widget.dataset.mkhHasSelection = "true";

        callbacksRef.current.onLocationSelected({
          placeId,
          formattedAddress,
          latitude,
          longitude,
          captureMethod: "google_place",
        });
      } catch (error) {
        if (!active) return;

        setWidgetError(
          error instanceof Error
            ? error.message
            : "Google Maps could not confirm this address."
        );
      }
    };

    const mount = async () => {
      try {
        const placesLibrary = await (google.maps as any).importLibrary(
          "places"
        );

        if (!active || !widgetHostRef.current) return;

        widget = new placesLibrary.PlaceAutocompleteElement({
          includedRegionCodes: ["ng"],
          requestedLanguage: "en",
          requestedRegion: "NG",
        });

        widget.placeholder =
          "Enter house number + street name + estate/locality in Google Maps";

        widget.style.width = "100%";
        widget.style.display = "block";
        widget.style.minHeight = "54px";

        widget.setAttribute(
          "aria-label",
          "Search for your delivery address on Google Maps"
        );

        widget.addEventListener("gmp-select", handleSelect);
        widget.addEventListener("input", handleInput);

        widgetHostRef.current.replaceChildren(widget);
        widgetRef.current = widget;

        // Bias suggestions towards the selected MKH locality.
        // This is a search preference only, never the delivery destination.
        if (localityLabel.trim()) {
          try {
            const geocoder = new google.maps.Geocoder();
            const response = await geocoder.geocode({
              address: `${localityLabel}, Lagos, Nigeria`,
              region: "NG",
            });

            const location = response.results?.[0]?.geometry?.location;

            if (active && location && widget) {
              const bounds = new google.maps.Circle({
                center: location,
                radius: 12000,
              }).getBounds();

              if (bounds) widget.locationBias = bounds;
            }
          } catch {
            // Autocomplete remains available without locality bias.
          }
        }
      } catch (error) {
        if (active) {
          setWidgetError(
            error instanceof Error
              ? error.message
              : "Google address search could not be loaded."
          );
        }
      }
    };

    void mount();

    return () => {
      active = false;

      if (widget) {
        widget.removeEventListener("gmp-select", handleSelect);
        widget.removeEventListener("input", handleInput);
        widget.remove();
      }

      widgetRef.current = null;
      widgetHostRef.current?.replaceChildren();
    };
  }, [isLoaded, localityLabel, disabled]);

  // Open the pin picker at the selected MKH area, or at the current selection.
  useEffect(() => {
    if (!mapOpen || !isLoaded) return;

    if (selectedLocation) {
      const position = {
        lat: selectedLocation.latitude,
        lng: selectedLocation.longitude,
      };
      setMapCenter(position);
      setPin(position);
      return;
    }

    setPin(null);

    if (!localityLabel.trim()) {
      setMapCenter(DEFAULT_LAGOS_CENTER);
      return;
    }

    let active = true;

    const centreMap = async () => {
      try {
        const geocoder = new google.maps.Geocoder();
        const response = await geocoder.geocode({
          address: `${localityLabel}, Lagos, Nigeria`,
          region: "NG",
        });

        const location = response.results?.[0]?.geometry?.location;

        if (active && location) {
          setMapCenter({
            lat: location.lat(),
            lng: location.lng(),
          });
        } else if (active) {
          setMapCenter(DEFAULT_LAGOS_CENTER);
        }
      } catch {
        if (active) setMapCenter(DEFAULT_LAGOS_CENTER);
      }
    };

    void centreMap();

    return () => {
      active = false;
    };
  }, [mapOpen, isLoaded, localityLabel, selectedLocation]);

  function openPinPicker() {
    setMapError("");
    setPin(
      selectedLocation
        ? {
            lat: selectedLocation.latitude,
            lng: selectedLocation.longitude,
          }
        : null
    );
    setMapOpen(true);
  }

  function useCurrentLocation() {
    setMapError("");

    if (!navigator.geolocation) {
      setMapError("Your browser does not support location access.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setPin(current);
        setMapCenter(current);
      },
      () => {
        setMapError(
          "Location access was not granted. You can still move the map pin manually."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  async function confirmMapPin() {
    if (!pin) {
      setMapError("Tap the map or move the pin to your delivery entrance first.");
      return;
    }

    setMapBusy(true);
    setMapError("");

    let formattedAddress = "";
    let placeId: string | null = null;

    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({
        location: pin,
        region: "NG",
      });

      const results = response.results ?? [];
      const best =
        results.find((result) =>
          result.types.some((type) =>
            [
              "street_address",
              "premise",
              "subpremise",
              "route",
            ].includes(type)
          )
        ) ?? results[0];

      formattedAddress = best?.formatted_address?.trim() ?? "";
      placeId = best?.place_id ?? null;
    } catch {
      // The selected Google Map pin itself remains the exact destination.
      // The server will also attempt reverse geocoding when it calculates the route.
    }

    const location: GoogleDestination = {
      placeId,
      formattedAddress:
        formattedAddress ||
        `Google Maps pin (${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)})`,
      latitude: pin.lat,
      longitude: pin.lng,
      captureMethod: "map_pin",
    };

    callbacksRef.current.onLocationSelected(location);

    if (widgetRef.current) {
      widgetRef.current.value = location.formattedAddress;
      widgetRef.current.dataset.mkhHasSelection = "true";
    }

    setMapBusy(false);
    setMapOpen(false);
  }

  return (
    <div className="space-y-3">
      <div
        ref={widgetHostRef}
        className="min-h-[54px] w-full overflow-visible rounded-xl border border-slate-300 bg-white"
      />

      {widgetError && (
        <p role="alert" className="text-sm text-red-700">
          {widgetError}
        </p>
      )}

      {loadError && (
        <p role="alert" className="text-sm text-red-700">
          Google Maps could not load. Please check the Maps JavaScript API key
          configuration.
        </p>
      )}

      {!apiKey && (
        <p role="alert" className="text-sm text-red-700">
          Google Maps is not configured for this website.
        </p>
      )}

      {selectedLocation && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-bold text-emerald-900">
            Google Maps location captured
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            {selectedLocation.formattedAddress}
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            {selectedLocation.captureMethod === "map_pin"
              ? "Exact map pin"
              : "Google Place selected"}
            {" · "}
            {selectedLocation.latitude.toFixed(6)},{" "}
            {selectedLocation.longitude.toFixed(6)}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={openPinPicker}
          disabled={disabled || !isLoaded}
          className="rounded-lg border border-orange-400 px-4 py-2 text-sm font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
        >
          {selectedLocation
            ? "Adjust exact delivery pin on map"
            : "Can't find the exact address? Pin it on the map"}
        </button>

        {selectedLocation && (
          <button
            type="button"
            onClick={() => {
              callbacksRef.current.onSelectionCleared();
              if (widgetRef.current) {
                widgetRef.current.value = "";
                widgetRef.current.dataset.mkhHasSelection = "false";
              }
            }}
            disabled={disabled}
            className="text-sm font-semibold text-slate-600 underline"
          >
            Search for another location
          </button>
        )}
      </div>

      <p className="text-xs leading-5 text-slate-600">
        Search with your house number and street name, plus the estate or locality,
        then select the Google result showing that full address. Estate or area-only
        results are rejected. If Google does not list your exact address, place the
        pin at the actual delivery entrance and add directions in Delivery Notes.
      </p>

      {mapOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm exact delivery point on Google Maps"
        >
          <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div>
                <h3 className="font-bold text-slate-900">
                  Pin your exact delivery point
                </h3>
                <p className="text-xs text-slate-600">
                  Place the marker at the building entrance or gate.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMapOpen(false)}
                className="rounded-lg border px-3 py-2 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b p-3">
              <button
                type="button"
                onClick={useCurrentLocation}
                className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-700"
              >
                Use my current location
              </button>

              {pin && (
                <span className="text-xs text-slate-600">
                  Pin: {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
                </span>
              )}
            </div>

            <div className="min-h-0 flex-1 p-2">
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={mapCenter}
                  zoom={17}
                  onClick={(event) => {
                    const point = event.latLng;
                    if (point) {
                      setPin({
                        lat: point.lat(),
                        lng: point.lng(),
                      });
                    }
                  }}
                  options={{
                    mapTypeControl: true,
                    streetViewControl: true,
                    fullscreenControl: true,
                    clickableIcons: false,
                  }}
                >
                  {pin && (
                    <Marker
                      position={pin}
                      draggable
                      onDragEnd={(event) => {
                        const point = event.latLng;
                        if (point) {
                          setPin({
                            lat: point.lat(),
                            lng: point.lng(),
                          });
                        }
                      }}
                    />
                  )}
                </GoogleMap>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-600">
                  Loading Google Maps...
                </div>
              )}
            </div>

            <div className="border-t p-4">
              {mapError && (
                <p role="alert" className="mb-2 text-sm text-red-700">
                  {mapError}
                </p>
              )}

              <button
                type="button"
                onClick={() => void confirmMapPin()}
                disabled={!pin || mapBusy}
                className="w-full rounded-xl bg-orange-500 p-3 font-bold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {mapBusy ? "Confirming Google Maps pin..." : "Confirm this delivery pin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}