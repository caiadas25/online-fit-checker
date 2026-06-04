import type { GarmentType } from "./garments";

export interface PromptGarment {
  type: GarmentType;
  label: string;
}

const ARTICLE: Record<GarmentType, string> = {
  top: "top / shirt",
  bottom: "bottoms (pants/skirt/shorts)",
  dress: "dress",
  jacket: "jacket / outerwear",
  shoes: "shoes",
  hat: "hat / headwear",
};

const CATEGORY_BOUNDARY: Record<GarmentType, string> = {
  top: "Keep only the upper-body shirt/top itself: collar, sleeves, cuffs, placket, hem, fabric, print, and attached garment details. Exclude any pants, skirts, belts, shoes, jackets, bags, jewelry, skin, hair, and background.",
  bottom:
    "Keep only the lower-body bottom itself: skirt, skort, trousers, pants, or shorts, including its waistband, pleats, pockets, hem, fabric, print, and attached garment details. Exclude every upper-body item in the same source image, especially shirts, collars, sleeves, cuffs, jackets, sweaters, hands, hair, bags, shoes, and styling belts unless the belt is permanently attached to the bottom.",
  dress:
    "Keep only the dress itself from neckline to hem, including sleeves if they are part of the dress. Exclude jackets, belts, shoes, bags, jewelry, skin, hair, and background unless a detail is permanently attached to the dress.",
  jacket:
    "Keep only the outerwear garment itself: jacket body, lapels, collar, sleeves, cuffs, pockets, buttons, lining edges, hem, fabric, print, and attached garment details. Exclude any shirt, skirt, pants, shoes, bag, jewelry, skin, hair, and background from the source image.",
  shoes:
    "Keep only the shoes themselves as a pair. Exclude socks, pants, legs, floor shadows, labels, person, and background.",
  hat: "Keep only the hat/headwear itself. Exclude hair, face, jewelry, clothing, person, and background.",
};

const JACKET_VISIBILITY_RULE =
  "Jacket/outerwear rule: if a jacket or outerwear garment is listed, it must appear as the outermost upper-body layer with its sleeves, collar or lapels, front panels, closure, pockets, cuffs, and hem visibly present. Do not replace it with a vest, shirt, hoodie, or generic top, and do not omit it because another upper-body garment is present.";

function imageList(count: number, offset: number): string {
  return Array.from({ length: count }, (_, i) => i + offset).join(", ");
}

/**
 * Build one prompt that composes the whole outfit in a single request.
 *
 * Reference photos are e-commerce hero shots: a real model wearing the target
 * item alongside other clothing, page text, and unrelated overlays. The model
 * must extract only the named garment from each photo and ignore everything else.
 * `garments` are pre-sorted innermost to outermost.
 */
export function buildOutfitPrompt(
  garments: PromptGarment[],
  hasBaseImage: boolean,
): string {
  const offset = hasBaseImage ? 2 : 1;

  const subject = hasBaseImage
    ? "The first image shows the target person. Keep their exact face, body, hair, and skin, on a plain light-gray studio background."
    : "Generate one neutral, faceless, light-gray full-body mannequin standing front-facing on a seamless light-gray studio background. The mannequin should be slim, average height, with no facial features.";

  const extractionSteps = garments.map((g, i) => {
    const imageNumber = i + offset;

    return [
      `Step ${i + 2}: From image ${imageNumber}, extract ONLY the ${ARTICLE[g.type]}.`,
      `Target product label: "${g.label}". Use this label to identify the intended item when the source model is wearing a full outfit.`,
      CATEGORY_BOUNDARY[g.type],
      "Treat every other visible garment in that source photo as contamination, even if it overlaps, sits under, or is styled with the target item.",
      "Ignore the person, pose, hair, skin, hands, all other clothing, shoes, accessories, page UI, measurement labels, price tags, captions, watermarks, and product-page text.",
      "Copy the target garment's exact colour, fabric, cut, length, collar style, sleeve length, stitching, buttons, seams, trims, pattern, print, embroidery, patches, and any logo or lettering physically attached to that target garment.",
      "Do not simplify, recolour, restyle, or borrow details from any non-target garment in the same source image.",
    ].join(" ");
  });

  return [
    subject,
    `You are given ${garments.length + (hasBaseImage ? 1 : 0)} image(s). Images ${imageList(garments.length, offset)} are reference photos of individual garments on models. Each photo may contain a complete styled outfit, but only one garment per image is the target.`,
    "EXTRACTION STEPS (follow in order):",
    ...extractionSteps,
    `Step ${garments.length + 2}: Compose the extracted target garments onto the mannequin as ONE outfit, layered from innermost to outermost in the order listed. Use only the extracted target garments. Do not import any extra shirt, collar, cuffs, belt, shoes, model annotation, or styling item from a reference photo unless that item is one of the listed targets.`,
    "Layering rules: tops sit on the upper body; bottoms sit at the waist; dresses replace separate top and bottom pieces; jackets and outerwear sit over tops or dresses; shoes sit on the feet; hats sit on the head.",
    JACKET_VISIBILITY_RULE,
    "Completeness rule: every listed target garment must appear in the final outfit.",
    "Exact-match rule: match each target garment's colour, fabric texture, cut, length, collar/sleeve style, stitching, trims, patterns, and garment-native logos or lettering when present. A pink cardigan stays a pink cardigan. A beige pleated skirt/skort stays a beige pleated skirt/skort without the blue shirt from its source photo.",
    "Zero-typography rule: the final canvas must contain no readable words, numbers, labels, captions, size/height annotations, signatures, UI text, price tags, watermarks, or product-page graphics anywhere in the background, margins, corners, or floor. Text or logos are allowed only when physically printed, embroidered, patched, woven, or attached to a target garment.",
    "Before finalizing, internally check that every image contributes only its named target item, no source-photo styling items leak in, and the background and lower-right corner contain no text.",
    "Show the entire figure from head to feet, centred, full-length, on a clean seamless light-gray studio background. Do not crop or zoom in.",
    "Output only the final composed image.",
  ].join("\n\n");
}

