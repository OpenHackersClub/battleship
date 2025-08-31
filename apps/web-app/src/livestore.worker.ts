import { makeWorker } from '@livestore/adapter-web/worker';
import { makeCfSync } from '@livestore/sync-cf';
import { schema } from './schema/schema';

const VITE_LIVESTORE_SYNC_URL = import.meta.env.VITE_LIVESTORE_SYNC_URL || 'http://localhost:8787';
console.log('Livestore worker sync url', VITE_LIVESTORE_SYNC_URL);
makeWorker({
  schema,
  sync: {
    backend: makeCfSync({
      url: VITE_LIVESTORE_SYNC_URL,
    }),
    initialSyncOptions: { _tag: 'Blocking', timeout: 5000 },
  },
});
