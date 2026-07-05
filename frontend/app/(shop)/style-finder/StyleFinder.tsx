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
  slug?: string;
  name: string;
  price: number;
  category?: string;
  status?: string;
  images?: ProductImg[];
};

/** Exported for the server page, which loads the catalogue and passes it in. */
export type SFProduct = Product;

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

/* Tasteful swatch hexes for the colour/mood question, keyed by option index.
   Used only for presentation — scoring still flows through colourHints. */
const MOOD_SWATCHES = ['#e8dcc4', 'var(--color-ink)', '#e3c6c2', '#c2cabb'];

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

type Phase = 'intro' | 'quiz' | 'loading' | 'results' | 'error';

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

/* ──────────────────────────────────────────────────────────────────────────
   Shareable persona. Five named silk "characters". The persona is chosen from
   the SAME answer weights the scorer already uses — no new scoring path. We
   read the accumulated colourHints (champagne / ink / blush / sage) plus the
   linen lean, tally them into the five clusters, and take the highest. Ties
   and "no strong colour" fall to the Considered Classicist. */
type Persona = {
  key: string;
  name: string;
  line: string;
};

const PERSONAS: Record<string, Persona> = {
  minimalist: {
    key: 'minimalist',
    name: 'The Quiet Minimalist',
    line: 'Clean lines, champagne and ivory — nothing that shouts.',
  },
  romantic: {
    key: 'romantic',
    name: 'The Romantic',
    line: 'Blush, soft drape, slow mornings that stretch.',
  },
  sophisticate: {
    key: 'sophisticate',
    name: 'The Midnight Sophisticate',
    line: 'Ink and inky silk, dressed for candlelight.',
  },
  naturalist: {
    key: 'naturalist',
    name: 'The Sun-washed Naturalist',
    line: 'Sage, linen and bare-legged ease.',
  },
  classicist: {
    key: 'classicist',
    name: 'The Considered Classicist',
    line: 'Timeless robes and slips — investment pieces, kept for years.',
  },
};

/* Which colour hints belong to which cluster. Mirrors the mood-question hints. */
const PERSONA_HINTS: Record<string, string[]> = {
  minimalist: ['champagne', 'ivory', 'cream', 'pearl', 'oyster', 'gold'],
  romantic: ['blush', 'rose', 'pink', 'petal', 'nude', 'dusty'],
  sophisticate: ['black', 'ink', 'midnight', 'noir', 'charcoal', 'navy'],
  naturalist: ['sage', 'green', 'eucalyptus', 'olive', 'moss', 'mist', 'linen'],
};

function choosePersona(colourHints: string[]): Persona {
  const tally: Record<string, number> = {
    minimalist: 0,
    romantic: 0,
    sophisticate: 0,
    naturalist: 0,
  };
  for (const hint of colourHints) {
    for (const [key, hints] of Object.entries(PERSONA_HINTS)) {
      if (hints.includes(hint)) tally[key] += 1;
    }
  }
  let bestKey = '';
  let bestScore = 0;
  // Stable order so ties resolve deterministically (first-defined wins).
  for (const key of ['minimalist', 'romantic', 'sophisticate', 'naturalist']) {
    if (tally[key] > bestScore) {
      bestScore = tally[key];
      bestKey = key;
    }
  }
  // No strong colour cluster → the timeless default.
  return bestScore > 0 ? PERSONAS[bestKey] : PERSONAS.classicist;
}

/* Stagger helper for the staged reveal: each element eases in ~150ms after the
   one before it. Returns a style object carrying the per-element delay. */
function revealDelay(index: number): React.CSSProperties {
  return { animationDelay: `${index * 150}ms` };
}

