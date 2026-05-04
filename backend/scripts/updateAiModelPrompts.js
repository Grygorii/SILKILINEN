require('dotenv').config();
const mongoose = require('mongoose');
const AiModel = require('../models/AiModel');

const REFINED_PROMPTS = {
  'Aoife': `A 28-year-old Irish fashion model with strikingly beautiful, magnetic presence — the brand's signature face. Editorial-quality features photographed in the quiet luxury aesthetic of Toast UK and &Daughter campaigns.

Face: Heart-shaped face with elegant defined jawline and high gentle cheekbones. Large luminous sea-green eyes set wide apart with a slight upturn at the outer corners — striking and arresting. Long dark lashes. Naturally arched warm-brown brows with an editorial shape. Refined straight nose with a delicately rounded tip. Full sculpted lips with a defined cupid's bow, soft neutral-pink natural tone. A delicate scattering of natural freckles across the bridge of her nose and upper cheekbones — characterful, not stylised.

Hair: Long luxurious auburn hair (rich warm copper-chestnut, glossy and healthy) falling past mid-chest. Natural soft waves with body and movement. Side-parted, falling beautifully over one shoulder. Air-dried texture but groomed — luxury imperfection, not messy.

Skin: Fair Celtic complexion with cool pink undertone, dewy luminous finish — the kind of skin that comes from care and good genetics. Subtle natural freckles on shoulders and collarbones. No visible makeup beyond a wash of warmth on cheeks and groomed brows. Real skin texture visible at close crop, but flawless in proportion.

Body: 5'9", model proportions — long limbs, narrow shoulders, long elegant neck, defined collarbones, small bust, lean frame. Trained model posture — composed, intentional, never stiff. Long-fingered narrow hands with short natural nails.

Age: 28 years old. Beautifully composed, knowing, confident in her body.

Expression: Calm closed-mouth with the suggestion of a smile rather than a smile. Eyes direct and arresting, looking straight at camera or just past it with quiet intensity. The expression of an editorial cover — magnetic, contemplative, never grinning.

Energy: A real fashion model with a soulful Irish presence. Aspirational beauty with quiet depth. The kind of woman who anchors a luxury campaign without trying. Toast UK SS24 cover, &Daughter knitwear hero, early Phoebe Philo Celine portraits.

Reference aesthetic: Toast UK editorial campaigns, &Daughter knitwear, Vogue Ireland editorial, professional fashion model photography.

Crucial: she is a strikingly beautiful editorial model first, with an Irish soul second. Aspirational and lovely. The kind of beauty that stops you scrolling.`,

  'Charlotte': `A 30-year-old British fashion model with sharp editorial beauty — the brand's face for refined intimate apparel. Channeling the polished sophistication of senior Net-a-Porter, The Row, and Khaite campaigns.

Face: Oval face with strong defined cheekbones and an elegant jawline. Deep brown almond-shaped eyes with a steady, intelligent gaze and natural depth. Long dark lashes. Strong feminine brows in dark brown, naturally full with editorial fullness at the inner edge. Refined straight nose with elegant high bridge. Full sculpted lips with a defined cupid's bow, neutral mauve-pink tone — never red, never glossed. A subtle natural beauty mark above the left lip corner.

Hair: Long lustrous dark chocolate brown hair (deep rich brown, not black), glossy with natural body, falling past mid-back. Centre-parted, sleek but with a slight loose bend — air-dried with luxury polish. Healthy luminous shine.

Skin: Fair English complexion with neutral undertone, smooth dewy finish — never matte, never shiny. Discreet editorial makeup invisible at first glance: defined groomed brows, mascara, balm on lips, faint flush at cheekbones. The kind of expensive-looking skin that comes from quality, not products.

Body: 5'10", classic model proportions — angular shoulders, very long elegant neck, defined collarbones, small bust, narrow hips, long legs. Refined model posture, intentional stillness, magnetic presence. Long-fingered narrow hands with sheer nude or unpolished nails.

Age: 30 years old. Settled in her beauty, confident without performance, sophisticated.

Expression: Direct gaze into camera with calm authority — the look of a senior editorial cover. Closed lips with a barely-there expression — neither smiling nor serious. The expression of someone who knows exactly how to hold a camera. Brows relaxed, jaw soft.

Energy: Refined, considered, slightly cool — aspirational without warmth. The senior fashion editor face of a luxury intimates campaign. Net-a-Porter editorial, The Row campaign, mid-century film noir sensibility, modern minimalist sophistication.

Reference aesthetic: The Row campaigns, Khaite SS23 hero, Matches Fashion editorial, senior Net-a-Porter campaigns, classic British editorial fashion photography.

Crucial: she is editorial first, beautiful second, never glossy or commercial. The kind of refined beauty you'd see on a Vogue cover, not a high street ad.`,

  'Sofia': `A 28-year-old Italian fashion model with warm, sensual editorial beauty — the brand's face for relaxed luxury and continental sophistication. Channeling the warmth and elegance of Brunello Cucinelli, Loro Piana, and Valentino campaigns.

Face: Soft oval face with strikingly high cheekbones and refined feminine jawline. Hazel-brown almond eyes (warm brown with green flecks) under heavy natural dark lashes — magnetic and warm. Strong dark brows, naturally full with a defined editorial arch. Beautiful aquiline nose with character — slightly defined bridge, never surgical, classically Italian. Full natural lips with a defined cupid's bow, neutral mauve-pink tone. The face of a Mediterranean Vogue cover.

Hair: Long lustrous dark brown hair with natural copper sun-touched highlights, falling past shoulders to mid-back. Loose editorial waves with natural volume and movement. Side-parted, falling beautifully over one shoulder. Air-dried texture with luxury polish — beach-glamour without effort.

Skin: Olive complexion with warm golden undertone, sun-kissed luminous glow. Real natural beauty marks on cheek and collarbone — characterful editorial features. Healthy Mediterranean glow, never tanned-looking artificial. Dewy finish, real skin texture visible at close crop but flawless in proportion.

Body: 5'8", model proportions with feminine curves — defined waist, elegant hips, medium bust, long legs, strong natural posture. Movement is fluid, confident, sensual without performance. Warm-toned hands, short natural unpolished nails.

Age: 28 years old. Womanly, confident in her body, beautifully composed.

Expression: Soft closed-mouth that just touches a smile in the eyes. Direct warm gaze or looking off into soft middle distance with quiet sensuality. Relaxed, never stiff. The expression of a luxury Italian campaign — warmth meets sophistication. Brow soft, jaw unclenched.

Energy: Warm sensual editorial beauty, grounded confidence, aspirational ease. The kind of model who looks effortless on a Brunello campaign. Italian summer, slow morning light, linen sheets at golden hour.

Reference aesthetic: Brunello Cucinelli SS24, Loro Piana editorial, early Pierpaolo Piccioli Valentino, Mediterranean fashion editorial, Sofia Coppola film stills.

Crucial: she is a strikingly beautiful editorial model with Mediterranean warmth — aspirational and sensual, never glamorous in a commercial way. The kind of beauty that defines continental luxury.`,

  'Maya': `A 27-year-old mixed-heritage American fashion model with confident modern editorial beauty — the brand's face for the US market. Channeling the contemporary cool of Khaite, Jenni Kayne, and modern Skims editorial campaigns.

Face: Soft heart-shaped face with high defined cheekbones and an elegant jawline. Deep brown almond-shaped eyes with thick natural dark lashes — striking and direct. Beautifully defined dark brown brows, full with a soft editorial arch. Refined straight nose with a delicately rounded tip. Full sculpted lips with a prominent cupid's bow, neutral berry-rose natural tone. The face of a modern American luxury campaign.

Hair: Long lustrous dark brown-black hair (rich espresso, not flat black) with subtle natural waves, falling to upper back. Centre-parted, with body and movement — glossy, healthy, never sleek-styled. Tucked naturally behind one ear with editorial polish.

Skin: Light brown skin with warm golden-bronze undertone, smooth luminous radiance. Natural cheek warmth. Discreet defined editorial makeup invisible at first glance — subtle balm lip, mascara, brushed brows. Real skin texture visible at close crop but flawless in proportion.

Body: 5'9", model proportions — athletic shoulders, defined waist, long legs, small-medium bust, lean toned frame. Stands grounded with confident model posture and subtle attitude. Medium-toned hands with slim fingers, short clean natural nails.

Age: 27 years old. Self-possessed, modern, confident.

Expression: Unsmiling but soft — closed lips, eyes direct and steady with quiet authority. The expression of someone calm and confident in her own skin. Not aloof, not warm — magnetic and present. Brow relaxed, slight intentional tilt of chin upward. Editorial cover energy.

Energy: Modern aspirational beauty, quietly powerful, contemporary sophistication. The kind of model who anchors a Khaite campaign or fronts a luxury editorial. LA morning light, Brooklyn loft elegance, considered modernism.

Reference aesthetic: Khaite SS24 campaigns, Jenni Kayne editorial, Skims luxury editorial (not commercial), Marina Tabassum portraiture, modern American fashion editorial.

Crucial: she is a contemporary editorial model with self-possessed confidence — aspirational, never sweet or coquettish. She owns the frame.`,

  'Yuki': `A 28-year-old Japanese fashion model with serene minimalist editorial beauty — the brand's face for accessories and considered pieces. Channeling the refined stillness of Issey Miyake, Toogood, and modern Japanese luxury editorial campaigns.

Face: Refined oval face with elegant high cheekbones and a delicately defined jawline. Deep dark almond eyes with calm steady gaze and long natural lashes — quietly magnetic. Beautifully naturally straight black brows with a soft editorial tail. Refined small nose with a delicately rounded tip. Soft sculpted lips with natural pink-rose tone, gently full lower lip. The face of a Japanese Vogue editorial.

Hair: Long lustrous jet-black hair (true rich black with luxury sheen), pin-straight with a slight inward bend at the ends, falling past shoulders to upper back. Centre-parted, clean and considered. Glossy, healthy, intentional — sometimes loosely tied back at nape with stray pieces framing the face.

Skin: Fair porcelain complexion with cool neutral undertone, luminous glass-skin finish — dewy without shine. Almost no visible makeup beyond a tinted balm on lips and groomed brows. Skin shows the kind of natural perfection that comes from care, not products.

Body: 5'7", model proportions — slender petite frame with refined feminine proportions, narrow shoulders, slim defined waist, small bust, fine wrists and ankles. Posture composed, contained, intentional — trained model poise. Delicate hands with slim fingers, short bare natural nails.

Age: 28 years old. Quiet, deliberate, mature, contained.

Expression: Completely neutral closed mouth, gaze direct or slightly lowered with quiet intensity. The expression of editorial meditation — calm, present, internal, magnetic. No tension, no performance. The face is simply still and arresting.

Energy: Minimalist editorial beauty, intentional stillness, contained sophistication. Every detail considered. The kind of model who defines modern Japanese luxury editorial. Tokyo apartment morning, Kyoto wabi-sabi sensibility, refined modern Japanese fashion.

Reference aesthetic: Issey Miyake campaigns, Toogood editorials, Hender Scheme imagery, modern Japanese Vogue editorial, refined minimalist fashion photography.

Crucial: she is a strikingly beautiful editorial model with Japanese refinement — quiet stillness as her entire presence. Aspirational beauty through composure.`,
};

async function updatePrompts() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  for (const [name, prompt] of Object.entries(REFINED_PROMPTS)) {
    const result = await AiModel.findOneAndUpdate(
      { name },
      { prompt, locked: false },
      { new: true }
    );

    if (result) {
      console.log(`✓ Updated prompt for ${name} (unlocked for reference regeneration)`);
    } else {
      console.log(`✗ Model "${name}" not found in database — skipped`);
    }
  }

  console.log('\nDone. Go to /admin/models and regenerate references for all 5 models (Premium 4K).');
  console.log('Re-lock each model once you approve its new reference photo.');
  await mongoose.disconnect();
}

updatePrompts().catch(err => {
  console.error(err);
  process.exit(1);
});
