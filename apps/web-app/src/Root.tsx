import { makePersistedAdapter } from '@livestore/adapter-web';
import LiveStoreSharedWorker from '@livestore/adapter-web/shared-worker?sharedworker';
import { LiveStoreProvider } from '@livestore/react';
import { FPSMeter } from '@overengineering/fps-meter';
import type React from 'react';
import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import { Footer } from './components/Footer';
import { GameStateProvider } from './components/GameStateProvider';
import { Header } from './components/Header';
import { MainSection } from './components/MainSection';
import LiveStoreWorker from './livestore.worker?worker';
import { schema } from './schema/schema';
import { getStoreId } from './util/store-id';

const AppBody: React.FC = () => (
  <div className="flex h-screen">
    <div className="flex-1 flex flex-col">
      <section className="container p-6 flex-1  mx-auto">
        <GameStateProvider>
          <Header />
          <MainSection />
          <Footer />
        </GameStateProvider>
      </section>
    </div>
  </div>
);

const storeId = getStoreId();

const adapter = makePersistedAdapter({
  storage: { type: 'opfs' },
  worker: LiveStoreWorker,
  sharedWorker: LiveStoreSharedWorker,
});

export const App: React.FC = () => (
  <LiveStoreProvider
    schema={schema}
    adapter={adapter}
    renderLoading={(_) => <div>Loading LiveStore ({_.stage})...</div>}
    batchUpdates={batchUpdates}
    storeId={storeId}
    syncPayload={{ authToken: 'insecure-token-change-me' }}
  >
    <div style={{ top: 0, right: 0, position: 'absolute', background: '#333' }}>
      <FPSMeter height={40} />
    </div>
    <AppBody />
  </LiveStoreProvider>
);
