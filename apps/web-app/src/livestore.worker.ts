import { makeWorker } from '@livestore/adapter-web/worker';
import { makeCfSync } from '@livestore/sync-cf';
import { schema } from './schema/schema';

makeWorker({
  schema,
  sync: {
    backend: makeCfSync({
      url: import.meta.env.VITE_LIVESTORE_SYNC_URL || 'http://localhost:8787',
    }),
    initialSyncOptions: { _tag: 'Blocking', timeout: 5000 },
  },
});
