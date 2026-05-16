'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type ConsentValue = 'accepted' | 'rejected' | null;

interface CookieConsentContextType {
  consent: ConsentValue;
  showBanner: boolean;
  accept: () => void;
  reject: () => void;
  openBanner: () => void;
}

const STORAGE_KEY = 'silkilinen:cookieConsent';

const CookieConsentContext = createContext<CookieConsentContextType | null>(null);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentValue>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ConsentValue | null;
    if (stored === 'accepted' || stored === 'rejected') {
      setConsent(stored);
    } else {
      // Migrate from old key — if user already accepted all, carry it forward silently
      const legacy = localStorage.getItem('silkilinen_cookie_consent');
      if (legacy === 'all') {
        localStorage.setItem(STORAGE_KEY, 'accepted');
        setConsent('accepted');
      } else if (legacy === 'essential') {
        localStorage.setItem(STORAGE_KEY, 'rejected');
        setConsent('rejected');
      } else {
        setShowBanner(true);
      }
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setConsent('accepted');
    setShowBanner(false);
  }

  function reject() {
    localStorage.setItem(STORAGE_KEY, 'rejected');
    setConsent('rejected');
    setShowBanner(false);
  }

  function openBanner() {
    setShowBanner(true);
  }

  return (
    <CookieConsentContext.Provider value={{ consent, showBanner, accept, reject, openBanner }}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used within CookieConsentProvider');
  return ctx;
}
