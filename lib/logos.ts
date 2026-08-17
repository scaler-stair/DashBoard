export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
/** For the file picker's `accept` attribute. */
export const LOGO_ACCEPT = ".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp";

/** Shared by the browser forms and the API routes: null when the file is acceptable. */
export function logoError(file: File): string | null {
  if (!LOGO_MIME_TYPES.includes(file.type)) {
    return "Logo must be a PNG, JPG, SVG or WebP image";
  }
  if (file.size > LOGO_MAX_BYTES) {
    return `Logo must be under ${Math.round(LOGO_MAX_BYTES / (1024 * 1024))} MB`;
  }
  return null;
}

/**
 * Logos that ship with the app, for client orgs that were created before logo
 * uploads existed. Keyed by a loose match on the organization name.
 *
 * To use a client's official artwork, drop the file into `public/logos/` and
 * point the entry at it (an uploaded logo always wins over these defaults).
 */
const BUNDLED: Array<{ match: RegExp; src: string }> = [
  { match: /protean/i, src: "/logos/protean.svg" },
];

/** The logo to render for an org: the uploaded one, else a bundled default, else null. */
export function orgLogoSrc(orgName: string | null, uploaded?: string | null): string | null {
  if (uploaded) return uploaded;
  if (!orgName) return null;
  return BUNDLED.find((b) => b.match.test(orgName))?.src ?? null;
}

/** Two-letter monogram used when an org has no logo at all. */
export function orgInitials(orgName: string | null): string {
  if (!orgName) return "–";
  const words = orgName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "–";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
