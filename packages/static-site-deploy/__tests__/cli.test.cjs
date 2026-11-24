const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, delimiter } = require('node:path');

const cli = resolve(__dirname, '../dist/cli.js');
const site = 'example-org/example-site';
const targets = {
  AWS_REGION: 'us-east-1',
  AWS_S3_BUCKET: 'example-site-bucket',
  AWS_CLOUDFRONT_DISTRIBUTION_ID: 'EXAMPLE123',
  SITE_URL: 'https://example.test/',
  AWS_PROFILE: 'example-local',
};

const tempDirectories = [];
afterEach(() => {
  for (const cwd of tempDirectories.splice(0)) rmSync(cwd, { recursive: true, force: true });
});

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'static-site-deploy-'));
  tempDirectories.push(cwd);
  const env = {
    APPSTASH_BASE_DIR: cwd,
    PATH: [cwd, process.env.PATH].join(delimiter),
    CALLS: join(cwd, 'calls.log'),
  };
  const cliRun = (args, extra = {}) => spawnSync(process.execPath, [cli, ...args], {
    cwd, env: { ...env, ...extra }, encoding: 'utf8',
  });
  const mock = (name, body) => writeFileSync(join(cwd, name), '#!/usr/bin/env node\n' + body, { mode: 0o755 });
  return { cwd, env, cliRun, mock, calls: () => readFileSync(env.CALLS, 'utf8').trim().split('\n').map(JSON.parse) };
}

test('setup stores only targets and profile for the selected site; env overrides the stash', () => {
  const { cliRun, cwd } = fixture();
  const setup = cliRun(['setup', '--site', site, '--yes'], { ...targets, FAKE_SECRET: 'not-for-the-store' });
  assert.equal(setup.status, 0, setup.stderr);
  const local = cliRun(['check', '--site', site]);
  assert.equal(local.status, 0, local.stderr);
  const invalid = cliRun(['check', '--site', site], { AWS_S3_BUCKET: 's3://not-a-bucket-name' });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /AWS_S3_BUCKET/);
  const unrelated = cliRun(['check', '--site', 'example-org/other-site']);
  assert.notEqual(unrelated.status, 0);
  const ci = cliRun(['check', '--site', site], { CI: 'true' });
  assert.notEqual(ci.status, 0);
  assert.match(ci.stderr, /AWS_REGION/);
  const file = readFileSync(join(cwd, '.static-site-deploy', 'config', 'vars', 'example-org%2Fexample-site.json'), 'utf8');
  assert.doesNotMatch(file, /FAKE_SECRET|not-for-the-store/);
});

function fakeDeploy() {
  const fixtureState = fixture();
  const { cwd, mock } = fixtureState;
  mkdirSync(join(cwd, 'out', 'new-page'), { recursive: true });
  for (const key of ['index.html', 'new-page/index.html', 'asset.js']) {
    writeFileSync(join(cwd, 'out', key), '');
  }
  const log = "const args = process.argv.slice(2); require('node:fs').appendFileSync(process.env.CALLS, JSON.stringify([";
  mock('aws', log + `'aws', ...args]) + '\\n');
const [service, command] = args;
if (command === 'create-invalidation') console.log('{"Invalidation":{"Id":"EXAMPLE"}}');
if (command === 'wait' && process.env.WAIT_FAILURE) process.exit(9);
if (command === 'list-objects-v2') {
  if (args.includes('--continuation-token')) {
    console.log(JSON.stringify({Contents: [{Key: 'manual/data.json'}]}));
  } else {
    console.log(JSON.stringify({
      Contents: ['old.html', '_next/static/old.js', 'new-page', 'asset.js', 'old-lesson.md', 'llms.txt'].map(Key => ({Key})),
      IsTruncated: true, NextContinuationToken: process.env.TOKEN ?? 'page-2',
    }));
  }
}
if (command === 'delete-objects') console.log(process.env.DELETE_ERROR ?? '{}');
`);
  mock('curl', log + `'curl', ...args]) + '\\n');
process.stdout.write('<html></html>\\n' + (process.env.HTTP_STATUS ?? '200 text/html'));
`);
  return fixtureState;
}

