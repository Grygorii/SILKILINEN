require('dotenv').config();
const mongoose = require('mongoose');
const AiModel = require('../models/AiModel');
const { hasRun, markRun } = require('./_lib/migrations');

const MIGRATION_NAME = 'updateAiModelPromptsV2';

const MODEL_PROMPTS_V2 = {
  'Aoife': `A 28-year-old fashion model with quiet Irish beauty. The brand's signature face — chosen not because she dominates the frame, but because she lets the garment breathe.

Face: Heart-shaped face, defined jawline, gentle high cheekbones. Sea-green eyes with long dark lashes, set wide apart. Naturally arched warm-brown brows. Refined straight nose with a delicately rounded tip. Full natural lips with neutral pink tone, defined cupid's bow. A delicate scattering of natural freckles across the bridge of her nose and upper cheekbones — characterful, not stylised.

Hair: Long auburn hair (rich warm copper-chestnut), glossy and healthy, falling past mid-chest. Soft natural waves with body and movement. Side-parted, falling beautifully over one shoulder. Air-dried texture, groomed.

Skin: Fair Celtic complexion with cool pink undertone. Dewy luminous finish. Subtle natural freckles on shoulders and collarbones. No visible makeup beyond a wash of warmth on cheeks and groomed brows.

Body: 5'9", slim model proportions — long limbs, narrow shoulders, long elegant neck, defined collarbones, small bust, lean frame. Long-fingered narrow hands with short natural nails.

Age: 28. Composed, real, not performing.

Expression: Soft closed-mouth, gaze direct but unforced — a look of quiet consideration. Not magnetic, not arresting, not "editorial cover energy." A real woman calmly meeting the camera. Brow relaxed. The expression of someone considering whether to say something, then choosing to be still.

Energy: Quiet beauty, calm presence, slow consideration. Aspiration through stillness, not through performance. Toast UK, &Daughter, Brunello Cucinelli — the brands she'd wear, not the brands she'd front.

Critical instruction — read carefully: Aoife serves the garment. She is beautiful, but the garment is the subject. Her face supports the silk; the silk does not support her face. If a viewer's eye lands on Aoife first, the photograph has failed. If their eye lands on the silk and feels Aoife as its quiet setting, the photograph has succeeded. The garment must dominate the visual hierarchy.

Reference photo composition: Full-length editorial portrait against soft cream-white seamless studio backdrop. Aoife standing centre frame, hands relaxed at sides, calm posture, looking softly at camera. Wearing a simple unbranded cream silk slip dress for identity reference only — actual product photos will replace the garment. Vertical 3:4 aspect ratio. Soft diffused natural daylight from camera-left. Real skin texture visible at close crop, flawless in proportion. Sharp focus on face, professional fashion photography quality, 4K resolution. The image should feel quiet — like she is letting you look, not commanding you to.

Locked identity declaration: This image is the locked identity reference for Aoife. All future generations of Aoife wearing different garments must preserve exactly: this face shape, sea-green eye colour, freckle pattern, auburn hair colour and texture, fair Celtic skin tone, slim 5'9" body proportion, and the serving-the-garment energy.`,

  'Charlotte': `A 30-year-old British fashion model with refined sophistication. The brand's face for considered intimate apparel — chosen for her stillness, not her drama.

Face: Oval face with strong cheekbones and elegant jawline. Deep brown almond-shaped eyes with steady, intelligent gaze. Long dark lashes. Strong feminine brows in dark brown, naturally full. Refined straight nose with elegant high bridge. Full lips with neutral mauve-pink tone — never red, never glossed. A subtle natural beauty mark above the left lip corner.

Hair: Long lustrous dark chocolate brown hair (deep rich brown, not black), glossy with natural body, falling past mid-back. Centre-parted, sleek but with a slight loose bend. Air-dried with luxury polish.

Skin: Fair English complexion with neutral undertone. Smooth dewy finish — never matte, never shiny. Discreet editorial makeup invisible at first glance: groomed brows, mascara, balm on lips, faint flush at cheekbones.

Body: 5'10", classic model proportions — angular shoulders, very long elegant neck, defined collarbones, small bust, narrow hips, long legs. Refined posture, intentional stillness. Long-fingered narrow hands with sheer nude or unpolished nails.

Age: 30. Settled in her beauty, confident without performance.

Expression: Direct gaze with calm authority — but soft, never commanding. Closed lips with a barely-there expression. Brow relaxed, jaw soft. The expression of someone who knows the camera is there and is comfortable being seen, without trying to be seen more.

Energy: Refined, considered, quietly confident. The Row, early Phoebe Philo Celine, Toogood. The kind of beauty that whispers rather than announces.

Critical instruction — read carefully: Charlotte serves the garment. She is sophisticated, but the silk is the subject. Her stillness frames the silk; the silk does not frame her stillness. If a viewer's eye lands on Charlotte first, the photograph has failed. If their eye lands on the silk held by her quiet presence, the photograph has succeeded. The garment must dominate the visual hierarchy.

Reference photo composition: Full-length editorial portrait against soft cream-white seamless studio backdrop. Charlotte standing centre frame, hands relaxed at sides, intentional refined posture, looking softly at camera. Wearing a simple unbranded cream silk slip dress for identity reference only — actual product photos will replace the garment. Vertical 3:4 aspect ratio. Soft diffused natural daylight from camera-left. Real skin texture visible at close crop, flawless in proportion. Sharp focus on face, professional fashion photography quality, 4K resolution.

Locked identity declaration: This image is the locked identity reference for Charlotte. All future generations of Charlotte wearing different garments must preserve exactly: this oval face shape, deep brown almond eye shape, dark chocolate hair colour and texture, fair English skin tone, mauve-pink lip tone, beauty mark above the left lip, 5'10" body proportion, and the quiet-confidence energy.`,

  'Sofia': `A 28-year-old Italian fashion model with continental warmth. The brand's face for relaxed luxury — chosen for her grounded ease, not for sensual performance.

Face: Soft oval face with high cheekbones and refined feminine jawline. Hazel-brown almond eyes (warm brown with green flecks) under heavy natural dark lashes. Strong dark brows, naturally full with a soft editorial arch. Beautiful aquiline nose with character — slightly defined bridge, classically Italian, never surgical. Full natural lips with neutral mauve-pink tone.

Hair: Long lustrous dark brown hair with natural copper sun-touched highlights, falling past shoulders to mid-back. Loose natural waves with body and movement. Side-parted, falling beautifully over one shoulder. Air-dried texture with luxury polish.

Skin: Olive complexion with warm golden undertone. Sun-kissed luminous glow, never tanned-looking artificial. Real natural beauty marks on cheek and collarbone. Dewy finish, real skin texture visible at close crop, flawless in proportion.

Body: 5'8", model proportions with feminine softness — defined waist, elegant hips, medium bust, long legs. Movement is fluid and grounded, never performative. Warm-toned hands with short natural unpolished nails.

Age: 28. Womanly, confident in her body, beautifully composed.

Expression: Soft closed-mouth that just touches a smile in the eyes. Direct warm gaze or looking softly off into middle distance — but never "sensual" or "smouldering." Just at home in her own skin. Brow soft, jaw unclenched. The expression of someone who has just paused mid-thought and looked toward the camera kindly.

Energy: Continental warmth, grounded confidence, slow ease. Brunello Cucinelli, Loro Piana, slow Italian morning light. The opposite of "stops you scrolling" — she invites you to slow down, to look longer.

Critical instruction — read carefully: Sofia serves the garment. Her warmth surrounds the silk like the morning surrounds an open window. The silk is what's being seen; she is the way the silk is being seen. If a viewer's eye lands on Sofia first, the photograph has failed. If their eye lands on the silk and feels its warmth in her body, the photograph has succeeded. The garment must dominate the visual hierarchy.

Reference photo composition: Full-length editorial portrait against soft cream-white seamless studio backdrop. Sofia standing centre frame, hands relaxed at sides, confident relaxed posture, looking softly at camera with warm steady gaze. Wearing a simple unbranded cream silk slip dress for identity reference only — actual product photos will replace the garment. Vertical 3:4 aspect ratio. Soft diffused warm natural daylight from camera-left. Real skin texture visible at close crop, flawless in proportion. Sharp focus on face, professional fashion photography quality, 4K resolution.

Locked identity declaration: This image is the locked identity reference for Sofia. All future generations of Sofia wearing different garments must preserve exactly: this soft oval face shape, hazel-brown eye colour with green flecks, dark brown hair with copper sun highlights, olive skin tone with warm golden undertone, aquiline nose, 5'8" body proportion, and the continental-warmth energy.`,

  'Maya': `A 27-year-old mixed-heritage American fashion model with contemporary calm. The brand's face for the US and modern global markets — chosen for her grounded presence, not for cool detachment.

Face: Soft heart-shaped face with high defined cheekbones and elegant jawline. Deep brown almond-shaped eyes with thick natural dark lashes. Beautifully defined dark brown brows, full with a soft editorial arch. Refined straight nose with delicately rounded tip. Full sculpted lips with prominent cupid's bow, neutral berry-rose natural tone.

Hair: Long lustrous dark brown-black hair (rich espresso, not flat black) with subtle natural waves, falling to upper back. Centre-parted, with body and movement — glossy, healthy, never sleek-styled.

Skin: Light brown skin with warm golden-bronze undertone, smooth luminous radiance. Natural cheek warmth. Discreet defined editorial makeup invisible at first glance — subtle balm lip, mascara, brushed brows.

Body: 5'9", model proportions — athletic shoulders, defined waist, long legs, small-medium bust, lean toned frame. Stands grounded with confident posture. Medium-toned hands with slim fingers, short clean natural nails.

Age: 27. Self-possessed, modern, unhurried.

Expression: Soft closed-lipped with eyes direct and calm. Not "magnetic and present" — just simply at home, simply looking, simply still. Brow relaxed, no chin-tilt or "attitude." The expression of someone in a quiet moment, neither performing nor withdrawing.

Energy: Modern aspiration through restraint. Khaite, Jenni Kayne, considered American minimalism. Soft California morning, quiet Brooklyn loft elegance. The opposite of glossy commercial photography — she anchors the frame by being quiet in it.

Critical instruction — read carefully: Maya serves the garment. Her contemporary calm holds the silk in stillness. The silk is the subject; she is the body that lets it be seen. If a viewer's eye lands on Maya first, the photograph has failed. If their eye lands on the silk and feels its modernness, the photograph has succeeded. The garment must dominate the visual hierarchy.

Reference photo composition: Full-length editorial portrait against soft cream-white seamless studio backdrop. Maya standing centre frame, hands relaxed at sides, grounded confident posture, looking softly at camera with steady calm gaze. Wearing a simple unbranded cream silk slip dress for identity reference only — actual product photos will replace the garment. Vertical 3:4 aspect ratio. Soft diffused natural daylight from camera-left. Real skin texture visible at close crop, flawless in proportion. Sharp focus on face, professional fashion photography quality, 4K resolution.

Locked identity declaration: This image is the locked identity reference for Maya. All future generations of Maya wearing different garments must preserve exactly: this soft heart-shaped face, deep brown almond eye shape, dark espresso hair colour and texture, light brown skin tone with golden-bronze undertone, berry-rose lip tone, 5'9" body proportion, and the contemporary-calm energy.`,

  'Yuki': `A 28-year-old Japanese fashion model with serene minimalist presence. The brand's face for accessories and considered pieces — chosen for her stillness, which is her entire art.

Face: Refined oval face with elegant high cheekbones and delicately defined jawline. Deep dark almond eyes with long natural lashes. Beautifully naturally straight black brows with a soft editorial tail. Refined small nose with delicately rounded tip. Soft sculpted lips with natural pink-rose tone, gently full lower lip.

Hair: Long lustrous jet-black hair (true rich black with luxury sheen), pin-straight with a slight inward bend at the ends, falling past shoulders to upper back. Centre-parted, clean and considered. Glossy, healthy, intentional.

Skin: Fair porcelain complexion with cool neutral undertone. Luminous glass-skin finish — dewy without shine. Almost no visible makeup beyond tinted balm on lips and groomed brows.

Body: 5'7", refined feminine proportions — narrow shoulders, slim defined waist, small bust, fine wrists and ankles. Posture composed, contained, intentional. Delicate hands with slim fingers, short bare natural nails.

Age: 28. Quiet, deliberate, mature, contained.

Expression: Completely neutral closed mouth. Gaze direct or slightly lowered with quiet calm — never "intense" or "magnetic." The expression of editorial meditation: still, present, internal. No tension, no performance. The expression of someone watching morning light enter a room.

Energy: Minimalist editorial stillness. Issey Miyake, Toogood, Hender Scheme — Japanese refinement of slowness. Tokyo apartment morning, Kyoto wabi-sabi sensibility. Stillness as her entire presence.

Critical instruction — read carefully: Yuki serves the garment through stillness. The silk and her stillness are one — she is the silk's setting, not its competitor. If a viewer's eye lands on Yuki first, the photograph has failed. If their eye lands on the silk in its quietness, the photograph has succeeded. The garment must dominate the visual hierarchy.

Reference photo composition: Full-length editorial portrait against soft cream-white seamless studio backdrop. Yuki standing centre frame, hands relaxed at sides, composed intentional posture, looking softly at camera with calm steady gaze. Wearing a simple unbranded cream silk slip dress for identity reference only — actual product photos will replace the garment. Vertical 3:4 aspect ratio. Soft diffused even natural daylight, minimal shadows. Luminous porcelain skin. Sharp focus on face, professional fashion photography quality, 4K resolution.

Locked identity declaration: This image is the locked identity reference for Yuki. All future generations of Yuki wearing different garments must preserve exactly: this refined oval face, dark almond eye shape, jet-black pin-straight hair, fair porcelain skin tone with cool neutral undertone, soft pink-rose lip tone, 5'7" body proportion, and the minimalist-stillness-as-presence energy.`,
};

