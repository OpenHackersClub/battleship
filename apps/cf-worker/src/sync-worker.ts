import type { ExecutionContext, Fetcher } from '@cloudflare/workers-types';
import {
  HttpApp,
  HttpMiddleware,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform';
import { makeDurableObject, makeWorker } from '@livestore/sync-cf/cf-worker';
import { Effect } from 'effect';

// Re-export ServerClientDO from dedicated file
export { ServerClientDO } from './server-client-do';

export class WebSocketServer extends makeDurableObject({}) {}

// Environment type definition
interface Env {
  SERVER_CLIENT_DO: DurableObjectNamespace;
  WEBSOCKET_SERVER: DurableObjectNamespace;
  ASSETS: Fetcher;
}

const syncWorker = makeWorker({
  validatePayload: (payload: unknown) => {
    if (!payload) {
      throw new Error('Missing payload');
    }
    if (typeof payload !== 'object') {
      throw new Error('Invalid payload format');
    }
    if ((payload as Record<string, unknown>)?.authToken !== 'insecure-token-change-me') {
      throw new Error('Invalid auth token');
    }
  },
  syncBackendBinding: 'WEBSOCKET_SERVER',
  enableCORS: true,
});

// CORS middleware using @effect/platform
const corsMiddleware = HttpMiddleware.cors({
  allowedOrigins: ['*'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Create router with routes
const makeRouter = (env: Env, ctx: ExecutionContext) =>
  HttpRouter.empty.pipe(
    // Agent route - initialize ServerClientDO
    HttpRouter.all(
      '/agent',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const id = env.SERVER_CLIENT_DO.idFromName('singleton');
        const stub = env.SERVER_CLIENT_DO.get(id);
        const response = yield* Effect.promise(() => stub.fetch(request.source as Request));
        return HttpServerResponse.raw(response);
      })
    ),
    HttpRouter.all(
      '/agent/*',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const id = env.SERVER_CLIENT_DO.idFromName('singleton');
        const stub = env.SERVER_CLIENT_DO.get(id);
        const response = yield* Effect.promise(() => stub.fetch(request.source as Request));
        return HttpServerResponse.raw(response);
      })
    ),

    // Sync/WebSocket route
    HttpRouter.all(
      '/sync',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const url = new URL((request.source as Request).url);
        const storeId = url.searchParams.get('storeId');

        console.log('[sync-worker] Sync request received, storeId:', storeId);

        if (storeId) {
          console.log('[sync-worker] Triggering ServerClientDO initialization...');
          const id = env.SERVER_CLIENT_DO.idFromName('singleton');
          const stub = env.SERVER_CLIENT_DO.get(id);
          ctx.waitUntil(
            stub.fetch(new Request(`https://dummy/init?storeId=${encodeURIComponent(storeId)}`))
          );
        }

        const response = yield* Effect.promise(() =>
          syncWorker.fetch(request.source as Request, env, ctx)
        );
        return HttpServerResponse.raw(response);
      })
    ),
    HttpRouter.all(
      '/sync/*',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const url = new URL((request.source as Request).url);
        const storeId = url.searchParams.get('storeId');

        console.log('[sync-worker] Sync request received, storeId:', storeId);

        if (storeId) {
          console.log('[sync-worker] Triggering ServerClientDO initialization...');
          const id = env.SERVER_CLIENT_DO.idFromName('singleton');
          const stub = env.SERVER_CLIENT_DO.get(id);
          ctx.waitUntil(
            stub.fetch(new Request(`https://dummy/init?storeId=${encodeURIComponent(storeId)}`))
          );
        }

        const response = yield* Effect.promise(() =>
          syncWorker.fetch(request.source as Request, env, ctx)
        );
        return HttpServerResponse.raw(response);
      })
    ),

    // Fallback: serve static assets (SPA)
    HttpRouter.all(
      '/*',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;

        const response = yield* Effect.tryPromise({
          try: () => env.ASSETS.fetch(request.source as Request),
          catch: () => new Error('Assets fetch failed'),
        });

        if (response.status === 404) {
          // SPA fallback: serve index.html for client-side routing
          const indexRequest = new Request(
            new URL('/', (request.source as Request).url).toString(),
            request.source as Request
          );
          const indexResponse = yield* Effect.promise(() => env.ASSETS.fetch(indexRequest));
          return HttpServerResponse.raw(indexResponse);
        }

        return HttpServerResponse.raw(response);
      })
    )
  );

// Export default worker handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const router = makeRouter(env, ctx);

    // Apply CORS middleware to agent routes only
    const url = new URL(request.url);
    const isAgentRoute = url.pathname === '/agent' || url.pathname.startsWith('/agent/');

    const finalRouter = isAgentRoute ? router.pipe(HttpRouter.use(corsMiddleware)) : router;

    // Convert router to HttpApp and create web handler
    const program = Effect.gen(function* () {
      const httpApp = yield* HttpRouter.toHttpApp(finalRouter);
      const handler = HttpApp.toWebHandler(httpApp);
      return yield* Effect.promise(() => handler(request));
    });

    return Effect.runPromise(program);
  },
};
