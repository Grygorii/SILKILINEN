'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { CONFIRMED_DESTINATIONS, destinationsFor, journeyPath, mapView, ORIGIN, projectLocation, type ShipmentMode } from '@/lib/shippingDestinations';
import styles from './ShippingMap.module.css';

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  document.addEventListener('visibilitychange', callback);
  return () => {
    media.removeEventListener('change', callback);
    document.removeEventListener('visibilitychange', callback);
  };
}
const motionAllowed = () => document.visibilityState === 'visible' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const serverMotion = () => false;
const JOURNEY_DURATION = 8000;

export default function ShippingMap() {
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const drawing = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<ShipmentMode>('shipped');
  const [index, setIndex] = useState(2); // Begin with France, a founder-confirmed destination.
  const [paused, setPaused] = useState(false);
  const [selectFocused, setSelectFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [additional, setAdditional] = useState<string[]>([]);
  const fetched = useRef(false);
  const allowMotion = useSyncExternalStore(subscribeMotion, motionAllowed, serverMotion);
  const destinations = destinationsFor(mode, additional);
  const destination = destinations[index % destinations.length];
  const view = mapView(destination);
  const radius = view.startsWith('30 ') ? 4 : 1.3;
  const running = allowMotion && visible && !paused && mode === 'shipped';
  const [ox, oy] = projectLocation(ORIGIN.longitude, ORIGIN.latitude);
  const [dx, dy] = projectLocation(destination.longitude, destination.latitude);
  const path = journeyPath(destination);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || fetched.current || !process.env.NEXT_PUBLIC_API_URL) return;
    fetched.current = true;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/shipping/destinations`, { signal: AbortSignal.timeout(4000) })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (Array.isArray(data?.countries)) setAdditional(data.countries.filter((code: unknown) => typeof code === 'string' && /^[A-Z]{2}$/.test(code)).slice(0, 250));
      })
      .catch(() => { /* Confirmed history remains visible if the optional endpoint is unavailable. */ });
  }, [visible]);

  // Only the explicit pause control changes paused. Choosing a country never requires Play.
  // Pause the SVG timeline, rather than removing it, so a manual pause resumes in place.
  useEffect(() => {
    const svg = drawing.current;
    if (running) svg?.unpauseAnimations();
    else svg?.pauseAnimations();
  }, [running, view]);

  useEffect(() => {
    if (!running || selectFocused) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % destinations.length), JOURNEY_DURATION);
    return () => window.clearInterval(timer);
  }, [running, selectFocused, destinations.length, index]);

  function chooseMode(next: ShipmentMode) {
    setMode(next);
    setIndex(next === 'shipped' ? 2 : 0);
  }

  return (
    <section ref={root} className={styles.section} aria-labelledby={`${id}-title`} data-shipping-map data-running={running}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Shipped from Ireland</p>
          <h2 id={`${id}-title`}>From Donegal, <em>to you.</em></h2>
          <p className={styles.intro}>Our pieces have travelled to {destinationsFor('shipped', additional).length} countries.</p>
          <Link href="/shipping" className={styles.textLink} data-track="shipping_map_delivery">Delivery details</Link>
        </div>

        <div className={styles.atlas}>
          <div className={styles.modes} role="group" aria-label="Shipment history or delivery availability">
            <button type="button" aria-pressed={mode === 'shipped'} onClick={() => chooseMode('shipped')}>Where we’ve shipped</button>
            <button type="button" aria-pressed={mode === 'available'} onClick={() => chooseMode('available')}>Where we deliver</button>
          </div>
          <div className={styles.mapFrame}>
            <svg ref={drawing} key={view} viewBox={view} className={styles.map} aria-hidden="true" focusable="false">
              <defs>
                <filter id={`${id}-land`} x="0" y="0" width="100%" height="100%">
                  <feFlood floodColor="var(--color-line)" />
                  <feComposite in2="SourceAlpha" operator="in" />
                </filter>
              </defs>
              <image href="/maps/shipping-world.svg" width="1000" height="500" filter={`url(#${id}-land)`} />
              {destinations.map(item => {
                const [x, y] = projectLocation(item.longitude, item.latitude);
                return <circle key={item.code} cx={x} cy={y} r={radius * .6} className={mode === 'shipped' ? styles.actualDot : styles.availableDot} vectorEffect="non-scaling-stroke" />;
              })}
              <path d={path} className={mode === 'shipped' ? styles.route : styles.possibleRoute} vectorEffect="non-scaling-stroke" />
              <circle cx={ox} cy={oy} r={radius * 2.2} className={styles.originRing} vectorEffect="non-scaling-stroke" />
              <circle cx={ox} cy={oy} r={radius} className={styles.originDot} />
              <circle cx={dx} cy={dy} r={radius * 2.2} className={styles.destinationRing} vectorEffect="non-scaling-stroke" />
              <circle cx={dx} cy={dy} r={radius * .8} className={styles.originDot} />
              {allowMotion && mode === 'shipped' && (
                <circle key={destination.code} r={radius * .8} className={styles.parcel} data-journey-animation>
                  <animateMotion dur="7s" repeatCount="indefinite" path={path} />
                </circle>
              )}
            </svg>
            <span className={styles.mapLegend}>Donegal, Ireland</span>
          </div>
          <div className={styles.selection}>
            <div className={styles.destination}>
              <label htmlFor={`${id}-country`}>{mode === 'shipped' ? 'A destination we’ve shipped to' : 'Choose your delivery country'}</label>
              <select id={`${id}-country`} value={destination.code}
                onFocus={() => setSelectFocused(true)} onBlur={() => setSelectFocused(false)}
                onChange={event => setIndex(destinations.findIndex(item => item.code === event.target.value))}>
                {destinations.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
            </div>
            {mode === 'shipped' && (
              <button type="button" className={styles.motionButton} disabled={!allowMotion}
                onClick={() => setPaused(current => !current)} aria-pressed={paused}
                aria-label={paused ? 'Play journey animation' : 'Pause journey animation'}>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  {paused ? <path d="M5 3L12 8L5 13Z" fill="currentColor" /> : <path d="M5 3V13M11 3V13" stroke="currentColor" strokeWidth="1.5" />}
                </svg>
                <span>{!allowMotion ? 'Still' : paused ? 'Play' : 'Pause'}</span>
              </button>
            )}
          </div>
          <p className={styles.status}>{mode === 'shipped' ? 'Past shipments, illustrated. Not live parcel tracking.' : 'Delivery availability, not previous orders.'}</p>
        </div>

        <div className={styles.notes}>
          <details>
            <summary>{mode === 'shipped' ? 'Explore our destinations' : 'View all delivery destinations'}</summary>
            <p>{destinations.map(item => item.name).join(' · ')}</p>
            <p>{mode === 'shipped'
              ? `${CONFIRMED_DESTINATIONS.length} destinations confirmed by our founder, plus countries from website orders marked shipped or delivered. This is not a live parcel location.`
              : 'These are the destinations available at checkout, not a claim of a past order.'} Routes do not show customer addresses or exact delivery paths.</p>
          </details>
          <a href="https://silkilinen.etsy.com" target="_blank" rel="noopener noreferrer" className={styles.textLink} data-track="shipping_map_etsy">Our Etsy shop <span aria-hidden="true">↗</span><span className={styles.srOnly}> (opens in a new tab)</span></a>
        </div>
      </div>
    </section>
  );
}
