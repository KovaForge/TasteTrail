import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handlers for debug console
window.onerror = (message, source, lineno, colno, error) => {
  const event = new CustomEvent('tastetrail:error', {
    detail: {
      type: 'error',
      message: String(message),
      source,
      lineno,
      colno,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
    },
  });
  window.dispatchEvent(event);
  return false;
};

window.onunhandledrejection = (event) => {
  const customEvent = new CustomEvent('tastetrail:error', {
    detail: {
      type: 'unhandledrejection',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      timestamp: new Date().toISOString(),
    },
  });
  window.dispatchEvent(customEvent);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
