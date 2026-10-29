import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AccountGate } from './Account';
import App from './App';
import { PhoneGate } from './Pair';
import './styles.css';
import './theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountGate><PhoneGate><App /></PhoneGate></AccountGate>
  </StrictMode>,
);