test('syncs and refreshes aliases before verifying and pruning across pages', () => {
  const { cliRun, calls } = fakeDeploy();
  const result = cliRun(['deploy', '--site', site, '--preserve', '*.md', '--preserve', 'llms.txt', '--preserve', 'manual/*'], {
    ...targets, AWS_PROFILE: undefined, GITHUB_ACTIONS: 'true',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls().map(([tool, service, command]) => tool === 'curl' ? 'check' : `${service} ${command}`), [
    's3 sync', 's3 cp', 's3 cp', 'cloudfront create-invalidation', 'cloudfront wait',
    'check', 's3api list-objects-v2', 's3api list-objects-v2', 's3api delete-objects',
    'cloudfront create-invalidation', 'cloudfront wait',
  ]);
  const sync = calls()[0];
  assert.ok(!sync.includes('--delete'), 'sync must not delete before health checks and preserve filtering');
  const copy = calls()[2];
  assert.deepEqual(copy.slice(3), [
    's3://example-site-bucket/new-page/index.html', 's3://example-site-bucket/new-page',
  ]);
  const deleteArgs = calls().find(args => args[2] === 'delete-objects');
  assert.deepEqual(JSON.parse(deleteArgs[deleteArgs.indexOf('--delete') + 1]), {
    Objects: [{ Key: 'old.html' }, { Key: '_next/static/old.js' }],
  });
});

for (const [label, additional, error] of [
  ['invalidation fails', { WAIT_FAILURE: '1' }, /cloudfront wait failed/],
  ['homepage is unhealthy', { HTTP_STATUS: '503 text/html' }, /HTTP 200 with HTML/],
  ['object listing is incomplete', { TOKEN: '' }, /listing is incomplete/],
]) {
  test(`does not delete when ${label}`, () => {
    const { cliRun, calls } = fakeDeploy();
    const result = cliRun(['deploy', '--site', site], { ...targets, ...additional });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, error);
    assert.ok(!calls().find(args => args[2] === 'delete-objects'));
  });
}

