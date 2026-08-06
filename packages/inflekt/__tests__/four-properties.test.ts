/**
 * The four properties every singular/plural pair must satisfy, because callers
 * hand us words in both numbers and ask for either one:
 *
 *   singularize(singular) === singular
 *   pluralize(singular)   === plural
 *   pluralize(plural)     === plural
 *   singularize(plural)   === singular
 *
 * The corpora here are the hand-picked ones — identifiers a schema actually
 * contains, and the English shapes that break naive suffix rules. The
 * exhaustive check is scripts/audit.ts, which runs these same four properties
 * over every singular/plural pair in the system dictionary.
 */
import { pluralize, singularize } from '../src/pluralize';

/** Identifiers, as a developer writes them in a schema. */
const IDENTIFIERS: Array<[string, string]> = [
  // coined acronyms and abbreviations: never in a dictionary, and the reason
  // "drop the s" has to be the fallback for -is/-us
  ['api', 'apis'], ['uri', 'uris'], ['url', 'urls'], ['uuid', 'uuids'],
  ['guid', 'guids'], ['id', 'ids'], ['ip', 'ips'], ['cpu', 'cpus'],
  ['gpu', 'gpus'], ['ram', 'rams'], ['acl', 'acls'], ['sdk', 'sdks'],
  ['cli', 'clis'], ['ui', 'uis'], ['ux', 'uxes'], ['dag', 'dags'],
  ['pid', 'pids'], ['fd', 'fds'], ['csr', 'csrs'], ['sha', 'shas'],
  ['jwt', 'jwts'], ['saml', 'samls'], ['totp', 'totps'], ['otp', 'otps'],
  ['mfa', 'mfas'], ['orm', 'orms'], ['crud', 'cruds'],
  // formats and languages
  ['json', 'jsons'], ['yaml', 'yamls'], ['toml', 'tomls'], ['csv', 'csvs'],
  ['sql', 'sqls'], ['html', 'htmls'], ['css', 'csses'],
  // -x words, where Latin and English disagree
  ['vertex', 'vertices'], ['matrix', 'matrices'], ['mutex', 'mutexes'],
  ['regex', 'regexes'],
  // -a words the inflection library mistakes for Latin plurals
  ['schema', 'schemas'], ['lambda', 'lambdas'], ['delta', 'deltas'],
  ['beta', 'betas'], ['alpha', 'alphas'], ['quota', 'quotas'],
  ['replica', 'replicas'], ['persona', 'personas'], ['formula', 'formulas'],
  ['antenna', 'antennas'],
  // -us/-is words that are singular, not plural
  ['status', 'statuses'], ['radius', 'radiuses'], ['focus', 'focuses'],
  ['syllabus', 'syllabuses'], ['bus', 'buses'], ['alias', 'aliases'],
  ['bias', 'biases'], ['axis', 'axes'], ['analysis', 'analyses'],
  ['basis', 'bases'],
  // genuine Latin, where singularize and pluralize must agree with each other
  ['datum', 'data'], ['metadatum', 'metadata'], ['criterion', 'criteria'],
  ['phenomenon', 'phenomena'], ['medium', 'media'], ['stratum', 'strata'],
  ['corpus', 'corpora'], ['forum', 'forums'],
  // -o words: "s", not "es"
  ['repo', 'repos'], ['proto', 'protos'], ['photo', 'photos'],
  ['video', 'videos'], ['macro', 'macros'], ['micro', 'micros'],
  // GraphQL and database vocabulary
  ['mutation', 'mutations'], ['subscription', 'subscriptions'],
  ['resolver', 'resolvers'], ['directive', 'directives'],
  ['fragment', 'fragments'], ['migration', 'migrations'],
  ['snapshot', 'snapshots'], ['cursor', 'cursors'], ['policy', 'policies'],
  ['query', 'queries'], ['tenant', 'tenants'], ['grant', 'grants'],
  ['role', 'roles'], ['scope', 'scopes'], ['claim', 'claims'],
  ['session', 'sessions'], ['token', 'tokens'], ['webhook', 'webhooks'],
  ['endpoint', 'endpoints'], ['payload', 'payloads'], ['directory', 'directories'],
  ['proxy', 'proxies'], ['gateway', 'gateways'], ['queue', 'queues'],
  ['cache', 'caches'], ['class', 'classes'], ['process', 'processes'],
  ['hash', 'hashes'], ['branch', 'branches'], ['patch', 'patches'],
  ['batch', 'batches'], ['match', 'matches'], ['checksum', 'checksums'],
  ['digest', 'digests'], ['bucket', 'buckets'], ['volume', 'volumes'],
  ['partition', 'partitions'], ['shard', 'shards'], ['cluster', 'clusters'],
  ['node', 'nodes'], ['pod', 'pods'], ['disk', 'disks'], ['edge', 'edges'],
  ['graph', 'graphs'], ['heap', 'heaps'], ['stack', 'stacks'],
  ['kernel', 'kernels'], ['daemon', 'daemons'], ['socket', 'sockets'],
  ['thread', 'threads'], ['codec', 'codecs'], ['cron', 'crons'],
  ['config', 'configs'], ['env', 'envs'], ['plugin', 'plugins'],
  ['addon', 'addons'], ['secret', 'secrets'], ['certificate', 'certificates'],
  ['tuple', 'tuples'], ['struct', 'structs'], ['union', 'unions'],
  ['enum', 'enums'], ['bool', 'bools'], ['byte', 'bytes'], ['bit', 'bits'],
  ['blob', 'blobs'], ['file', 'files'], ['key', 'keys'], ['value', 'values'],
  ['object', 'objects'], ['array', 'arrays'], ['vector', 'vectors'],
  ['tensor', 'tensors'], ['embedding', 'embeddings'], ['mock', 'mocks'],
  ['stub', 'stubs'], ['offset', 'offsets'],
  // snake_case compounds: the last word decides
  ['api_key', 'api_keys'], ['access_token', 'access_tokens'],
  ['user_profile', 'user_profiles'], ['schema_migration', 'schema_migrations'],
  ['oauth_client', 'oauth_clients'], ['ssh_key', 'ssh_keys'],
  ['index_stat', 'index_stats'], ['full_text_search', 'full_text_searches'],
  ['api_status', 'api_statuses'], ['user_analysis', 'user_analyses'],
];