const PRODUCT_SHOT_TEMPLATE = `PRODUCT SHOT — [SHOT TYPE]

Model: [MODEL NAME]
The locked identity reference for this model is attached as image 1.
Preserve her face, hair, skin, and body proportions exactly as in the
reference. This is the same woman.

Garment: [GARMENT NAME]
The garment reference is attached as image 2.
CRITICAL — preserve the garment exactly as in the reference photo:
- Color (especially the exact shade)
- Cut and silhouette
- Length
- Sleeve style and length
- Neckline / lapel / collar
- All trim, piping, ties, and details
- Fabric weight and drape
Do NOT alter, simplify, or "improve" the garment. Photographic accuracy
is mandatory.

Shot type: [HERO / FRONT / BACK / SIDE / DETAIL]

Background: Pure cream-white seamless studio backdrop. No floor line,
no wall texture, no shadows besides those cast by the model and garment.

Lighting: Soft diffused natural daylight from camera-left. Gentle shadows
defining bone structure and fabric drape. Lighting should hit the
garment first; the model's face is a secondary point of emphasis.

Composition: Vertical 3:4 aspect ratio. The garment must occupy at least
50% of the visible frame area — it is the visual hero. The model's face
is fully visible but does not dominate.

Style: La Perla, The Row, Khaite editorial product photography. Clean,
considered, garment-forward.

Model details: Barefoot. No jewellery. No accessories beyond the garment.
No additional props. No bag, no hat, no belt unless part of the garment
reference itself.

Critical anti-instructions (do NOT violate):
- Do NOT change the garment to a different style of clothing
- Do NOT add or substitute pyjamas, bedding, sleepwear, or any clothing
  not in the reference photo
- Do NOT change the model's identity from the locked reference
- Do NOT add props (mug, food, books, jewellery, flowers) unless
  specifically requested
- Do NOT alter the garment color toward a different shade
- Do NOT add patterns, prints, or motifs not in the reference
- Do NOT show explicit skin (this is luxury product photography, not
  lingerie editorial)
- Resolution: 4K, sharp focus, professional editorial quality`;

