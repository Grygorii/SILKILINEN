'use client';

import { useState, useEffect } from 'react';
import { type SiteSettings, SETTINGS_FALLBACK } from './settings';

const API = process.env.NEXT_PUBLIC_API_URL;

// Client components: the editable site settings via a hook, falling back to the
// defaults until loaded so nothing flashes empty.
export function useSiteSettings(): SiteSettings {
  const [settings, setSettings] = useState<SiteSettings>(SETTINGS_FALLBACK);
  useEffect(() => {
    let active = true;
    fetch(`${API}/api/settings`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (active && d) setSettings({ ...SETTINGS_FALLBACK, ...d }); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return settings;
}
