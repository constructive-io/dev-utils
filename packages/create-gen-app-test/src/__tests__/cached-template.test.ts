import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { appstash, resolve } from 'appstash';

import { createFromTemplate, CacheManager, GitCloner } from '../index';
import { buildAnswers, TEST_REPO, TEST_TEMPLATE_PATH } from '../test-utils/integration-helpers';

const DEFAULT_TEMPLATE_URL = TEST_REPO;

describe('cached template integration tests', () => {
  let testOutputDir: string;
  let testCacheTool: string;

  beforeAll(() => {
    testCacheTool = `mymodule-test-${Date.now()}`;
  });

  beforeEach(() => {
    testOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-output-'));
  });

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    const dirs = appstash(testCacheTool);
    if (fs.existsSync(dirs.root)) {
      fs.rmSync(dirs.root, { recursive: true, force: true });
    }
  });

  describe('cache functionality', () => {
    let sharedCachePath: string;
    let cacheManager: CacheManager;

    beforeAll(() => {
      cacheManager = new CacheManager({
        toolName: testCacheTool,
      });
    });

    it('should return null when cache does not exist for new URL', () => {
      const nonExistentUrl = 'https://github.com/nonexistent/repo-test-123456';
      const cacheKey = cacheManager.createKey(nonExistentUrl);
      const cachedRepo = cacheManager.get(cacheKey);
      expect(cachedRepo).toBeNull();
    });

    it('should clone repository to cache', () => {
      // Use GitCloner + CacheManager to clone and cache
      const gitCloner = new GitCloner();
      const normalizedUrl = gitCloner.normalizeUrl(DEFAULT_TEMPLATE_URL);
      const cacheKey = cacheManager.createKey(normalizedUrl);

      // Clone to cache directory
      const cachePath = path.join(cacheManager.getReposDir(), cacheKey);
      gitCloner.clone(normalizedUrl, cachePath, { depth: 1 });

      // Register in cache manager
      cacheManager.set(cacheKey, cachePath);
      sharedCachePath = cachePath;

      // Verify cache was created correctly
      expect(fs.existsSync(cachePath)).toBe(true);
      expect(fs.existsSync(path.join(cachePath, '.git'))).toBe(false);

      const dirs = appstash(testCacheTool);
      expect(cachePath.startsWith(dirs.cache)).toBe(true);
    }, 60000);

    it('should retrieve cached repository', () => {
      const gitCloner = new GitCloner();
      const normalizedUrl = gitCloner.normalizeUrl(DEFAULT_TEMPLATE_URL);
      const cacheKey = cacheManager.createKey(normalizedUrl);
      const cachedRepo = cacheManager.get(cacheKey);

      expect(cachedRepo).not.toBeNull();
      expect(cachedRepo).toBe(sharedCachePath);
      expect(fs.existsSync(cachedRepo!)).toBe(true);
    });
  });

  describe('first clone with variable replacement', () => {
    let firstCloneResult: any;
    let firstOutputDir: string;

    beforeAll(async () => {
      firstOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'first-clone-'));

      firstCloneResult = await createFromTemplate({
        templateUrl: DEFAULT_TEMPLATE_URL,
        outputDir: firstOutputDir,
        answers: buildAnswers('test'),
        toolName: testCacheTool,
        noTty: true,
        fromPath: TEST_TEMPLATE_PATH
      });
    }, 60000);

    afterAll(() => {
      if (fs.existsSync(firstOutputDir)) {
        fs.rmSync(firstOutputDir, { recursive: true, force: true });
      }
    });

    it('should clone and process template successfully', () => {
      expect(firstCloneResult).toBeDefined();
      expect(firstCloneResult.outputDir).toBe(firstOutputDir);
      expect(firstCloneResult.cachePath).toBeDefined();
      expect(fs.existsSync(firstCloneResult.cachePath!)).toBe(true);
    });

    it('should create output directory with files', () => {
      expect(fs.existsSync(firstOutputDir)).toBe(true);

      const files = fs.readdirSync(firstOutputDir);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should snapshot created directory structure', () => {
      const structure = getDirectoryStructure(firstOutputDir);
      expect(structure).toMatchSnapshot();
    });

    it('should snapshot package.json files if they exist', () => {
      const packageJsonFiles = findPackageJsonFiles(firstOutputDir);

      const packageJsonContents: Record<string, any> = {};
      for (const file of packageJsonFiles) {
        const relativePath = path.relative(firstOutputDir, file);
        const content = JSON.parse(fs.readFileSync(file, 'utf8'));
        packageJsonContents[relativePath] = content;
      }

      expect(packageJsonContents).toMatchSnapshot();
    });

    it('should verify template cache was created', () => {
      // Verify cache was created by createFromTemplate
      const cacheManager = new CacheManager({
        toolName: testCacheTool,
      });
      const gitCloner = new GitCloner();
      const normalizedUrl = gitCloner.normalizeUrl(DEFAULT_TEMPLATE_URL);
      const cacheKey = cacheManager.createKey(normalizedUrl);
      const cachedRepo = cacheManager.get(cacheKey);

      expect(cachedRepo).not.toBeNull();
      expect(fs.existsSync(cachedRepo!)).toBe(true);
    });
  });

  describe('second clone from cache', () => {
    let secondCloneResult: any;
    let secondOutputDir: string;

    beforeAll(async () => {
      await createFromTemplate({
        templateUrl: DEFAULT_TEMPLATE_URL,
        outputDir: fs.mkdtempSync(path.join(os.tmpdir(), 'warmup-')),
        answers: buildAnswers('warmup'),
        toolName: testCacheTool,
        noTty: true,
        fromPath: TEST_TEMPLATE_PATH
      });

      secondOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'second-clone-'));

      secondCloneResult = await createFromTemplate({
        templateUrl: DEFAULT_TEMPLATE_URL,
        outputDir: secondOutputDir,
        answers: buildAnswers('cached'),
        toolName: testCacheTool,
        noTty: true,
        fromPath: TEST_TEMPLATE_PATH
      });
    }, 60000);

    afterAll(() => {
      if (fs.existsSync(secondOutputDir)) {
        fs.rmSync(secondOutputDir, { recursive: true, force: true });
      }
    });

    it('should use cached template', () => {
      expect(secondCloneResult.outputDir).toBe(secondOutputDir);
      expect(secondCloneResult.cacheUsed).toBe(true);
      expect(secondCloneResult.cachePath).toBeDefined();
    });

    it('should create output directory with files from cache', () => {
      expect(fs.existsSync(secondOutputDir)).toBe(true);

      const files = fs.readdirSync(secondOutputDir);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should snapshot created directory structure from cache', () => {
      const structure = getDirectoryStructure(secondOutputDir);
      expect(structure).toMatchSnapshot();
    });

    it('should snapshot package.json files from cached template', () => {
      const packageJsonFiles = findPackageJsonFiles(secondOutputDir);

      const packageJsonContents: Record<string, any> = {};
      for (const file of packageJsonFiles) {
        const relativePath = path.relative(secondOutputDir, file);
        const content = JSON.parse(fs.readFileSync(file, 'utf8'));
        packageJsonContents[relativePath] = content;
      }

      expect(packageJsonContents).toMatchSnapshot();
    });

    it('should have created output files from cached template', () => {
      const files = getAllFiles(secondOutputDir);

      expect(files.length).toBeGreaterThan(0);

      const textFiles = files.filter(file => {
        const ext = path.extname(file);
        return ['.json', '.md', '.txt', '.js', '.ts'].includes(ext);
      });

      expect(textFiles.length).toBeGreaterThan(0);
    });
  });

  describe('cache persistence', () => {
    it('should persist cache across multiple uses', async () => {
      const dirs = appstash(testCacheTool);
      const cacheDir = resolve(dirs, 'cache', 'repos');

      expect(fs.existsSync(cacheDir)).toBe(true);

      const cachedRepos = fs.readdirSync(cacheDir);
      expect(cachedRepos.length).toBeGreaterThan(0);
    });
  });
});

function getDirectoryStructure(dir: string, prefix: string = ''): string[] {
  const structure: string[] = [];

  if (!fs.existsSync(dir)) {
    return structure;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      structure.push(`${relativePath}/`);
      structure.push(...getDirectoryStructure(fullPath, relativePath));
    } else {
      structure.push(relativePath);
    }
  }

  return structure.sort();
}

function findPackageJsonFiles(dir: string): string[] {
  const packageJsonFiles: string[] = [];

  if (!fs.existsSync(dir)) {
    return packageJsonFiles;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && entry.name !== 'node_modules') {
      packageJsonFiles.push(...findPackageJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name === 'package.json') {
      packageJsonFiles.push(fullPath);
    }
  }

  return packageJsonFiles;
}

function getAllFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...getAllFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}
