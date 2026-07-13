function getApiUrl() {
  const pageHost = window.location.hostname;

  // ngrok / LAN: use same origin and let Vite proxy to the backend.
  if (pageHost && pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
    return '';
  }

  return import.meta.env.VITE_API_URL || 'http://localhost:4000';
}

function buildHeaders(extra = {}, { json = true } = {}) {
  const pageHost = window.location.hostname;
  const headers = {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...extra,
  };

  if (pageHost.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  return headers;
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: buildHeaders(options.headers || {}),
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.');
    error.details = data;
    throw error;
  }

  return data;
}

export async function apiUpload(path, formData, options = {}) {
  const response = await fetch(`${getApiUrl()}${path}`, {
    method: 'POST',
    ...options,
    headers: buildHeaders(options.headers || {}, { json: false }),
    body: formData,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Upload failed.');
  }

  return data;
}
