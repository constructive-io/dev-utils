const assert = require("node:assert/strict");
const fs = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join } = require("node:path");

const { generate, markdownSource, parsePage, planGeneration, readPlacements } = require("../dist");

const siteUrl = "https://example.com";
const id = (slug) => `${siteUrl}/#${slug}`;
const graph = (...nodes) => `<script type="application/ld+json">${JSON.stringify({ "@graph": nodes })}</script>`;
const entity = (slug, description, props = {}) => ({
  "@type": "SoftwareApplication", "@id": id(slug), name: slug, description, ...props,
});
const placement = (slug, props = {}) => ({
  key: slug, tier: "page", route: `/${slug}`, entityId: id(slug), parentKey: "work", ...props,
});
let dir;
let outDir;
const read = (file) => fs.readFileSync(join(outDir, file), "utf8");
const write = (file, html) => {
  const path = join(outDir, file);
  fs.mkdirSync(dirname(path), { recursive: true });
  fs.writeFileSync(path, html);
};
const page = (slug, nodes = [], body = "<p>Public main content.</p>", head = "") =>
  write(`${slug}.html`, `${head}${graph(...nodes)}<main><h1>${slug}</h1>${body}</main>`);
const config = (placements, tree = {}) => ({
  outDir, siteUrl,
  tree: {
    sections: [{ key: "work", title: "Products", rank: 4, description: "Primary tools." }],
    placements,
    ...tree,
  },
});

