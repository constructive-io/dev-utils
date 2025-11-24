import * as fs from "fs";
import * as path from "path";

const PLACEHOLDER_PATTERN = /{{(\w+)}}/g;

interface LicenseContext {
  year: string;
  author: string;
  email: string;
}

type LicenseTemplateMap = Record<string, string>;

let cachedTemplates: LicenseTemplateMap | null = null;

export type SupportedLicense = string;

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
    author: context.author ?? "Unknown Author",
    email: context.email ?? "",
  };

  const emailLine = ctx.email ? ` <${ctx.email}>` : "";

  return template.replace(PLACEHOLDER_PATTERN, (_, rawKey: string) => {
    const key = rawKey.toUpperCase();
    if (key === "EMAIL_LINE") {
      return emailLine;
    }
    const normalizedKey = key.toLowerCase() as keyof LicenseContext;
    const value = ctx[normalizedKey];
    return value || "";
  });
}

export function listSupportedLicenses(): string[] {
  return Object.keys(loadLicenseTemplates());
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

    if (path.extname(file).toLowerCase() !== ".txt") {
      continue;
    }

    const key = path.basename(file, path.extname(file)).toUpperCase();
    templates[key] = fs.readFileSync(fullPath, "utf8");
  }

  cachedTemplates = templates;
  return cachedTemplates;
}

function findTemplatesDir(): string | null {
  const candidates = [
    path.resolve(__dirname, "..", "licenses-templates"),
    path.resolve(__dirname, "licenses-templates"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

