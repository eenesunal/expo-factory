import * as Location from "expo-location";
import { isSupabaseConfigured, supabase } from "./supabase";

export type Coordinates = { latitude: number; longitude: number };

export type NearbyPlace = {
  entityId: string;
  title: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

// Sadece ÖN PLAN izni istiyoruz. Arka plan konumu ("always") Apple'dan ek
// gerekçe ister ve review'ı belirgin şekilde zorlaştırır — gerçekten
// gerekmiyorsa istemeyin.
export async function requestLocation(): Promise<Coordinates | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;

  const location = await Location.getCurrentPositionAsync({});
  return { latitude: location.coords.latitude, longitude: location.coords.longitude };
}

// "Kadıköy, İstanbul" gibi okunabilir bir etiket — sadece görüntü için,
// hesaplamalar buna bağımlı olmamalı (reverse geocode başarısız olabilir).
export async function reverseGeocodeLabel(coords: Coordinates): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync(coords);
    if (!place) return null;
    const district = place.subregion || place.district;
    const city = place.city || place.region;
    const parts = [district, city].filter((p, i, arr) => Boolean(p) && arr.indexOf(p) === i);
    return parts.length > 0 ? parts.join(", ") : null;
  } catch {
    return null;
  }
}

// DİKKAT: konumu asla URL query string'ine koymayın (log'lara ve üçüncü
// taraflara sızar) — RPC gövdesiyle gidiyor.
export async function nearby(
  coords: Coordinates,
  options?: { radiusKm?: number; limit?: number }
): Promise<NearbyPlace[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc("nearby_places", {
    p_latitude: coords.latitude,
    p_longitude: coords.longitude,
    p_radius_km: options?.radiusKm ?? 10,
    p_limit: options?.limit ?? 50,
  });
  if (error || !data) {
    if (error) console.error("Yakındakiler okunamadı:", error);
    return [];
  }
  return (
    data as { entity_id: string; title: string; latitude: number; longitude: number; distance_km: number }[]
  ).map((r) => ({
    entityId: r.entity_id,
    title: r.title,
    latitude: r.latitude,
    longitude: r.longitude,
    distanceKm: r.distance_km,
  }));
}