export function buildGarmentCutoutPrompt(garment: PromptGarment): string {
  return [
    `Extract only this target garment: ${ARTICLE[garment.type]}.`,
    `Target product label: "${garment.label}". Use this label to identify the intended item when the source model is wearing multiple garments.`,
    CATEGORY_BOUNDARY[garment.type],
    "Create a clean product cutout of the target garment only, front-facing as much as the source allows, preserving its exact color, fabric, cut, silhouette, length, stitching, buttons, seams, trims, patterns, embroidery, patches, and garment-native logos or lettering.",
    "Remove the model body, face, hair, hands, legs, all non-target garments, shoes, bags, jewelry, styling items, background, shadows, UI, price tags, captions, size/height labels, lower-right height/size annotations, measurement overlays, signatures, watermarks, and every source-photo or product-page text element.",
    "Do not include any readable words, numbers, labels, or annotation text unless it is physically printed, embroidered, patched, woven, or attached to the target garment.",
    "Place the isolated target garment centered on a plain white or transparent background. Output only the garment cutout image.",
  ].join("\n\n");
}

export function buildCutoutCompositionPrompt(
  garments: PromptGarment[],
  hasBaseImage: boolean,
): string {
  const offset = hasBaseImage ? 2 : 1;

  const subject = hasBaseImage
    ? "The first image shows the target person. Keep their exact face, body, hair, and skin, on a plain light-gray studio background."
    : "Generate one neutral, faceless, light-gray full-body mannequin standing front-facing on a seamless light-gray studio background. The mannequin should be slim, average height, with no facial features.";

  const garmentList = garments.map(
    (g, i) =>
      `Image ${i + offset}: ${ARTICLE[g.type]} from "${g.label}". Use this entire isolated garment and no other clothing.`,
  );

  return [
    subject,
    `You are given ${garments.length + (hasBaseImage ? 1 : 0)} image(s). Images ${imageList(garments.length, offset)} are isolated garment cutouts that were already cleaned from their original product photos.`,
    "GARMENT CUTOUTS:",
    ...garmentList,
    "Compose the garment cutouts onto the mannequin as one outfit, layered from innermost to outermost in the listed order.",
    "Layering rules: tops sit on the upper body; bottoms sit at the waist; dresses replace separate top and bottom pieces; jackets and outerwear sit over tops or dresses; shoes sit on the feet; hats sit on the head.",
    JACKET_VISIBILITY_RULE,
    "Completeness rule: every provided cutout must appear in the final outfit.",
    "Exact-match rule: preserve each cutout garment's color, fabric texture, cut, length, collar/sleeve style, stitching, trims, patterns, and garment-native logos or lettering when present.",
    "Zero-typography rule: the final canvas must contain no readable words, numbers, labels, captions, size/height annotations, signatures, UI text, price tags, watermarks, or product-page graphics anywhere in the background, margins, corners, or floor. Text or logos are allowed only when physically attached to a target garment.",
    "Show the entire figure from head to feet, centred, full-length, on a clean seamless light-gray studio background. Do not crop or zoom in.",
    "Output only the final composed image.",
  ].join("\n\n");
}
