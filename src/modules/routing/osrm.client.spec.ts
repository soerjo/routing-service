import { ConfigService } from '@nestjs/config';
import { OsrmClient } from './osrm.client.js';

type FetchMock = jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>;

const configService = (url = 'http://osrm:5000') =>
  ({ get: jest.fn().mockReturnValue(url) }) as unknown as ConfigService;

const jsonResponse = (body: unknown, ok = true) =>
  ({
    ok,
    json: jest.fn().mockResolvedValue(body),
  }) as unknown as Response;

const installFetch = (mock: FetchMock): void => {
  global.fetch = mock;
};

const buildFetchMock = (): FetchMock => jest.fn() as FetchMock;

describe('OsrmClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('parses a successful OSRM response', async () => {
    const fetchMock = buildFetchMock();
    fetchMock.mockResolvedValue(
      jsonResponse({
        code: 'Ok',
        routes: [{ distance: 1234.5, duration: 120.3, geometry: 'abc123' }],
      }),
    );
    installFetch(fetchMock);

    const client = new OsrmClient(configService());
    const result = await client.getRoute(
      { lat: -6.2, lng: 106.8 },
      { lat: -6.9, lng: 107.6 },
    );

    expect(result).toEqual({
      distanceMeters: 1234.5,
      durationSeconds: 120.3,
      polyline: 'abc123',
      routeSource: 'OSRM',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'http://osrm:5000/route/v1/driving/106.8,-6.2;107.6,-6.9?overview=full&geometries=polyline',
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns null on a non-2xx response', async () => {
    const fetchMock = buildFetchMock();
    fetchMock.mockResolvedValue(jsonResponse({}, false));
    installFetch(fetchMock);

    const client = new OsrmClient(configService());
    expect(
      await client.getRoute(
        { lat: -6.2, lng: 106.8 },
        { lat: -6.9, lng: 107.6 },
      ),
    ).toBeNull();
  });

  it("returns null when OSRM code is not 'Ok'", async () => {
    const fetchMock = buildFetchMock();
    fetchMock.mockResolvedValue(jsonResponse({ code: 'NoRoute', routes: [] }));
    installFetch(fetchMock);

    const client = new OsrmClient(configService());
    expect(
      await client.getRoute(
        { lat: -6.2, lng: 106.8 },
        { lat: -6.9, lng: 107.6 },
      ),
    ).toBeNull();
  });

  it('returns null when the request throws (timeout)', async () => {
    const fetchMock = buildFetchMock();
    fetchMock.mockRejectedValue(new Error('The operation was aborted'));
    installFetch(fetchMock);

    const client = new OsrmClient(configService());
    expect(
      await client.getRoute(
        { lat: -6.2, lng: 106.8 },
        { lat: -6.9, lng: 107.6 },
      ),
    ).toBeNull();
  });
});