const LIFESTYLE_SHOT_TEMPLATE = `LIFESTYLE SHOT — DONEGAL PAINTER'S STUDIO

Model: [MODEL NAME]
The locked identity reference for this model is attached as image 1.
Preserve her face, hair, skin, and body proportions exactly as in the
reference. This is the same woman.

Garment: [GARMENT NAME]
The garment reference is attached as image 2.
CRITICAL — preserve the garment exactly as in the reference photo
(color, cut, drape, trim, all details). The garment must be visible and
clearly readable. Do NOT substitute, simplify, or alter the garment.

Setting: A working painter's studio interior in rural Donegal, Ireland.
Soft natural daylight streams through a large multi-pane window
(visible in frame on one side). The walls are pale lime-washed stone or
plain plastered cream — no wallpaper, no decorative wallpaper or busy
patterns. The floor is wide-plank natural wood, slightly worn,
unpolished. Two or three large stretched canvases lean against the
wall, partially visible, each showing soft natural-pigment landscape
abstracts (Donegal coast in muted greys, sage greens, soft warm
ochres — no bright colors, no figures). A simple wooden artist's
easel stands to one side with a partially-finished painting on it. A
small wooden stool. A single linen-upholstered armchair, cream-colored.
That is the entire scene. No clutter, no excessive props.

Lighting: Soft diffused Atlantic daylight through the window, natural
overcast quality. Gentle, even, never harsh. The light reveals the
silk's drape and sheen first; the model's face is a secondary point
of emphasis.

Pose: Model stands or sits naturally in the studio. Suggested poses:
  (a) Standing near the window, garment catching the natural light, gaze
      directed softly at the camera or just past it
  (b) Seated calmly in the linen armchair, hands resting in lap, looking
      softly toward camera
  (c) Standing centre frame with one hand softly at her side, the
      easel and canvases visible behind, looking softly at camera
The pose is unstaged, calm, never theatrical. The model is at home in
this space, simply being.

Composition: Vertical 3:4 aspect ratio. Full body or three-quarter view
(knees up if standing, full body if seated). The garment occupies at
least 45% of the vertical frame area. The studio context frames the
garment but does not compete with it.

Style: Toast UK editorial, Brunello Cucinelli campaign, Sofia Coppola
film still, slow Irish winter morning. Authentic, considered, intimate.
No glossy magazine glamour.

CRITICAL ANTI-INSTRUCTIONS — do NOT violate any of these:
- This is NOT a bedroom scene. There is NO bed, NO bedding, NO pillows,
  NO sheets, NO mattress, NO sleeping context anywhere in the image.
- There are NO mugs, NO cups, NO plates, NO food, NO drink visible
- There is NO bathroom, NO kitchen, NO domestic-living-room context
- The garment must NOT be substituted with pyjamas, sleepwear, robes
  not in the reference photo, or any other clothing
- The model must match the locked identity reference exactly
- No additional figures (no second model, no children, no animals)
- No decorative books, vases, plants beyond what is described above
- No urban context (no city through window — the window shows soft
  Donegal landscape: stone wall, grass, sky, no buildings)
- Do NOT show explicit skin or sleepwear-style framing
- Resolution: 4K, sharp focus, professional editorial quality

The image should evoke: a real painter's working space in rural Ireland,
where someone happens to be wearing the garment, doing nothing in
particular, just inhabiting the space. Quiet, warm, lived-in. Aspirational
through specificity, not through gloss.`;

