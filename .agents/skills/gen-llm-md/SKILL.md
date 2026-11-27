---
name: gen-llm-md
description: Generate an LLM index and Markdown twins from a built static export; configure native Markdown and custom page rules.
---

# Generate Markdown twins

1. Build the site to a local static export, then run
   `pnpm exec gen-llm-md generate --dir out --site-url https://example.com --dry-run`.
2. Run without `--dry-run` to write the artifacts. Check the site identity in
   `out/llms.txt`, follow sample index links to local files, and check that
   excluded routes do not appear.
3. For a curated index, use `--config ./llms.config.mjs` with `tree.sections`
   and `tree.placements` (or load a JSON placement file with
   `readPlacements`). Set relevance as `page`, `child`, `optional`, or
   `omit`. Use a `pageContent` provider for authored Markdown
   (see `markdownSource`), or `nativeMarkdown` to preserve existing bytes.
   Configure collection regions with per-route rules. Facts come from
   the page's inline JSON-LD; no graph files are generated. Body links
   prefer existing twins, while the `Source:` link stays on HTML.
4. If deployment preserves removed Markdown files, persist the last export
   manifest (`--previous-manifest`) and enable unavailable notices. Never deploy with this tool;
   it only writes local artifacts.

See the [package reference](../../../packages/gen-llm-md/README.md).
