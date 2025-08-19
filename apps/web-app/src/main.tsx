import './index.css';

import ReactDOM from 'react-dom/client';

import { App } from './Root.js';

const rootElement = document.getElementById('react-app');
if (!rootElement) {
  throw new Error('Root element not found');
}
ReactDOM.createRoot(rootElement).render(<App />);

// ReactDOM.createRoot(document.getElementById('react-app')!).render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>,
// )