test('fails on S3 per-key delete errors without a second invalidation', () => {
  const { cliRun, calls } = fakeDeploy();
  const result = cliRun(['deploy', '--site', site], {
    ...targets, DELETE_ERROR: '{"Errors":[{"Code":"AccessDenied","Key":"old.html"}]}',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /S3 object deletion failed.*AccessDenied/);
  assert.equal(calls().filter(args => args[2] === 'create-invalidation').length, 1);
});

const provisionArgs = ['setup', '--site', site, '--provision', '--yes', '--reviewer', 'example-reviewer',
  '--account-id', '123456789012', '--role-name', 'example-deploy', '--branch', 'release'];

test('dry run plans site-specific IAM and GitHub settings without mutating the stash', () => {
  const { cliRun } = fixture();
  const result = cliRun([...provisionArgs, '--dry-run'], targets);
  assert.equal(result.status, 0, result.stderr);
  const output = result.stdout.replace(/\\(.)/g, '$1');
  assert.match(output, /users\/example-reviewer/);
  assert.match(output, /repo:example-org\/example-site:environment:production:ref:refs\/heads\/release/);
  assert.match(output, /arn:aws:cloudfront::123456789012:distribution\/EXAMPLE123/);
  assert.match(output, /"include_claim_keys":\["repo","context","ref"\]/);
  assert.match(output, /gh variable set AWS_DEPLOY_ROLE_ARN --repo example-org\/example-site --env production/);
  assert.notEqual(cliRun(['check', '--site', site]).status, 0);
});

for (const { bypass, firstRun = false } of [{ bypass: true }, { bypass: false }, { bypass: false, firstRun: true }]) {
  const description = firstRun ? 'creates missing provisioning resources when the approval gate is in place' :
    `preserves GitHub environment settings on rerun (admin bypass = ${bypass})`;
  test(description, () => {
    const { cliRun, mock, calls } = fixture();
    const log = "const args = process.argv.slice(2); require('node:fs').appendFileSync(process.env.CALLS, JSON.stringify([";
    mock('aws', log + `'aws', ...args]) + '\\n');
const [service, command] = args;
if (service === '--version') console.log('aws-cli/2.example');
else if (service === 'sts') console.log('arn:aws:iam::123456789012:role/example-admin');
else if (${firstRun} && ['get-open-id-connect-provider', 'get-role'].includes(command)) {
  console.error('An error occurred (NoSuchEntity)');
  process.exit(254);
}
else if (command === 'create-role') console.log('arn:aws:iam::123456789012:role/example-deploy');
else if (command === 'get-open-id-connect-provider') console.log('{"ClientIDList":["sts.amazonaws.com"]}');
else if (command === 'get-role') console.log('{"Role":{"Arn":"arn:aws:iam::123456789012:role/example-deploy"}}');
else if (command === 'list-attached-role-policies') console.log('{"AttachedPolicies":[]}');
else if (command === 'list-role-policies') console.log('{"PolicyNames":["SiteDeploy"]}');
else if (!['create-open-id-connect-provider','update-assume-role-policy','put-role-policy'].includes(command)) process.exit(99);
`);
    mock('gh', log + `'gh', ...args]) + '\\n');
const fs = require('node:fs');
const [command, endpoint, method, target] = args;
if (endpoint === 'repos/example-org/example-site') console.log('example-org/example-site');
else if (endpoint.endsWith('/customization/sub')) console.log('{"use_immutable_subject":false}');
else if (endpoint === 'users/example-reviewer') console.log('123');
else if (endpoint === '--paginate') console.log(${firstRun} ? '[{"branch_policies":[]}]' : '[{"branch_policies":[{"id":1,"name":"release","type":"branch"}]}]');
else if (${firstRun} && endpoint.endsWith('/environments/production') && !fs.existsSync(process.env.CALLS + '.changed')) {
  console.error('gh: Not Found (HTTP 404)');
  process.exit(1);
}
else if (endpoint.endsWith('/environments/production')) console.log(JSON.stringify({
  can_admins_bypass: ${bypass} || (!${firstRun} && fs.existsSync(process.env.CALLS + '.changed')),
  deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
  protection_rules: [{ type: 'required_reviewers', prevent_self_review: false, reviewers: [{ type: 'User', reviewer: {id: 123} }] }],
}));
else if (endpoint === '--method' && method === 'PUT') {
  if (target.endsWith('/environments/production')) fs.writeFileSync(process.env.CALLS + '.changed', '');
} else if (command !== 'variable' && !(method === 'POST' && target.endsWith('/deployment-branch-policies'))) process.exit(99);
`);
    const result = cliRun(provisionArgs, targets);
    assert.equal(result.status, bypass ? 1 : 0, result.stderr);
    const commands = calls();
    assert.equal(commands.some(args => args.includes('PUT') && args[4].endsWith('/environments/production')), firstRun);
    assert.equal(commands.some(args => args.includes('update-assume-role-policy')), !bypass && !firstRun);
    assert.equal(commands.some(args => args.includes('PUT') && args[4].endsWith('/customization/sub')), !bypass);
    if (firstRun) {
      assert.ok(commands.some(args => args.includes('POST') && args[4].endsWith('/deployment-branch-policies')));
      assert.ok(commands.some(args => args.includes('create-open-id-connect-provider')));
      assert.ok(commands.some(args => args.includes('create-role')));
    }
    if (bypass) assert.match(result.stderr, /Allow administrators to bypass configured protection rules/);
  });
}
