# gen-llm-md

### Derive the tree from page JSON-LD

Use `tree.graph` instead of `tree.placements` to retain every discovered
indexable HTML page. Declare sections in match order, with an unconditional
section last as a fallback. Section rank controls presentation order. Use
the section key `Optional` to put matching local pages under the final
Optional heading without dropping their twins.

```js
tree: {
  sections: [
    { key: 'home', title: 'Home', rank: 0, match: '/' },
    { key: 'guide', title: 'Guides', rank: 1, match: /^\/guide(?:\/|$)/ },
    { key: 'products', title: 'Products', rank: 2, types: ['SoftwareApplication'] },
    { key: 'other', title: 'Other', rank: 3 },
  ],
  graph: {
    parents: ['isPartOf', 'parentOrganization', 'hasPart', 'creator', 'subjectOf'],
    context: { relations: ['mentions'], types: ['SoftwareApplication'], external: 'optional' },
  },
}
```

Associate a subject with its exported page through `mainEntityOfPage`, a
matching `url` or `@id`, or the page document's `mainEntity`. Graph relations
establish parents first, then a matching parent route, then the section.
Entities sort by `rank` (overridable with `rankProperty`), `position`, then
newest date (`datePublished`, `startDate`, or `dateCreated`). Contextual
references are opt-in by relation and type and never replace a local page
twin. Use `external: 'child'` for unlinked external context or `'omit'` to
hide it. Titles and descriptions use the page graph first and page-local
HTML as a fallback when a page has no suitable graph values.

Generate `llms.txt` and Markdown twins from an existing static HTML export. The
tool reads each page's main content, embedded JSON-LD, and HTML metadata. It
never crawls the site or fetches a separate JSON-LD dataset.

```sh
pnpm exec gen-llm-md generate --dir out --site-url https://example.com --exclude /preview
pnpm exec gen-llm-md generate --config ./llms.config.mjs --dry-run
```

Requires Node 22.12+. `--dir` defaults to `out`; paths are relative to the
working directory. `--exclude` is repeatable. A config is a synchronous JS
module exporting a config object. CLI flags override the directory and site
URL and add to the exclusions. Dry run lists the files without writing or
deleting them. Planned removals are prefixed with `delete`.

Flat and trailing-slash exports (for example, `guide.html` and
`guide/index.html`) both map to `guide.md`. The generator skips 404s,
redirects, and noindex pages (except legal pages), and resolves relative
content links against the page URL. Mark UI to omit with `data-llm-ignore`.
Content is taken from the main landmark, the first article, or the body,
in that order. Site headers, footers, and navigation are omitted, and
adjacent images with the same resolved source are emitted once.
ARIA tables convert to Markdown tables; presentation tables are flattened.
An explicit primary entity can supply page metadata. A named page retains
its own identity when the graph lists collection members or related topics.

## Library

```js
import { generate, flattenLayoutTables } from 'gen-llm-md';

const isIssue = ({ route }) => route.startsWith('/issues/');
const config = {
  outDir: 'out',
  siteUrl: 'https://example.com',
  exclude: ['/preview'],
  transforms: [
    { match: /^\/issues\//, apply: ({ $ }) => flattenLayoutTables($, '.issue-body table') },
  ],
  index: {
    sections: (pages) => [
      { title: 'Issues', pages: pages.filter(isIssue) },
      { title: 'Pages', pages: pages.filter((page) => !isIssue(page)) },
    ],
  },
};
await generate(config);
```

- `planGeneration(config)` returns the site identity, twins, and artifacts
  without changing the filesystem. `generate(config)` applies the plan.
  A planned removal has `remove: true` and the SHA-256 of the owned file
  instead of `contents`.
- Use `pageContent(page)` for a page whose Markdown body is available at build
  time but is not rendered in the HTML; return `{ body }` and optionally
  `title` or `description` to override the defaults. Parsed pages expose
  `html`, `$` (Cheerio), `jsonld`, `meta(name)`, the canonical `url`,
  and the exported HTML and Markdown paths.
- Use `nativeMarkdown()` to supply complete twins and their index metadata.
  A twin's `markdown` string or byte array is written as supplied, without
  normalization or content filtering. Providers must apply site policy to
  their native output themselves. `blockedHosts` applies to generated
  content.
- Import or override the individual pipeline stages: `discoverPages`,
  `parsePage`, `selectPageEntity`, `selectSiteIdentity`, `htmlToMarkdown`,
  `renderTwin`, `renderIndex`, `planManifest`, and `writeArtifacts`.
  Pass overrides under `pipeline`, or compose the functions independently.

## Curated tree mode (opt-in)

Add `tree` in `llms.config.mjs` and keep the same CLI build step. Sites
without `tree` keep the flat index and existing provider behavior. Do not
combine `tree` and `index.sections`.