beforeEach(() => {
  dir = fs.mkdtempSync(join(tmpdir(), "gen-llm-md-tree-"));
  outDir = join(dir, "out");
  write("index.html", '<meta name="description" content="The default bio.">' + graph(
    { "@type": "WebSite", "@id": id("website"), url: siteUrl, name: "Acme", description: "The public bio." },
  ) + "<main><h1>Home</h1><p>Home content.</p></main>");
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test("derives public twins, graph parents and contextual entries without an entity list", async () => {
  const root = { "@id": id("widget"), "@type": "SoftwareApplication", name: "Widget",
    description: "The local widget.", mainEntityOfPage: siteUrl + "/widget",
    hasPart: [{ "@id": id("early") }, { "@id": id("late") }],
    mentions: [{ "@id": id("local") }, { "@id": id("external") }, { "@id": id("late") }] };
  const early = entity("early", "First release.", { mainEntityOfPage: siteUrl + "/first", datePublished: "2024-02-01" });
  const late = entity("late", "Latest release.", { mainEntityOfPage: siteUrl + "/second", datePublished: "2024-03-01" });
  const local = entity("local", "Supporting capability.");
  const external = entity("external", "External reference.", { url: "https://example.net/reference", rank: 1 });
  page("widget", [root, early, late, local, external], '<a href="/second">Current release</a>',
    '<link rel="canonical" href="https://upstream.example.net/widget?preview=true">');
  page("first", [early]);
  page("second", [late]);
  page("plain", [], "<p>Plain page.</p>");
  page("archive", [entity("Archive", "Historical reference.", {
    mainEntityOfPage: siteUrl + "/archive", isPartOf: { "@id": root["@id"] },
  })]);
  page("noindex", [entity("hidden", "Hidden.")], undefined, '<meta name="robots" content="noindex">');
  const result = await generate({
    outDir, siteUrl,
    blockedHosts: ["upstream.example.net"],
    tree: {
      sections: [
        { key: "home", title: "Home", rank: 0, match: "/" },
        { key: "Optional", title: "Optional", rank: 0, match: "/archive" },
        { key: "reference", title: "Reference", rank: 1, types: ["SoftwareApplication"] },
        { key: "other", title: "Other", rank: 2 },
      ],
      graph: { context: { relations: ["mentions"], types: ["SoftwareApplication"] } },
    },
  });
  const index = read("llms.txt");
  assert.match(index, /## Home\n\n- \[Home\]\(https:\/\/example\.com\/index\.md\)/);
  assert.match(index, /## Reference\n\n- \[Widget\].*\n  - \[late\].*\n  - \[early\].*\n  - local: Supporting capability\./);
  assert.match(index, /## Optional\n\n- \[external\]\(https:\/\/example\.net\/reference\)/);
  assert.equal(index.match(/## Optional/g).length, 1);
  assert.match(index.split("## Optional")[1], /\n- \[Archive\]\(https:\/\/example\.com\/archive\.md\)/);
  assert.match(read("archive.md"), /Source: https:\/\/example\.com\/archive\n/);
  assert.doesNotMatch(index, /upstream\.example\.net|noindex|hidden/);
  assert.match(read("widget.md"), /Source: https:\/\/example\.com\/widget\n/);
  assert.match(read("widget.md"), /\[Current release\]\(https:\/\/example\.com\/second\.md\)/);
  assert.deepEqual(result.twins.map(({ file }) => file).sort(), ["archive.md", "first.md", "index.md", "plain.md", "second.md", "widget.md"]);
});

test("matches JSON-LD documents and local targets under a site path prefix", async () => {
  const prefixed = siteUrl + "/docs/";
  const subject = entity("widget", "Product summary.", { mentions: [{ "@id": id("alias") }] });
  const alias = entity("alias", "Duplicate context.", { url: prefixed + "widget" });
  page("widget", [{ "@type": "WebPage", "@id": prefixed + "widget#page", mainEntity: { "@id": id("widget") } },
    subject, alias]);
  await generate({
    outDir, siteUrl: prefixed,
    tree: {
      sections: [
        { key: "products", title: "Products", rank: 0, types: ["SoftwareApplication"] },
        { key: "other", title: "Other", rank: 1 },
      ],
      graph: { context: { relations: ["mentions"], types: ["SoftwareApplication"] } },
    },
  });
  const index = read("llms.txt");
  assert.match(index, /## Products\n\n- \[widget\]\(https:\/\/example\.com\/docs\/widget\.md\): Product summary\./);
  assert.doesNotMatch(index, /Duplicate context/);
});

test("keeps untitled graph-mode pages using the graph name or route slug", async () => {
  write("catalog/named.html", graph(entity("Graph name", "Public item.", {
    mainEntityOfPage: siteUrl + "/catalog/named",
  })) + "<main><p>Known item.</p></main>");
  write("catalog/untitled.html", "<main><p>Entry without title metadata.</p></main>");
  await generate({
    outDir, siteUrl,
    tree: { sections: [{ key: "pages", title: "Pages", rank: 0 }], graph: {} },
  });
  assert.match(read("catalog/named.md"), /^# Graph name\n/);
  assert.match(read("catalog/untitled.md"), /^# untitled\n/);
  assert.match(read("llms.txt"), /\[untitled\]\(https:\/\/example\.com\/catalog\/untitled\.md\)/);
});

test("curates a ranked multilevel tree and does not generate twins for contextual, excluded, or unplaced routes", async () => {
  page("parent", [entity("parent", "Project overview.")]);
  page("item", [entity("item", "The useful project.", { isPartOf: { "@id": id("parent") } })]);
  page("extra", [entity("extra", "An extra resource.")]);
  page("cross", [entity("cross", "Read upstream.")], undefined, '<link rel="canonical" href="https://example.net/cross">');
  page("skip", [entity("skip", "A hidden item.")]);
  page("noindex", [], undefined, '<meta name="robots" content="noindex">');
  page("unplaced");
  const canonicalMapFile = join(dir, "canonical.json");
  const result = await generate(config([
    placement("extra", { tier: "optional", parentKey: undefined }),
    placement("item", { parentKey: undefined }),
    placement("parent", { rank: 1 }),
    placement("cross", { rank: 2 }),
    placement("skip", { tier: "omit" }),
    placement("noindex"),
    { key: "integration", tier: "child", parentKey: "item", title: "Integration", summary: "Supported protocol." },
    { key: "optional-note", tier: "optional", title: "Other documentation" },
    { key: "home", tier: "page", route: "/", title: "Start here" },
  ], { inferParents: ["isPartOf"], canonicalMapFile }));
  assert.equal(read("llms.txt"), `# Acme

> The public bio.

- [Start here](https://example.com/index.md)

## Products

Primary tools.

- [parent](https://example.com/parent.md): Project overview.
  - [item](https://example.com/item.md): The useful project.
    - Integration: Supported protocol.
- [cross](https://example.net/cross): Read upstream.

## Optional

- [extra](https://example.com/extra.md): An extra resource.
- Other documentation
`);
  assert.deepEqual(result.twins.map(({ file }) => file).sort(), ["extra.md", "index.md", "item.md", "parent.md"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(canonicalMapFile, "utf8")), {
    "/extra.md": "https://example.com/extra", "/item.md": "https://example.com/item",
    "/parent.md": "https://example.com/parent", "/index.md": "https://example.com/",
  });
  assert.ok(!result.artifacts.some(({ file }) => file.endsWith(".jsonld")));
  assert.ok(!fs.existsSync(join(outDir, "cross.md")));
  await generate(config([]));
  assert.ok(!fs.existsSync(join(outDir, "item.md")));
});

test("uses the page's own subject and direct facts only, rejects the site bio and supports route/type overrides", async () => {
  page("widget", [
    { "@type": "Person", "@id": id("person"), name: "Acme Builder", description: "A broad background bio." },
    { "@type": "Organization", "@id": id("org"), name: "Acme Labs", description: "Company description." },
    { "@type": "ImageObject", "@id": id("photo"), name: "Unneeded image" },
    entity("widget", "A scoped tool description.", {
      creator: { "@id": id("person") }, publisher: { "@id": id("org") }, image: { "@id": id("photo") },
      contributor: { "@type": "Role", roleName: "Maintainer" },
      startDate: "2025-01-01", codeRepository: "https://example.net/code",
    }),
  ], "<p>Started on 2025-01-01. See <a href='https://example.net/code'>the source</a>.</p>",
  '<meta name="description" content="The default bio.">');
  page("sparse", [entity("sparse")], undefined, '<meta name="description" content="The public bio.">');
  await assert.rejects(planGeneration(config([placement("sparse")])), /Missing page-specific description/);
  const treeConfig = config([placement("widget", { summary: "The default bio." })], {
    factFields: { SoftwareApplication: ["creator", "publisher", "contributor", "image", "startDate", "codeRepository"] },
    renderers: { SoftwareApplication: ({ body }) => `${body}\n\nType renderer.` },
    hooks: {
      filterEntities: (node) => node["@type"] !== "ImageObject",
      transformMarkdown: (body) => `${body}\n\nTransformed.`,
    },
  });
  await generate(treeConfig);
  assert.match(read("llms.txt"), /A scoped tool description\./);
  assert.match(read("widget.md"), /> Source: https:\/\/example\.com\/widget\n> Type: SoftwareApplication\n> Creator: Acme Builder\n> Publisher: Acme Labs/);
  assert.match(read("widget.md"), /> Contributor: Maintainer/);
  assert.doesNotMatch(read("widget.md"), /background bio|Company description|Unneeded image|> Start date:|> Repository:/);
  assert.match(read("widget.md"), /Type renderer\.\n\nTransformed\./);
  treeConfig.tree.pages = [{ match: "/widget", renderer: "entity", facts: false }];
  await generate(treeConfig);
  assert.doesNotMatch(read("widget.md"), /> Type:|Type renderer/);
  assert.match(read("widget.md"), /Transformed\./);
});

test("renders ordered visible cards and rewrites Markdown link destinations without changing code or images", async () => {
  const lesson = (slug, title, description) => ({ "@type": "LearningResource", "@id": id(slug), name: title, description, url: `${siteUrl}/${slug}` });
  page("course", [{
    "@type": "Course", "@id": id("course"), name: "Course", description: "A public course.",
    itemListElement: [{ item: { url: `${siteUrl}/second`, name: "Second", description: "Second detail." } },
      lesson("first", "First", "First detail."), lesson("hidden", "Ghost", "Do not render.")],
  }], `
    <p>Main introduction.</p><div data-cards>
      <a href="/first"><img alt="First" src="/light.png"><img alt="First" src="/dark.png"><span data-duration>8:00</span><p>First</p><em>Topic</em></a>
      <a href="/second"><span data-duration>5:30</span><p>Second</p></a>
    </div><p>More text.</p>`);
  page("first", [entity("first", "First substantive lesson.")]);
  page("second", [entity("second", "Second substantive lesson.")]);
  const conf = config([placement("course"), placement("first", { parentKey: "course" })], {
    pages: [{ match: "/course", renderer: "collection", collection: {
      selector: "[data-cards]", relation: "itemListElement", durationSelector: "[data-duration]",
    } }],
  });
  conf.pageContent = ({ route }) => route === "/first" ? { body: [
    '[Course](/course.html "title") [Reference][course] [Unretained](/second) [Anchor](#section)',
    "![Image](/course) [External](https://example.net/course) [Query](/course?chapter=2)",
    "`[Code](/course)`", "", "```md", "[Fenced](/course)", "```", "", "[course]: /course",
  ].join("\n") } : undefined;
  await generate(conf);
  const course = read("course.md").replace(/\\-/g, "-");
  assert.match(course, /Main introduction\./);
  assert.match(course, /^[*-] \[First\]\(https:\/\/example\.com\/first\.md\) — 8 min: First detail\./m);
  assert.match(course, /^[*-] \[Second\]\(https:\/\/example\.com\/second\) — 5 min 30 sec: Second detail\./m);
  assert.match(course, /More text\./);
  assert.ok(course.indexOf("[First]") < course.indexOf("[Second]"));
  assert.doesNotMatch(course, /dark\.png|light\.png|Ghost|8:00FirstTopic/);
  const first = read("first.md");
  assert.match(first, /\[Course\]\(https:\/\/example\.com\/course\.md "title"\)/);
  assert.match(first, /\[course\]: https:\/\/example\.com\/course\.md/);
  assert.match(first, /\[Anchor\]\(https:\/\/example\.com\/first#section\)/);
  assert.match(first, /\[Unretained\]\(https:\/\/example\.com\/second\)/);
  assert.match(first, /!\[Image\]\(\/course\)/);
  assert.match(first, /\[External\]\(https:\/\/example\.net\/course\)/);
  assert.match(first, /\[Query\]\(https:\/\/example\.com\/course\?chapter=2\)/);
  assert.match(first, /`\[Code\]\(\/course\)`/);
  assert.match(first, /\[Fenced\]\(\/course\)/);
  conf.tree.rewriteInternalLinks = false;
  await generate(conf);
  assert.match(read("course.md"), /\[First\]\(https:\/\/example\.com\/first\)/);
});

test("validates placement topology, scoped subjects, and non-public canonical metadata", async () => {
  page("a", [entity("a", "Description of a.")]);
  page("b", [entity("b", "Description of b.")]);
  await assert.rejects(planGeneration(config([placement("a", { parentKey: "b" }), placement("b", { parentKey: "a" })])), /cycle/);
  await assert.rejects(planGeneration(config([placement("a", { parentKey: "unknown" })])), /Unknown tree parent/);
  await assert.rejects(planGeneration(config([placement("a"), placement("a", { key: "also-a" })])), /Duplicate tree route/);
  await assert.rejects(planGeneration(config([placement("a", { entityId: id("b") })])), /Unknown page entity/);
  await assert.rejects(planGeneration({ ...config([]), index: { sections: () => [] } }), /cannot be used together/);
  await assert.rejects(generate(config([], { canonicalMapFile: join(outDir, "headers.json") })), /outside outDir/);
});

test("reads policy and native source through generic helpers and separates the original scripts", async () => {
  page("native", [entity("native", "Scope for native content.")], '<span data-llm-title>Custom title</span>');
  fs.writeFileSync(join(dir, "policy.json"), JSON.stringify([placement("native")]));
  fs.writeFileSync(join(dir, "lesson.md"), "# Duplicate title\n\nNative lesson.\n");
  const conf = config(readPlacements(join(dir, "policy.json")));
  conf.pageContent = markdownSource([{ match: "/native", file: () => "lesson.md", intro: () => ({
    byline: "By Acme", date: "2026-01-02", links: [{ href: "https://example.net/code", label: "Code" }],
  }) }], { root: dir, titleSelector: "[data-llm-title]" });
  await generate(conf);
  assert.match(read("native.md"), /# Custom title[\s\S]*By Acme · 2026-01-02[\s\S]*\[Code\][\s\S]*Native lesson\./);
  assert.doesNotMatch(read("native.md"), /Duplicate title/);
  const parsed = parsePage({ route: "/native", file: "native.md", htmlFile: "native.html" }, read("native.html"), siteUrl);
  parsed.jsonld = [];
  assert.equal(parsed.jsonldDocuments[0]["@graph"][0]["@id"], id("native"));
  assert.deepEqual(parsed.jsonld, []);
});

test("renders an explicitly metadata-only page twin", async () => {
  page("widget", [entity("widget", "Widget details.")]);
  await generate(config([placement("widget")], {
    pages: [{ match: "/widget", content: "omit" }],
  }));
  assert.match(read("widget.md"), /> Source: https:\/\/example\.com\/widget\n> Type: SoftwareApplication/);
  assert.doesNotMatch(read("widget.md"), /Public main content/);
});

test("retains twins when canonical HTML uses export filenames", async () => {
  for (const [file, slug] of [["guide.html", "guide"], ["help/index.html", "help"]]) {
    write(file, `<link rel="canonical" href="/${file}">` +
      graph(entity(slug, "Page-specific description.")) + "<main><p>Guide content.</p></main>");
  }
  const result = await generate(config([placement("guide"), placement("help")]));
  assert.deepEqual(result.twins.map(({ file }) => file), ["guide.md", "help.md"]);
  assert.match(read("guide.md"), /> Source: https:\/\/example\.com\/guide\.html/);
  assert.match(read("help.md"), /> Source: https:\/\/example\.com\/help\/index\.html/);
});

test("resolves fragment entity IDs on the pages that define them when inferring parents", async () => {
  page("parent", [entity("parent", "Parent details.", {
    "@id": "#project", hasPart: { "@id": "/inverse#project" },
  })]);
  page("direct", [entity("direct", "Direct child.", {
    "@id": "#project", isPartOf: { "@id": "/parent#project" },
  })]);
  page("inverse", [entity("inverse", "Inverse child.", { "@id": "#project" })]);
  await generate(config([
    placement("parent", { entityId: "#project" }),
    placement("direct", { entityId: "#project", parentKey: undefined }),
    placement("inverse", { entityId: "#project", parentKey: undefined }),
  ], { inferParents: ["isPartOf", "hasPart"] }));
  assert.match(read("llms.txt"), /parent\.md\): Parent details\.\n  - .*direct\.md\).*\n  - .*inverse\.md\)/);
});

test("falls back to body content when the export has no main or article", async () => {
  write("plain.html", graph(entity("plain", "Plain page description.")) +
    "<body><h1>plain</h1><p>Public body content.</p><aside data-llm-ignore>Private chrome.</aside></body>");
  await generate(config([placement("plain")]));
  assert.match(read("plain.md"), /Public body content\./);
  assert.doesNotMatch(read("plain.md"), /Private chrome|## plain/);
});

test("keeps card facts distinct for two anchors on the same page", async () => {
  page("guide", [entity("guide", "Guide description.", {
    hasPart: [
      { "@type": "LearningResource", url: "/guide#first", name: "First topic", description: "First details." },
      { "@type": "LearningResource", url: "/guide#second", name: "Second topic", description: "Second details." },
    ],
  })], '<div data-cards><a href="#first">Read more</a><a href="#second">Read more</a></div>');
  await generate(config([placement("guide")], {
    pages: [{ match: "/guide", collection: { selector: "[data-cards]", relation: "hasPart" } }],
  }));
  assert.match(read("guide.md"), /\[First topic\]\(https:\/\/example\.com\/guide#first\): First details\./);
  assert.match(read("guide.md"), /\[Second topic\]\(https:\/\/example\.com\/guide#second\): Second details\./);
});
