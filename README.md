<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

Routing-only service: road routing (OSRM with Haversine fallback), real-time
driver presence (Redis GEO), nearest-driver lookup, and an atomic accept-lock
primitive. Pricing/booking live in separate services (see `docs/SCOPE.md`).

## API contract

All routes are under the global prefix `/api`. Every response is wrapped by the
global interceptor as `{ statusCode, message, data, timestamp, path }`; the
payloads below are the `data` field.

| Method | Path                               | Auth   | Description                                             |
| ------ | ---------------------------------- | ------ | ------------------------------------------------------- |
| GET    | `/api/v1/routing/route`            | JWT    | Driving route between two points                        |
| GET    | `/api/v1/routing/nearby-drivers`   | JWT    | Active drivers near a point, nearest first              |
| POST   | `/api/v1/driver/location`          | DRIVER | Publish driver location + heartbeat                     |
| PATCH  | `/api/v1/driver/status`            | DRIVER | Update driver availability (OFFLINE removes from GEO)   |
| POST   | `/api/v1/locks/acquire`            | JWT    | Acquire `lock:<resourceKey>` (SET NX PX), returns token |
| POST   | `/api/v1/locks/release`            | JWT    | Release the lock only if the caller still owns the token|

### `GET /api/v1/routing/route`

Query: `originLat`, `originLng`, `destLat`, `destLng` (numbers).
Returns `{ distanceMeters, durationSeconds, polyline, routeSource }` where
`routeSource` is `OSRM` or `HAVERSINE_FALLBACK` (Haversine × 1.35, duration
derived from `HAVERSINE_SPEED_KMH`).

### `GET /api/v1/routing/nearby-drivers`

Query: `lat`, `lng`, `radiusKm` (default 5), `limit` (default 10, max 50).
Returns an ordered array `[{ driverId, distanceMeters }]` filtered by a live
`driver:heartbeat:<id>` key.

### `POST /api/v1/driver/location`

Body: `{ lat, lng }`. Writes `GEOADD drivers:locations:active` and
`SET driver:heartbeat:<id> "1" EX 60`; mirrors a best-effort `lastKnownLat/Lng`
snapshot into `driver_profiles`. The driver id comes from the JWT subject.

### `PATCH /api/v1/driver/status`

Body: `{ status }` where status is `OFFLINE`, `ONLINE`, or `BUSY`. Persists to
`driver_profiles`; `OFFLINE` also removes the driver from the GEO index.

### `POST /api/v1/locks/acquire` and `POST /api/v1/locks/release`

Acquire body: `{ resourceKey, ttlMs? }` (TTL defaults to `LOCK_TTL_MS`).
Returns `{ acquired, token }`. Release body: `{ resourceKey, token }`; the
release Lua script deletes the key only when the stored value still equals the
token. Returns `{ released }`.

## Redis keys

| Key                                  | Contents                          | TTL        |
| ------------------------------------ | --------------------------------- | ---------- |
| `drivers:locations:active` (GEO)     | member = driver id, geohash score | —          |
| `driver:heartbeat:<driver_id>`       | `"1"`                             | 60 seconds |
| `lock:<resource_key>`                | lock token                        | per acquire|

## Project setup

```bash
$ bun install
```

## Compile and run the project

```bash
# development
$ bun run start

# watch mode
$ bun run start:dev

# production mode
$ bun run start:prod
```

## Run tests

```bash
# unit tests
$ bun run test

# e2e tests
$ bun run test:e2e

# test coverage
$ bun run test:cov
```

## Environment variables

Create a `.env` file (see `.env.example`) before running the app. Key variables:

| Variable                 | Required | Default       | Description                                                                       |
| ------------------------ | -------- | ------------- | --------------------------------------------------------------------------------- |
| `NODE_ENV`               | No       | `development` | development \| production \| test                                                 |
| `PORT`                   | No       | `3000`        | Server port                                                                       |
| `DATABASE_URL`           | Yes      | —             | PostgreSQL connection string                                                      |
| `JWT_ACCESS_SECRET`      | Yes      | —             | Signs access tokens                                                               |
| `JWT_REFRESH_SECRET`     | Yes      | —             | Signs refresh tokens                                                              |
| `JWT_ACCESS_EXPIRATION`  | No       | `15m`         | Access token expiry (`s`/`m`/`h`/`d` suffix, or bare seconds)                      |
| `JWT_REFRESH_EXPIRATION` | No       | `7d`          | Refresh token expiry (`s`/`m`/`h`/`d` suffix, or bare seconds)                     |
| `GOOGLE_CLIENT_ID`       | Yes      | —             | Google OAuth client ID                                                            |
| `GOOGLE_CLIENT_SECRET`   | Yes      | —             | Google OAuth client secret                                                        |
| `GOOGLE_CALLBACK_URL`    | No       | see `.env.example` | Google OAuth callback URL                                                    |
| `FRONTEND_URL`           | No       | `http://localhost:5173` | Frontend base URL (Google OAuth redirect)                                |
| `CORS_ORIGINS`           | No       | —             | Comma-separated allowed origins; unset/empty enables CORS for all origins (dev)   |
| `OSRM_URL`               | No       | `http://localhost:5000` | OSRM backend base URL                                       |
| `REDIS_URL`              | No       | `redis://localhost:6379` | Redis connection string (GEO index + locks)                |
| `HAVERSINE_SPEED_KMH`    | No       | `30`          | Average speed used to estimate fallback route duration                    |
| `LOCK_TTL_MS`            | No       | `30000`       | Default lock TTL for `POST /api/v1/locks/acquire`                         |

### Deploying the production stack

`docker-compose.prod.yml` runs the app, Redis, and OSRM as one stack. OSRM needs
a preprocessed regional map extract (Jabodetabek/Indonesia) placed in `./osrm`
— the compose file documents the `osrm-extract` / `osrm-partition` /
`osrm-customize` commands. Create `.env` from `.env.example` (fill in
`DATABASE_URL` and the JWT secrets), then:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Redis and OSRM stay on the internal network; only the app port is published.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ bun install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
