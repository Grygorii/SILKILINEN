'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type ConsentValue = 'accepted' | 'rejected' | 'customised' | null;

export type CategoryPrefs = {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

interface CookieConsentContextType {
  consent: ConsentValue;
  preferences: CategoryPrefs | null;
  showBanner: boolean;
  showSettings: boolean;
  accept: () => void;
  reject: () => void;
  openBanner: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  savePreferences: (prefs: CategoryPrefs) => void;
}

const STORAGE_KEY = 'silkilinen:cookieConsent';
const PREFS_KEY = 'silkilinen:cookiePrefs';

const CookieConsentContext = createContext<CookieConsentContextType | null>(null);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentValue>(null);
  const [preferences, setPreferences] = useState<CategoryPrefs | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ConsentValue | null;
    if (stored === 'accepted' || stored === 'rejected' || stored === 'customised') {
      setConsent(stored);
      if (stored === 'customised') {
        try {
          setPreferences(JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'));
        } catch {}
      }
    } else {
      // Migrate from old key
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
    setShowSettings(false);
  }

  function reject() {
    localStorage.setItem(STORAGE_KEY, 'rejected');
    setConsent('rejected');
    setShowBanner(false);
    setShowSettings(false);
  }

  function openBanner() {
    setShowBanner(true);
    setShowSettings(false);
  }

  function openSettings() {
    setShowSettings(true);
    setShowBanner(false);
  }

  function closeSettings() {
    setShowSettings(false);
  }

  function savePreferences(prefs: CategoryPrefs) {
    localStorage.setItem(STORAGE_KEY, 'customised');
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    setConsent('customised');
    setPreferences(prefs);
    setShowBanner(false);
    setShowSettings(false);
  }

  return (
    <CookieConsentContext.Provider value={{ consent, preferences, showBanner, showSettings, accept, reject, openBanner, openSettings, closeSettings, savePreferences }}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used within CookieConsentProvider');
  return ctx;
}
