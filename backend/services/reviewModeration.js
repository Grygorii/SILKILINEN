'use strict';

// Auto-flag heuristics for incoming reviews. Each fires a tag in
// flagReasons[]; the admin still has final say on every review. The
// goal is high recall on scams without false-positives that would
// upset legitimate customers — when in doubt, flag and let the admin
// approve.

const URL_RE         = /\b(https?:\/\/|www\.|bit\.ly|tinyurl|t\.co)\S*/i;
const EMAIL_RE       = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE       = /\+?\d[\d\s().-]{7,}/;
const ALL_CAPS_RE    = /\b[A-Z]{3,}(\s+[A-Z]{3,}){3,}\b/;     // 4+ consecutive uppercase words
const REPEAT_CHAR_RE = /(.)\1{6,}/;                            // letter repeated 7+ times (looooooove)
const EMOJI_RE       = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}]/gu;
// Prompt-injection phrasing. Reviews can be fed into the admin AI tools (Pin
// Studio), so surface anything that reads like an instruction to a model so the
// admin sees it before approving. Advisory only — the AI paths also fence this
// text as data; this is defence-in-depth at the human-review step.
const PROMPT_INJECTION_RE = /\b(ignore|disregard|forget)\b[^.]*\b(previous|prior|above|earlier|all)\b[^.]*\b(instruction|prompt|rule|direction)/i;
const AI_DIRECTIVE_RE     = /\b(system prompt|you are now|new task|as an ai|act as|role\s*:\s*system|assistant\s*:|<<<|reveal your (instructions|prompt))/i;

// Small, conservative phrase allowlist. Add as the spam evolves; don't
// be tempted to expand to include benign words.
const SPAM_PHRASES = [
  'click here', 'buy now', 'free money', 'crypto', 'btc address',
  'whatsapp me', 'telegram me', 'dm me', 'contact me at',
  'best price', 'wholesale', '100% off', 'lottery',
];

function emojiDensity(text) {
  const matches = text.match(EMOJI_RE);
  if (!matches) return 0;
  return matches.length / Math.max(text.length, 1);
}

/**
 * Run heuristics over a review payload. Returns the list of flag tags
 * that matched. Empty list = clean submission. Caller decides what
 * status to set based on policy (we default to 'pending' regardless,
 * so flags are advisory in the admin UI, not gating).
 */
function flagReview({ reviewer = '', title = '', message = '' }) {
  const flags = [];
  const body = `${title}\n${message}`;
  const reviewerLower = reviewer.toLowerCase();
  const bodyLower = body.toLowerCase();

  if (URL_RE.test(body))            flags.push('contains-url');
  if (EMAIL_RE.test(body))          flags.push('contains-email');
  if (PHONE_RE.test(body))          flags.push('contains-phone');
  if (ALL_CAPS_RE.test(body))       flags.push('shouty-uppercase');
  if (REPEAT_CHAR_RE.test(body))    flags.push('stretched-characters');
  if (emojiDensity(body) > 0.3)     flags.push('emoji-heavy');
  if (message.trim().length > 0 && message.trim().length < 10) flags.push('very-short');
  if (message.trim().length > 2000) flags.push('excessive-length');
  if (PROMPT_INJECTION_RE.test(body) || AI_DIRECTIVE_RE.test(body)) flags.push('prompt-injection');

  // Reviewer name shouldn't be a marketing handle
  if (URL_RE.test(reviewer) || EMAIL_RE.test(reviewer)) flags.push('promo-handle');
  if (reviewer.trim().length < 2) flags.push('invalid-name');

  // Spam phrase match (case-insensitive)
  for (const phrase of SPAM_PHRASES) {
    if (bodyLower.includes(phrase) || reviewerLower.includes(phrase)) {
      flags.push(`spam-phrase:${phrase.replace(/\s+/g, '-')}`);
      break; // one phrase match is enough; no need to spam the flags array
    }
  }

  return flags;
}

/**
 * Human-readable label for a flag tag. Used by the admin moderation UI
 * so the operator doesn't have to read the raw tag.
 */
function flagLabel(tag) {
  if (tag.startsWith('spam-phrase:')) return `Spam phrase: ${tag.split(':')[1].replace(/-/g, ' ')}`;
  const labels = {
    'contains-url':         'Contains a URL',
    'contains-email':       'Contains an email address',
    'contains-phone':       'Contains a phone number',
    'shouty-uppercase':     'Aggressive uppercase',
    'stretched-characters': 'Stretched characters (loooove)',
    'emoji-heavy':          'High emoji density',
    'very-short':           'Very short body',
    'excessive-length':     'Excessively long',
    'promo-handle':         'Reviewer name contains a URL or email',
    'invalid-name':         'Reviewer name too short',
    'prompt-injection':     'Reads like an AI prompt-injection attempt',
  };
  return labels[tag] || tag;
}

module.exports = { flagReview, flagLabel };
