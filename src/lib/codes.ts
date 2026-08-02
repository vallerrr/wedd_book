/**
 * Invite codes.
 *
 * Crockford base32 minus I, L, O and U — no characters that get misread off a
 * printed card, and no accidental words. Must stay in sync with the alphabet
 * in scripts/make-guests.mjs, which generates the same codes offline (that
 * script runs in plain Node and can't import this module).
 */
export const CODE_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'
export const CODE_LENGTH = 3

export function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return out
}

/** Accept whatever a guest actually types: caps, spaces, stray dashes. */
export function normaliseCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}
