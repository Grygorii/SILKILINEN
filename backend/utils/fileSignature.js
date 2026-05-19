'use strict';

// Magic-byte signature check. multer's fileFilter only sees client-supplied
// MIME headers (trivially spoofed), so after upload we sniff the actual
// buffer for known image formats. Returns the detected type or null.

function detectImageType(buf) {
  if (!buf || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'png';

  // GIF: 47 49 46 38 (37|39) 61  — "GIF87a" or "GIF89a"
  if (
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  ) return 'gif';

  // WebP: RIFF....WEBP — 52 49 46 46 ? ? ? ? 57 45 42 50
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'webp';

  return null;
}

function assertIsImage(file) {
  const type = detectImageType(file && file.buffer);
  if (!type) {
    const err = new Error('Uploaded file is not a recognised image (jpeg/png/gif/webp).');
    err.status = 400;
    err.expose = true;
    throw err;
  }
  return type;
}

module.exports = { detectImageType, assertIsImage };
