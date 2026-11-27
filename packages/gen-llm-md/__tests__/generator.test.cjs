const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join, resolve } = require("node:path");

const { flattenLayoutTables, generate, manifestFile, planGeneration, retiredPageNotice, writeArtifacts } = require("../dist");

const siteUrl = "https://example.com";
let outDir;
const read = (file) => fs.readFileSync(join(outDir, file), "utf8");
const write = (file, html) => {
  const path = join(outDir, file);
  fs.mkdirSync(dirname(path), { recursive: true });
  fs.writeFileSync(path, html);
};
const graph = (...nodes) => `<script type="application/ld+json">${JSON.stringify({ "@graph": nodes })}</script>`;

beforeEach(() => {
  outDir = fs.mkdtempSync(join(tmpdir(), "gen-llm-md-"));
  write("index.html", "<main><h1>Home</h1></main>");
});
afterEach(() => fs.rmSync(outDir, { recursive: true, force: true }));

test("refuses symlinked artifact files and parent directories before writing", () => {
  const outside = fs.mkdtempSync(join(tmpdir(), "llms-outside-"));
  try {
    const protectedFile = join(outside, "protected.md");
    fs.writeFileSync(protectedFile, "untouched");
    fs.symlinkSync(protectedFile, join(outDir, "leaf.md"));
    fs.symlinkSync(outside, join(outDir, "nested"), "dir");
    for (const file of ["leaf.md", "nested/protected.md"]) {
      assert.throws(() => writeArtifacts(outDir, [{ file, contents: "overwrite" }]), /artifact symlink/);
    }
    assert.equal(fs.readFileSync(protectedFile, "utf8"), "untouched");
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("uses canonical site and page identities, preserves the body, and indexes trailing-slash exports", async () => {
  write("index.html", graph(
    { "@type": "WebSite", "@id": "#website:project", name: "Unrelated site" },
    { "@type": "WebSite", "@id": "#website", url: siteUrl, mainEntity: { "@id": "#person" } },
    { "@type": "Person", "@id": "#person", name: "Example", description: "Canonical summary" },
    { "@type": "WebPage", "@id": "#home", name: "Home page", about: { "@id": "#news" }, mainEntity: [{ "@id": "#news" }] },
    { "@type": "Event", "@id": "#news", name: "News event" }
  ) + "<main><h1>Home</h1></main>");
  for (const [slug, relationship] of [["main", "mainEntity"], ["about", "about"]]) {
    write(`example/${slug}/index.html`, graph(
      { "@type": "WebPage", "@id": `/example/${slug}/#webpage`, [relationship]: { "@id": `/#${slug}` } },
      { "@type": "Article", "@id": `/#${slug}`, headline: "Example article" }
    ) + '<meta name="description" content="HTML summary"><main><h1>Other title</h1><button>Read this <strong>first</strong></button><a href="../">more</a><a href="https://old.example.com">old</a></main>');
  }
  write("preview.html", "<main><h1>Preview</h1></main>");
  write("listing.html", graph(
    { "@type": "CollectionPage", "@id": "/listing#page", name: "All events", mainEntity: [{ "@id": "#one" }, { "@id": "#two" }] },
    { "@type": "Event", "@id": "#one", name: "First event" },
    { "@type": "Event", "@id": "#two", name: "Second event" }
  ) + "<main>Listing</main>");
  write("redirect.html", '<meta http-equiv="refresh" content="0; url=/"><main>Redirect</main>');
  write("404.html", "<main>Missing</main>");
  const config = { outDir, siteUrl, exclude: ["/preview"], blockedHosts: ["old.example.com"] };
  const { twins } = await generate(config);
  assert.deepEqual(twins.map((twin) => twin.file), ["index.md", "example/about.md", "example/main.md", "listing.md"]);
  assert.match(read("llms.txt"), /^# Example\n\n> Canonical summary/);
  assert.match(read("index.md"), /^# Home page\n/);
  assert.match(read("listing.md"), /^# All events\n/);
  assert.match(read("llms.txt"), /\[Example article \(\/example\/main\/\)\]/);
  assert.match(read("example/main.md"), /^# Example article\n\n> HTML summary/);
  assert.match(read("example/main.md"), /Read this \*\*first\*\*/);
  assert.doesNotMatch(read("example/main.md"), /old\.example\.com/);
  assert.match(read("example/about.md"), /\[more\]\(https:\/\/example\.com\/example\/\)/);
});

test("supports native bytes, body providers, route transforms, and custom sections in a dry run", async () => {
  const native = Buffer.from("# Native\r\n\r\nBody  \r\n");
  write("native.html", "<main>Should not appear</main>");
  write("client.html", "<main><h1>Client</h1></main>");
  write("issues/one.html", `<main><h1>Issue</h1>
    <table><tr><td>•</td><td><b>Story</b></td></tr></table>
    <h6>&nbsp;</h6><h6><mark>&nbsp;IN THIS ISSUE&nbsp;</mark></h6>
    <div role="grid"><div role="rowgroup">
      <div role="row"><div role="columnheader">Date</div><div role="columnheader">Score</div></div>
      <div role="row"><div role="rowheader">June</div><div role="gridcell" aria-label="42"></div></div>
    </div></div><article><h3>Event</h3><time>Monday</time><p>Details</p></article>
    </main>`);
  const config = {
    outDir, siteUrl,
    nativeMarkdown: () => [{ title: "Native", route: "/native", file: "native.md", markdown: native }],
    pageContent: ({ route }) => route === "/client" ? { body: "Client-only source" } : undefined,
    transforms: [{ match: /^\/issues\//, apply: ({ $ }) => flattenLayoutTables($, "main table") }],
    index: { sections: (pages) => [{ title: "Custom", pages }] },
  };
  const plan = await planGeneration(config);
  assert.equal(fs.existsSync(join(outDir, "llms.txt")), false);
  assert(plan.artifacts.some(({ file }) => file === "native.md"));
  await generate(config);
  assert.deepEqual(fs.readFileSync(join(outDir, "native.md")), native);
  assert.match(read("client.md"), /Client-only source/);
  assert.match(read("llms.txt"), /^## Custom$/m);
  const issue = read("issues/one.md");
  assert.match(issue, /^\* \*\*Story\*\*$/m);
  assert.match(issue, /^###### IN THIS ISSUE$/m);
  assert.doesNotMatch(issue, /^#+\s*$/m);
  assert.match(issue, /\| Date\s+\| Score\s+\|/);
  assert.match(issue, /\| June\s+\| 42\s+\|/);
  assert.match(issue, /### Event\s+Monday\s+Details/);
});

test("collapses adjacent card images with the same normalized URL", async () => {
  write("cards.html", `<main><h1>Cards</h1>
    <a href="/story">
      <img class="block dark:hidden" src="/card.png" alt="Card">
      <!-- dark mode --><img class="hidden dark:block" src="https://example.com/card.png" alt="Card">
      <picture><source media="(min-width: 600px)" srcset="/wide.png"><img src="./card.png" alt="Card"></picture>
      <noscript><img src="/card.png" alt="Card"></noscript>
      <img src="/different.png" alt="Other">
    </a>
    <p>Separate placement</p><img src="/card.png" alt="Card">
  </main>`);
  await generate({ outDir, siteUrl });
  const markdown = read("cards.md");
  assert.equal(markdown.match(/!\[Card\]\(https:\/\/example\.com\/card\.png\)/g)?.length, 2);
  assert.match(markdown, /\[\s*!\[Card\]\(https:\/\/example\.com\/card\.png\)\s*!\[Other\]\(https:\/\/example\.com\/different\.png\)\s*\]\(https:\/\/example\.com\/story\)/);
});

test.each([true, false])("strips page chrome while keeping article structure (main: %s)", async withMain => {
  const body = `<div><header><h1>Site Header</h1><a href="/news">Site News</a></header></div>
    <div role="banner">Site banner</div>
    <div role="navigation">Menu landmark</div><nav>Site navigation</nav>
    <h1>Guide</h1><p>Page content.</p>
    <section><header><h2>Section heading</h2></header><p>Section content.</p><footer>Section credits</footer></section>
    <div role="contentinfo">Site info landmark</div><footer>Site footer</footer>`;
  write("guide.html", withMain ? `<main>${body}</main>` : `<body><div>${body}</div></body>`);
  await generate({ outDir, siteUrl });
  const markdown = read("guide.md");
  assert.match(markdown, /^# Guide/);
  assert.match(markdown, /Page content\./);
  assert.match(markdown, /Section heading/);
  assert.match(markdown, /Section credits/);
  assert.doesNotMatch(markdown, /Site Header|Site News|Site banner|Menu landmark|Site navigation|Site info landmark|Site footer/);
});

test("keeps editorial headers inside main", async () => {
  write("guide.html", '<main><header><h1>Guide</h1><p>Intro text.</p></header><p>Body text.</p></main>');
  await generate({ outDir, siteUrl });
  assert.match(read("guide.md"), /^# Guide\n/);
  assert.match(read("guide.md"), /Intro text\./);
});

test.each([
  '<h1>Site name</h1><nav><a href="/news">News</a></nav>',
  '<h1><a href="/">Site name</a></h1><a href="/news">News</a>',
])("strips branded headers inside main (%s)", async header => {
  write("guide.html", `<main><header>${header}</header><header><h1>Guide</h1><p>Intro text.</p></header></main>`);
  await generate({ outDir, siteUrl });
  const markdown = read("guide.md");
  assert.match(markdown, /^# Guide\n/);
  assert.match(markdown, /Intro text\./);
  assert.doesNotMatch(markdown, /Site name|News/);
});

test("keeps the sole page heading in an editorial header with a table of contents", async () => {
  write("guide.html", '<div role="main"><header><h1>Guide</h1><p>Intro text.</p><nav><a href="#details">Details</a></nav></header><h2 id="details">Page details</h2></div>');
  await generate({ outDir, siteUrl });
  assert.match(read("guide.md"), /^# Guide\n/);
  assert.match(read("guide.md"), /Intro text\./);
});

test("honors data-llm-ignore on a content root", async () => {
  write("ignored-body.html", '<body data-llm-ignore><main><h1>Ignored body</h1></main></body>');
  write("ignored-article.html", '<article data-llm-ignore><h1>Ignored article</h1></article><p>Visible content.</p>');
  await generate({ outDir, siteUrl });
  assert.equal(fs.existsSync(join(outDir, "ignored-body.md")), false);
  assert.match(read("ignored-article.md"), /Visible content\./);
  assert.doesNotMatch(read("ignored-article.md"), /Ignored article/);
});

test("keeps the labelled copy of an adjacent duplicate image", async () => {
  write("cards.html", '<main><h1>Cards</h1><img src="/card.png" alt=""><img src="/card.png" alt="Card"></main>');
  await generate({ outDir, siteUrl });
  assert.match(read("cards.md"), /!\[Card\]\(https:\/\/example\.com\/card\.png\)/);
  assert.doesNotMatch(read("cards.md"), /!\[\]\(/);
});

test("only replaces stale twins generated by the tool and keeps notices out of the index", async () => {
  write("removed.html", "<main><h1>Old</h1></main>");
  write("reserved.html", "<main><h1>Reserved</h1></main>");
  const config = { outDir, siteUrl, stale: { unavailable: true } };
  await generate(config);
  fs.unlinkSync(join(outDir, "removed.html"));
  fs.unlinkSync(join(outDir, "reserved.html"));
  write("reserved.md", "Intentional existing notice");
  await generate(config);
  assert.match(read("removed.md"), /no longer available/);
  assert.equal(read("reserved.md"), "Intentional existing notice");
  assert.doesNotMatch(read("llms.txt"), /removed\.md/);
  assert(JSON.parse(read(manifestFile)).twins.some(({ file, unavailable }) => file === "removed.md" && unavailable));
});

test("regenerates a twin after its exclusion is lifted", async () => {
  const config = { outDir, siteUrl };
  write("guide.html", "<main><h1>Original guide</h1></main>");
  await generate(config);
  await generate({ ...config, exclude: ["/guide"] });
  assert.equal(fs.existsSync(join(outDir, "guide.md")), false);
  assert.doesNotMatch(read("llms.txt"), /guide\.md/);
  write("guide.html", "<main><h1>Updated guide</h1></main>");
  await generate(config);
  assert.match(read("guide.md"), /^# Updated guide/);
  assert.match(read("llms.txt"), /guide\.md/);
});

test.each(["noindex", "redirect", "404", "excluded", "removed"])(
  "deletes obsolete manifest-owned twins on a reused export (%s)",
  async (reason) => {
    const config = { outDir, siteUrl };
    write("guide/index.html", "<main><h1>Original guide</h1></main>");
    write("edited.html", "<main><h1>Edited guide</h1></main>");
    await generate(config);
    fs.unlinkSync(join(outDir, "edited.html"));
    write("edited.md", "Hand-edited guide");
    write("manual.md", "Hand-written guide");
    if (reason === "noindex") {
      write("guide/index.html", '<meta name="robots" content="noindex"><main>Private copy</main>');
    } else if (reason === "redirect") {
      write("guide/index.html", '<meta http-equiv="refresh" content="0; url=/">');
    } else if (reason === "404") {
      fs.renameSync(join(outDir, "guide"), join(outDir, "404"));
    } else if (reason === "excluded") {
      config.exclude = ["/guide/"];
    } else {
      fs.unlinkSync(join(outDir, "guide/index.html"));
    }
    const manifest = read(manifestFile);
    const { artifacts } = await planGeneration(config);
    assert(artifacts.some(({ file, remove }) => file === "guide.md" && remove));
    if (reason === "noindex") {
      const cli = resolve(__dirname, "../dist/cli.js");
      const dryRun = spawnSync(process.execPath, [cli, "generate", "--dir", outDir, "--site-url", siteUrl, "--dry-run"], { encoding: "utf8" });
      assert.equal(dryRun.status, 0, dryRun.stderr);
      assert.match(dryRun.stdout, /^delete guide\.md$/m);
    }
    assert.match(read("guide.md"), /Original guide/);
    assert.equal(read(manifestFile), manifest);
    await generate(config);
    assert.equal(fs.existsSync(join(outDir, "guide.md")), false);
    assert.equal(read("edited.md"), "Hand-edited guide");
    assert.equal(read("manual.md"), "Hand-written guide");
    assert.doesNotMatch(read("llms.txt"), /guide\.md/);
    assert.deepEqual(JSON.parse(read(manifestFile)).twins.map(({ file }) => file), ["index.md"]);
  }
);

test("writes an unavailable notice when a reused page becomes noindex and notices are enabled", async () => {
  const config = { outDir, siteUrl };
  write("guide.html", "<main><h1>Original guide</h1></main>");
  await generate(config);
  write("guide.html", '<meta name="robots" content="noindex"><main>Private copy</main>');
  await generate({ ...config, stale: { unavailable: true } });
  assert.match(read("guide.md"), /no longer available/);
  assert.doesNotMatch(read("llms.txt"), /guide\.md/);
  assert(JSON.parse(read(manifestFile)).twins.some(({ file, unavailable }) => file === "guide.md" && unavailable));
});

test("points retired Markdown at a local HTML refresh destination", async () => {
  const config = { outDir, siteUrl: siteUrl + "/docs" };
  write("guide.html", "<main><h1>Original guide</h1></main>");
  write("manual.html", "<main><h1>Original manual</h1></main>");
  await generate(config);
  const noindex = '<meta name="robots" content="noindex">';
  write("guide.html", noindex + '<meta http-equiv="refresh" content="0; url=/docs/reference">');
  write("manual.html", noindex + '<meta http-equiv="refresh" content="0; url=https://elsewhere.example/reference">');
  write("reference.html", "<main><h1>Reference</h1></main>");
  await generate({ ...config, stale: { unavailable: retiredPageNotice(outDir, config.siteUrl) } });
  assert.match(read("guide.md"), /Moved to \[\/docs\/reference\]\(https:\/\/example\.com\/docs\/reference\)/);
  assert.match(read("manual.md"), /Markdown copy no longer available/);
  assert.doesNotMatch(read("llms.txt"), /guide\.md|manual\.md/);
});

test("refuses planned deletions after the target is edited or replaced by a symlink", async () => {
  const config = { outDir, siteUrl };
  write("guide.html", "<main><h1>Original guide</h1></main>");
  await generate(config);
  const original = read("guide.md");
  const manifest = read(manifestFile);
  fs.unlinkSync(join(outDir, "guide.html"));
  const { artifacts } = await planGeneration(config);
  write("guide.md", "Hand-edited guide");
  assert.throws(() => writeArtifacts(outDir, artifacts), /Refusing to delete unowned Markdown/);
  assert.equal(read("guide.md"), "Hand-edited guide");
  fs.renameSync(join(outDir, "guide.md"), join(outDir, "manual.md"));
  write("protected.md", original);
  fs.symlinkSync(join(outDir, "protected.md"), join(outDir, "guide.md"));
  assert.throws(() => writeArtifacts(outDir, artifacts), /artifact symlink/);
  assert(fs.lstatSync(join(outDir, "guide.md")).isSymbolicLink());
  assert.equal(read("protected.md"), original);
  assert.equal(read(manifestFile), manifest);
});

test("can retry generation after deleting a stale twin fails", async () => {
  const config = { outDir, siteUrl };
  write("guide.html", "<main><h1>Original guide</h1></main>");
  write("removed.html", "<main><h1>Old article</h1></main>");
  await generate(config);
  fs.unlinkSync(join(outDir, "removed.html"));
  write("guide.html", "<main><h1>Updated guide</h1></main>");
  const failure = Object.assign(new Error("Permission denied while removing stale twin"), { code: "EACCES" });
  const unlink = jest.spyOn(fs, "unlinkSync").mockImplementationOnce(() => { throw failure; });
  try {
    await assert.rejects(generate(config), { code: "EACCES" });
    assert.match(read("guide.md"), /^# Original guide/);
    assert.match(read("removed.md"), /^# Old article/);
  } finally {
    unlink.mockRestore();
  }
  await generate(config);
  assert.match(read("guide.md"), /^# Updated guide/);
  assert.equal(fs.existsSync(join(outDir, "removed.md")), false);
  assert(!JSON.parse(read(manifestFile)).twins.some(({ file }) => file === "removed.md"));
});

test("uses the configured previous manifest to verify a retained twin before replacing it", async () => {
  const config = { outDir, siteUrl };
  write("guide.html", "<main><h1>Original guide</h1></main>");
  await generate(config);
  const original = read("guide.md");
  write("previous.json", read(manifestFile));
  write("guide.html", "<main><h1>Updated guide</h1></main>");
  await generate(config);
  write("guide.md", original);
  fs.unlinkSync(join(outDir, "guide.html"));
  await generate({ ...config, stale: { previousManifest: join(outDir, "previous.json"), unavailable: true } });
  assert.match(read("guide.md"), /no longer available/);
  assert.doesNotMatch(read("llms.txt"), /guide\.md/);
});

test("does not overwrite Markdown without matching ownership in the export manifest", async () => {
  const config = { outDir, siteUrl };
  write("guide.html", "<main><h1>Guide</h1></main>");
  write("guide.md", "Hand-written guide");
  await assert.rejects(generate(config), /unowned Markdown: guide\.md/);
  assert.equal(read("guide.md"), "Hand-written guide");
  assert.equal(fs.existsSync(join(outDir, "index.md")), false);
  fs.unlinkSync(join(outDir, "guide.md"));
  await generate(config);
  write("guide.html", "<main><h1>New guide</h1></main>");
  await generate(config);
  assert.match(read("guide.md"), /^# New guide/);
  write("guide.md", "Manually replaced");
  await assert.rejects(generate(config), /unowned Markdown: guide\.md/);
  assert.equal(read("guide.md"), "Manually replaced");
});

test.each(["guide.MD", "guide.markdown", "guide.mdown"])(
  "keeps the manifest usable across runs for a native twin named %s",
  async (file) => {
    const config = {
      outDir, siteUrl,
      nativeMarkdown: () => [{ route: "/guide", file, title: "Guide", markdown: "# Guide" }],
    };
    await generate(config);
    await generate(config);
    assert.equal(read(file), "# Guide");
    await generate({ outDir, siteUrl, stale: { unavailable: true } });
    assert.match(read(file), /no longer available/);
    assert(!read("llms.txt").includes(file));
  }
);

test("does not overwrite handwritten .markdown files", async () => {
  const file = "guide.markdown";
  write(file, "Hand-written guide");
  await assert.rejects(generate({
    outDir, siteUrl,
    nativeMarkdown: () => [{ route: "/guide", file, title: "Guide", markdown: "# Generated guide" }],
  }), /unowned Markdown: guide\.markdown/);
  assert.equal(read(file), "Hand-written guide");
});

test("protects hand-edited native twins even with a custom file extension", async () => {
  const file = "guide.mdown";
  const config = {
    outDir, siteUrl,
    nativeMarkdown: () => [{ route: "/guide", file, title: "Guide", markdown: "# Guide" }],
  };
  await generate(config);
  write(file, "Hand-edited guide");
  const { artifacts } = await planGeneration(config);
  assert.throws(() => writeArtifacts(outDir, artifacts), /unowned Markdown: guide\.mdown/);
  assert.equal(read(file), "Hand-edited guide");
});

test("ships the gen-llm-md binary and names it in the CLI help", () => {
  const { name, bin } = require("../dist/package.json");
  assert.equal(name, "gen-llm-md");
  assert.equal(bin[name], "cli.js");
  const help = spawnSync(process.execPath, [resolve(__dirname, "../dist", bin[name]), "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /^Usage: gen-llm-md generate /);
});

test("CLI loads an ESM config and dry-run never writes artifacts", () => {
  write("llms.config.mjs", `export default { siteUrl: "${siteUrl}", outDir: ".", pageContent: () => ({ title: "Configured" }) };`);
  const cli = resolve(__dirname, "../dist/cli.js");
  const args = [cli, "generate", "--config", "./llms.config.mjs"];
  const run = (flags) => spawnSync(process.execPath, [...args, ...flags], { encoding: "utf8", cwd: outDir });
  const preview = run(["--dry-run"]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /^llms\.txt$/m);
  assert.equal(fs.existsSync(join(outDir, "llms.txt")), false);
  const full = run([]);
  assert.equal(full.status, 0, full.stderr);
  assert.match(read("index.md"), /^# Configured\n/);
});

test.each(["https://example.com/project/", "https://example.com/project"])(
  "keeps the site path prefix in the index and Markdown sources for %s",
  async (base) => {
    write("guides/topic/index.html", '<main><h1>Topic</h1><a href="../">Guides</a></main>');
    await generate({ outDir, siteUrl: base });
    assert.match(read("llms.txt"), /https:\/\/example\.com\/project\/guides\/topic\.md/);
    assert.match(read("index.md"), /> Source: https:\/\/example\.com\/project\/\n/);
    const twin = read("guides/topic.md");
    assert.match(twin, /> Source: https:\/\/example\.com\/project\/guides\/topic\/\n/);
    assert.match(twin, /\[Guides\]\(https:\/\/example\.com\/project\/guides\/\)/);
  }
);

test("keeps paths with a colon relative to the site URL", async () => {
  write("Help:Contents.html", "<main><h1>Help</h1></main>");
  await generate({ outDir, siteUrl: `${siteUrl}/project/` });
  assert.match(read("llms.txt"), /\[Help\]\(https:\/\/example\.com\/project\/Help:Contents\.md\)/);
  assert.match(read("Help:Contents.md"), /> Source: https:\/\/example\.com\/project\/Help:Contents\n/);
});

test("uses the directory index when a flat export shares its public route", async () => {
  write("guide.html", "<main><h1>Flat guide</h1></main>");
  write("guide/index.html", "<main><h1>Directory guide</h1></main>");
  const { twins } = await generate({ outDir, siteUrl });
  assert.deepEqual(twins.map(({ file }) => file), ["index.md", "guide.md"]);
  assert.match(read("guide.md"), /^# Directory guide\n/);
  assert.match(read("guide.md"), /> Source: https:\/\/example\.com\/guide\/\n/);
});

test("does not parse JSON-LD on redirects or noindex pages", async () => {
  const malformed = '<script type="application/ld+json">{</script><main>Body</main>';
  write("redirect.html", '<meta http-equiv="refresh" content="0; url=/">' + malformed);
  write("hidden.html", '<meta name="robots" content="noindex">' + malformed);
  const { twins } = await generate({ outDir, siteUrl });
  assert.deepEqual(twins.map(({ file }) => file), ["index.md"]);
  write("visible.html", malformed);
  await assert.rejects(planGeneration({ outDir, siteUrl }), /Invalid JSON-LD in visible\.html/);
});

test("allows a route transform to replace parsed JSON-LD", async () => {
  const url = `${siteUrl}/guide`;
  write("guide.html", graph({ "@type": "WebPage", url, name: "Original title" }) + "<main><p>Guide</p></main>");
  await generate({
    outDir, siteUrl,
    transforms: [{ match: "/guide", apply(page) {
      "use strict";
      page.jsonld = [{ "@type": "WebPage", url, name: "Replacement title" }];
    } }],
  });
  assert.match(read("guide.md"), /^# Replacement title\n/);
});
