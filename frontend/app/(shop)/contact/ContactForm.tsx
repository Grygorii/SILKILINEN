'use client';

import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import styles from './page.module.css';

type ContactFields = {
  name: string;
  email: string;
  message: string;
  website: string;
};

const INITIAL_FIELDS: ContactFields = { name: '', email: '', message: '', website: '' };
const FALLBACK_EMAIL = 'hello@silkilinen.com';

export default function ContactForm() {
  const [fields, setFields] = useState<ContactFields>(INITIAL_FIELDS);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  function update<K extends keyof ContactFields>(key: K, value: ContactFields[K]) {
    setFields(current => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'sending') return;

    setState('sending');
    setMessage('');
    try {
      await api.post('/api/contact', fields);
      setFields(INITIAL_FIELDS);
      setState('sent');
      setMessage('Thank you — your message is on its way. We’ll be in touch soon.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiError && error.message
        ? error.message
        : 'We could not send your message just now.');
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}>
        <label htmlFor="contact-name">Your name</label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          value={fields.name}
          onChange={event => update('name', event.target.value)}
          maxLength={120}
          required
          disabled={state === 'sending'}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="contact-email">Email address</label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          value={fields.email}
          onChange={event => update('email', event.target.value)}
          maxLength={200}
          required
          disabled={state === 'sending'}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="contact-message">Your message</label>
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          value={fields.message}
          onChange={event => update('message', event.target.value)}
          maxLength={3000}
          required
          disabled={state === 'sending'}
        />
      </div>
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={fields.website}
          onChange={event => update('website', event.target.value)}
        />
      </div>
      <button type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send message'}
      </button>
      <div className={styles.formStatus} aria-live="polite" aria-atomic="true">
        {state === 'sent' && <p className={styles.success}>{message}</p>}
        {state === 'error' && (
          <p className={styles.error} role="alert">
            {message} You can also email us at <a href={`mailto:${FALLBACK_EMAIL}`}>{FALLBACK_EMAIL}</a>.
          </p>
        )}
      </div>
    </form>
  );
}
