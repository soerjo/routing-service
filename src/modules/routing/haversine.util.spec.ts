import { haversineDistanceMeters } from './haversine.util.js';

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistanceMeters(-6.2, 106.8, -6.2, 106.8)).toBe(0);
  });

  it('approximates one degree of latitude at the equator', () => {
    const meters = haversineDistanceMeters(0, 0, 1, 0);
    expect(meters).toBeGreaterThan(111000);
    expect(meters).toBeLessThan(111300);
  });

  it('is symmetric', () => {
    const forward = haversineDistanceMeters(-6.2, 106.8, -6.9, 107.6);
    const backward = haversineDistanceMeters(-6.9, 107.6, -6.2, 106.8);
    expect(forward).toBeCloseTo(backward, 6);
  });
});
