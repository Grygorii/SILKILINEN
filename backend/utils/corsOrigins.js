'use strict';

// Vercel gives each deployment a unique URL. The production backend needs to
// accept this shop's own deployment smoke checks, but must never use a broad
// `*.vercel.app` credentialed CORS allow-list.
const DEPLOYMENT_HOST_SUFFIX = '-grishakinzerskyi-1780s-projects.vercel.app';

function isSilkilinenVercelDeployment(origin) {
  try {
    const url = new URL(origin);
    if (url.origin !== origin || url.protocol !== 'https:' || url.port) return false;
    const host = url.hostname.toLowerCase();
    return host === 'silkilinen.vercel.app'
      || (host.startsWith('silkilinen-') && host.endsWith(DEPLOYMENT_HOST_SUFFIX));
  } catch {
    return false;
  }
}

module.exports = { isSilkilinenVercelDeployment };
