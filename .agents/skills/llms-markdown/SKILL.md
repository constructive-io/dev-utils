---
name: llms-markdown
description: Generate an LLM index and Markdown twins from a built static export; configure native Markdown and custom page rules.
---

# Generate Markdown twins

1. Build the site to a local static export, then run
   `pnpm exec llms-markdown generate --dir out --site-url https://example.com --dry-run`.
2. Run without `--dry-run` to write the artifacts. Check the site identity in
   `out/llms.txt`, follow sample index links to local files, and check that
   excluded routes do not appear.
3. For site rules, use `--config ./llms.config.mjs` or the programmable API.
   Use a body provider for client-only Markdown and a native twin provider
   when existing bytes must be preserved. Use route transforms for
   nonstandard page structure instead of changing the defaults.
4. If deployment preserves removed Markdown files, persist the last export
   manifest and enable unavailable notices. Never deploy with this tool;
   it only writes local artifacts.

See the [package reference](../../../packages/llms-markdown/README.md).
