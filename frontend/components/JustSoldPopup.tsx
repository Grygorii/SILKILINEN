'use client';

import { useState, useEffect } from 'react';
import styles from './JustSoldPopup.module.css';

const FIRST_NAMES = ['Sarah', 'Emma', 'Aoife', 'Ciara', 'Niamh', 'Fiona', 'Rachel', 'Laura', 'Kate', 'Sinéad', 'Ruth', 'Amy', 'Claire', 'Hannah', 'Orla'];
const CITIES = ['Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford', 'Belfast', 'London', 'Edinburgh', 'Paris', 'Amsterdam'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  if (mins < 120) return '1 hour ago';
  return 'recently';
}

type Activity = { item: string; createdAt: string };

const API = process.env.NEXT_PUBLIC_API_URL;

export default function JustSoldPopup() {
  const [notification, setNotification] = useState<{ name: string; city: string; item: string; ago: string } | null>(null);
  const [visible, setVisible] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    fetch(`${API}/api/orders/recent-activity`)
      .then(r => (r.ok ? r.json() : []))
      .then(setActivities)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activities.length === 0) return;

    function showOne() {
      const act = randomFrom(activities);
      setNotification({
        name: randomFrom(FIRST_NAMES),
        city: randomFrom(CITIES),
        item: act.item,
        ago: timeAgo(act.createdAt),
      });
      setVisible(true);
      setTimeout(() => setVisible(false), 5000);
    }

    const firstTimer = setTimeout(showOne, 8000);
    const interval = setInterval(showOne, 35000);
    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, [activities]);

  if (!notification) return null;

  return (
    <div className={`${styles.popup} ${visible ? styles.visible : ''}`} role="status" aria-live="polite">
      <div className={styles.icon}>🛍</div>
      <div className={styles.content}>
        <p className={styles.main}>
          <strong>{notification.name}</strong> from {notification.city} just bought
        </p>
        <p className={styles.item}>{notification.item}</p>
        <p className={styles.ago}>{notification.ago}</p>
      </div>
      <button className={styles.close} onClick={() => setVisible(false)} aria-label="Dismiss">✕</button>
    </div>
  );
}
