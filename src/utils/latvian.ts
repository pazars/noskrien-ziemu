/**
 * Latvian character normalization utilities
 *
 * Handles conversion of Latvian special characters (ā, č, ē, ģ, ī, ķ, ļ, ņ, š, ū, ž)
 * to their ASCII equivalents for consistent name matching.
 */

// Mapping of Latvian characters to ASCII equivalents
const LATVIAN_CHAR_MAP: Record<string, string> = {
  'ā': 'a', 'Ā': 'A',
  'č': 'c', 'Č': 'C',
  'ē': 'e', 'Ē': 'E',
  'ģ': 'g', 'Ģ': 'G',
  'ī': 'i', 'Ī': 'I',
  'ķ': 'k', 'Ķ': 'K',
  'ļ': 'l', 'Ļ': 'L',
  'ņ': 'n', 'Ņ': 'N',
  'š': 's', 'Š': 'S',
  'ū': 'u', 'Ū': 'U',
  'ž': 'z', 'Ž': 'Z',
};

// All Latvian special characters for pattern matching
const LATVIAN_CHARS = Object.keys(LATVIAN_CHAR_MAP).join('');
const LATVIAN_CHAR_PATTERN = new RegExp(`[${LATVIAN_CHARS}]`, 'g');

/**
 * Normalize Latvian characters to ASCII equivalents
 *
 * @param str - Input string with potential Latvian characters
 * @returns String with Latvian characters replaced by ASCII equivalents
 *
 * @example
 * normalizeLatvian('Dāvis Pazars') // 'Davis Pazars'
 * normalizeLatvian('JĀNIS KALNIŅŠ') // 'JANIS KALNINS'
 */
export function normalizeLatvian(str: string): string {
  return str.replace(LATVIAN_CHAR_PATTERN, (char) => LATVIAN_CHAR_MAP[char]);
}

/**
 * Count the number of Latvian special characters in a string
 *
 * @param str - Input string to analyze
 * @returns Number of Latvian special characters found
 *
 * @example
 * countLatvianChars('Dāvis') // 1
 * countLatvianChars('Bērziņš') // 2
 */
export function countLatvianChars(str: string): number {
  const matches = str.match(LATVIAN_CHAR_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * Check if a name has natural casing (not all uppercase)
 *
 * @param name - Name to check
 * @returns true if name has natural casing, false if all uppercase
 *
 * @example
 * hasNaturalCasing('Dāvis Pazars') // true
 * hasNaturalCasing('DAVIS PAZARS') // false
 */
export function hasNaturalCasing(name: string): boolean {
  // Remove spaces and non-letter characters for analysis
  const letters = name.replace(/[^a-zA-ZāčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]/g, '');

  // If no letters, consider it natural casing
  if (letters.length === 0) return true;

  // Check if all letters are uppercase
  const allUppercase = letters === letters.toUpperCase();

  return !allUppercase;
}
