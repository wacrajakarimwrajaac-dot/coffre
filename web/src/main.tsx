import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PhoneGate } from './Pair';
import './styles.css';
import './theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PhoneGate><App /></PhoneGate>
  </StrictMode>,
);
