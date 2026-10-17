export type RouteSource = 'OSRM' | 'HAVERSINE_FALLBACK';

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
  routeSource: RouteSource;
}

export interface NearbyDriver {
  driverId: string;
  distanceMeters: number;
}

export interface Coordinates {
  lat: number;
  lng: number;
}
