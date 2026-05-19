import { describe, it, expect } from 'vitest';
import { detectImageType } from '../utils/fileSignature.js';

// Real magic-byte prefixes followed by garbage payload bytes. The detector
// only sniffs the first 12 bytes, so the rest is irrelevant.
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const png  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const gif87 = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
const gif89 = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

// MZ header — DOS/Windows PE executable. The exact attack F15 exists to block.
const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);

describe('detectImageType', () => {
  it('recognises JPEG', () => {
    expect(detectImageType(jpeg)).toBe('jpeg');
  });

  it('recognises PNG', () => {
    expect(detectImageType(png)).toBe('png');
  });

  it('recognises GIF87a and GIF89a', () => {
    expect(detectImageType(gif87)).toBe('gif');
    expect(detectImageType(gif89)).toBe('gif');
  });

  it('recognises WebP (RIFF...WEBP)', () => {
    expect(detectImageType(webp)).toBe('webp');
  });

  it('rejects a Windows executable masquerading as image/jpeg', () => {
    expect(detectImageType(exe)).toBeNull();
  });

  it('rejects empty / undersized buffers', () => {
    expect(detectImageType(null)).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it('rejects an arbitrary text buffer', () => {
    expect(detectImageType(Buffer.from('not an image at all'))).toBeNull();
  });
});
