# SILKILINEN photographic direction

This system keeps product truth ahead of atmosphere. Editorial images may set a mood, but every image used to sell a piece must preserve its real colour, construction, trim, proportions and fit.

## Image roles

- **Campaign:** one composed, human scene per homepage campaign. Use quiet natural interiors or Irish landscape light, with the garment still readable. Prefer 3:2 landscape on desktop and supply a deliberate 4:5 mobile crop with the subject inside the central 60%.
- **Product cards:** 4:5 portrait, consistent warm-ivory background, full garment visible at a repeatable scale. The garment should occupy roughly 75–85% of frame height. Do not mix full-body, torso-only and empty lifestyle frames in the same grid.
- **Product gallery:** first image is the clearest full-garment view; follow with front/back, construction details, fabric texture, then restrained lifestyle or video. Portrait stills use 4:5; detail crops may use 1:1. Never use lifestyle imagery as the only evidence of the product.

## Light, colour and finish

- Soft directional daylight, neutral-to-warm white balance, controlled highlights that retain silk texture.
- Warm ivory or pale mineral backgrounds; soft contact shadows, never artificial glow or mirror-like shine.
- Natural skin texture and anatomically credible hands. Avoid excessive smoothing and inconsistent faces across one product story.
- Match colour against the physical garment before publishing. Silk sheen may change with angle; the base colour must not.

## Composition

- Keep camera height, subject scale and horizon consistent within a product grid.
- Models should stand naturally with hands visible or intentionally outside frame—not concealed to mask anatomy.
- Keep buttons, piping, seams, hems and straps unobstructed in at least one image.
- Define mobile focal points in Cloudinary crops; never rely on an automatic centre crop when it removes the garment.

## Delivery requirements

- Upload a master at least 1800px on the long edge; preserve the original asset and public ID.
- Serve responsive `srcset`/`sizes`, modern formats and automatic quality through Cloudinary.
- Product-card images reserve their aspect ratio before loading. The hero and first product image receive priority; gallery images after the first load lazily.
- Alt text describes the visible product, colour and view. It must not add manufacturing or material claims that are not established in product data.

## Current live-image audit — 12 November 2026

The live collection grid is technically sound—images load without broken assets—but its first row mixes four incompatible treatments: a full-body male studio image, an empty bedroom lifestyle frame, a full-body female studio image and a torso crop. That inconsistency weakens comparison and makes the catalogue feel assembled rather than art-directed.

Ranked replacement plan:

1. **Silk pillowcase in Pink Blush:** replace the empty-bedroom primary card image with a clear 4:5 product-led frame; retain the room image later in the gallery.
2. **Silk bikini briefs in Bare Blush:** replace or recrop the neck-to-hip primary image to match the subject scale of adjacent full-garment cards. Verify skin, straps, seams and waistband against originals.
3. **Silk men's pure boxer shorts in Copper:** recrop closer while keeping the full garment and natural proportions; the current distant full-body scale makes the product materially smaller than adjacent cards.
4. **Silk sunset nightshirt in Copper:** align crop, background temperature and subject scale with the other nightshirts.
5. Audit generic or malformed alt text, including “undefined Silk Apparel”, against the actual image and product record.

No live images were replaced in this pass. Reliable original product photography was not available in the repository, so generating replacements would risk changing garment construction or colour. Replacements should be made from approved originals, preserved under new Cloudinary public IDs, and reversible from the product editor.
