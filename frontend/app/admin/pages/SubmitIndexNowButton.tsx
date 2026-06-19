'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL;

// Submits every live public URL to IndexNow (Bing/Yandex) so they re-crawl after
// site changes. Calls the same endpoint as the SEO page's resubmit button.
export default function SubmitIndexNowButton() {
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function submit() {
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/api/admin/seo-health/resubmit-indexnow`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      setMsg({ text: `✓ Submitted ${data.submitted} URLs to IndexNow (Bing/Yandex). Check the IndexNow tab in Bing Webmaster Tools.`, ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Could not submit to IndexNow.', ok: false });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        title="Ping Bing/Yandex via IndexNow to re-crawl every live page — use after you've made changes to the site."
        style={{
          padding: '8px 16px', fontSize: 12, letterSpacing: '0.3px',
          border: '1px solid var(--border, #e8e2d6)', background: 'white', color: 'var(--dark, #2a2218)',
          cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1, fontFamily: 'inherit',
        }}
      >
        {submitting ? 'Submitting…' : '↻ Submit all pages to IndexNow (Bing)'}
      </button>
      {msg && <span style={{ fontSize: 12, color: msg.ok ? '#2d7d47' : '#c0392b' }}>{msg.text}</span>}
    </div>
  );
}
