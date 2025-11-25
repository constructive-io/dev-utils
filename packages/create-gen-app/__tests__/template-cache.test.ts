import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { TemplateCache } from "../src/template-cache";

const TEST_REPO = "https://github.com/launchql/pgpm-boilerplates";

describe("TemplateCache", () => {
  let tempBaseDir: string;
  const cacheTool = `test-cache-${Date.now()}`;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), "template-cache-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  describe("basic cache operations", () => {
    it("should return null for non-existent cache", () => {
      const cache = new TemplateCache({
        enabled: true,
        toolName: cacheTool,
        baseDir: tempBaseDir,
      });

      const result = cache.get("https://github.com/test/repo");
      expect(result).toBeNull();
    });

    it("should store and retrieve a cached template", () => {
      const cache = new TemplateCache({
        enabled: true,
        toolName: cacheTool,
        baseDir: tempBaseDir,
      });

      const cachedPath = cache.set(TEST_REPO);
      expect(fs.existsSync(cachedPath)).toBe(true);

      const retrievedPath = cache.get(TEST_REPO);
      expect(retrievedPath).toBe(cachedPath);
    }, 60000);

    it("should handle branches correctly", () => {
      const cache = new TemplateCache({
        enabled: true,
        toolName: cacheTool,
        baseDir: tempBaseDir,
      });

      const mainPath = cache.set(TEST_REPO);
      const mainRetrieved = cache.get(TEST_REPO);

      expect(mainRetrieved).toBe(mainPath);
    }, 60000);

    it("should clear specific cached template", () => {
      const cache = new TemplateCache({
        enabled: true,
        toolName: cacheTool,
        baseDir: tempBaseDir,
      });

      const cachedPath = cache.set(TEST_REPO);
      expect(cache.get(TEST_REPO)).toBe(cachedPath);

      cache.clear(TEST_REPO);
      expect(cache.get(TEST_REPO)).toBeNull();
    }, 60000);

    it("should clear all cached templates", () => {
      const cache = new TemplateCache({
        enabled: true,
        toolName: cacheTool,
        baseDir: tempBaseDir,
      });

      cache.set(TEST_REPO);
      cache.clearAll();

      expect(cache.get(TEST_REPO)).toBeNull();
    }, 60000);
  });

  describe("TTL functionality", () => {
    it("should respect TTL and invalidate expired cache", async () => {
      const shortTtl = 1000; // 1 second
      const cache = new TemplateCache({
        enabled: true,
        toolName: cacheTool,
        baseDir: tempBaseDir,
        ttl: shortTtl,
      });

      const cachedPath = cache.set(TEST_REPO);
      expect(cache.get(TEST_REPO)).toBe(cachedPath);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, shortTtl + 100));

      // Cache should be expired and return null
      const result = cache.get(TEST_REPO);
      expect(result).toBeNull();
    }, 65000);

    it("should work with maxAge alias", () => {
      const cache = new TemplateCache({
        enabled: true,
        toolName: cacheTool,
        baseDir: tempBaseDir,
        maxAge: 5000,
      });

      const config = cache.getConfig();
      expect(config.ttl).toBe(5000);
    });

    it("should prioritize ttl over maxAge when both are provided", () => {
      const cache = new TemplateCache({
        enabled: true,
        toolName: cacheTool,
        baseDir: tempBaseDir,
        ttl: 3000,
        maxAge: 5000,
      });

      const config = cache.getConfig();
      expect(config.ttl).toBe(3000);
    });

    it("should not expire cache when TTL is not set", async () => {
      const cache = new TemplateCache({
        enabled: true,
        toolName: cacheTool,
        baseDir: tempBaseDir,
      });

      const cachedPath = cache.set(TEST_REPO);
      expect(cache.get(TEST_REPO)).toBe(cachedPath);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Cache should still be valid
      const result = cache.get(TEST_REPO);
      expect(result).toBe(cachedPath);
    }, 60000);
  });

  describe("metadata operations", () => {
    it("should store and retrieve metadata", () => {
      const cache = new TemplateCache({
        enabled: true,
        toolName: cacheTool,
        baseDir: tempBaseDir,
      });

      cache.set(TEST_REPO);
      const metadata = cache.getMetadata(TEST_REPO);

      expect(metadata).not.toBeNull();
      expect(metadata?.templateUrl).toBe(TEST_REPO);
      expect(metadata?.timestamp).toBeDefined();
      expect(metadata?.gitUrl).toBeDefined();
    }, 60000);

    it("should return null metadata for non-existent cache", () => {
      const cache = new TemplateCache({
        enabled: true,
        toolName: cacheTool,
        baseDir: tempBaseDir,
      });

      const metadata = cache.getMetadata("https://github.com/test/nonexistent");
      expect(metadata).toBeNull();
    });

    it("should list all cached templates", () => {
      const cache = new TemplateCache({
        enabled: true,
        toolName: cacheTool,
        baseDir: tempBaseDir,
      });

      cache.set(TEST_REPO);

      const list = cache.listAll();
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]).toHaveProperty("templateUrl");
      expect(list[0]).toHaveProperty("timestamp");
      expect(list[0]).toHaveProperty("expired");
      expect(list[0].expired).toBe(false);
    }, 60000);

    it("should mark expired templates in list", async () => {
      const cache = new TemplateCache({
        enabled: true,
        toolName: cacheTool,
        baseDir: tempBaseDir,
        ttl: 500,
      });

      cache.set(TEST_REPO);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 600));

      const list = cache.listAll();
      expect(list.length).toBeGreaterThan(0);
      expect(list[0].expired).toBe(true);
    }, 61000);
  });

  describe("disabled cache", () => {
    it("should return null when cache is disabled", () => {
      const cache = new TemplateCache(false);

      expect(cache.isEnabled()).toBe(false);
      expect(cache.get(TEST_REPO)).toBeNull();
    });

    it("should throw error when trying to set with disabled cache", () => {
      const cache = new TemplateCache({ enabled: false });

      expect(() => cache.set(TEST_REPO)).toThrow("Cache is disabled");
    });

    it("should not error when clearing disabled cache", () => {
      const cache = new TemplateCache(false);

      expect(() => cache.clear(TEST_REPO)).not.toThrow();
      expect(() => cache.clearAll()).not.toThrow();
    });
  });

  describe("configuration", () => {
    it("should use default tool name when not provided", () => {
      const cache = new TemplateCache({
        enabled: true,
        baseDir: tempBaseDir,
      });

      const config = cache.getConfig();
      expect(config.toolName).toBe("pgpm");
    });

    it("should use custom tool name", () => {
      const customTool = "my-custom-tool";
      const cache = new TemplateCache({
        enabled: true,
        toolName: customTool,
        baseDir: tempBaseDir,
      });

      const config = cache.getConfig();
      expect(config.toolName).toBe(customTool);
    });

    it("should enable cache by default", () => {
      const cache = new TemplateCache({});

      expect(cache.isEnabled()).toBe(true);
    });
  });
});
