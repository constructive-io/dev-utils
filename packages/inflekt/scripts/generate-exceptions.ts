/**
 * Regenerate src/exceptions.ts from a system dictionary.
 *
 *   sudo apt-get install -y wamerican   # /usr/share/dict/words
 *   npx ts-node scripts/generate-exceptions.ts
 *
 * Method: a dictionary word is treated as a plural only when some
 * dictionary-valid singular candidate pluralizes back to it exactly. That
 * candidate is the expected singular; whenever the suffix rules alone disagree,
 * the pair is emitted as an exception (the rules-only path keeps this script
 * idempotent — rerunning it reproduces the same table).
 * Ambiguous noun/verb homographs (calves =
 * plural of "calf" and third person of "calve") are resolved in favour of the
 * noun via F_STEM_NOUNS, and Greek/Latin `-sis` nouns via SIS_NOUNS, because
 * those are the senses schema and API names mean.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { pluralize } from '../src/pluralize';
import { F_STEM_PLURALS, singularizeByRules } from '../src/rules';

const DICTIONARY = '/usr/share/dict/words';

/**
 * Frequency-ranked word list (google-10000-english-usa, public domain), used
 * only to choose between two dictionary-valid singulars: "cookies" is the
 * plural of both "cookie" and the dictionary's "cooky", and frequency says
 * which one people mean.
 */
const FREQUENCY_LIST = join(__dirname, '..', '__fixtures__', 'word-frequency-usa.txt');

const F_STEM_NOUNS = F_STEM_PLURALS.map(([singular]) => singular);

/** Greek/Latin -sis nouns whose plural is -ses. */
const SIS_NOUNS = [
  'amanuensis', 'amniocentesis', 'analysis', 'apotheosis', 'basis', 'catharsis',
  'crisis', 'diagnosis', 'dialysis', 'dieresis', 'ellipsis', 'emphasis',
  'exegesis', 'genesis', 'hypnosis', 'hypothesis', 'metastasis', 'nemesis',
  'neurosis', 'oasis', 'paralysis', 'parenthesis', 'periphrasis', 'prognosis',
  'prosthesis', 'psychosis', 'symbiosis', 'synopsis', 'synthesis', 'thesis',
  'thrombosis', 'urinalysis',
];

/**
 * Plurals with two dictionary-valid singulars and no way to choose from the
 * dictionary alone. Anything not listed here is left to the suffix rules.
 */
const AMBIGUOUS: Record<string, string> = {
  penes: 'penis', // vs "pen"
};

/** Plural-looking words that are not plurals (or are uncountable). */
const NOT_PLURALS = new Set([
  'acoustics', 'aerobics', 'athletics', 'crossroads', 'economics', 'ethics',
  'genetics', 'gymnastics', 'linguistics', 'logistics', 'mathematics',
  'mechanics', 'news', 'obstetrics', 'optics', 'physics', 'politics', 'series',
  'hes', 'hises', 'ses', 'shes', 'sis', 'sises', 'species', 'statistics', 'summons', 'these',
]);

const words = readFileSync(DICTIONARY, 'utf8')
  .split('\n')
  .map((word) => word.trim())
  .filter((word) => /^[a-z]{3,}$/.test(word));
const dictionary = new Set(words);

const frequency = new Map(
  readFileSync(FREQUENCY_LIST, 'utf8')
    .split('\n')
    .map((word, rank) => [word.trim(), rank] as [string, number])
);

function rank(word: string): number {
  return frequency.get(word) ?? Number.MAX_SAFE_INTEGER;
}

/** Singular forms that could pluralize into `word`. */
function candidates(word: string): string[] {
  const out: string[] = [];
  if (word.endsWith('s')) out.push(word.slice(0, -1));
  if (word.endsWith('es')) out.push(word.slice(0, -2), word.slice(0, -2) + 'is');
  if (word.endsWith('ies')) out.push(word.slice(0, -3) + 'y');
  if (word.endsWith('ses')) out.push(word.slice(0, -2));
  if (word.endsWith('ves')) {
    out.push(word.slice(0, -3) + 'f', word.slice(0, -3) + 'fe');
  }
  if (word.endsWith('ices')) {
    out.push(word.slice(0, -4) + 'ex', word.slice(0, -4) + 'ix');
  }
  return out;
}

/** Plurals pinned to a preferred sense, including dictionary compounds. */
function pinnedSingulars(nouns: string[]): Map<string, string> {
  const pinned = new Map<string, string>();
  for (const noun of nouns) {
    const plural = pluralize(noun);
    for (const word of words) {
      if (!word.endsWith(plural)) continue;
      const prefix = word.slice(0, word.length - plural.length);
      const singular = prefix + noun;
      if (word === plural || dictionary.has(singular)) {
        pinned.set(word, singular);
      }
    }
  }
  return pinned;
}

