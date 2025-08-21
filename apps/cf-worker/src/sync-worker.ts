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

export default makeWorker({
  validatePayload: (payload: any) => {
    console.log('payload ', payload);

    // Handle null, undefined, or empty payload
    if (!payload) {
      throw new Error('Missing payload');
    }

    // Handle malformed JSON that results in empty object
    if (typeof payload !== 'object') {
      throw new Error('Invalid payload format');
    }

    if (payload?.authToken !== 'insecure-token-change-me') {
      throw new Error('Invalid auth token');
    }
  },
  enableCORS: true,
});
