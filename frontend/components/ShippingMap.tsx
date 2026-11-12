'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { CONFIRMED_DESTINATIONS, destinationsFor, journeyPath, mapView, ORIGIN, projectLocation, type ShipmentMode } from '@/lib/shippingDestinations';
import styles from './ShippingMap.module.css';

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  document.addEventListener('visibilitychange', callback);
  return () => { media.removeEventListener('change', callback); document.removeEventListener('visibilitychange', callback); };
}
const motionAllowed = () => document.visibilityState === 'visible' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const serverMotion = () => false;

export default function ShippingMap() {
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const [mode,setMode] = useState<ShipmentMode>('shipped');
  const [index,setIndex] = useState(0);
  const [paused,setPaused] = useState(false);
  const [visible,setVisible] = useState(false);
  const [additional,setAdditional] = useState<string[]>([]);
  const fetched = useRef(false);
  const allowMotion = useSyncExternalStore(subscribeMotion,motionAllowed,serverMotion);
  const destinations = destinationsFor(mode,additional);
  const destination = destinations[index % destinations.length];
  const view = mapView(destination);
  const radius = view.startsWith('30 ') ? 5 : 1.6;
  const running = allowMotion && visible && !paused && mode === 'shipped';
  const [ox,oy] = projectLocation(ORIGIN.longitude,ORIGIN.latitude);
  const [dx,dy] = projectLocation(destination.longitude,destination.latitude);
  const path = journeyPath(destination);

  useEffect(() => {
    if (!root.current || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting),{threshold:.15});
    observer.observe(root.current);
    return () => observer.disconnect();
  },[]);

  useEffect(() => {
    if (!visible || fetched.current || !process.env.NEXT_PUBLIC_API_URL) return;
    fetched.current = true;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/shipping/destinations`,{ signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data?.countries)) setAdditional(data.countries.filter((c: unknown) => typeof c === 'string' && /^[A-Z]{2}$/.test(c)).slice(0,250)); })
      .catch(() => { /* Founder-confirmed history remains available during API outages. */ });
  },[visible]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setIndex(i => (i+1)%destinations.length),6500);
    return () => window.clearInterval(timer);
  },[running,destinations.length]);

  return (
    <section ref={root} className={styles.section} aria-labelledby={`${id}-title`} data-shipping-map>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>From Donegal, outward</p>
          <h2 id={`${id}-title`}>From our world.<br /><em>To yours.</em></h2>
          <p className={styles.intro}>Discover where our pieces have travelled, and where your own Silkilinen story could begin.</p>
          <p className={styles.proof}><strong>{destinationsFor('shipped',additional).length}</strong> countries we have shipped to</p>
          <div className={styles.links}>
            <Link href="/shop" data-track="shipping_map_shop">Explore the collection <span aria-hidden="true">↗</span></Link>
            <a href="https://silkilinen.etsy.com" target="_blank" rel="noopener noreferrer" data-track="shipping_map_etsy">Find us on Etsy <span aria-hidden="true">↗</span><span className={styles.srOnly}> (opens in a new tab)</span></a>
          </div>
        </div>
        <div className={styles.atlas}>
          <div className={styles.toolbar}>
            <div className={styles.modes} role="group" aria-label="Shipment history or delivery availability">
              <button type="button" aria-pressed={mode==='shipped'} onClick={() => { setMode('shipped');setIndex(0);setPaused(true); }}>Where we’ve shipped</button>
              <button type="button" aria-pressed={mode==='available'} onClick={() => { setMode('available');setIndex(0);setPaused(true); }}>Where we deliver</button>
            </div>
          </div>
          <div className={styles.mapFrame}>
            <svg viewBox={view} className={styles.map} aria-hidden="true" focusable="false">
              <image href="/maps/shipping-world.svg" width="1000" height="500" />
              {destinations.map(d => { const [x,y]=projectLocation(d.longitude,d.latitude);return <circle key={d.code} cx={x} cy={y} r={radius*.65} className={mode==='shipped'?styles.actualDot:styles.availableDot} vectorEffect="non-scaling-stroke" />; })}
              <path d={path} className={mode==='shipped'?styles.route:styles.possibleRoute} vectorEffect="non-scaling-stroke" />
              <circle cx={ox} cy={oy} r={radius*2.7} className={styles.halo} />
              <circle cx={ox} cy={oy} r={radius} className={styles.originDot} />
              <circle cx={dx} cy={dy} r={radius*2.4} className={styles.destinationRing} vectorEffect="non-scaling-stroke" />
              <circle cx={dx} cy={dy} r={radius} className={styles.originDot} />
              {running && <circle key={destination.code} r={radius*.8} className={styles.parcel} data-journey-animation><animateMotion dur="5.5s" repeatCount="indefinite" path={path} /></circle>}
            </svg>
            <p className={styles.mapLegend}><span /> Donegal, Ireland</p>
          </div>
          <div className={styles.selection}>
            <div className={styles.selectionHeader}>
              <label htmlFor={`${id}-country`}>{mode==='shipped'?'A destination we’ve shipped to':'Choose your delivery country'}</label>
              <button type="button" className={styles.motionButton} disabled={!allowMotion||mode==='available'} onClick={() => setPaused(p=>!p)} aria-label={paused?'Play journey animation':'Pause journey animation'}>{!allowMotion||mode==='available'?'Still':paused?'Play':'Pause'}</button>
            </div>
            <select id={`${id}-country`} value={destination.code} onFocus={() => setPaused(true)} onChange={e => { setIndex(destinations.findIndex(d=>d.code===e.target.value));setPaused(true); }}>
              {destinations.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
            <p className={styles.status}>{mode==='shipped'?'Selected shipment history — not a live parcel location.':'Available at checkout — not a claim of a past order.'}</p>
          </div>
        </div>
        <div className={styles.notes}>
          <p>{mode==='shipped'?`Includes ${CONFIRMED_DESTINATIONS.length} destinations confirmed by our founder, plus countries from website orders marked shipped or delivered.`:'Delivery destinations match the countries offered at checkout. See shipping rates and estimated delivery times before you order.'}</p>
          <p>Routes are illustrative and do not show customer addresses or exact delivery paths.</p>
          <details><summary>{mode==='shipped'?'All shipment destinations':'All delivery destinations'}</summary><p>{destinations.map(d=>d.name).join(' · ')}</p></details>
          {mode==='available' && <Link href="/shipping">Shipping information →</Link>}
        </div>
      </div>
    </section>
  );
}