const pinned = new Map([
  ...pinnedSingulars(F_STEM_NOUNS),
  ...pinnedSingulars(SIS_NOUNS),
]);

/**
 * The singular `word` is the plural of, or null when the dictionary cannot say.
 *
 * A candidate that pluralizes back to `word` wins outright; failing that a lone
 * dictionary-valid candidate is taken (this is what recovers Latin plurals such
 * as appendices -> appendix, whose plural the inflection library spells
 * "appendixes"). Genuinely ambiguous words must be pinned explicitly.
 */
function expectedSingular(word: string): string | null {
  if (pinned.has(word)) return pinned.get(word) as string;
  if (Object.prototype.hasOwnProperty.call(AMBIGUOUS, word)) return AMBIGUOUS[word];

  const valid = [...new Set(candidates(word))].filter(
    (candidate) => candidate.length > 1 && dictionary.has(candidate)
  );
  const exact = valid.filter((candidate) => pluralize(candidate) === word);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    const [best, runnerUp] = [...exact].sort((a, b) => rank(a) - rank(b));
    return rank(best) === rank(runnerUp) ? null : best;
  }
  return valid.length === 1 ? valid[0] : null;
}

const exceptions = new Map<string, string>();
for (const word of words) {
  // Singular words ending in "s" (atlas, bus, status, lens) that the rules
  // would mangle into a non-word: record them as their own singular.
  if (
    word.endsWith('s') &&
    !word.endsWith('ss') &&
    !candidates(word).some((candidate) => dictionary.has(candidate)) &&
    singularizeByRules(word) !== word &&
    !dictionary.has(singularizeByRules(word))
  ) {
    exceptions.set(word, word);
    continue;
  }
  // -ss words are singular (class, princess, adventuress), never plurals.
  if (!word.endsWith('s') || word.endsWith('ss') || NOT_PLURALS.has(word)) continue;
  const expected = expectedSingular(word);
  if (!expected) continue;
  if (singularizeByRules(word) !== expected) exceptions.set(word, expected);
}

// Round-trip closure: whenever pluralize() coins a plural the dictionary does
// not list (kohlrabi -> kohlrabis, rabbi -> rabbis), the rules must still get
// back to the singular.
const dictionaryPlurals = new Set(words.map((word) => pluralize(word)));
for (const word of words) {
  // Latin plurals the dictionary also lists (foci, alumni, phalli) are not
  // singulars: pluralizing them again coins words nobody writes ("focis").
  if (word.endsWith('s') || NOT_PLURALS.has(word) || dictionaryPlurals.has(word)) continue;
  const plural = pluralize(word);
  if (plural === word || exceptions.has(plural) || dictionary.has(plural)) continue;
  if (singularizeByRules(plural) !== word) exceptions.set(plural, word);
}

// Self-consistency: a singular that itself ends in "s" (biceps, kudos) must
// singularize to itself, or singularize(plural) would not be idempotent.
for (const singular of [...exceptions.values()]) {
  if (exceptions.has(singular)) continue;
  if (singular.endsWith('s') && singularizeByRules(singular) !== singular) {
    exceptions.set(singular, singular);
  }
}

const entries = [...exceptions.entries()].sort(([a], [b]) => a.localeCompare(b));
const body = entries.map(([plural, singular]) => `  ${plural}: '${singular}',`).join('\n');

writeFileSync(
  join(__dirname, '..', 'src', 'exceptions.ts'),
  `/**
 * Plural -> singular pairs that no generic suffix rule gets right.
 *
 * English singularization is not rule-decidable: \`-ies\` is \`-y\` for "bodies"
 * but \`-ie\` for "cookies"; \`-ches\` drops "es" for "matches" but only "s" for
 * "aches"; \`-oes\` drops "es" for "potatoes" but only "s" for "shoes". The
 * generic rules in pluralize.ts handle the majority case for each suffix and
 * this table carries the words where the majority case is wrong.
 *
 * GENERATED — do not hand-edit. Regenerate with:
 *
 *   sudo apt-get install -y wamerican
 *   npx ts-node scripts/generate-exceptions.ts
 *
 * Every entry is dictionary-proven: the singular is a real word whose
 * pluralization returns the key (see scripts/generate-exceptions.ts).
 */
export const SINGULAR_EXCEPTIONS: Record<string, string> = {
${body}
};
`
);

console.log(`wrote ${entries.length} exception pairs`);
