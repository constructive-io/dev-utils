import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';

import { awsEnvironment, SiteConfig } from './config';

const markdown = ['*.md', 'llms.txt'];
const globRegex = (pattern: string) => new RegExp(`^${pattern.split('*').map(
  part => part.replace(/[|\\{}()[\]^$+?.]/g, '\\$&'),
).join('.*')}$`);

function* exportKeys(root: string, prefix = ''): Generator<string> {
  for (const entry of readdirSync(resolve(root, prefix), { withFileTypes: true })) {
    const key = prefix + entry.name;
    if (entry.isDirectory()) yield* exportKeys(root, `${key}/`);
    else if (entry.isFile()) yield key;
    else throw new Error(`Unexpected non-regular file in site export: ${key}`);
  }
}

type Options = { directory: string; preserve?: string[] };
type ObjectKey = { Key: string };
type ObjectPage = { Contents?: ObjectKey[]; IsTruncated?: boolean; NextContinuationToken?: string };

export function deploy(config: SiteConfig, { directory, preserve = markdown }: Options) {
  const root = resolve(directory);
  const files = new Set(exportKeys(root));
  if (!files.has('index.html')) throw new Error(`Site export is missing ${directory}/index.html`);
  const aliases = new Map<string, string>();
  for (const key of files) {
    if (!key.endsWith('.html') || key === 'index.html') continue;
    const alias = key.endsWith('/index.html') ? key.slice(0, -'/index.html'.length) : key.slice(0, -'.html'.length);
    if (files.has(alias) || aliases.has(alias)) throw new Error(`Conflicting extensionless route: ${alias}`);
    aliases.set(alias, key);
  }

  const keep = preserve.map(globRegex);
  const { AWS_S3_BUCKET: bucket, AWS_CLOUDFRONT_DISTRIBUTION_ID: distribution, SITE_URL: url } = config;
  const s3 = `s3://${bucket}`;
  const environment = awsEnvironment(config);
  const exec = (command: string, args: string[], env?: NodeJS.ProcessEnv) => execFileSync(command, args, {
    env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 4 * 1024 * 1024,
  });
  const aws = (...args: string[]) => {
    const result = spawnSync('aws', args, { env: environment, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`AWS ${args.slice(0, 2).join(' ')} failed (${result.status ?? result.signal})`);
  };
  const awsJson = <T>(...args: string[]): T => JSON.parse(exec('aws', [...args, '--output', 'json'], environment));
  const invalidate = () => {
    const { Invalidation: { Id } } = awsJson<{ Invalidation: { Id: string } }>(
      'cloudfront', 'create-invalidation', '--distribution-id', distribution, '--paths', '/*',
    );
    aws('cloudfront', 'wait', 'invalidation-completed', '--distribution-id', distribution, '--id', Id);
  };

  const source = root.endsWith(sep) ? root : root + sep;
  aws('s3', 'sync', source, s3, ...markdown.flatMap(pattern => ['--exclude', pattern]));
  aws('s3', 'cp', source, s3, '--recursive', '--exclude', '*',
    ...markdown.flatMap(pattern => ['--include', pattern]), '--content-type', 'text/plain; charset=utf-8');
  for (const [alias, key] of aliases) aws('s3', 'cp', `${s3}/${key}`, `${s3}/${alias}`);
  invalidate();

  const response = exec('curl', ['--silent', '--show-error', '--max-time', '30', '--write-out', '\n%{http_code} %{content_type}', '--', url]);
  const separator = response.lastIndexOf('\n');
  const status = response.slice(separator + 1);
  if (!/^200 text\/html(?:;.*)?$/i.test(status) || !/<!doctype\s+html\b|<html\b/i.test(response.slice(0, separator))) {
    throw new Error(`Homepage health check did not return HTTP 200 with HTML (got ${status})`);
  }

  const stale: ObjectKey[] = [];
  const seen = new Set<string>();
  let token: string | undefined;
  do {
    const page: ObjectPage = awsJson('s3api', 'list-objects-v2', '--bucket', bucket, '--no-paginate',
      ...(token ? ['--continuation-token', token] : []));
    for (const { Key } of page.Contents ?? []) {
      if (!files.has(Key) && !aliases.has(Key) && !keep.some(pattern => pattern.test(Key))) stale.push({ Key });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && (!token || seen.has(token))) throw new Error('S3 object listing is incomplete');
    if (token) seen.add(token);
  } while (token);

  for (let offset = 0; offset < stale.length; offset += 20) {
    const { Errors } = awsJson<{ Errors?: unknown[] }>('s3api', 'delete-objects', '--bucket', bucket, '--delete',
      JSON.stringify({ Objects: stale.slice(offset, offset + 20) }));
    if (Errors?.length) throw new Error(`S3 object deletion failed: ${JSON.stringify(Errors)}`);
  }
  console.log(`Pruned ${stale.length} stale S3 objects`);
  if (stale.length) invalidate();
}
