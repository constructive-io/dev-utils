/**
 * Rule-based inflection: the suffix rules alone, with no exception tables.
 *
 * Kept separate from pluralize.ts so that scripts/generate-exceptions.ts can
 * diff the rules against a dictionary without the exception tables masking the
 * very defects they are meant to record. Not part of the public API.
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
  ['corpora', 'corpus'],
  ['genera', 'genus'],
  ['criteria', 'criterion'],
  ['phenomena', 'phenomenon'],
  ['media', 'medium'],
  ['memoranda', 'memorandum'],
  ['strata', 'stratum'],
  ['curricula', 'curriculum'],
  ['data', 'datum'],
];

/**
 * The `-a` plurals of LATIN_SUFFIX_OVERRIDES, as a set: these are the only
 * words the rules may read as an existing plural rather than pluralizing them.
 *
 * Everything else ending in "a" is treated as a singular that takes "-as"
 * (deltas, betas, quotas, schemas, replicas). The inflection library assumes
 * the opposite — that "-a" is Latin — and so leaves every one of them
 * unchanged, which for an identifier means the plural silently equals the
 * singular.
 */
const LATIN_A_PLURALS = LATIN_SUFFIX_OVERRIDES.map(([plural]) => plural);

/** Whether `lowerWord` is (or ends in) one of the Latin `-a` plurals. */
function isLatinAPlural(lowerWord: string): boolean {
  return LATIN_A_PLURALS.some((plural) => lowerWord.endsWith(plural));
}

/**
 * The Latin plurals to *produce*, the inverse of LATIN_SUFFIX_OVERRIDES minus
 * "schema" (whose plural is "schemas" here, per PostGraphile). Matched as a
 * suffix so compounds follow: metadatum -> metadata.
 *
 * Without this, pluralize and singularize disagree: "criteria" singularizes to
 * "criterion", but "criterion" would pluralize to "criterions".
 *
 * Format: [singularSuffix, pluralSuffix]
 */
const LATIN_PLURAL_SUFFIXES: Array<[string, string]> = LATIN_SUFFIX_OVERRIDES
  .filter(([plural]) => plural !== 'schemata')
  .map(([plural, singular]) => [singular, plural]);

/**
 * Compound words ending in "base" that the inflection library incorrectly
 * singularizes via its (b)a branch in the ses$ rule (e.g. codebases -> codebasis).
 * We intercept these before delegating to inflection.singularize().
 */
const COMPOUND_BASE_REGEX = /(database|codebase|firebase|knowledgebase)s$/i;

/**
 * Generic suffix rules applied before delegating to the inflection library,
 * replacing inflection rules that are wrong for most English words.
 *
 * The biggest offender is `-ves`: inflection rewrites it to `-fe`/`-f` (knives
 * -> knife, wolves -> wolf), but the overwhelming majority of `-ves` words
 * simply drop the trailing "s" (derives -> derive, solves -> solve, olives ->
 * olive). The genuine f-stem nouns are carried by SINGULAR_EXCEPTIONS, so the
 * generic case here is "drop the s".
 *
 * Format: [pluralPattern, singularReplacement]
 */

/**
 * The complete set of English nouns whose plural rewrites -f/-fe to -ves.
 *
 * Both directions are wrong in the inflection library, which applies the -ves
 * pattern by suffix shape: it invents "caves" for cafe, "saves" for safe and
 * "barves" for barf, while spelling the real cases "leafs", "thiefs" and
 * "loafs". Matched as a suffix so compounds work (bookshelf -> bookshelves,
 * jackknife -> jackknives).
 *
 * Format: [singular, plural]
 */
export const F_STEM_PLURALS: Array<[string, string]> = [
  ['calf', 'calves'],
  ['dwarf', 'dwarves'],
  ['elf', 'elves'],
  ['half', 'halves'],
  ['hoof', 'hooves'],
  ['knife', 'knives'],
  ['leaf', 'leaves'],
  ['life', 'lives'],
  ['loaf', 'loaves'],
  ['scarf', 'scarves'],
  ['self', 'selves'],
  ['sheaf', 'sheaves'],
  ['shelf', 'shelves'],
  ['thief', 'thieves'],
  ['wharf', 'wharves'],
  ['wife', 'wives'],
  ['wolf', 'wolves'],
];

/**
 * Adjectives, never plurals: anxious, various, porous. No noun stem ends in
 * "ou", so nothing here is ever a dropped-s away from a singular.
 *
 * There is no equivalent rule for the rest of "-is"/"-us", because none exists:
 * "apis" and "iris" are both a vowel plus "s" (api + s, iri + s), so no suffix
 * tells the plural from the singular. Whether a word is one or the other is a
 * dictionary fact, and the dictionary-proven singulars live in
 * SINGULAR_EXCEPTIONS as self-mappings (status -> status, analysis -> analysis).
 * Words the dictionary does not know fall through to the generic "drop the s",
 * which is what coined identifiers want: apis -> api, cpus -> cpu, uris -> uri.
 */
