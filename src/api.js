// ── Update this URL after deploying your Google Apps Script ──
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbwEYnjO0kYr_Q6akgbjl7ILywxPNMYm-bk4Ee1jjOr9_8T4bb-4b3SydeBNfulZajxo/exec';

const TIMEOUT_MS = 12000; // 12s — covers GAS cold start, then retry hits warm server

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// Retries automatically on timeout or network failure.
// Attempt 1 wakes GAS up. If it times out, attempt 2 hits a warm server and responds fast.
export async function gasCall(action, payload = {}, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, ...payload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        // Short pause between retries
        await new Promise(r => setTimeout(r, 800));
      }
    }
  }
  throw lastErr;
}
