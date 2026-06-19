'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL;

type Product = { _id: string; name: string; slug?: string; image: string | null };

export default function WriteReviewForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [customerName, setCustomerName] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — must stay empty
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('This link is missing its token. Try clicking the link in the email again.');
      setLoading(false);
      return;
    }
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/reviews/from-token?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (aborted) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'This link is no longer valid.');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setProduct(data.product);
        setCustomerName(data.customerName || '');
        setName(data.customerName || '');
        setAlreadyReviewed(!!data.alreadyReviewed);
        setLoading(false);
      } catch {
        if (aborted) return;
        setError('Could not load the review form. Check your connection and try again.');
        setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/reviews/from-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          reviewer: name.trim(),
          starRating: rating,
          title: title.trim(),
          message: message.trim(),
          website, // honeypot — server drops the request if set
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Submission failed. Please try again.');
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Could not submit your review. Check your connection and try again.');
      setSubmitting(false);
    }
  }

  const wrapStyle: React.CSSProperties = {
    maxWidth: 560,
    margin: '0 auto',
    fontFamily: 'Jost, sans-serif',
    color: 'var(--color-ink, #2A2218)',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    letterSpacing: '2.5px',
    textTransform: 'uppercase',
    color: 'var(--color-ink-muted, #8A8278)',
    marginBottom: 8,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 48,
    padding: '0 14px',
    border: '1px solid var(--color-line, #E8E2D6)',
    background: '#fff',
    borderRadius: 2,
    fontFamily: 'Jost, sans-serif',
    fontSize: 14,
    color: 'var(--color-ink, #2A2218)',
  };

  if (loading) {
    return <div style={{ ...wrapStyle, textAlign: 'center', color: '#8A8278' }}>Loading…</div>;
  }

  if (error && !product) {
    return (
      <div style={{ ...wrapStyle, textAlign: 'center' }}>
        <p style={{ fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#8A8278', marginBottom: 20 }}>
          We couldn’t open this link
        </p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 300, lineHeight: 1.2, margin: '0 0 16px' }}>
          {error}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: '#8A8278', marginBottom: 32 }}>
          The link may have expired or already been used. If you’d like to leave a review,
          reply to the original order email and we’ll send a fresh link.
        </p>
        <a href="/" style={{ fontSize: 12, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#2A2218', textDecoration: 'underline' }}>
          ← Back to home
        </a>
      </div>
    );
  }

  if (alreadyReviewed) {
    return (
      <div style={{ ...wrapStyle, textAlign: 'center' }}>
        <p style={{ fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#8A8278', marginBottom: 20 }}>
          Review already submitted
        </p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 300, lineHeight: 1.2, margin: '0 0 16px' }}>
          Thank you — your review is already on its way.
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: '#8A8278' }}>
          Each link can only be used once. Approved reviews appear on the product page within a few days.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ ...wrapStyle, textAlign: 'center' }}>
        <p style={{ fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#8A8278', marginBottom: 20 }}>
          Thank you
        </p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 300, lineHeight: 1.2, margin: '0 0 16px' }}>
          We&rsquo;ve received your review.
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: '#8A8278', maxWidth: 440, margin: '0 auto 32px' }}>
          A member of our team will read it shortly. Approved reviews appear on the product page within a few days.
        </p>
        <a href={product?.slug ? `/product/${product.slug}` : (product?._id ? `/product/${product._id}` : '/shop')} style={{ display: 'inline-block', padding: '14px 32px', background: '#2A2218', color: '#FAF8F4', textDecoration: 'none', fontSize: 12, letterSpacing: '2.5px', textTransform: 'uppercase', borderRadius: 2 }}>
          View product
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={wrapStyle}>
      <p style={{ fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#8A8278', marginBottom: 16, textAlign: 'center' }}>
        {customerName ? `${customerName.split(' ')[0]}, write a review` : 'Write a review'}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, marginBottom: 32, background: '#fff', border: '1px solid #E8E2D6', borderRadius: 2 }}>
        {product?.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 2 }} />
        )}
        <div>
          <p style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8A8278', margin: '0 0 4px' }}>You purchased</p>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, color: '#2A2218', margin: 0 }}>
            {product?.name}
          </p>
        </div>
      </div>

      {/* Rating */}
      <div style={{ marginBottom: 24 }}>
        <span style={labelStyle}>Rating</span>
        <div role="radiogroup" aria-label="Rating" style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              onClick={() => setRating(n)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 32,
                color: n <= rating ? '#C4A882' : '#E8E2D6',
                padding: 0,
              }}
            >★</button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="reviewer-name" style={labelStyle}>Your name</label>
        <input
          id="reviewer-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          maxLength={80}
          style={inputStyle}
        />
      </div>

      {/* Title */}
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="reviewer-title" style={labelStyle}>Title <span style={{ fontWeight: 300, color: '#bbb', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
        <input
          id="reviewer-title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={120}
          placeholder="A few words to lead with"
          style={inputStyle}
        />
      </div>

      {/* Message */}
      <div style={{ marginBottom: 24 }}>
        <label htmlFor="reviewer-message" style={labelStyle}>Your review</label>
        <textarea
          id="reviewer-message"
          rows={6}
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={2000}
          placeholder="How does the silk feel? Did it fit as expected? What would you tell a friend who was considering it?"
          style={{ ...inputStyle, height: 'auto', padding: 14, fontFamily: 'Jost, sans-serif', lineHeight: 1.6, resize: 'vertical' }}
        />
        <div style={{ fontSize: 11, color: '#8A8278', marginTop: 6 }}>{message.length} / 2000</div>
      </div>

      {/* Honeypot — real users never see this */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Leave this empty
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={e => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <p style={{ color: '#c9572a', background: '#fde2e2', border: '1px solid #f4c9aa', padding: 12, borderRadius: 2, fontSize: 13, marginBottom: 16 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !name.trim() || rating < 1}
        style={{
          display: 'block',
          width: '100%',
          height: 52,
          background: '#2A2218',
          color: '#FAF8F4',
          border: 'none',
          borderRadius: 2,
          fontFamily: 'Jost, sans-serif',
          fontSize: 12,
          letterSpacing: '2.5px',
          textTransform: 'uppercase',
          cursor: submitting ? 'wait' : 'pointer',
          opacity: submitting || !name.trim() ? 0.5 : 1,
        }}
      >
        {submitting ? 'Submitting…' : 'Submit review'}
      </button>

      <p style={{ fontSize: 11, color: '#8A8278', marginTop: 16, textAlign: 'center', lineHeight: 1.5 }}>
        Reviews are read by our team before they appear on the product page.
      </p>
    </form>
  );
}
