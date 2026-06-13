'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

/* ──────────────────────────────────────────────────────────────────────────
   Data shape (discovered from the live storefront, see shop/page.tsx +
   ProductCard.tsx + routes/newsletter.js):

   Products:  GET ${API}/api/products  → Product[]
     { _id, name, price, category (slug), images:[{url,isPrimary,alt}], status }
     Product page lives at /product/<_id>.
   Categories: GET ${API}/api/categories → { slug, label, count }[]
   Subscribe:  POST ${API}/api/newsletter  { email, source } → { success:true }

   Real category slugs in use: robes, pyjamas, sleep-dresses, lingerie,
   shorts, shirts, pillowcases, eye-masks, scarves.
─────────────────────────────────────────────────────────────────────────── */

type ProductImg = { url: string; isPrimary?: boolean; alt?: string };
type Product = {
  _id: string;
  name: string;
  price: number;
  category?: string;
  status?: string;
  images?: ProductImg[];
};

type Weights = Record<string, number>;

type Option = {
  label: string;
  /** Weights toward category slugs. */
  weights: Weights;
  /** Optional gentle nudge from words found in a product name. */
  colourHints?: string[];
};

type Question = {
  id: string;
  prompt: string;
  options: Option[];
};

/* The whole quiz config in one place. Weights point at the real category
   slugs above; the scorer falls back gracefully if a slug isn't stocked. */
const QUESTIONS: Question[] = [
  {
    id: 'intent',
    prompt: 'What are you looking for?',
    options: [
      { label: 'To sleep in', weights: { 'sleep-dresses': 3, pyjamas: 3, lingerie: 1 } },
      { label: 'To lounge', weights: { robes: 3, shorts: 2, shirts: 2 } },
      { label: 'Something to wear out', weights: { 'sleep-dresses': 3, scarves: 2, shirts: 1 } },
      { label: 'A gift', weights: { scarves: 2, 'eye-masks': 2, pillowcases: 2, robes: 1 } },
      { label: 'Just browsing', weights: { robes: 1, 'sleep-dresses': 1, scarves: 1, pyjamas: 1 } },
    ],
  },
  {
    id: 'feel',
    prompt: 'Your ideal feel?',
    options: [
      { label: 'Barely-there & cool', weights: { 'sleep-dresses': 3, lingerie: 2, pillowcases: 1 } },
      { label: 'Wrapped & warm', weights: { robes: 3, pyjamas: 2, shirts: 1 } },
      { label: 'Smooth & sculpted', weights: { 'sleep-dresses': 2, lingerie: 2, scarves: 1 } },
    ],
  },
  {
    id: 'mood',
    prompt: 'Pick a mood',
    options: [
      { label: 'Champagne & ivory', weights: {}, colourHints: ['champagne', 'ivory', 'cream', 'pearl', 'oyster', 'gold'] },
      { label: 'Inky & dramatic', weights: {}, colourHints: ['black', 'ink', 'midnight', 'noir', 'charcoal', 'navy'] },
      { label: 'Soft blush', weights: {}, colourHints: ['blush', 'rose', 'pink', 'petal', 'nude', 'dusty'] },
      { label: 'Sage & calm', weights: {}, colourHints: ['sage', 'green', 'eucalyptus', 'olive', 'moss', 'mist'] },
    ],
  },
  {
    id: 'material',
    prompt: 'Silk, linen, or surprise me?',
    options: [
      { label: 'Silk', weights: { 'sleep-dresses': 1, lingerie: 1, robes: 1 }, colourHints: ['silk'] },
      { label: 'Linen', weights: { shirts: 1, shorts: 1, robes: 1 }, colourHints: ['linen'] },
      { label: 'Surprise me', weights: {} },
    ],
  },
  {
    id: 'recipient',
    prompt: "Who's it for?",
    options: [
      { label: 'Myself', weights: {} },
      { label: 'Someone I love', weights: { scarves: 1, 'eye-masks': 1, pillowcases: 1, robes: 1 } },
    ],
  },
];

const TOTAL = QUESTIONS.length;

type Answer = { questionId: string; optionIndex: number };

type Phase = 'quiz' | 'loading' | 'results' | 'error';

function primaryImage(p: Product): string | null {
  const imgs = (p.images ?? []).filter(i => i && typeof i.url === 'string' && i.url);
  const primary = imgs.find(i => i.isPrimary) ?? imgs[0];
  return primary?.url ?? null;
}

