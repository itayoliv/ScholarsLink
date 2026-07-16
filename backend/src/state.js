let demoMode = false;

export function isDemoMode() {
  return demoMode;
}

export function setDemoMode(value) {
  demoMode = Boolean(value);
}

export function demoUnavailable(feature = 'This feature') {
  const error = new Error(`${feature} is unavailable while the API is running in demo mode (MySQL unreachable).`);
  error.status = 503;
  return error;
}
