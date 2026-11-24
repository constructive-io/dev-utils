import { env, makeValidator, required } from '12factor-env';
import { createConfigStore } from 'appstash';

const storeName = 'static-site-deploy';
const storeKey = 'deploy';

export const fields = {
  AWS_S3_BUCKET: { label: 'S3 bucket', pattern: /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/ },
  AWS_CLOUDFRONT_DISTRIBUTION_ID: { label: 'CloudFront distribution ID', pattern: /^[A-Z0-9]+$/ },
  SITE_URL: { label: 'HTTPS homepage URL', pattern: /^https:\/\/[^/\s]+[^\s]*$/ },
  AWS_REGION: { label: 'AWS region', pattern: /^[a-z]{2}(-[a-z0-9]+)+-[0-9]+$/ },
  AWS_PROFILE: { label: 'AWS CLI profile', pattern: /\S/ },
} as const;

type ConfigKey = keyof typeof fields;
const keys = Object.keys(fields) as ConfigKey[];
type ConfigValues = Partial<Record<ConfigKey, string>>;
export type SiteConfig = Required<Omit<ConfigValues, 'AWS_PROFILE'>> & Pick<ConfigValues, 'AWS_PROFILE'>;
type Environment = NodeJS.ProcessEnv;

export function siteKey(site: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(site) || /\/\.{1,2}$/.test(site)) {
    throw new Error('Specify the GitHub repository as --site OWNER/REPO.');
  }
  return encodeURIComponent(site.toLowerCase());
}

export function isCI(environment: Environment) {
  return environment.GITHUB_ACTIONS === 'true' ||
    !!(environment.CI && !/^(false|0)$/i.test(environment.CI));
}

export function requiredFields(environment: Environment): ConfigKey[] {
  return keys.filter(
    key => key !== 'AWS_PROFILE' || (!isCI(environment) && !(environment.AWS_ACCESS_KEY_ID && environment.AWS_SECRET_ACCESS_KEY)),
  );
}

export function validValue(key: ConfigKey, raw?: string) {
  if (typeof raw !== 'string' || !fields[key].pattern.test(raw.trim())) return false;
  if (key !== 'SITE_URL') return true;
  try {
    const url = new URL(raw.trim());
    return !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateConfig(values: ConfigValues, environment: Environment): SiteConfig {
  const validator = (key: ConfigKey) => required(makeValidator(value => {
    if (!validValue(key, value)) throw new Error(`must be a valid ${fields[key].label}`);
    return value.trim();
  }));
  return { ...env(values, {}, {
    AWS_S3_BUCKET: validator('AWS_S3_BUCKET'),
    AWS_CLOUDFRONT_DISTRIBUTION_ID: validator('AWS_CLOUDFRONT_DISTRIBUTION_ID'),
    SITE_URL: validator('SITE_URL'),
    AWS_REGION: validator('AWS_REGION'),
    ...(requiredFields(environment).includes('AWS_PROFILE') || (!isCI(environment) && validValue('AWS_PROFILE', values.AWS_PROFILE))
      ? { AWS_PROFILE: validator('AWS_PROFILE') } : {}),
  }) };
}

export function readSiteConfig(site: string, environment = process.env): ConfigValues {
  const context = siteKey(site);
  const overrides: Environment = {
    ...environment,
    AWS_PROFILE: environment.AWS_PROFILE ?? environment.AWS_DEFAULT_PROFILE,
    AWS_REGION: environment.AWS_REGION ?? environment.AWS_DEFAULT_REGION,
  };
  const populated = Object.fromEntries(keys.flatMap(key =>
    overrides[key] === undefined ? [] : [[key, overrides[key]]],
  ));
  if (isCI(environment) || requiredFields(environment).every(key => overrides[key] !== undefined)) return populated;

  const stored = createConfigStore(storeName).getVar(storeKey, context);
  return { ...(stored ? JSON.parse(stored) : {}), ...populated };
}

export function saveSiteConfig(site: string, values: SiteConfig) {
  const context = siteKey(site);
  const store = createConfigStore(storeName);
  const config = Object.fromEntries(keys.flatMap(key =>
    validValue(key, values[key]) ? [[key, values[key].trim()]] : [],
  ));
  if (config.AWS_PROFILE === undefined) {
    const stored = store.getVar(storeKey, context);
    const profile = stored ? JSON.parse(stored).AWS_PROFILE : undefined;
    if (validValue('AWS_PROFILE', profile)) config.AWS_PROFILE = profile.trim();
  }
  store.setVar(storeKey, JSON.stringify(config), context);
}

export function awsEnvironment(config: SiteConfig, environment = process.env) {
  const result: Environment = { ...environment, AWS_REGION: config.AWS_REGION, AWS_DEFAULT_REGION: config.AWS_REGION };
  delete result.AWS_PROFILE;
  delete result.AWS_DEFAULT_PROFILE;
  if (config.AWS_PROFILE && requiredFields(environment).includes('AWS_PROFILE')) result.AWS_PROFILE = config.AWS_PROFILE;
  return result;
}
