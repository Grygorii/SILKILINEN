import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Journal editorial timestamps', () => {
  it('does not let a public read change an article edit timestamp', () => {
    const source = readFileSync('routes/journal.js', 'utf8');
    expect(source).toMatch(/findByIdAndUpdate\(article\._id,\s*\{ \$inc: \{ viewCount: 1 \} \},\s*\{ timestamps: false \}\)/s);
  });
});
