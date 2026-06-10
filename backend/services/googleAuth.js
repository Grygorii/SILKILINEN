// Shared Google service-account auth. Reads the service-account JSON from the
// GOOGLE_SERVICE_ACCOUNT_KEY env var (set in Railway — never committed) and
// mints scoped access tokens for the Google APIs we call (Content API for
// Merchant Center now; Search Console later).
//
// Everything here is defensive: if the key is missing/malformed, or the
// google-auth-library package isn't installed yet, callers get null instead of
// a thrown error. That keeps the store backend booting even mid-setup.

// Lazy-require so a missing dependency degrades gracefully instead of crashing
// server startup the moment this module is required.
function loadJWT() {
  try {
    return require('google-auth-library').JWT;
  } catch {
    return null;
  }
}

function getServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function getJwtClient(scopes) {
  const JWT = loadJWT();
  const sa = getServiceAccount();
  if (!JWT || !sa || !sa.client_email || !sa.private_key) return null;
  return new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: Array.isArray(scopes) ? scopes : [scopes],
  });
}

// Returns a bearer access token for the given scope(s), or null if the
// service account isn't configured / auth fails.
async function getAccessToken(scopes) {
  const client = getJwtClient(scopes);
  if (!client) return null;
  try {
    const { token } = await client.getAccessToken();
    return token || null;
  } catch {
    return null;
  }
}

module.exports = { getServiceAccount, getJwtClient, getAccessToken };
