
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './lib/pwa'
import { toast } from 'sonner'

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerServiceWorker((reload) => {
  toast("Update available", {
    description: "A new version of the app is ready.",
    duration: Infinity,
    action: { label: "Reload", onClick: reload },
  });
});
