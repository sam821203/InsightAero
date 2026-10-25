import { useState, useEffect } from "react";

/** Fallback center (Taipei) when geolocation is unavailable or denied */
export const FALLBACK_CENTER = { lat: 25.033, lng: 121.5654 };

/** Default start point when no geolocation (Taipei 101) */
export const TAIPEI_101_FALLBACK = { lat: 25.0339, lng: 121.5645 };

export type UserLocationResult = {
  location: { lat: number; lng: number } | null;
  isLoading: boolean;
};

export function useUserLocation(): UserLocationResult {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setIsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  }, []);

  return { location, isLoading };
}
