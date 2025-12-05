import { makeDurableObject, makeWorker } from '@livestore/sync-cf/cf-worker';
import type { ExecutionContext } from '@cloudflare/workers-types';

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

    // Initialize ServerClientDO on first sync request to ensure agent is running
    if (url.searchParams.has('storeId')) {
      // Trigger agent initialization in the background
      const storeId = url.searchParams.get('storeId');
      if (storeId) {
        const id = env.SERVER_CLIENT_DO.idFromName('singleton');
        const stub = env.SERVER_CLIENT_DO.get(id);
        // Fire and forget - don't await
        ctx.waitUntil(stub.fetch(new Request('https://dummy/init')));
      }
    }

    // Handle sync requests
    return syncWorker.fetch(request, env, ctx);
  },
};
