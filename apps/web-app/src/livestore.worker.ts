import { makeWorker } from '@livestore/adapter-web/worker';
import { makeWsSync } from '@livestore/sync-cf/client';
import { schema } from './schema/schema';

const VITE_LIVESTORE_SYNC_URL =
  import.meta.env.VITE_LIVESTORE_SYNC_URL || 'ws://localhost:10000/sync';
console.log('Livestore worker sync url', VITE_LIVESTORE_SYNC_URL);
makeWorker({
  schema,
  sync: {
    backend: makeWsSync({
      url: VITE_LIVESTORE_SYNC_URL,
    }),
    initialSyncOptions: { _tag: 'NonBlocking' },
  },
});