const ADJECTIVE_OUS_REGEX = /ous$/i;

/**
 * Words ending in "a" are singular (delta, schema, replica, quota, aorta): the
 * only English plurals spelled that way are the Latin ones in
 * LATIN_SUFFIX_OVERRIDES. The inflection library reads the suffix as Latin
 * regardless and rewrites it to "-um", coining "deltum" and "schemum", which
 * then reads back as a plural and leaves pluralize with nothing to do.
 */
const A_SINGULAR_REGEX = /a$/i;

/**
 * The only -ice plurals. The inflection library's rule is written `([m|l])ice`,
 * whose character class also matches "|", and it fires on any word ending in
 * "ice": police -> polouse, chalice -> chalouse, service -> servouse.
 */
const MOUSE_PLURALS: Record<string, string> = {
  dormice: 'dormouse',
  fieldmice: 'fieldmouse',
  lice: 'louse',
  mice: 'mouse',
  titmice: 'titmouse',
  woodlice: 'woodlouse',
};

const ICE_REGEX = /ice$/i;

/** @see the GENERIC_SINGULAR_RULES documentation above. */
const GENERIC_SINGULAR_RULES: Array<[RegExp, string]> = [
  [/zzes$/i, 'zz'], // buzzes -> buzz
  [/tzes$/i, 'tz'], // waltzes -> waltz
  [/yses$/i, 'ysis'], // analyses -> analysis, dialyses -> dialysis
  [/([^aeiou])uses$/i, '$1us'], // cactuses -> cactus, focuses -> focus
  [/ves$/i, 've'], // derives -> derive, solves -> solve, olives -> olive
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

export function normalizeMalformedDoubleS(word: string): string {
  return normalizeTrailingTripleS(normalizeTripleSBeforeEs(word));
}

export function enforceDoubleSPlural(
  singularWord: string,
  pluralWord: string
): string {
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
 * Pluralize the f-stem nouns (and their compounds), or null when `word` is not
 * one — in which case an -f/-fe word takes a plain "s" (cafes, roofs, barfs).
 */
export function pluralizeFStem(word: string): string | null {
  const lowerWord = word.toLowerCase();
  for (const [singular, plural] of F_STEM_PLURALS) {
    if (!lowerWord.endsWith(singular)) {
      continue;
    }
    const stem = word.slice(0, word.length - singular.length);
    const matched = word.slice(word.length - singular.length);
    return stem + matchCase(matched, plural);
  }
  return null;
}

/**
 * Restore the capitalization of `source` onto `replacement`.
 */
export function restoreWordCase(source: string, replacement: string): string {
  if (source === source.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (source[0] === source[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function matchCase(source: string, replacement: string): string {
  if (source && source === source.toUpperCase()) {
    return replacement.toUpperCase();
  }
  return replacement;
}

function applyGenericSingularRules(word: string): string | null {
  for (const [pattern, replacement] of GENERIC_SINGULAR_RULES) {
    if (!pattern.test(word)) {
      continue;
    }
    return word.replace(pattern, (matched, ...groups) => {
      const expanded = replacement.replace(/\$(\d)/g, (_, index) =>
        String(groups[Number(index) - 1] ?? '')
      );
      return matchCase(matched, expanded);
    });
  }
  return null;
}

/**
 * Singularize using suffix rules only — the fallback for words absent from the
 * exception table (including coined identifiers that no dictionary knows).
 */
const US_REGEX = /us$/i;
const A_REGEX = /a$/i;
const UM_REGEX = /um$/i;
const F_OR_FE_REGEX = /(?:f|fe)$/i;

/**
 * Nouns ending in "is" that are not the Greek/Latin `-sis`/`-xis` family: their
 * plural adds "es" (iris -> irises, chassis -> chassises). Only the Greek ones
 * rewrite the "is" itself (analysis -> analyses, axis -> axes), which is the
 * rule the inflection library applies to all of them, coining "chasses".
 */
const NON_GREEK_IS_REGEX = /(?<![sx])is$/i;

/**
 * Pluralize using suffix rules only, with no exception table — the fallback for
 * words the dictionary does not know, which is every coined identifier.
 *
 * The inflection library's Latin instincts are wrong for identifiers in three
 * shapes, all of which it leaves *unchanged* (so the "plural" equals the
 * singular, and a schema ends up with `radius` and `radius` fields):
 *
 *   radius -> radiuses   (not radius)
 *   delta  -> deltas     (not delta)
 *   forum  -> forums     (not fora)
 *
 * The genuine Latin plurals are a closed set of dictionary words, carried by
 * LATIN_SUFFIX_OVERRIDES and by the generated PLURAL_EXCEPTIONS table.
 *
 * Words the inflection library holds uncountable (sheep, series, aircraft) are
 * left alone here: "no plural" is a dictionary fact like any other, and the
 * ones it gets wrong (bias, atlas, aid) are corrected by PLURAL_EXCEPTIONS.
 */
export function pluralizeByRules(word: string): string {
  const normalizedWord = normalizeMalformedDoubleS(word);

  // Adjectives have no plural, so leave them be rather than coining
  // "anxiouses"; see ADJECTIVE_OUS_REGEX.
  if (ADJECTIVE_OUS_REGEX.test(normalizedWord)) {
    return normalizedWord;
  }

  // -f/-fe words: only the f-stem nouns take -ves; the rest take a plain "s".
  const fStem = pluralizeFStem(normalizedWord);
  if (fStem) {
    return fStem;
  }
  if (F_OR_FE_REGEX.test(normalizedWord)) {
    return matchWordCase(normalizedWord, `${normalizedWord}s`);
  }

  const lowerWord = normalizedWord.toLowerCase();
  for (const [singularSuffix, pluralSuffix] of LATIN_PLURAL_SUFFIXES) {
    if (!lowerWord.endsWith(singularSuffix)) {
      continue;
    }
    const stem = normalizedWord.slice(0, -singularSuffix.length);
    const matched = normalizedWord.slice(-singularSuffix.length);
    return stem + matchCase(matched, pluralSuffix);
  }

  if (NON_GREEK_IS_REGEX.test(normalizedWord)) {
    return matchWordCase(normalizedWord, `${normalizedWord}es`);
  }

  const pluralWord = normalizeMalformedDoubleS(
    inflection.pluralize(normalizedWord)
  );

  if (pluralWord === normalizedWord) {
    // Latin-looking shapes it declines to pluralize, and the uncountable list
    // it applies to countable nouns (bias, atlas, aid, air).
    if (US_REGEX.test(normalizedWord)) {
      return matchWordCase(normalizedWord, `${normalizedWord}es`);
    }
    if (UM_REGEX.test(normalizedWord)) {
      return matchWordCase(normalizedWord, `${normalizedWord}s`);
    }
    if (A_REGEX.test(normalizedWord) && !isLatinAPlural(lowerWord)) {
      return matchWordCase(normalizedWord, `${normalizedWord}s`);
    }
  }

  return matchWordCase(
    normalizedWord,
    enforceDoubleSPlural(singularizeByRules(normalizedWord), pluralWord)
  );
}

/**
 * Keep an all-caps word all-caps: the suffix rules and the inflection library
 * both append a lowercase "s", turning API_KEY into API_KEYs.
 */
function matchWordCase(word: string, plural: string): string {
  const isAllCaps = word === word.toUpperCase() && /[A-Z]/.test(word);
  return isAllCaps ? plural.toUpperCase() : plural;
}

/**
 * Whether the rules already read `word` as a plural: it singularizes to
 * something else, and that singular pluralizes back to exactly `word`.
 *
 * This is what keeps pluralize idempotent — `pluralize('apis')` must be `apis`,
 * not `apises` — without a table of every plural in the language.
 */
export function isRulesPlural(word: string): boolean {
  const singular = singularizeByRules(word);
  return singular !== word && pluralizeByRules(singular) === word;
}

export function singularizeByRules(word: string): string {
  const normalizedWord = normalizeMalformedDoubleS(word);
  const lowerWord = normalizedWord.toLowerCase();

  if (ADJECTIVE_OUS_REGEX.test(normalizedWord)) {
    return normalizedWord;
  }

  if (A_SINGULAR_REGEX.test(normalizedWord) && !isLatinAPlural(lowerWord)) {
    return normalizedWord;
  }

  if (ICE_REGEX.test(normalizedWord)) {
    const mouse = Object.prototype.hasOwnProperty.call(MOUSE_PLURALS, lowerWord)
      ? MOUSE_PLURALS[lowerWord]
      : null;
    return mouse ? restoreWordCase(normalizedWord, mouse) : normalizedWord;
  }

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
        newSuffix =
          singularSuffix.charAt(0).toUpperCase() + singularSuffix.slice(1);
      } else {
        newSuffix = singularSuffix;
      }

      return prefix + newSuffix;
    }
  }

  // Compound *base words: the inflection library's (b)a branch in the ses$
  // rule incorrectly produces "codebasis" instead of "codebase".
  if (COMPOUND_BASE_REGEX.test(normalizedWord)) {
    return normalizedWord.slice(0, -1);
  }

  const generic = applyGenericSingularRules(normalizedWord);
  if (generic) {
    return generic;
  }

  return normalizeMalformedDoubleS(inflection.singularize(normalizedWord));
}
