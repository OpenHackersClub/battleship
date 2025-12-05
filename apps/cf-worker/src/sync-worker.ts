import { makeDurableObject, makeWorker } from '@livestore/sync-cf/cf-worker';
import type { ExecutionContext, Fetcher } from '@cloudflare/workers-types';

// Re-export ServerClientDO from dedicated file
export { ServerClientDO } from './server-client-do';

export class WebSocketServer extends makeDurableObject({
  onPush: async (message) => {
    console.log('onPush', message.batch);
  },
  onPull: async (message) => {
    console.log('onPull', message);
  },
}) {}

// Environment type definition
interface Env {
  SERVER_CLIENT_DO: DurableObjectNamespace;
  WEBSOCKET_SERVER: DurableObjectNamespace;
  ASSETS: Fetcher;
}

const syncWorker = makeWorker({
  validatePayload: (payload: unknown) => {
    console.log('payload ', payload);

    // Handle null, undefined, or empty payload
    if (!payload) {
      throw new Error('Missing payload');
    }

    // Handle malformed JSON that results in empty object
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

// Check if request is for sync/WebSocket (has storeId or is WebSocket upgrade)
const isSyncRequest = (request: Request, url: URL): boolean => {
  // WebSocket upgrade requests for sync
  if (request.headers.get('Upgrade') === 'websocket') {
    return true;
  }
  // Sync API requests have storeId parameter
  if (url.searchParams.has('storeId')) {
    return true;
  }
  return false;
};

// Export default worker handler that initializes ServerClientDO and handles sync
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Route to ServerClientDO for agent initialization
    if (url.pathname === '/agent' || url.pathname === '/agent/') {
      const id = env.SERVER_CLIENT_DO.idFromName('singleton');
      const stub = env.SERVER_CLIENT_DO.get(id);
      return stub.fetch(request);
    }

    // Handle sync/WebSocket requests
    if (isSyncRequest(request, url)) {
      // Initialize ServerClientDO on first sync request to ensure agent is running
      const storeId = url.searchParams.get('storeId');
      if (storeId) {
        const id = env.SERVER_CLIENT_DO.idFromName('singleton');
        const stub = env.SERVER_CLIENT_DO.get(id);
        // Fire and forget - don't await
        ctx.waitUntil(stub.fetch(new Request('https://dummy/init')));
      }
      // Handle sync requests
      return syncWorker.fetch(request, env, ctx);
    }

    // Serve static assets for all other requests (SPA)
    // Try to serve the requested file, fallback to index.html for SPA routing
    try {
      const response = await env.ASSETS.fetch(request);
      if (response.status === 404) {
        // SPA fallback: serve index.html for client-side routing
        const indexRequest = new Request(new URL('/', request.url).toString(), request);
        return env.ASSETS.fetch(indexRequest);
      }
      return response;
    } catch {
      // If assets fetch fails, return a basic 404
      return new Response('Not Found', { status: 404 });
    }
  },
};
