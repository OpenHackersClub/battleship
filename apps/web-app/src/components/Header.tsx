import type React from 'react';
import { Alert, AlertDescription } from './ui/alert';

export const Header: React.FC = () => {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold">Battleship</h1>
      <Alert className="mb-4 text-center">
        <AlertDescription>
          Click on your grid to place ships, click on enemy waters to fire missiles!
        </AlertDescription>
      </Alert>
    </header>
  );
};
