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

const TRAILING_TRIPLE_S_REGEX = /[sS]{3,}$/;
const TRAILING_TRIPLE_S_BEFORE_ES_REGEX = /[sS]{3,}(?=e[sS]$)/;

function normalizeTrailingSRun(suffix: string): string {
  return suffix === suffix.toUpperCase() ? 'SS' : 'ss';
}

function normalizeTripleSBeforeEs(word: string): string {
  return word.replace(TRAILING_TRIPLE_S_BEFORE_ES_REGEX, normalizeTrailingSRun);
}

function normalizeTrailingTripleS(word: string): string {
  const match = word.match(TRAILING_TRIPLE_S_REGEX);
  if (!match) {
    return word;
  }

  const suffix = match[0];
  const prefix = word.slice(0, -suffix.length);
  const normalizedSuffix = normalizeTrailingSRun(suffix);
  return `${prefix}${normalizedSuffix}`;
}

function normalizeMalformedDoubleS(word: string): string {
  return normalizeTrailingTripleS(normalizeTripleSBeforeEs(word));
}

function enforceDoubleSPlural(singularWord: string, pluralWord: string): string {
  if (!singularWord.toLowerCase().endsWith('ss')) {
    return pluralWord;
  }

  // Defensive normalization for malformed outputs like "hazardClasss".
  if (pluralWord === `${singularWord}s`) {
    return `${singularWord}es`;
  }

  return pluralWord;
}

/**
 * Convert a word to its singular form with PostGraphile-compatible Latin handling
 * @example "Users" -> "User", "People" -> "Person", "Schemata" -> "Schema", "ApiSchemata" -> "ApiSchema"
 */
export function singularize(word: string): string {
  const normalizedWord = normalizeMalformedDoubleS(word);
  const lowerWord = normalizedWord.toLowerCase();

  for (const [pluralSuffix, singularSuffix] of LATIN_SUFFIX_OVERRIDES) {
    if (lowerWord.endsWith(pluralSuffix)) {
      const suffixStart = normalizedWord.length - pluralSuffix.length;
      const prefix = normalizedWord.slice(0, suffixStart);
      const originalSuffix = normalizedWord.slice(suffixStart);

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

  return normalizeMalformedDoubleS(inflection.singularize(normalizedWord));
}

function pluralizeCanonical(word: string): string {
  const normalizedWord = normalizeMalformedDoubleS(word);
  const pluralWord = normalizeMalformedDoubleS(inflection.pluralize(normalizedWord));
  return enforceDoubleSPlural(singularize(normalizedWord), pluralWord);
}

/**
 * Convert a word to its plural form
 * @example "User" -> "Users", "Person" -> "People"
 */
export function pluralize(word: string): string {
  return pluralizeCanonical(word);
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
