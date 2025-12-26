import * as fs from 'fs';
import * as path from 'path';

const PLACEHOLDER_PATTERN = /{{(\w+)}}/g;

interface LicenseContext {
  year: string;
  author: string;
  email: string;
}

type LicenseTemplateMap = Record<string, string>;

let cachedTemplates: LicenseTemplateMap | null = null;

export type SupportedLicense = string;
export const DEFAULT_LICENSE = 'MIT';
export const LICENSE_VALUE_KEYS = ['LICENSE', 'license'];
export const LICENSE_AUTHOR_KEYS = [
  'USERFULLNAME',
  'AUTHOR',
  'AUTHORFULLNAME',
  'USERNAME',
  'fullName',
  'author',
  'authorFullName',
  'userName',
];
export const LICENSE_EMAIL_KEYS = ['USEREMAIL', 'EMAIL', 'email', 'userEmail'];

export function isSupportedLicense(name: string): name is SupportedLicense {
  if (!name) {
    return false;
  }
  return Boolean(loadLicenseTemplates()[name.toUpperCase()]);
}

export function renderLicense(
  licenseName: string,
  context: Partial<LicenseContext>
): string | null {
  if (!licenseName) {
    return null;
  }
  const templates = loadLicenseTemplates();
  const template = templates[licenseName.toUpperCase()];
  if (!template) {
    return null;
  }

  const ctx: LicenseContext = {
    year: context.year ?? new Date().getFullYear().toString(),
    author: context.author ?? 'Unknown Author',
    email: context.email ?? '',
  };

  const emailLine = ctx.email ? ` <${ctx.email}>` : '';

  return template.replace(PLACEHOLDER_PATTERN, (_, rawKey: string) => {
    const key = rawKey.toUpperCase();
    if (key === 'EMAIL_LINE') {
      return emailLine;
    }
    const normalizedKey = key.toLowerCase() as keyof LicenseContext;
    const value = ctx[normalizedKey];
    return value || '';
  });
}

export function listSupportedLicenses(): string[] {
  const licenses = Object.keys(loadLicenseTemplates());
  // Sort with DEFAULT_LICENSE first, then alphabetically
  return licenses.sort((a, b) => {
    if (a === DEFAULT_LICENSE) return -1;
    if (b === DEFAULT_LICENSE) return 1;
    return a.localeCompare(b);
  });
}

export function findLicenseValue(
  answers: Record<string, any>
): string | undefined {
  return getAnswerValue(answers, LICENSE_VALUE_KEYS);
}

export function findLicenseAuthor(
  answers: Record<string, any>
): string | undefined {
  return getAnswerValue(answers, LICENSE_AUTHOR_KEYS);
}

export function findLicenseEmail(
  answers: Record<string, any>
): string | undefined {
  return getAnswerValue(answers, LICENSE_EMAIL_KEYS);
}

function loadLicenseTemplates(): LicenseTemplateMap {
  if (cachedTemplates) {
    return cachedTemplates;
  }

  const dir = findTemplatesDir();
  if (!dir) {
    cachedTemplates = {};
    return cachedTemplates;
  }

  const files = fs.readdirSync(dir);
  const templates: LicenseTemplateMap = {};

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      continue;
    }

    if (path.extname(file).toLowerCase() !== '.txt') {
      continue;
    }

    const key = path.basename(file, path.extname(file)).toUpperCase();
    templates[key] = fs.readFileSync(fullPath, 'utf8');
  }

  cachedTemplates = templates;
  return cachedTemplates;
}

function findTemplatesDir(): string | null {
  const candidates = [
    path.resolve(__dirname, '..', 'licenses-templates'),
    path.resolve(__dirname, 'licenses-templates'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getAnswerValue(
  answers: Record<string, any>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = answers?.[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return undefined;
}
