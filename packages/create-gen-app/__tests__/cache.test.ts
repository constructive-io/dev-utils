import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { createGen } from "../src";
import {
  TEST_BRANCH,
  TEST_REPO,
  TEST_TEMPLATE,
  buildAnswers,
  cleanupWorkspace,
  createTempWorkspace,
} from "../test-utils/integration-helpers";

jest.setTimeout(180_000);

describe("template caching (appstash)", () => {
  let tempBaseDir: string;
  const cacheTool = `pgpm-cache-${Date.now()}`;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), "create-gen-cache-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it("reuses cached repositories across runs when cache is enabled", async () => {
    const cacheOptions = {
      toolName: cacheTool,
      baseDir: tempBaseDir,
      enabled: true,
    };

    const firstWorkspace = createTempWorkspace("cache-first");
    const firstAnswers = buildAnswers("cache-first");

    try {
      await createGen({
        templateUrl: TEST_REPO,
        fromBranch: TEST_BRANCH,
        fromPath: TEST_TEMPLATE,
        outputDir: firstWorkspace.outputDir,
        argv: firstAnswers,
        noTty: true,
        cache: cacheOptions,
      });
    } finally {
      cleanupWorkspace(firstWorkspace);
    }

    const repoCacheDir = path.join(tempBaseDir, `.${cacheTool}`, "cache", "repos");
    expect(fs.existsSync(repoCacheDir)).toBe(true);
    const cachedEntries = fs.readdirSync(repoCacheDir);
    expect(cachedEntries.length).toBeGreaterThan(0);

    const secondWorkspace = createTempWorkspace("cache-second");
    const secondAnswers = buildAnswers("cache-second");
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await createGen({
        templateUrl: TEST_REPO,
        fromBranch: TEST_BRANCH,
        fromPath: TEST_TEMPLATE,
        outputDir: secondWorkspace.outputDir,
        argv: secondAnswers,
        noTty: true,
        cache: cacheOptions,
      });

      expect(
        logSpy.mock.calls.some(([message]) =>
          typeof message === "string" && message.includes("Using cached repository")
        )
      ).toBe(true);
    } finally {
      logSpy.mockRestore();
      cleanupWorkspace(secondWorkspace);
    }
  });
});


