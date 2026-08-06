/**
 * Inflection with PostGraphile-compatible Latin suffix handling.
 *
 * Both directions are the same shape: an exception table proven against a
 * system dictionary (exceptions.ts) in front of the suffix rules (rules.ts),
 * so dictionary words are right by construction and coined identifiers fall
 * through to the rules. Both are idempotent — `singularize` of a singular and
 * `pluralize` of a plural return the word unchanged.
 */
import { PLURAL_EXCEPTIONS, SINGULAR_EXCEPTIONS } from './exceptions';
import {
  isRulesPlural,
  normalizeMalformedDoubleS,
  pluralizeByRules,
  restoreWordCase,
  singularizeByRules,
} from './rules';

const LAST_SEGMENT_REGEX = /([A-Z]|_[a-z0-9])[a-z0-9]*_*$/;

/**
 * Locate the final word segment of a compound name ("user_cookies" -> "cookies",
 * "UserCookies" -> "Cookies") so the exception table applies to compounds too.
 */
function splitLastSegment(
  str: string
): { prefix: string; word: string } | null {
  const matches = str.match(LAST_SEGMENT_REGEX);
  if (!matches) {
    return null;
  }
  const index = (matches.index ?? 0) + matches[1].length - 1;
  if (index <= 0) {
    return null;
  }
  return { prefix: str.slice(0, index), word: str.slice(index) };
}

function lookup(
  table: Record<string, string>,
  word: string
): string | null {
  const key = word.toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(table, key)) {
    return null;
  }
  return restoreWordCase(word, table[key]);
}

/**
 * Apply an exception table to a word, or to the final segment of a compound
 * name ("user_cookies" -> "cookies") so compounds inflect like the word they
 * end in.
 */
function applyTable(
  table: Record<string, string>,
  word: string
): string | null {
  const whole = lookup(table, word);
  if (whole) {
    return whole;
  }
  const segment = splitLastSegment(word);
  if (!segment) {
    return null;
  }
  const segmentException = lookup(table, segment.word);
  return segmentException ? segment.prefix + segmentException : null;
}

/**
 * Convert a word to its singular form with PostGraphile-compatible Latin handling
 * @example "Users" -> "User", "People" -> "Person", "Schemata" -> "Schema", "ApiSchemata" -> "ApiSchema"
 */
export function singularize(word: string): string {
  const normalizedWord = normalizeMalformedDoubleS(word);

  const exception = applyTable(SINGULAR_EXCEPTIONS, normalizedWord);
  if (exception) {
    return exception;
  }

  return singularizeByRules(normalizedWord);
}

/**
 * Whether `word` is already a plural, and so must be returned unchanged.
 *
 * SINGULAR_EXCEPTIONS answers this for the dictionary (its keys are plurals,
 * except the self-mapped singulars it carries to protect them from the rules),
 * and the rules answer it for everything else, coined identifiers included.
 */
function isPlural(word: string): boolean {
  const singular = applyTable(SINGULAR_EXCEPTIONS, word);
  if (singular) {
    return singular !== word;
  }
  return isRulesPlural(word);
}

/**
 * Convert a word to its plural form. Already-plural input is returned as-is.
 * @example "User" -> "Users", "Person" -> "People", "Users" -> "Users"
 */
export function pluralize(word: string): string {
  const normalizedWord = normalizeMalformedDoubleS(word);

  if (isPlural(normalizedWord)) {
    return normalizedWord;
  }

  const exception = applyTable(PLURAL_EXCEPTIONS, normalizedWord);
  if (exception) {
    return exception;
  }

  return pluralizeByRules(normalizedWord);
}

/**
 * Pluralize/singularize only the final segment of a compound name.
 * This is important for names like "user_profiles" where only "profiles" should be pluralized.
 *
 * @param fn - The singularize or pluralize function to apply
 * @param str - The string to transform
 * @returns The transformed string with only the final segment changed
 */
function changeLastWord(fn: (word: string) => string, str: string): string {
  const matches = str.match(LAST_SEGMENT_REGEX);
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