export default function StyleFinder({ initialProducts = [] }: { initialProducts?: Product[] }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [results, setResults] = useState<Product[]>([]);
  const [line, setLine] = useState('');
  const [persona, setPersona] = useState<Persona | null>(null);

  // Optional, fully non-blocking email capture on the results screen.
  const [email, setEmail] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Calm "Copy link" affordance on the results.
  const [copied, setCopied] = useState(false);

  const finish = useCallback(async (allAnswers: Answer[]) => {
    setPhase('loading');
    const { weights, colourHints } = buildProfile(allAnswers);
    setPersona(choosePersona(colourHints));
    // A calm minimum "gathering" beat so the reveal feels earned, not instant.
    const beat = new Promise<void>(resolve => setTimeout(resolve, 1100));

    // Products are loaded by the server page and passed in — reliable. Only if
    // that came back empty do we try a client fetch as a last resort.
    let catalogue = initialProducts;
    if (!catalogue.length) {
      try {
        const res = await fetch(`${API}/api/products`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) catalogue = data;
        }
      } catch {
        /* stay graceful — handled by the empty-catalogue branch below */
      }
    }

    const ranked = scoreProducts(catalogue, weights, colourHints);
    let picks = ranked.slice(0, 4);
    // Guarantee a non-empty edit: if the match set is thin, top up with other
    // pieces so the quiz never dead-ends on "we couldn't gather your pieces".
    if (picks.length < 4) {
      const have = new Set(picks.map(p => p._id));
      picks = [...picks, ...catalogue.filter(p => !have.has(p._id)).slice(0, 4 - picks.length)];
    }

    await beat;
    setResults(picks);
    setLine(resultLine(allAnswers));
    // Only fall to the graceful "shop the collection" screen if there is truly
    // no catalogue to show at all.
    setPhase(picks.length ? 'results' : 'error');
  }, [initialProducts]);

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
    setPersona(null);
    setEmail('');
    setSaveState('idle');
    setCopied(false);
    setPhase('intro');
  }, []);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard unavailable — stay quiet, no error surfaced.
    }
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
      {/* ── Intro ────────────────────────────────────────── */}
      {phase === 'intro' && (
        <section className={`${styles.intro} ${styles.fadeIn}`} aria-live="polite">
          <p className={styles.kicker}>Silk Style Finder</p>
          <h1 className={styles.introTitle}>Which silk are you?</h1>
          <p className={styles.introSub}>
            Five quiet questions. One edit, chosen for the way you like to live in silk.
          </p>
          <button type="button" className={styles.beginBtn} onClick={() => setPhase('quiz')}>
            Begin
          </button>
        </section>
      )}

      {/* ── Quiz ─────────────────────────────────────────── */}
      {phase === 'quiz' && (
        <section className={styles.stage} aria-live="polite">
          <p className={styles.kicker}>Silk Style Finder</p>

          <div className={styles.progress} aria-hidden="true">
            <span className={styles.progressNum}>
              {String(step + 1).padStart(2, '0')} / {String(TOTAL).padStart(2, '0')}
            </span>
            <span className={styles.progressTrack}>
              <span
                className={styles.progressFill}
                style={{ transform: `scaleX(${(step + 1) / TOTAL})` }}
              />
            </span>
          </div>

          {/* Keyed on step so each question fades/slides in afresh. */}
          <div key={QUESTIONS[step].id} className={styles.slide}>
            <h1 className={styles.question}>{QUESTIONS[step].prompt}</h1>

            <ul className={`${styles.options} ${QUESTIONS[step].id === 'mood' ? styles.optionsSwatch : ''}`}>
              {QUESTIONS[step].options.map((opt, i) => (
                <li key={opt.label}>
                  <button
                    type="button"
                    className={`${styles.option} ${currentAnswer?.optionIndex === i ? styles.optionChosen : ''}`}
                    onClick={() => choose(i)}
                  >
                    {QUESTIONS[step].id === 'mood' && (
                      <span
                        className={styles.swatch}
                        style={{ background: MOOD_SWATCHES[i] }}
                        aria-hidden="true"
                      />
                    )}
                    <span className={styles.optionLabel}>{opt.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.controls}>
            {step > 0 ? (
              <button type="button" className={styles.backBtn} onClick={back} aria-label="Previous question">
                <span aria-hidden="true">←</span> Back
              </button>
            ) : (
              <span />
            )}
          </div>
        </section>
      )}

      {/* ── Loading — a calm "gathering" beat ────────────── */}
      {phase === 'loading' && (
        <section className={`${styles.stage} ${styles.gather}`} aria-live="polite" aria-busy="true">
          <p className={styles.kicker}>Silk Style Finder</p>
          <span className={styles.gatherLine} aria-hidden="true" />
          <p className={styles.gatherWords}>
            <span className={styles.gatherWord}>Reading your answers…</span>
            <span className={styles.gatherWord}>Gathering your silk…</span>
            <span className={styles.gatherWord}>Choosing the pieces made for you…</span>
          </p>
          <span className={styles.srOnly}>Gathering your edit.</span>
        </section>
      )}

      {/* ── Results — staged, cinematic reveal ───────────── */}
      {phase === 'results' && (
        <section className={styles.results} aria-live="polite">
          {persona && (
            <div className={styles.persona}>
              <span className={styles.personaGlow} aria-hidden="true" />
              <p className={`${styles.kicker} ${styles.reveal}`} style={revealDelay(0)}>You are</p>
              <h1 className={`${styles.personaName} ${styles.reveal}`} style={revealDelay(1)}>
                {persona.name}
              </h1>
              <p className={`${styles.personaLine} ${styles.reveal}`} style={revealDelay(2)}>
                {persona.line}
              </p>
            </div>
          )}

          <p className={`${styles.editKicker} ${styles.reveal}`} style={revealDelay(3)}>Your edit</p>
          <h2 className={`${styles.resultTitle} ${styles.reveal}`} style={revealDelay(4)}>
            {line} <span className={styles.resultDecisive}>This is your edit.</span>
          </h2>

          {results.length > 0 ? (
            <div className={styles.grid}>
              {results.map((p, i) => {
                const img = primaryImage(p);
                const isPrimaryPick = i === 0;
                return (
                  <Link
                    key={p._id}
                    href={`/product/${p.slug || p._id}`}
                    className={`${styles.card} ${isPrimaryPick ? styles.cardPrimary : ''} ${styles.reveal}`}
                    style={revealDelay(5 + i)}
                  >
                    <span className={styles.cardImg}>
                      {isPrimaryPick && <span className={styles.matchMark}>Your match</span>}
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={p.name} loading="lazy" />
                      ) : (
                        <span className={styles.imgFallback} aria-hidden="true" />
                      )}
                    </span>
                    <span className={styles.cardName}>{p.name}</span>
                    <span className={styles.cardPrice}>€{Number(p.price).toFixed(2)}</span>
                    <span className={styles.cardView} aria-hidden="true">View piece →</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={`${styles.emptyEdit} ${styles.reveal}`} style={revealDelay(5)}>
              <p className={styles.subtle}>
                Your edit is ready to be explored in full.
              </p>
              <Link href="/shop" className={styles.ctaOutline}>
                Shop the collection →
              </Link>
            </div>
          )}

          {/* ── Calm controls, placed below the reveal ─────── */}
          <div className={styles.afterReveal}>
            <div className={styles.shareRow}>
              <button type="button" className={styles.shareBtn} onClick={copyLink}>
                {copied ? 'Link copied' : 'Share'}
              </button>
            </div>

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
          </div>
        </section>
      )}

      {/* ── Error (products failed to load) — persona still reveals ─ */}
      {phase === 'error' && (
        <section className={styles.results} aria-live="polite">
          {persona && (
            <div className={styles.persona}>
              <span className={styles.personaGlow} aria-hidden="true" />
              <p className={`${styles.kicker} ${styles.reveal}`} style={revealDelay(0)}>You are</p>
              <h1 className={`${styles.personaName} ${styles.reveal}`} style={revealDelay(1)}>
                {persona.name}
              </h1>
              <p className={`${styles.personaLine} ${styles.reveal}`} style={revealDelay(2)}>
                {persona.line}
              </p>
            </div>
          )}
          <p className={`${styles.editKicker} ${styles.reveal}`} style={revealDelay(3)}>Your edit</p>
          <h2 className={`${styles.resultTitle} ${styles.reveal}`} style={revealDelay(4)}>
            {line} <span className={styles.resultDecisive}>This is your edit.</span>
          </h2>
          <div className={`${styles.emptyEdit} ${styles.reveal}`} style={revealDelay(5)}>
            <p className={styles.subtle}>
              We couldn’t gather your pieces just now — but the collection is waiting.
            </p>
            <Link href="/shop" className={styles.ctaOutline}>
              Shop the collection →
            </Link>
          </div>
          <div className={styles.afterReveal}>
            <div className={styles.finalControls}>
              <button type="button" className={styles.textBtn} onClick={restart}>
                Start again
              </button>
              <Link href="/shop" className={styles.textBtn}>
                Shop everything →
              </Link>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
