import type { ReactElement } from 'react';
import styles from './Footer.module.css';
import CookiePreferencesLink from './CookiePreferencesLink';
import FooterMobileNav from './FooterMobileNav';
import GoogleReviewsBadge from './GoogleReviewsBadge';
import { isValidSocialUrl } from '@/lib/socialUrl';
import { getSiteSettings } from '@/lib/settings';

const API = process.env.NEXT_PUBLIC_API_URL;

type SocialPlatform = { key: string; displayName: string; icon: string; brandColor: string; url: string };

const FOOTER_ICONS: Record<string, ReactElement> = {
  instagram: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
  pinterest: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.627 0-12 5.372-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/></svg>,
  facebook: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  tiktok: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>,
  threads: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.852 1.206 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.689-2.042 1.47-1.56 1.875-3.854 1.678-5.503h-5.33c-.048 1.596-.536 2.699-1.434 3.348-1.03.75-2.445.846-4.026.725-1.504-.118-2.684-.773-3.321-1.817-.507-.821-.589-1.822-.344-2.838.39-1.62 1.737-2.681 3.638-2.888 1.166-.125 2.485.1 3.755.525z"/></svg>,
  youtube: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>,
  twitter_x: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
};

async function getSocialPlatforms(): Promise<SocialPlatform[]> {
  try {
    const res = await fetch(`${API}/api/social/platforms`, {
      // Short cache so adding/activating a social link (e.g. Facebook) in admin
      // shows in the footer within a minute instead of up to an hour.
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    } as RequestInit);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

// Live categories for the footer Shop column, so it tracks the real categories
// (with products) instead of a hardcoded list.
async function getFooterCategories(): Promise<{ slug: string; label: string; count: number }[]> {
  try {
    const res = await fetch(`${API}/api/categories`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    } as RequestInit);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export default async function Footer() {
  const socialPlatforms = (await getSocialPlatforms()).filter(p => isValidSocialUrl(p.url));
  const shopCategories = (await getFooterCategories()).filter(c => c.count > 0).slice(0, 6);
  const { supportEmail, brandTagline, brandLocation } = await getSiteSettings();
  const socialRow = socialPlatforms.length > 0 ? (
    <div className={styles.socialRow}>
      {socialPlatforms.map(p => (
        <a
          key={p.key}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          title={p.displayName}
          className={styles.socialIcon}
        >
          {FOOTER_ICONS[p.icon] ?? <span style={{ fontSize: 11 }}>{p.displayName}</span>}
        </a>
      ))}
    </div>
  ) : null;

  return (
    <footer className={styles.footer}>
      {/* Desktop column grid — hidden on mobile */}
      <div className={styles.inner}>
        <div className={styles.brand}>
          <h3>SILKILINEN</h3>
          <p>{brandTagline},<br />shipped worldwide from Donegal.</p>
          <p className={styles.address}>
            {brandLocation}<br />
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </p>
          {socialRow}
        </div>
        <div className={styles.col}>
          <h4>Shop</h4>
          <a href="/shop?new=true">New arrivals</a>
          <a href="/shop">All products</a>
          {shopCategories.map(c => (
            <a key={c.slug} href={`/shop?category=${c.slug}`}>{c.label}</a>
          ))}
        </div>
        <div className={styles.col}>
          <h4>Info</h4>
          <a href="/about">About us</a>
          <a href="/reviews">Reviews</a>
          <a href="/shipping">Shipping</a>
          <a href="/size-guide">Size guide</a>
          <a href="/contact">Contact</a>
        </div>
        <div className={styles.col}>
          <h4>Legal</h4>
          <a href="/privacy-policy">Privacy policy</a>
          <a href="/terms">Terms &amp; conditions</a>
          <a href="/returns">Returns &amp; refunds</a>
          <CookiePreferencesLink />
        </div>
      </div>

      {/* Mobile brand — hidden on desktop */}
      <div className={styles.mobileBrand}>
        <h3>SILKILINEN</h3>
        <p>{brandTagline},<br />shipped worldwide from Donegal.</p>
        <p className={styles.address}>
          {brandLocation}<br />
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </p>
        {socialRow}
      </div>

      {/* Mobile accordion — hidden on desktop */}
      <FooterMobileNav />

      <div className={styles.bottom}>
        <p>© {new Date().getFullYear()} SILKILINEN. All rights reserved.</p>
        <p>Registered in Donegal, Ireland · VAT not applicable — small business exemption (Ireland)</p>
      </div>

      <GoogleReviewsBadge />
    </footer>
  );
}