/* Accumulate the answer weights and colour hints into one profile. */
function buildProfile(answers: Answer[]) {
  const weights: Weights = {};
  const colourHints: string[] = [];
  for (const a of answers) {
    const q = QUESTIONS.find(x => x.id === a.questionId);
    const opt = q?.options[a.optionIndex];
    if (!opt) continue;
    for (const [slug, w] of Object.entries(opt.weights)) {
      weights[slug] = (weights[slug] ?? 0) + w;
    }
    if (opt.colourHints) colourHints.push(...opt.colourHints);
  }
  return { weights, colourHints };
}

/* Score each product: category-weight match, plus a gentle name nudge for
   the chosen colour/material mood. Higher is better. */
function scoreProducts(products: Product[], weights: Weights, colourHints: string[]) {
  return products
    .filter(p => p.status === undefined || p.status === 'active' || p.status === 'published')
    .map(p => {
      const cat = p.category ?? '';
      const name = (p.name ?? '').toLowerCase();
      let score = weights[cat] ?? 0;
      // Gentle colour/material nudge from the product name.
      for (const hint of colourHints) {
        if (name.includes(hint)) score += 1.5;
      }
      // Tiny deterministic tie-break so ordering is stable, not random.
      const tie = (p._id.charCodeAt(p._id.length - 1) % 7) * 0.001;
      return { product: p, score: score + tie };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.product);
}

/* A warm, personalised one-liner built from the chosen mood + feel + intent.
   Pure quiet-luxury voice — British/Irish English. */
function resultLine(answers: Answer[]): string {
  const moodIdx = answers.find(a => a.questionId === 'mood')?.optionIndex;
  const feelIdx = answers.find(a => a.questionId === 'feel')?.optionIndex;
  const intentIdx = answers.find(a => a.questionId === 'intent')?.optionIndex;

  const tone = ['in champagne tones', 'in inky, low-lit tones', 'in soft blush tones', 'in calm sage tones'][moodIdx ?? -1] ?? 'in tones we think you’ll love';
  const feel = ['for cool, considered rest', 'for being wrapped and warm', 'for smooth, sculpted ease'][feelIdx ?? -1] ?? 'for the way you like to feel';
  const close = intentIdx === 3 ? 'a quiet gift, beautifully chosen' : 'these are yours';

  return `${feel.charAt(0).toUpperCase()}${feel.slice(1)}, ${tone} — ${close}.`;
}

export default function StyleFinder() {
  const [phase, setPhase] = useState<Phase>('quiz');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [results, setResults] = useState<Product[]>([]);
  const [line, setLine] = useState('');

  // Optional, fully non-blocking email capture on the results screen.
  const [email, setEmail] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const finish = useCallback(async (allAnswers: Answer[]) => {
    setPhase('loading');
    const { weights, colourHints } = buildProfile(allAnswers);
    try {
      const res = await fetch(`${API}/api/products`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed');
      const data: Product[] = await res.json();
      const ranked = scoreProducts(Array.isArray(data) ? data : [], weights, colourHints);
      // Fall back to top categories if scoring is empty (e.g. sparse stock).
      const picks = ranked.slice(0, 4);
      setResults(picks);
      setLine(resultLine(allAnswers));
      setPhase('results');
    } catch {
      setLine(resultLine(allAnswers));
      setPhase('error');
    }
  }, []);

  const choose = useCallback(
    (optionIndex: number) => {
      const q = QUESTIONS[step];
      const next = [...answers.filter(a => a.questionId !== q.id), { questionId: q.id, optionIndex }];
      setAnswers(next);
      if (step + 1 < TOTAL) {
        setStep(step + 1);
      } else {
        finish(next);
      }
    },
    [step, answers, finish],
  );

  const back = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  const restart = useCallback(() => {
    setAnswers([]);
    setStep(0);
    setResults([]);
    setLine('');
    setEmail('');
    setSaveState('idle');
    setPhase('quiz');
  }, []);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || saveState === 'saving' || saveState === 'saved') return;
    setSaveState('saving');
    try {
      const res = await fetch(`${API}/api/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'style-finder' }),
      });
      if (!res.ok) throw new Error('save failed');
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  const currentAnswer = answers.find(a => a.questionId === QUESTIONS[step]?.id);

  return (
    <main className={styles.page}>
      {/* ── Quiz ─────────────────────────────────────────── */}
      {phase === 'quiz' && (
        <section className={styles.stage} aria-live="polite">
          <p className={styles.kicker}>Silk Style Finder</p>

          <div className={styles.dots} aria-hidden="true">
            {QUESTIONS.map((q, i) => (
              <span key={q.id} className={`${styles.dot} ${i === step ? styles.dotActive : ''} ${i < step ? styles.dotDone : ''}`} />
            ))}
          </div>

          <h1 className={styles.question}>{QUESTIONS[step].prompt}</h1>

          <ul className={styles.options}>
            {QUESTIONS[step].options.map((opt, i) => (
              <li key={opt.label}>
                <button
                  type="button"
                  className={`${styles.option} ${currentAnswer?.optionIndex === i ? styles.optionChosen : ''}`}
                  onClick={() => choose(i)}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.controls}>
            {step > 0 ? (
              <button type="button" className={styles.textBtn} onClick={back}>
                ← Back
              </button>
            ) : (
              <span />
            )}
            <span className={styles.counter}>
              {step + 1} of {TOTAL}
            </span>
          </div>
        </section>
      )}

      {/* ── Loading ──────────────────────────────────────── */}
      {phase === 'loading' && (
        <section className={styles.stage} aria-live="polite">
          <p className={styles.kicker}>Silk Style Finder</p>
          <h1 className={styles.question}>Gathering your edit…</h1>
          <p className={styles.subtle}>A moment, while we choose the pieces made for you.</p>
        </section>
      )}

      {/* ── Results ──────────────────────────────────────── */}
      {phase === 'results' && (
        <section className={styles.results} aria-live="polite">
          <p className={styles.kicker}>Your silk edit</p>
          <h1 className={styles.resultTitle}>{line}</h1>

          {results.length > 0 ? (
            <div className={styles.grid}>
              {results.map(p => {
                const img = primaryImage(p);
                return (
                  <Link key={p._id} href={`/product/${p._id}`} className={styles.card}>
                    <span className={styles.cardImg}>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={p.name} loading="lazy" />
                      ) : (
                        <span className={styles.imgFallback} aria-hidden="true" />
                      )}
                    </span>
                    <span className={styles.cardName}>{p.name}</span>
                    <span className={styles.cardPrice}>€{Number(p.price).toFixed(2)}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyEdit}>
              <p className={styles.subtle}>
                Your edit is ready to be explored in full.
              </p>
              <Link href="/shop" className={styles.ctaOutline}>
                Shop the collection
              </Link>
            </div>
          )}

          {/* Optional, never-blocking email capture (real /api/newsletter). */}
          {saveState === 'saved' ? (
            <p className={styles.savedNote}>Saved.</p>
          ) : (
            <form className={styles.save} onSubmit={saveEdit}>
              <label className={styles.saveLabel} htmlFor="sf-email">
                Save your edit — first access to new pieces
              </label>
              <div className={styles.saveRow}>
                <input
                  id="sf-email"
                  type="email"
                  className={styles.saveInput}
                  placeholder="Your email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={saveState === 'saving'}
                  required
                />
                <button type="submit" className={styles.saveBtn} disabled={saveState === 'saving'}>
                  {saveState === 'saving' ? 'Saving…' : 'Save'}
                </button>
              </div>
              {saveState === 'error' && <p className={styles.subtle}>That didn’t save — do try again.</p>}
            </form>
          )}

          <div className={styles.finalControls}>
            <button type="button" className={styles.textBtn} onClick={restart}>
              Start again
            </button>
            <Link href="/shop" className={styles.textBtn}>
              Shop everything →
            </Link>
          </div>
        </section>
      )}

      {/* ── Error (products failed to load) ──────────────── */}
      {phase === 'error' && (
        <section className={styles.results} aria-live="polite">
          <p className={styles.kicker}>Your silk edit</p>
          <h1 className={styles.resultTitle}>{line}</h1>
          <div className={styles.emptyEdit}>
            <p className={styles.subtle}>
              We couldn’t gather your pieces just now — but the collection is waiting.
            </p>
            <Link href="/shop" className={styles.ctaOutline}>
              Shop the collection
            </Link>
          </div>
          <div className={styles.finalControls}>
            <button type="button" className={styles.textBtn} onClick={restart}>
              Start again
            </button>
            <Link href="/shop" className={styles.textBtn}>
              Shop everything →
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
