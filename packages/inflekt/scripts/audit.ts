/**
 * Scratch audit (not shipped): measure the four inflection properties against
 * the dictionary-attested singular/plural pairs.
 *
 *   npx ts-node scripts/audit.ts [--sample N]
 *
 * A singular may have several attested plurals (apexes and apices, cactuses and
 * cacti): any of them counts as correct, since which one to prefer is a style
 * choice, not a correctness one.
 */
import { readFileSync, writeFileSync } from 'fs';

import { pluralize, singularize } from '../src/pluralize';

const words = readFileSync('/usr/share/dict/words', 'utf8')
  .split('\n')
  .map((w) => w.trim())
  .filter((w) => /^[a-z]{3,}$/.test(w));
const dictionary = new Set(words);

/** Words that look like plurals but are not (or have no singular). */
const NOT_PLURALS = new Set([
  'acoustics', 'aerobics', 'athletics', 'crossroads', 'economics', 'ethics',
  'genetics', 'gymnastics', 'linguistics', 'logistics', 'mathematics',
  'mechanics', 'news', 'obstetrics', 'optics', 'physics', 'politics', 'series',
  'species', 'statistics', 'summons', 'hes', 'hises', 'ses', 'shes', 'sis',
  'sises', 'these', 'shucks', 'biceps', 'triceps', 'forceps',
]);

function candidates(word: string): string[] {
  const out: string[] = [];
  if (word.endsWith('s')) out.push(word.slice(0, -1));
  if (word.endsWith('es')) out.push(word.slice(0, -2), word.slice(0, -2) + 'is');
  if (word.endsWith('ies')) out.push(word.slice(0, -3) + 'y');
  if (word.endsWith('ses')) out.push(word.slice(0, -2));
  if (word.endsWith('ves')) out.push(word.slice(0, -3) + 'f', word.slice(0, -3) + 'fe');
  if (word.endsWith('ices')) out.push(word.slice(0, -4) + 'ex', word.slice(0, -4) + 'ix');
  return out;
}

// singular -> every attested plural of it
const attested = new Map<string, Set<string>>();
for (const word of words) {
  if (!word.endsWith('s') || word.endsWith('ss') || NOT_PLURALS.has(word)) continue;
  const valid = [...new Set(candidates(word))].filter(
    (c) => c.length > 1 && dictionary.has(c) && c !== word
  );
  if (valid.length !== 1) continue;
  const plurals = attested.get(valid[0]) ?? new Set<string>();
  plurals.add(word);
  attested.set(valid[0], plurals);
}

const buckets: Record<string, string[]> = {
  'singularize(singular) != singular': [],
  'pluralize(singular) not attested': [],
  'pluralize(plural) != plural': [],
  'singularize(plural) != singular': [],
};

let pairCount = 0;
for (const [singular, plurals] of attested) {
  pairCount += plurals.size;
  const want = [...plurals].join('/');

  if (singularize(singular) !== singular) {
    buckets['singularize(singular) != singular'].push(
      `${singular} -> ${singularize(singular)}`
    );
  }
  const got = pluralize(singular);
  if (!plurals.has(got)) {
    buckets['pluralize(singular) not attested'].push(
      `${singular} -> ${got} (attested ${want})`
    );
  }
  for (const plural of plurals) {
    if (pluralize(plural) !== plural) {
      buckets['pluralize(plural) != plural'].push(`${plural} -> ${pluralize(plural)}`);
    }
    if (singularize(plural) !== singular) {
      buckets['singularize(plural) != singular'].push(
        `${plural} -> ${singularize(plural)} (want ${singular})`
      );
    }
  }
}

const sampleFlag = process.argv.indexOf('--sample');
const sample = sampleFlag === -1 ? 15 : Number(process.argv[sampleFlag + 1]);

let report = `singulars: ${attested.size}, attested plurals: ${pairCount}\n`;
for (const [name, failures] of Object.entries(buckets)) {
  const rate = ((failures.length / attested.size) * 100).toFixed(2);
  report += `\n${name}: ${failures.length} (${rate}%)\n`;
  report += failures.map((f) => `    ${f}`).join('\n') + '\n';
}
writeFileSync('/tmp/audit.txt', report);
console.log(
  report
    .split('\n')
    .filter((line) => !line.startsWith('    '))
    .join('\n')
);
for (const [name, failures] of Object.entries(buckets)) {
  if (!failures.length) continue;
  console.log(`\n${name} (first ${sample}):`);
  console.log(failures.slice(0, sample).map((f) => `    ${f}`).join('\n'));
}
console.log('\nfull: /tmp/audit.txt');
