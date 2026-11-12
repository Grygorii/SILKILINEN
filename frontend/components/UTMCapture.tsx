'use client';
import { useEffect } from 'react';
import { captureAcquisition } from '@/lib/acquisition';
export default function UTMCapture() {
  useEffect(() => {
    try { captureAcquisition(window.sessionStorage, { search: window.location.search, pathname: window.location.pathname, hostname: window.location.hostname, referrer: document.referrer }); }
    catch { /* Blocked storage is not a shopping error. */ }
  }, []);
  return null;
}
