'use client';

import { useEffect } from 'react';

export default function UTMCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utmSource   = params.get('utm_source');
    const utmMedium   = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');

    if (utmSource) {
      sessionStorage.setItem('attr_source',   utmSource);
      sessionStorage.setItem('attr_medium',   utmMedium   ?? 'none');
      sessionStorage.setItem('attr_campaign', utmCampaign ?? 'none');
      sessionStorage.setItem('attr_referrer', document.referrer ?? '');
      sessionStorage.setItem('attr_landing',  window.location.pathname);
      return;
    }

    // Auto-detect source from referrer if no UTM params and no prior attribution
    if (!sessionStorage.getItem('attr_source')) {
      const ref = document.referrer;
      let source = 'direct';
      let medium = 'none';

      if (ref) {
        try {
          const host = new URL(ref).hostname;
          if (/google|bing|yahoo|duckduckgo|baidu/i.test(host)) {
            source = host.replace(/^www\./, '').split('.')[0];
            medium = 'organic';
          } else if (/facebook|instagram|tiktok|pinterest|twitter|x\.com/i.test(host)) {
            source = host.replace(/^www\./, '').split('.')[0];
            medium = 'social';
          } else {
            source = host.replace(/^www\./, '');
            medium = 'referral';
          }
        } catch {
          source = 'referral';
          medium = 'referral';
        }
      }

      sessionStorage.setItem('attr_source',   source);
      sessionStorage.setItem('attr_medium',   medium);
      sessionStorage.setItem('attr_campaign', 'none');
      sessionStorage.setItem('attr_referrer', ref);
      sessionStorage.setItem('attr_landing',  window.location.pathname);
    }
  }, []);

  return null;
}
