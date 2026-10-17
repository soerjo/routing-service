import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Coordinates, RouteResult } from './routing.types.js';

export const OSRM_TIMEOUT_MS = 2000;
export const DEFAULT_OSRM_URL = 'http://localhost:5000';

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: string;
}

interface OsrmResponse {
  code?: string;
  routes?: OsrmRoute[];
}

@Injectable()
export class OsrmClient {
  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    const configured =
      this.configService.get<string>('OSRM_URL') ?? DEFAULT_OSRM_URL;
    return configured.replace(/\/+$/, '');
  }

  /**
   * Requests a driving route from OSRM. Returns `null` on any failure
   * (non-2xx, malformed payload, timeout) so callers can fall back.
   */
  async getRoute(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<RouteResult | null> {
    const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `${this.baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=polyline`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
      });
      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as OsrmResponse;
      const route = data.routes?.[0];
      if (data.code !== 'Ok' || !route) {
        return null;
      }

      return {
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        polyline: route.geometry,
        routeSource: 'OSRM',
      };
    } catch {
      return null;
    }
  }
}
