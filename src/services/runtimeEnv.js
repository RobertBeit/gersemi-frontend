const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const hasValue = (value) => typeof value === 'string' && value.trim().length > 0;

const normalizeUrl = (value) => (hasValue(value) ? trimTrailingSlash(value.trim()) : null);

export const isLocalRuntime = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const host = String(window.location?.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
};

export const resolveServiceBaseUrl = ({
  explicitUrl,
  localUrl,
  deployedUrl,
  fallbackUrl,
}) => {
  const explicit = normalizeUrl(explicitUrl);
  if (explicit) return explicit;

  const local = normalizeUrl(localUrl);
  const deployed = normalizeUrl(deployedUrl);

  if (isLocalRuntime()) {
    return local || deployed || normalizeUrl(fallbackUrl);
  }

  return deployed || local || normalizeUrl(fallbackUrl);
};
