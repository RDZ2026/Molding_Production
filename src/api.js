// ── Update this URL after deploying your Google Apps Script ──
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbwEYnjO0kYr_Q6akgbjl7ILywxPNMYm-bk4Ee1jjOr9_8T4bb-4b3SydeBNfulZajxo/exec';

export async function gasCall(action, payload = {}) {
  if (GAS_URL === 'https://script.google.com/macros/s/AKfycbwEYnjO0kYr_Q6akgbjl7ILywxPNMYm-bk4Ee1jjOr9_8T4bb-4b3SydeBNfulZajxo/exec') {
    throw new Error('GAS_URL not configured. Update src/api.js with your deployment URL.');
  }
  const res = await fetch(GAS_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
