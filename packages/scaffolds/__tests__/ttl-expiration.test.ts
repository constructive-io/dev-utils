import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CacheManager } from '../src/cache/cache-manager';
import { GitCloner } from '../src/git/git-cloner';

describe('TTL expiration', () => {
  it('invalidates cache when TTL expires', async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttl-test-'));
    const cacheManager = new CacheManager({
      toolName: 'test-ttl',
      ttl: 1000, // 1 second
      baseDir: testDir,
    });

    const gitCloner = new GitCloner();
    const testRepo = 'https://github.com/launchql/pgpm-boilerplates';

    try {
      // First clone - cache miss
      const cacheKey = cacheManager.createKey(testRepo);
      const tempDest = path.join(cacheManager.getReposDir(), cacheKey);

      console.log(`Cloning test repository to ${tempDest}...`);
      gitCloner.clone(testRepo, tempDest, { depth: 1 });
      cacheManager.set(cacheKey, tempDest);

      // Verify cache hit
      const cachedPath = cacheManager.get(cacheKey);
      expect(cachedPath).toBe(tempDest);
      expect(fs.existsSync(cachedPath as string)).toBe(true);

      // Verify not expired yet
      const notExpired = cacheManager.checkExpiration(cacheKey);
      expect(notExpired).toBeNull();

      // Wait for expiration
      console.log('Waiting 1.1 seconds for TTL to expire...');
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Check expiration
      const expiredMeta = cacheManager.checkExpiration(cacheKey);
      expect(expiredMeta).not.toBeNull();
      expect(expiredMeta!.lastUpdated).toBeDefined();
      expect(expiredMeta!.key).toBe(cacheKey);

      // Get should return null for expired
      const expiredGet = cacheManager.get(cacheKey);
      expect(expiredGet).toBeNull();

      console.log('TTL expiration test passed!');
    } finally {
      // Cleanup
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    }
  }, 65000); // 65 second timeout
});
