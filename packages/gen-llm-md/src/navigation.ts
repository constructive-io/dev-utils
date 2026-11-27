import { getBuiltinModule } from 'node:process';

import { urlFor } from './entities';

export const routeKey = (path: string) => path.replace(/\/$/, '');
export const linkKey = (url: URL) => url.origin + routeKey(url.pathname);
export const http = (url: URL) => ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
export const markdownHref = (url: URL) => url.href.replace(/[()]/g, value => value === '(' ? '%28' : '%29');

export function twinLink(href: string, base: URL, files: ReadonlyMap<string, URL>): string {
  const url = urlFor(href, base);
  if (!url || !http(url) || /[?#]/.test(href)) return href;
  const twin = files.get(linkKey(url));
  return twin ? markdownHref(twin) : href;
}

let tokenizer: Promise<typeof import('micromark')> | undefined;

export async function rewriteMarkdownLinks(markdown: string, rewrite: (href: string) => string): Promise<string> {
  const { parse, postprocess, preprocess } = await (tokenizer ??= typeof __filename === 'string'
    ? Promise.resolve(getBuiltinModule('node:module')!.createRequire(__filename)('micromark') as typeof import('micromark'))
    : import('micromark'));
  const events = postprocess(parse().document().write(preprocess()(markdown, undefined, true)));
  const replacements = new Map<number, { end: number; value: string }>();
  const references: { image: boolean; label?: string; reference?: string; inline?: boolean }[] = [];
  const linkRefs = new Set<string>();
  const imageRefs = new Set<string>();
  const definitions: { label: string; begin: number; end: number; href: string }[] = [];
  let definitionLabel = '';
  const identifier = (value: string) => value.replace(/\s+/g, ' ').trim().toUpperCase();
  const replace = (begin: number, end: number, href: string) => {
    const value = rewrite(href);
    if (value !== href) replacements.set(begin, { end, value });
  };

  for (const [event, token] of events) {
    const { type, start: { offset: begin }, end: { offset: end } } = token;
    if (event === 'exit') {
      if (type === 'link' || type === 'image') {
        const ref = references.pop();
        if (ref && !ref.inline && ref.label) (ref.image ? imageRefs : linkRefs).add(identifier(ref.reference || ref.label));
      }
      continue;
    }
    if (type === 'link' || type === 'image') references.push({ image: type === 'image' });
    const ref = references.at(-1);
    const value = markdown.slice(begin, end);
    if (type === 'labelText' && ref) ref.label = value;
    if (type === 'referenceString' && ref) ref.reference = value;
    if (type === 'resource' && ref) ref.inline = true;
    if (type === 'resourceDestinationString' && ref && !ref.image) replace(begin, end, value);
    if (type === 'autolinkProtocol' && !ref?.image) replace(begin, end, value);
    if (type === 'definitionLabelString') definitionLabel = identifier(value);
    if (type === 'definitionDestinationString') definitions.push({ label: definitionLabel, begin, end, href: value });
  }
  for (const { label, begin, end, href } of definitions) {
    if (linkRefs.has(label) && !imageRefs.has(label)) replace(begin, end, href);
  }
  let result = markdown;
  for (const [begin, { end, value }] of [...replacements].sort(([a], [b]) => b - a)) {
    result = result.slice(0, begin) + value + result.slice(end);
  }
  return result;
}
