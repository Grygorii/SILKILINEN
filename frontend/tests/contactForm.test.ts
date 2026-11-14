import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('contact form contract', () => {
  it('keeps the public contact action a real labelled form, not a decorative control', () => {
    const page = read('app/(shop)/contact/page.tsx');
    const form = read('app/(shop)/contact/ContactForm.tsx');

    expect(page).toContain('<ContactForm />');
    expect(form).toContain('<form className={styles.form} onSubmit={submit}>');
    expect(form).toContain('htmlFor="contact-name"');
    expect(form).toContain('htmlFor="contact-email"');
    expect(form).toContain('htmlFor="contact-message"');
    expect(form).toContain('required');
    expect(form).toContain("api.post('/api/contact', fields)");
  });

  it('gives visitors an accessible status and a truthful email fallback', () => {
    const form = read('app/(shop)/contact/ContactForm.tsx');
    const css = read('app/(shop)/contact/page.module.css');

    expect(form).toContain('aria-live="polite"');
    expect(form).toContain('role="alert"');
    expect(form).toContain('mailto:${FALLBACK_EMAIL}');
    expect(form).toContain('name="website"');
    expect(css).toContain('.honeypot');
    expect(css).toContain('min-height: var(--ctrl-h-desktop);');
  });
});
