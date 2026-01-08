import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("InvoiceIntel: Application booting...");

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("FATAL: Could not find root element. The index.html may be malformed.");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("InvoiceIntel: Mount successful.");
  } catch (error) {
    console.error("InvoiceIntel: Render crash detected:", error);
  }
}