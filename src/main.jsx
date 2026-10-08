import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Unregister stale service workers — fixes blank screen on Android in regular mode
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
