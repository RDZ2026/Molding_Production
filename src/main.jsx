import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Auto-recovery: wipe stale localStorage on version bump
const APP_VERSION = '2';
try {
  if (localStorage.getItem('appVersion') !== APP_VERSION) {
    localStorage.clear();
    localStorage.setItem('appVersion', APP_VERSION);
  }
} catch (e) {
  // localStorage blocked or corrupt — app will load clean
}

// Unregister any stale service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
