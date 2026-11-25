#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { Inquirerer } from 'inquirerer';

import {
  awsEnvironment, fields, isCI, readSiteConfig, requiredFields, saveSiteConfig, SiteConfig, validValue, validateConfig,
} from './config';
import { deploy } from './deploy';

const usage = `Usage:
  static-site-deploy deploy --site OWNER/REPO [--dir out] [--preserve PATTERN ...]
    [--dry-run] [--trailing-slash-aliases] [--verify-homepage]
  static-site-deploy check --site OWNER/REPO
  static-site-deploy setup --site OWNER/REPO [--provision] [--dry-run] [--yes]
    [--reviewer LOGIN] [--account-id ID] [--role-name NAME] [--branch main]`;

const interactive = !isCI(process.env) && process.stdin.isTTY && process.stdout.isTTY;

async function promptForConfig(site: string, allowPrompt: boolean) {
  const values = readSiteConfig(site);
  const missing = requiredFields(process.env).filter(key => !values[key]?.trim());
  if (!allowPrompt || !missing.length) return { config: validateConfig(values, process.env), prompted: false };

  const detectedRegion = missing.includes('AWS_REGION') ? spawnSync('aws', ['configure', 'get', 'region'], {
    encoding: 'utf8',
    env: { ...process.env, AWS_PROFILE: values.AWS_PROFILE ?? 'default' },
  }).stdout?.trim() : undefined;
  const prompter = new Inquirerer();
  try {
    const answers = await prompter.prompt({}, missing.map(key => ({
      type: 'text',
      name: key,
      message: fields[key].label,
      required: true,
      ...(key === 'AWS_PROFILE' ? { default: 'default' } : {}),
      ...(key === 'AWS_REGION' && detectedRegion ? { default: detectedRegion } : {}),
      validate: (input: string) => validValue(key, input) ? { success: true } : {
        success: false, reason: `Enter a valid ${fields[key].label}.`,
      },
    })));
    return { config: validateConfig({ ...values, ...answers }, process.env), prompted: true };
  } finally {
    prompter.close();
  }
}

function runProvisioner(site: string, config: SiteConfig, provision: Record<string, string>, dryRun: boolean) {
  const { AWS_PROFILE: _profile, ...targets } = config;
  const result = spawnSync('bash', [join(__dirname, 'provision.sh'), ...(dryRun ? ['--dry-run'] : [])], {
    env: { ...awsEnvironment(config), ...targets, ...provision, SITE_REPO: site },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}

async function main() {
  const { values: options, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      site: { type: 'string' },
      dir: { type: 'string' },
      preserve: { type: 'string', multiple: true },
      'trailing-slash-aliases': { type: 'boolean' },
      'verify-homepage': { type: 'boolean' },
      provision: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      yes: { type: 'boolean' },
      reviewer: { type: 'string' },
      'account-id': { type: 'string' },
      'role-name': { type: 'string' },
      branch: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (options.help) return console.log(usage);
  const [command] = positionals;
  if (positionals.length !== 1 || !['deploy', 'setup', 'check'].includes(command)) throw new Error(usage);
  const site = options.site ?? process.env.GITHUB_REPOSITORY;
  if (!site) throw new Error('Specify the GitHub repository as --site OWNER/REPO.');
  if (command !== 'setup' && (options.provision || options.yes ||
      options.reviewer || options['account-id'] || options['role-name'] || options.branch)) throw new Error(usage);
  if (command !== 'deploy' && (options.dir || options.preserve ||
      options['trailing-slash-aliases'] || options['verify-homepage'])) throw new Error(usage);
  if (command === 'check' && options['dry-run']) throw new Error(usage);

  const allowPrompt = interactive && !options.yes && command !== 'check';
  const dryRun = !!options['dry-run'];
  if (command === 'setup' && !dryRun) {
    if (isCI(process.env)) throw new Error('Run interactive setup outside CI; use environment variables to deploy in CI.');
    if (options.provision && !allowPrompt && !options.yes) {
      throw new Error('Unattended cloud provisioning requires --provision --yes.');
    }
  }
  const { config, prompted } = await promptForConfig(site, allowPrompt);
  if (command === 'check') return;
  if (command === 'deploy') {
    if (prompted && !dryRun) saveSiteConfig(site, config);
    return deploy(config, {
      directory: options.dir ?? 'out',
      preserve: options.preserve,
      dryRun,
      trailingSlashAliases: options['trailing-slash-aliases'],
      verifyHomepage: options['verify-homepage'],
    });
  }

  if (!dryRun) {
    saveSiteConfig(site, config);
    console.log(`Saved local deploy settings for ${site}. No AWS credentials were stored.`);
  }

  const provision: Record<string, string> = {
    SITE_REVIEWER: options.reviewer ?? process.env.SITE_REVIEWER,
    AWS_ACCOUNT_ID: options['account-id'] ?? process.env.AWS_ACCOUNT_ID,
    AWS_DEPLOY_ROLE_NAME: options['role-name'] ?? process.env.AWS_DEPLOY_ROLE_NAME,
    SITE_BRANCH: options.branch ?? 'main',
  };
  if (!allowPrompt) {
    if (!options.provision && !dryRun) return;
    return runProvisioner(site, config, provision, dryRun);
  }

  const prompter = new Inquirerer();
  try {
    if (!dryRun && !options.provision) {
      const { configure } = await prompter.prompt({} as { configure?: boolean }, [{
        type: 'confirm', name: 'configure', message: 'Set up AWS OIDC and the GitHub production environment?', default: false,
      }]);
      if (!configure) return;
    }
    const questions = [
      { name: 'SITE_REVIEWER', message: 'GitHub reviewer login (optional)', required: false },
      { name: 'AWS_ACCOUNT_ID', message: 'AWS account ID', required: true },
      { name: 'AWS_DEPLOY_ROLE_NAME', message: 'Dedicated IAM deploy role name', required: true },
    ].filter(question => provision[question.name] === undefined);
    const answers = questions.length ? await prompter.prompt({}, questions.map(question => ({
      ...question,
      type: 'text',
    }))) : {};
    const { apply } = dryRun ? { apply: true } : await prompter.prompt({} as { apply?: boolean }, [{
      type: 'confirm',
      name: 'apply',
      message: `Apply AWS and GitHub changes for ${site} on ${provision.SITE_BRANCH}? (Does not deploy)`,
      default: false,
    }]);
    if (apply) runProvisioner(site, config, { ...provision, ...answers }, dryRun);
  } finally {
    prompter.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
