import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const TEST_REPO =
  process.env.CREATE_GEN_TEST_REPO ??
  "https://github.com/constructive-io/pgpm-boilerplates.git";
export const TEST_BRANCH =
  process.env.CREATE_GEN_TEST_BRANCH ?? "main";
export const TEST_TEMPLATE_DIR = (() => {
  const envDir = process.env.CREATE_GEN_TEST_BASE_PATH;
  if (envDir) return envDir;

  try {
    const root = fs.realpathSync(process.cwd());
    const cfgPath = path.join(root, ".boilerplates.json");
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      if (parsed?.dir && typeof parsed.dir === "string") {
        return parsed.dir;
      }
    }
  } catch {
    // ignore and fall through
  }

  return ".";
})();
export const TEST_TEMPLATE =
  process.env.CREATE_GEN_TEST_TEMPLATE ?? "module";
export const TEST_TEMPLATE_PATH =
  process.env.CREATE_GEN_TEST_TEMPLATE_PATH ??
  path.join(TEST_TEMPLATE_DIR, TEST_TEMPLATE);

export interface TempWorkspace {
  baseDir: string;
  outputDir: string;
}

export function createTempWorkspace(prefix: string): TempWorkspace {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), `create-gen-${prefix}-`));
  const outputDir = path.join(baseDir, "output");
  return { baseDir, outputDir };
}

export function cleanupWorkspace(workspace: TempWorkspace): void {
  fs.rmSync(workspace.baseDir, { recursive: true, force: true });
}

export function buildAnswers(
  suffix: string,
  overrides: Partial<Record<string, string>> = {}
): Record<string, string> {
  const safeSuffix = suffix.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  return {
    fullName: `Test User ${suffix}`,
    email: `tester-${safeSuffix}@example.com`,
    moduleName: `integration-${safeSuffix}`,
    moduleDesc: `Integration test module ${suffix}`,
    description: `Integration test module ${suffix}`,
    repoName: `integration-${safeSuffix}`,
    username: `tester-${safeSuffix}`,
    access: "public",
    license: "MIT",
    packageIdentifier: `integration-${safeSuffix}`,
    ...overrides,
  };
}
