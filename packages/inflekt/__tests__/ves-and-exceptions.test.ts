import { SINGULAR_EXCEPTIONS } from '../src/exceptions';
import { pluralize, singularize, singularizeLast } from '../src/pluralize';
import { F_STEM_PLURALS } from '../src/rules';

describe('singularize: -ves words', () => {
  it('drops the "s" instead of inventing an f-stem', () => {
    // The regression that started this: "derives" -> "derife".
    expect(singularize('derives')).toBe('derive');
    expect(singularize('archives')).toBe('archive');
    expect(singularize('curves')).toBe('curve');
    expect(singularize('drives')).toBe('drive');
    expect(singularize('hives')).toBe('hive');
    expect(singularize('motives')).toBe('motive');
    expect(singularize('natives')).toBe('native');
    expect(singularize('olives')).toBe('olive');
    expect(singularize('solves')).toBe('solve');
    expect(singularize('valves')).toBe('valve');
    expect(singularize('waves')).toBe('wave');
  });

  it('still singularizes the genuine f-stem nouns', () => {
    expect(singularize('knives')).toBe('knife');
    expect(singularize('lives')).toBe('life');
    expect(singularize('wives')).toBe('wife');
    expect(singularize('wolves')).toBe('wolf');
    expect(singularize('shelves')).toBe('shelf');
    expect(singularize('halves')).toBe('half');
    expect(singularize('leaves')).toBe('leaf');
    expect(singularize('loaves')).toBe('loaf');
    expect(singularize('thieves')).toBe('thief');
    expect(singularize('hooves')).toBe('hoof');
  });

  it('preserves case', () => {
    expect(singularize('Derives')).toBe('Derive');
    expect(singularize('DERIVES')).toBe('DERIVE');
    expect(singularize('Knives')).toBe('Knife');
    expect(singularize('KNIVES')).toBe('KNIFE');
  });

  it('applies to the last segment of compound names', () => {
    expect(singularizeLast('user_derives')).toBe('user_derive');
    expect(singularize('user_derives')).toBe('user_derive');
    expect(singularize('UserDerives')).toBe('UserDerive');
    expect(singularize('user_knives')).toBe('user_knife');
    expect(singularize('bookshelves')).toBe('bookshelf');
  });
});

describe('pluralize: -f/-fe words', () => {
  it('only rewrites the f-stem nouns to -ves', () => {
    for (const [singular, plural] of F_STEM_PLURALS) {
      expect(pluralize(singular)).toBe(plural);
    }
    expect(pluralize('bookshelf')).toBe('bookshelves');
    expect(pluralize('jackknife')).toBe('jackknives');
  });

  it('adds a plain "s" to every other -f/-fe word', () => {
    expect(pluralize('cafe')).toBe('cafes');
    expect(pluralize('safe')).toBe('safes');
    expect(pluralize('carafe')).toBe('carafes');
    expect(pluralize('roof')).toBe('roofs');
    expect(pluralize('proof')).toBe('proofs');
    expect(pluralize('belief')).toBe('beliefs');
    expect(pluralize('chief')).toBe('chiefs');
    expect(pluralize('beef')).toBe('beefs');
  });
});

describe('singularize: suffix classes the inflection library gets wrong', () => {
  it('keeps the "e" on -e stems ending in a sibilant', () => {
    expect(singularize('aches')).toBe('ache');
    expect(singularize('caches')).toBe('cache');
    expect(singularize('headaches')).toBe('headache');
    expect(singularize('niches')).toBe('niche');
    expect(singularize('avalanches')).toBe('avalanche');
    expect(singularize('crevasses')).toBe('crevasse');
    expect(singularize('impasses')).toBe('impasse');
    // ...while the -es plurals still lose it
    expect(singularize('matches')).toBe('match');
    expect(singularize('classes')).toBe('class');
    expect(singularize('bushes')).toBe('bush');
  });

  it('handles -ie plurals', () => {
    expect(singularize('cookies')).toBe('cookie');
    expect(singularize('movies')).toBe('movie');
    expect(singularize('prairies')).toBe('prairie');
    expect(singularize('calories')).toBe('calorie');
    expect(singularize('zombies')).toBe('zombie');
    expect(singularize('pies')).toBe('pie');
    // ...without breaking -y plurals
    expect(singularize('bodies')).toBe('body');
    expect(singularize('categories')).toBe('category');
    expect(singularize('policies')).toBe('policy');
  });

  it('handles -oe plurals', () => {
    expect(singularize('shoes')).toBe('shoe');
    expect(singularize('toes')).toBe('toe');
    expect(singularize('canoes')).toBe('canoe');
    expect(singularize('horseshoes')).toBe('horseshoe');
    // ...without breaking -o plurals
    expect(singularize('potatoes')).toBe('potato');
    expect(singularize('heroes')).toBe('hero');
    expect(singularize('echoes')).toBe('echo');
  });

  it('handles -sis nouns and leaves singular -is words alone', () => {
    expect(singularize('analyses')).toBe('analysis');
    expect(singularize('emphases')).toBe('emphasis');
    expect(singularize('oases')).toBe('oasis');
    expect(singularize('neuroses')).toBe('neurosis');
    expect(singularize('geneses')).toBe('genesis');
    expect(singularize('bases')).toBe('basis');
    expect(singularize('iris')).toBe('iris');
    expect(singularize('chassis')).toBe('chassis');
    expect(singularize('analysis')).toBe('analysis');
    expect(pluralize('iris')).toBe('irises');
    expect(singularize('irises')).toBe('iris');
  });

  it('handles -z, -us and Latin -ices plurals', () => {
    expect(singularize('waltzes')).toBe('waltz');
    expect(singularize('buzzes')).toBe('buzz');
    expect(singularize('cactuses')).toBe('cactus');
    expect(singularize('focuses')).toBe('focus');
    expect(singularize('statuses')).toBe('status');
    expect(singularize('appendices')).toBe('appendix');
    expect(singularize('cortices')).toBe('cortex');
    expect(singularize('helices')).toBe('helix');
    expect(singularize('matrices')).toBe('matrix');
    // ...without breaking regular -ice words
    expect(singularize('prices')).toBe('price');
    expect(singularize('slices')).toBe('slice');
    expect(singularize('devices')).toBe('device');
    expect(singularize('police')).toBe('police');
  });
});

describe('SINGULAR_EXCEPTIONS table', () => {
  it('is applied for every entry', () => {
    for (const [plural, singular] of Object.entries(SINGULAR_EXCEPTIONS)) {
      expect(singularize(plural)).toBe(singular);
    }
  });

  it('is idempotent — singularizing a singular is a no-op', () => {
    for (const singular of Object.values(SINGULAR_EXCEPTIONS)) {
      expect(singularize(singular)).toBe(singular);
    }
  });

  it('round-trips every entry through pluralize', () => {
    for (const singular of Object.values(SINGULAR_EXCEPTIONS)) {
      expect(singularize(pluralize(singular))).toBe(singular);
    }
  });
});