async function updatePromptsV2() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Beginning prompt updates.\n');

  if (await hasRun(MIGRATION_NAME)) {
    console.log(`[migrations] ${MIGRATION_NAME} already applied, skipping. Drop the marker in the 'migrations' collection to force re-run.`);
    await mongoose.disconnect();
    return;
  }

  let updatedCount = 0;
  let notFoundCount = 0;

  for (const [name, prompt] of Object.entries(MODEL_PROMPTS_V2)) {
    const result = await AiModel.findOneAndUpdate(
      { name },
      {
        prompt,
        productShotPromptTemplate: PRODUCT_SHOT_TEMPLATE,
        lifestyleShotPromptTemplate: LIFESTYLE_SHOT_TEMPLATE,
        locked: false,
      },
      { new: true }
    );

    if (result) {
      console.log(`✓ Updated ${name} — locked: false (ready for regeneration)`);
      updatedCount++;
    } else {
      console.log(`✗ Model "${name}" NOT FOUND in database`);
      notFoundCount++;
    }
  }

  console.log(`\nDone.`);
  console.log(`  Updated: ${updatedCount}/5`);
  console.log(`  Not found: ${notFoundCount}/5`);
  console.log(`\nNext step: admin user should regenerate reference images for all 5 models via /admin/models`);

  if (notFoundCount === 0) {
    await markRun(MIGRATION_NAME, { updatedCount });
  } else {
    console.log('[migrations] not marking run — some models were missing. Seed AiModels then re-run.');
  }

  await mongoose.disconnect();
  console.log('Disconnected.');
}

updatePromptsV2().catch((err) => {
  console.error('Update failed:', err);
  process.exit(1);
});
