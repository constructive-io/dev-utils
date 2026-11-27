import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sitePath, urlFor } from './entities';
import { discoverPages, type StaleOptions } from './files';
import { parsePage } from './html';
import { http, linkKey, markdownHref } from './navigation';
import { inline } from './render';

const unavailable = '# Page no longer available\n\nThis page is no longer part of the site.\n';

export function retiredPageNotice(defaultDir: string, defaultSiteUrl: string): Exclude<StaleOptions['unavailable'], boolean | undefined> {
  const inventories = new WeakMap<object, Map<string, ReturnType<typeof discoverPages>[number]>>();
  return ({ route }, options) => {
    const { outDir = defaultDir, siteUrl = defaultSiteUrl } = options ?? {};
    let exports = options && inventories.get(options);
    if (!exports) {
      exports = new Map(discoverPages(outDir).map((page) => [linkKey(sitePath(siteUrl, page.route)), page]));
      if (options) inventories.set(options, exports);
    }
    const key = linkKey(sitePath(siteUrl, route));
    const entry = exports.get(key);
    if (!entry) return unavailable;
    const source = sitePath(siteUrl, entry.route);

    let html: string;
    try {
      html = readFileSync(join(outDir, entry.htmlFile), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return unavailable;
      throw error;
    }
    const { $ } = parsePage(entry, html, siteUrl);
    const refresh = $('meta[http-equiv="refresh" i]').first().attr('content') ?? '';
    const address = /^\s*0\s*;\s*url\s*=\s*(.*?)\s*$/i.exec(refresh)?.[1];
    const target = urlFor(address?.replace(/^(["'])(.*)\1$/, '$2'), source);
    if (target && http(target) && linkKey(target) !== key && exports.has(linkKey(target))) {
      return `# Page moved\n\nMoved to [${inline(target.pathname)}](${markdownHref(target)}).\n`;
    }
    return `# Markdown copy no longer available\n\n[Read the current page](${markdownHref(source)}).\n`;
  };
}
