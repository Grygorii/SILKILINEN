'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import styles from './DropAHint.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Props = {
  productId: string;
  productName: string;
  onClose: () => void;
};

export default function DropAHint({ productId, productName, onClose }: Props) {
  const [form, setForm] = useState({
    recipientName: '',
    recipientEmail: '',
    senderName: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  function setField(key: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!form.recipientEmail || !form.senderName) return;
    setStatus('sending');
    try {
      const res = await fetch(`${API}/api/products/${productId}/drop-hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('sent');
      setTimeout(onClose, 2500);
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Drop a hint">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Send a hint</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {status === 'sent' ? (
          <div className={styles.success}>
            <p className={styles.successTitle}>Hint sent</p>
            <p className={styles.successSub}>We hope they get the message.</p>
          </div>
        ) : (
          <>
            <p className={styles.subtitle}>
              Want a little nudge? Send a link to someone who&apos;ll know what to do.
            </p>
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label className={styles.label}>Their name</label>
                <input
                  className={styles.input}
                  value={form.recipientName}
                  onChange={e => setField('recipientName', e.target.value)}
                  placeholder="Sophie"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Their email *</label>
                <input
                  className={styles.input}
                  type="email"
                  required
                  value={form.recipientEmail}
                  onChange={e => setField('recipientEmail', e.target.value)}
                  placeholder="sophie@example.com"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Your name *</label>
                <input
                  className={styles.input}
                  required
                  value={form.senderName}
                  onChange={e => setField('senderName', e.target.value)}
                  placeholder="Aoife"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Your message (optional)</label>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={form.message}
                  onChange={e => setField('message', e.target.value)}
                  placeholder="I think this would look beautiful on you..."
                />
              </div>
              {status === 'error' && (
                <p className={styles.errorMsg}>Something went wrong. Please try again.</p>
              )}
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={status === 'sending'}
              >
                {status === 'sending' ? 'Sending…' : 'SEND HINT'}
              </button>
            </form>
            <p className={styles.productRef}>Re: {productName}</p>
          </>
        )}
      </div>
    </div>
  );
}
