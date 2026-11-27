import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sitePath, urlFor } from './entities';
import { discoverPages, type StaleOptions } from './files';
import { parsePage } from './html';
import { http, linkKey, markdownHref } from './navigation';
import { inline } from './render';

export function retiredPageNotice(outDir: string, siteUrl: string): Exclude<StaleOptions['unavailable'], boolean | undefined> {
  let exports: Map<string, ReturnType<typeof discoverPages>[number]> | undefined;
  return ({ route }) => {
    exports ??= new Map(discoverPages(outDir).map((page) => [linkKey(sitePath(siteUrl, page.route)), page]));
    const source = sitePath(siteUrl, route);
    const key = linkKey(source);
    const entry = exports.get(key);
    if (!entry) return '# Page no longer available\n\nThis page is no longer part of the site.\n';

    const { $ } = parsePage(entry, readFileSync(join(outDir, entry.htmlFile), 'utf8'), siteUrl);
    const refresh = $('meta[http-equiv="refresh" i]').first().attr('content') ?? '';
    const address = /^\s*0\s*;\s*url\s*=\s*(.*?)\s*$/i.exec(refresh)?.[1];
    const target = urlFor(address?.replace(/^(["'])(.*)\1$/, '$2'), source);
    if (target && http(target) && linkKey(target) !== key && exports.has(linkKey(target))) {
      return `# Page moved\n\nMoved to [${inline(target.pathname)}](${markdownHref(target)}).\n`;
    }
    return `# Markdown copy no longer available\n\n[Read the current page](${markdownHref(source)}).\n`;
  };
}