/** The English shapes that break naive suffix rules. */
const ENGLISH: Array<[string, string]> = [
  // irregulars
  ['person', 'people'], ['child', 'children'], ['man', 'men'],
  ['woman', 'women'], ['foot', 'feet'], ['tooth', 'teeth'],
  ['goose', 'geese'], ['mouse', 'mice'], ['louse', 'lice'], ['ox', 'oxen'],
  // -f/-fe: only the f-stem nouns take -ves
  ['knife', 'knives'], ['life', 'lives'], ['wife', 'wives'],
  ['shelf', 'shelves'], ['leaf', 'leaves'], ['thief', 'thieves'],
  ['bookshelf', 'bookshelves'], ['cafe', 'cafes'], ['safe', 'safes'],
  ['roof', 'roofs'], ['belief', 'beliefs'], ['chief', 'chiefs'],
  // -ves that is not an f-stem plural at all
  ['olive', 'olives'], ['drive', 'drives'], ['archive', 'archives'],
  // -is/-us singulars, and the Greek/Latin -sis family
  ['iris', 'irises'], ['chassis', 'chassis'], ['atlas', 'atlases'],
  ['virus', 'viruses'], ['census', 'censuses'], ['genius', 'geniuses'],
  ['campus', 'campuses'], ['cactus', 'cactuses'], ['thesis', 'theses'],
  ['crisis', 'crises'], ['hypothesis', 'hypotheses'], ['diagnosis', 'diagnoses'],
  ['parenthesis', 'parentheses'], ['synopsis', 'synopses'], ['oasis', 'oases'],
  // -ss and -s stems
  ['class', 'classes'], ['address', 'addresses'], ['lens', 'lenses'],
  ['princess', 'princesses'], ['business', 'businesses'],
  // -y and -ie
  ['city', 'cities'], ['company', 'companies'], ['cookie', 'cookies'],
  ['movie', 'movies'], ['day', 'days'], ['key', 'keys'],
  // -o
  ['potato', 'potatoes'], ['tomato', 'tomatoes'], ['hero', 'heroes'],
  ['piano', 'pianos'], ['zero', 'zeros'], ['echo', 'echoes'],
  // -ch/-sh/-x/-z
  ['church', 'churches'], ['dish', 'dishes'], ['box', 'boxes'],
  ['quiz', 'quizzes'], ['buzz', 'buzzes'], ['waltz', 'waltzes'],
  // Latin and Greek. -ex/-ix takes the Latin plural wherever the dictionary
  // attests one, which is also what PostGraphile's inflector (the `pluralize`
  // package) does: indices, appendices, vertices, matrices. Elsewhere the
  // English plural wins wherever the dictionary attests one (alumnuses,
  // aquariums) — deliberately unlike `pluralize`, which coins "radii" and
  // "cacti" for identifiers — and the Latin plural is kept only where English
  // has none (curricula, memoranda, genera).
  ['appendix', 'appendices'], ['index', 'indices'], ['alumnus', 'alumnuses'],
  ['curriculum', 'curricula'], ['memorandum', 'memoranda'],
  ['aquarium', 'aquariums'], ['genus', 'genera'],
  // -o: "es" for the nouns that take it, "s" for the rest
  ['veto', 'vetoes'],
  // -ice, which the inflection library reads as -ouse
  ['police', 'polices'], ['service', 'services'], ['chalice', 'chalices'],
  // compounds where the last word is irregular
  ['salesperson', 'salespeople'], ['grandchild', 'grandchildren'],
];