```js
import { readPlacements } from 'gen-llm-md';

export default {
  siteUrl: 'https://example.com',
  outDir: 'out',
  tree: {
    sections: [{ key: 'work', title: 'Work', rank: 10, description: 'Tools and guides.' }],
    placements: readPlacements(new URL('./llms-placements.json', import.meta.url)),
    inferParents: ['isPartOf', 'hasPart', 'creator'],
    factFields: { SoftwareApplication: ['creator', 'datePublished', 'codeRepository'] },
    pages: [{
      match: '/guides',
      facts: false,
      collection: { selector: '[data-cards]', relation: 'itemListElement', durationSelector: '[data-duration]' },
    }],
  },
};
```

An example placement file:

```json
[
  { "key": "widget", "tier": "page", "route": "/widget", "parentKey": "work", "entityId": "https://example.com/#widget", "rank": 1 },
  { "key": "extension", "tier": "child", "parentKey": "widget", "title": "Extension", "summary": "Adds an export format." },
  { "key": "guides", "tier": "page", "route": "/guides", "parentKey": "work", "collection": true }
]
```

- `page` generates a twin from exported HTML. Use a page-scoped
  `entityId` or a unique same-route page whose `mainEntity` resolves;
  declare `collection: true` for a structural route without a subject.
  Set a reviewed `summary` or supply the subject's description. The site's
  default bio and unrelated HTML metadata are not fallbacks. The root
  may omit its parent. A route with a different HTML canonical is an HTML
  handoff rather than a duplicate twin.
- `child` emits one line under a retained parent, without a new file.
  Supply a `title` or scoped entity, and optionally a public contextual
  `href`. `optional` emits a line under the final Optional section and
  generates a twin only if it has a retained local HTML `route`.
  `omit`, noindex, redirects, exclusions and unspecified routes don't get twins.
- Sections and siblings sort by ascending `rank`, then title/key.
  Explicit `parentKey` takes precedence over the opt-in `inferParents`
  rules (listed in precedence order). Missing or ambiguous parents,
  duplicates and cycles fail before writing.
- Generated Markdown uses public main content and a canonical HTML
  `Source:` line. It includes short, non-repeated facts from the page's
  own inline JSON-LD by default; neither HTML nor standalone graph files
  are written. Disable facts with `tree.facts: false` or per route.
- `tree.pages` accepts the first matching string, regexp, or predicate.
  Set a built-in renderer (`default`, `entity`, `collection`) or custom
  function, override `facts`, or explicitly set `content: 'omit'` for
  an applicable metadata-only route. `tree.renderers` supplies defaults
  by Schema.org type. A collection rule turns a selected card region into
  a list, preserving visible order; configure title, duration,
  description and card selectors as needed. `hasPart` or
  `itemListElement` can provide labels and descriptions for visible links.
- Custom renderers and `hooks.transformMarkdown` get the body and a
  context with `page`, `subject`, and `twinHref(href)`. Use
  `hooks.filterEntities` to filter readable facts, not to change
  the source page or the graph.
- Body links to routes with emitted twins target the twins unless
  `tree.rewriteInternalLinks` is false. Links with query or fragment
  keep their HTML target. Code, image destinations and external links
  are not rewritten to twins. Exact-byte `nativeMarkdown` entries still
  bypass body processing; use `pageContent` for authored bodies you
  want to enrich or rewrite.
- `tree.canonicalMapFile` optionally writes a path-to-HTML-canonical map
  outside the export, for hosting. `planGeneration` returns
  `canonicalMap` without writing. The generator doesn't configure HTTP
  headers or deploy files.

Use `markdownSource` for native source files with route-to-file rules
and an optional custom frontmatter parser; use its `intro` option or
`formatMarkdownIntro` for bylines, dates, images, contextual text, and
links. `splitLeadingH1` separates a leading title from the body.

## Generated file ownership

The tool records its output in `out/.llms-markdown.json`. On a reused
export, generation deletes obsolete twins whose bytes still match that
manifest. Hand-written and edited Markdown is left alone. For deployments
that keep stale Markdown, pass `stale: { previousManifest: 'previous.json',
  unavailable: true }` and carry the last deployed manifest forward before
each clean build. If the output directory survives builds, the default
previous manifest is the one already in it. A removed route gets a notice
twin, not an index entry. Existing files not matching the previous
generated bytes are left alone. You can provide a function instead of
`true` to render a custom notice. Use `unavailable: retiredPageNotice(outDir, siteUrl)`
to link to the replacement HTML page when the retired route exports a
zero-delay meta refresh to another local page.

Generation refuses to overwrite an existing Markdown file unless the
current export manifest or the configured previous manifest records its
exact bytes.
On the first run over an older export without a manifest, rebuild into
a clean directory.
