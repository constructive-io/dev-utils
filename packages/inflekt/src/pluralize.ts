/**
 * Pluralization utilities with PostGraphile-compatible Latin suffix handling
 *
 * Uses the 'inflection' package with custom overrides for Latin plural suffixes
 * that PostGraphile handles differently than standard English pluralization,
 * plus a dictionary-proven exception table for the words where no suffix rule
 * is right (see exceptions.ts).
 */
import * as inflection from 'inflection';

import { SINGULAR_EXCEPTIONS } from './exceptions';
import {
  enforceDoubleSPlural,
  normalizeMalformedDoubleS,
  pluralizeFStem,
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

function lookupException(word: string): string | null {
  const key = word.toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SINGULAR_EXCEPTIONS, key)) {
    return null;
  }
  return restoreWordCase(word, SINGULAR_EXCEPTIONS[key]);
}

/**
 * Convert a word to its singular form with PostGraphile-compatible Latin handling
 * @example "Users" -> "User", "People" -> "Person", "Schemata" -> "Schema", "ApiSchemata" -> "ApiSchema"
 */
export function singularize(word: string): string {
  const normalizedWord = normalizeMalformedDoubleS(word);

  const exception = lookupException(normalizedWord);
  if (exception) {
    return exception;
  }

  const segment = splitLastSegment(normalizedWord);
  if (segment) {
    const segmentException = lookupException(segment.word);
    if (segmentException) {
      return segment.prefix + segmentException;
    }
  }

  return singularizeByRules(normalizedWord);
}

const F_OR_FE_REGEX = /(?:f|fe)$/i;

function pluralizeCanonical(word: string): string {
  const normalizedWord = normalizeMalformedDoubleS(word);

  // -f/-fe words: only the f-stem nouns take -ves; the rest take a plain "s".
  const fStem = pluralizeFStem(normalizedWord);
  if (fStem) {
    return fStem;
  }
  if (F_OR_FE_REGEX.test(normalizedWord)) {
    return `${normalizedWord}s`;
  }

  const pluralWord = normalizeMalformedDoubleS(
    inflection.pluralize(normalizedWord)
  );

  // -is nouns the inflection library leaves untouched (iris, chassis) rather
  // than treating as Greek/Latin (analysis -> analyses).
  if (pluralWord === normalizedWord && /is$/i.test(normalizedWord)) {
    return `${normalizedWord}es`;
  }

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
