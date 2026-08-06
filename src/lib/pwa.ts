// Guarded service worker registration.
// Never registers in dev, inside an iframe, or on Lovable preview hosts.

const SW_URL = "/sw.js";

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;

  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;

  if (new URLSearchParams(window.location.search).has("sw")) {
    if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  }

  return false;
}

async function unregisterAppWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) => {
        const scriptURL =
          registration.active?.scriptURL ||
          registration.waiting?.scriptURL ||
          registration.installing?.scriptURL ||
          "";
        return scriptURL.endsWith(SW_URL);
      })
      .map((registration) => registration.unregister()),
  );
}

export async function registerServiceWorker(
  onUpdateAvailable?: (reload: () => void) => void,
): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  if (isRefusedContext()) {
    await unregisterAppWorkers();
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_URL, { scope: "/" });

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          onUpdateAvailable?.(() => {
            registration.waiting?.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          });
        }
      });
    });
  } catch (error) {
    console.error("Service worker registration failed:", error);
  }
}
