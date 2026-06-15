'use strict';

// SSRF guard for the growth engine's outbound fetches. Competitor domains are
// entered by an admin and product/sitemap URLs are read from fetched pages, so
// without a check a value like `localhost`, `169.254.169.254` (cloud metadata),
// or an internal Railway hostname could be used to reach inside the network.
// Before any such fetch we require http(s) and confirm every resolved address
// is a public, routable IP — refusing private/loopback/link-local/reserved.
//
// Threat model: these fetches are admin-gated, so this is defence-in-depth /
// pivot-prevention. A residual DNS-rebinding (TOCTOU) gap remains acceptable at
// this risk level; the pre-flight resolution blocks the obvious internal targets.

const dns = require('dns').promises;
const net = require('net');

function ipv4Private(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformed → treat as unsafe
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;          // this-network / private / loopback
  if (a === 169 && b === 254) return true;                    // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;           // 172.16.0.0/12
  if (a === 192 && b === 168) return true;                    // 192.168.0.0/16
  if (a === 192 && b === 0) return true;                      // 192.0.0.0/24 (incl. 192.0.0.x)
  if (a === 100 && b >= 64 && b <= 127) return true;          // CGNAT 100.64.0.0/10
  if (a === 198 && (b === 18 || b === 19)) return true;       // benchmarking 198.18.0.0/15
  if (a >= 224) return true;                                  // multicast (224/4) + reserved (240/4)
  return false;
}

function ipPrivate(ip) {
  if (net.isIPv4(ip)) return ipv4Private(ip);
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    const mapped = lower.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) return ipv4Private(mapped[1]);                // IPv4-mapped IPv6
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;                 // fc00::/7 ULA
    if (/^fe[89ab]/.test(lower)) return true;                 // fe80::/10 link-local
    return false;
  }
  return true; // unrecognised → unsafe
}

// Throws if the URL is not safe to fetch. Resolves DNS and checks every address.
async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('Invalid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) URLs are allowed');
  const host = u.hostname;
  if (net.isIP(host)) {
    if (ipPrivate(host)) throw new Error('Refusing to fetch a private/internal address');
    return;
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error('Refusing to fetch an internal hostname');
  }
  let addrs;
  try { addrs = await dns.lookup(host, { all: true }); } catch { throw new Error('DNS resolution failed'); }
  if (!addrs.length) throw new Error('No DNS records');
  for (const { address } of addrs) {
    if (ipPrivate(address)) throw new Error('Refusing to fetch a private/internal address');
  }
}

module.exports = { assertPublicUrl, ipPrivate };
