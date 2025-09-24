import React from 'react';
import { createRoot } from 'react-dom/client';
import FlokApp from '../flok-app';
import ErrorBoundary from './ErrorBoundary';
import { ToastProvider } from './ui/toast';
import { ConfirmProvider } from './ui/confirm';
import './index.css';

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <FlokApp />
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Register service worker in production builds
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
