/**
 * Pluralization utilities with PostGraphile-compatible Latin suffix handling
 *
 * Uses the 'inflection' package with custom overrides for Latin plural suffixes
 * that PostGraphile handles differently than standard English pluralization.
 */
import * as inflection from 'inflection';

/**
 * Latin plural suffixes that inflection handles differently than PostGraphile.
 *
 * The inflection library correctly singularizes Latin words (schemata -> schematum),
 * but PostGraphile uses English-style naming (schemata -> schema).
 *
 * Format: [pluralSuffix, singularSuffix]
 */
const LATIN_SUFFIX_OVERRIDES: Array<[string, string]> = [
  ['schemata', 'schema'],
  ['criteria', 'criterion'],
  ['phenomena', 'phenomenon'],
  ['media', 'medium'],
  ['memoranda', 'memorandum'],
  ['strata', 'stratum'],
  ['curricula', 'curriculum'],
  ['data', 'datum'],
];

/**
 * Convert a word to its singular form with PostGraphile-compatible Latin handling
 * @example "Users" -> "User", "People" -> "Person", "Schemata" -> "Schema", "ApiSchemata" -> "ApiSchema"
 */
export function singularize(word: string): string {
  const lowerWord = word.toLowerCase();

  for (const [pluralSuffix, singularSuffix] of LATIN_SUFFIX_OVERRIDES) {
    if (lowerWord.endsWith(pluralSuffix)) {
      const suffixStart = word.length - pluralSuffix.length;
      const prefix = word.slice(0, suffixStart);
      const originalSuffix = word.slice(suffixStart);

      const isAllCaps = originalSuffix === originalSuffix.toUpperCase();
      const isUpperSuffix =
        originalSuffix[0] === originalSuffix[0].toUpperCase();

      let newSuffix: string;
      if (isAllCaps) {
        newSuffix = singularSuffix.toUpperCase();
      } else if (isUpperSuffix) {
        newSuffix = singularSuffix.charAt(0).toUpperCase() + singularSuffix.slice(1);
      } else {
        newSuffix = singularSuffix;
      }

      return prefix + newSuffix;
    }
  }

  return inflection.singularize(word);
}

/**
 * Convert a word to its plural form
 * @example "User" -> "Users", "Person" -> "People"
 */
export function pluralize(word: string): string {
  return inflection.pluralize(word);
}

/**
 * Pluralize/singularize only the final segment of a compound name.
 * This is important for names like "user_profiles" where only "profiles" should be pluralized.
 *
 * @param fn - The singularize or pluralize function to apply
 * @param str - The string to transform
 * @returns The transformed string with only the final segment changed
 */
function changeLastWord(
  fn: (word: string) => string,
  str: string
): string {
  const matches = str.match(/([A-Z]|_[a-z0-9])[a-z0-9]*_*$/);
  const index = matches ? (matches.index ?? 0) + matches[1].length - 1 : 0;
  const suffixMatches = str.match(/_*$/);
  const suffixIndex =
    suffixMatches && suffixMatches.index !== undefined
      ? suffixMatches.index
      : str.length;
  const prefix = str.slice(0, index);
  const word = str.slice(index, suffixIndex);
  const suffix = str.slice(suffixIndex);
  return `${prefix}${fn(word)}${suffix}`;
}

/**
 * Singularize only the final segment of a compound name
 * @example "user_profiles" -> "user_profile", "UserProfiles" -> "UserProfile"
 */
export function singularizeLast(str: string): string {
  return changeLastWord(singularize, str);
}

/**
 * Pluralize only the final segment of a compound name
 * @example "user_profile" -> "user_profiles", "UserProfile" -> "UserProfiles"
 */
export function pluralizeLast(str: string): string {
  return changeLastWord(pluralize, str);
}

/**
 * Create a distinct plural form, handling cases where singular === plural
 * @example "sheep" -> "sheeps" (forced distinct), "user" -> "users"
 */
export function distinctPluralize(str: string): string {
  const singular = singularize(str);
  const plural = pluralize(singular);
  if (singular !== plural) {
    return plural;
  }
  if (
    plural.endsWith('ch') ||
    plural.endsWith('s') ||
    plural.endsWith('sh') ||
    plural.endsWith('x') ||
    plural.endsWith('z')
  ) {
    return `${plural}es`;
  } else if (plural.endsWith('y')) {
    return `${plural.slice(0, -1)}ies`;
  } else {
    return `${plural}s`;
  }
}

/**
 * Create a distinct plural form for the last word in a compound name
 * @example "user_sheep" -> "user_sheeps", "UserSheep" -> "UserSheeps"
 */
export function distinctPluralizeLast(str: string): string {
  return changeLastWord(distinctPluralize, str);
}
