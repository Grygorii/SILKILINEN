'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useWishlist } from '@/context/WishlistContext';
import { useCustomer } from '@/context/CustomerContext';
import styles from './WishlistSignInNudge.module.css';

export default function WishlistSignInNudge() {
  const { count, mergedCount, clearMergeNotice } = useWishlist();
  const { customer } = useCustomer();
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showMergeToast, setShowMergeToast] = useState(false);
  const hasMounted = useRef(false);
  const prevCountRef = useRef(0);

  // 3rd-item save nudge — guest only, once per session
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      prevCountRef.current = count;
      return;
    }

    const prev = prevCountRef.current;
    prevCountRef.current = count;

    if (customer) return;
    if (prev >= 3 || count < 3) return;
    if (sessionStorage.getItem('wishlist_prompt_shown')) return;

    setShowSaveToast(true);
    sessionStorage.setItem('wishlist_prompt_shown', '1');
    const timer = setTimeout(() => setShowSaveToast(false), 5000);
    return () => clearTimeout(timer);
  }, [count, customer]);

  // Merge confirmation — fires after sign-in when guest had local items
  useEffect(() => {
    if (!mergedCount) return;
    setShowMergeToast(true);
    const timer = setTimeout(() => {
      setShowMergeToast(false);
      clearMergeNotice();
    }, 5000);
    return () => clearTimeout(timer);
  }, [mergedCount, clearMergeNotice]);

  if (!showSaveToast && !showMergeToast) return null;

  return (
    <div className={styles.stack}>
      {showSaveToast && (
        <div className={styles.toast}>
          <div className={styles.body}>
            <p className={styles.title}>Save your wishlist forever</p>
            <p className={styles.sub}>Sign in to access from any device.</p>
          </div>
          <div className={styles.actions}>
            <Link href="/account/sign-in" className={styles.signInLink}>Sign in</Link>
            <button className={styles.close} onClick={() => setShowSaveToast(false)} aria-label="Dismiss">✕</button>
          </div>
        </div>
      )}
      {showMergeToast && (
        <div className={`${styles.toast} ${styles.toastSuccess}`}>
          <p className={styles.title}>
            ✓ Your {mergedCount} saved item{mergedCount !== 1 ? 's have' : ' has'} been added to your account
          </p>
          <button
            className={styles.close}
            onClick={() => { setShowMergeToast(false); clearMergeNotice(); }}
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}
    </div>
  );
}