/** Words with no distinct plural: both numbers are the same word. */
const INVARIANT = [
  'sheep', 'series', 'species', 'aircraft', 'news', 'equipment',
  'information', 'software', 'chassis', 'deer', 'fish', 'moose', 'salmon',
];

describe.each([
  ['identifiers', IDENTIFIERS],
  ['english', ENGLISH],
])('%s', (_name, corpus) => {
  it.each(corpus)('%s <-> %s', (singular, plural) => {
    expect(singularize(singular)).toBe(singular);
    expect(pluralize(singular)).toBe(plural);
    expect(pluralize(plural)).toBe(plural);
    expect(singularize(plural)).toBe(singular);
  });
});

describe('invariant words', () => {
  it.each(INVARIANT)('%s', (word) => {
    expect(pluralize(word)).toBe(word);
    expect(singularize(word)).toBe(word);
  });
});

describe('casing is preserved in both directions', () => {
  it.each([
    ['ApiSchema', 'ApiSchemas'],
    ['UserStatus', 'UserStatuses'],
    ['AnalysisResult', 'AnalysisResults'],
    ['PersonAddress', 'PersonAddresses'],
    ['API_KEY', 'API_KEYS'],
    ['USER_STATUS', 'USER_STATUSES'],
  ])('%s <-> %s', (singular, plural) => {
    expect(singularize(singular)).toBe(singular);
    expect(pluralize(singular)).toBe(plural);
    expect(pluralize(plural)).toBe(plural);
    expect(singularize(plural)).toBe(singular);
  });
});

/**
 * Words no algorithm can get right without knowing what the author meant.
 * Pinned so a change of behaviour is a deliberate decision, not a surprise.
 */
describe('inherently ambiguous', () => {
  it('reads -ies as the dictionary does, not as an identifier', () => {
    // "tries" is the plural of "try" in every dictionary; that a codebase also
    // spells the plural of "trie" that way is invisible here.
    expect(singularize('tries')).toBe('try');
    // Same shape, opposite direction: "tty" is not a word, so the -y rule for
    // words (city -> cities) applies to it.
    expect(pluralize('tty')).toBe('tties');
  });

  it('treats a consonant-only acronym as a word, since nothing marks it', () => {
    // "dns" has the shape of a plural (and "cds", "urls" and "ids" really are
    // plurals), so it loses the "s" like any other unknown -s word.
    expect(singularize('dns')).toBe('dn');
  });

  it('reads a word that is also a plural as the word', () => {
    // wamerican lists "cons" as a word in its own right (with the plural
    // "conses"), so it is left alone rather than read as the plural of "con".
    expect(singularize('cons')).toBe('cons');
  });
});
