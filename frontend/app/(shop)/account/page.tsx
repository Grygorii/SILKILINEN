'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCustomer } from '@/context/CustomerContext';
import { useWishlist } from '@/context/WishlistContext';
import styles from './account.module.css';
import { Package, Wishlist, Profile, Address } from '@/components/icons';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AccountPage() {
  const { customer, signOut } = useCustomer();
  const { count: wishlistCount } = useWishlist();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get('welcome') === '1';
  const [orderCount, setOrderCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API}/api/customers/me/orders`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : []).then(d => setOrderCount(d.length)).catch(() => {});
  }, []);

  if (!customer) return null;

  return (
    <>
      {/* HUMAN: review proposed copy in UX-PUBLIC.md H4 before changing */}
      {isWelcome && (
        <div className={styles.welcomeBanner}>
          Welcome to SILKILINEN, {customer.firstName || customer.email.split('@')[0]}! Your account is ready.
          Use code <strong>SILK10</strong> for 10% off your first order.
        </div>
      )}
      <div className={styles.pageHeader}>
        <h1>My account</h1>
        <p>Hello{customer.firstName ? `, ${customer.firstName}` : ''} — {customer.email}</p>
      </div>

      <div className={styles.cardGrid}>
        <a href="/account/orders" className={styles.card}>
          <span className={styles.cardIcon}><Package size={24} /></span>
          <span className={styles.cardTitle}>Your orders</span>
          <span className={styles.cardMeta}>{orderCount === null ? '…' : orderCount === 0 ? 'No orders yet' : `${orderCount} order${orderCount === 1 ? '' : 's'}`}</span>
          <span className={styles.cardArrow}>View all →</span>
        </a>
        <a href="/account/wishlist" className={styles.card}>
          <span className={styles.cardIcon}><Wishlist size={24} /></span>
          <span className={styles.cardTitle}>Wishlist</span>
          <span className={styles.cardMeta}>{wishlistCount === 0 ? 'Empty' : `${wishlistCount} saved item${wishlistCount === 1 ? '' : 's'}`}</span>
          <span className={styles.cardArrow}>View wishlist →</span>
        </a>
        <a href="/account/profile" className={styles.card}>
          <span className={styles.cardIcon}><Profile size={24} /></span>
          <span className={styles.cardTitle}>Profile</span>
          <span className={styles.cardMeta}>{[customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Add your name'}</span>
          <span className={styles.cardArrow}>Edit profile →</span>
        </a>
        <a href="/account/addresses" className={styles.card}>
          <span className={styles.cardIcon}><Address size={24} /></span>
          <span className={styles.cardTitle}>Addresses</span>
          <span className={styles.cardMeta}>{customer.defaultShippingAddress?.city || 'No address saved'}</span>
          <span className={styles.cardArrow}>Manage →</span>
        </a>
      </div>

      <div className={styles.signOutRow}>
        <button className={styles.signOutBtn} onClick={async () => { await signOut(); window.location.href = '/'; }}>
          Sign out
        </button>
      </div>
    </>
  );
}
