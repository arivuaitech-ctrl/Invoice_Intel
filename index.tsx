
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("InvoiceIntel: Application starting...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("InvoiceIntel: Could not find root element to mount to");
} else {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
