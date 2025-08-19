import { type ExecutionContext, WorkerEntrypoint } from 'cloudflare:workers';
import { type Env, makeDurableObject, makeWorker } from '@livestore/sync-cf/cf-worker';

export class WebSocketServer extends makeDurableObject({
  onPush: async (message) => {
    console.log('onPush', message.batch);
  },
  onPull: async (message) => {
    console.log('onPull', message);
  },
}) {}

// Note AutoRouter not compatabile
const syncWorker = makeWorker({
  validatePayload: (payload: unknown) => {
    if (payload?.authToken !== 'insecure-token-change-me') {
      throw new Error('Invalid auth token');
    }
  },
  enableCORS: true,
});

export class WorkerLiveStore extends WorkerEntrypoint {
  // Currently, entrypoints without a named handler are not supported
  async fetch(request: Request) {
    return syncWorker.fetch(
      request,
      // @ts-expect-error
      this.env as Env,
      // @ts-expect-error
      this.ctx as ExecutionContext
    );
  }
}

export default WorkerLiveStore;
