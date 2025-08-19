import { useStore } from '@livestore/react';
import type React from 'react';

import { uiState$ } from '../livestore/queries.js';

export const Footer: React.FC = () => {
  const { store } = useStore();
  const _uiState = store.useQuery(uiState$);

  return (
    <footer className="footer">
      <div></div>
    </footer>
  );
};
