const { GoogleGenAI } = require('@google/genai');

const SEO_MODEL = 'gemini-2.0-flash';

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`SEO generation timed out after ${ms / 1000}s`)), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}

async function generateProductSEO(data) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `You are an SEO expert for SILKILINEN, a luxury silk and linen fashion brand based in Dublin, Ireland. Generate SEO content for this product. Return ONLY valid JSON, no other text.

Product details:
- Name: ${data.name}
- Description: ${data.description || 'Not provided'}
- Category: ${data.category}
- Material: ${data.materialComposition || 'Pure silk'}
- Colours: ${Array.isArray(data.colours) ? data.colours.join(', ') : (data.colours || 'Various')}
- Price: €${data.price}

Brand context:
- Quiet luxury aesthetic (Toast, Eberjey, La Perla level)
- Made in Dublin, ships worldwide
- OEKO-TEX certified silk
- Small business, handmade

Return JSON in this exact format:
{
  "metaTitle": "string under 60 characters, include product name and SILKILINEN",
  "metaDescription": "string between 140-160 characters, evocative but informative, include key product details and 'Made in Dublin'",
  "slug": "url-friendly-slug-like-this",
  "keywords": ["array", "of", "5-8", "relevant", "search", "terms"],
  "altTextTemplate": "template for image alt text using {position} placeholder, e.g. 'Bastet Silk Shorts in Cream — {position} view, handmade silk by SILKILINEN Dublin'"
}

Quality rules:
- Meta title: clear, includes product name + brand, under 60 characters
- Meta description: lead with benefit, include material + origin, evocative not salesy, 140-160 chars
- Slug: lowercase, hyphens only, no special chars, max 50 chars
- Keywords: mix of product terms, brand terms, and use cases
- All copy in British English (colour not color, programme not program)`;

  const response = await withTimeout(
    genai.models.generateContent({
      model: SEO_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    }),
    30_000
  );

  let text = '';
  for (const part of (response.candidates?.[0]?.content?.parts || [])) {
    if (part.text) { text = part.text; break; }
  }
  if (!text) throw new Error('No text response from Gemini');

  const cleanText = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleanText);
}

module.exports = { generateProductSEO };
