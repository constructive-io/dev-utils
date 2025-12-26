import {
  DefaultResolverRegistry,
  globalResolverRegistry,
  registerDefaultResolver,
  resolveDefault,
  getGitConfig,
  getNpmWhoami,
} from "../src/resolvers";

// Mock child_process.execSync for git config tests
jest.mock("child_process", () => ({
  execSync: jest.fn(),
}));

import { execSync } from "child_process";
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe("DefaultResolverRegistry", () => {
  let registry: DefaultResolverRegistry;

  beforeEach(() => {
    registry = new DefaultResolverRegistry();
    jest.clearAllMocks();
  });

  describe("register and resolve", () => {
    it("should register and resolve a simple synchronous resolver", async () => {
      registry.register("test.value", () => "test-result");

      const result = await registry.resolve("test.value");

      expect(result).toBe("test-result");
    });

    it("should register and resolve an async resolver", async () => {
      registry.register("test.async", async () => {
        return new Promise((resolve) =>
          setTimeout(() => resolve("async-result"), 10)
        );
      });

      const result = await registry.resolve("test.async");

      expect(result).toBe("async-result");
    });

    it("should return undefined for non-existent resolver", async () => {
      const result = await registry.resolve("non.existent");

      expect(result).toBeUndefined();
    });

    it("should treat empty string as undefined", async () => {
      registry.register("test.empty", () => "");

      const result = await registry.resolve("test.empty");

      expect(result).toBeUndefined();
    });

    it("should return undefined when resolver throws error", async () => {
      registry.register("test.error", () => {
        throw new Error("Test error");
      });

      const result = await registry.resolve("test.error");

      expect(result).toBeUndefined();
    });

    it("should handle resolver that returns null", async () => {
      registry.register("test.null", () => null);

      const result = await registry.resolve("test.null");

      expect(result).toBeNull();
    });

    it("should handle resolver that returns false", async () => {
      registry.register("test.false", () => false);

      const result = await registry.resolve("test.false");

      expect(result).toBe(false);
    });

    it("should handle resolver that returns 0", async () => {
      registry.register("test.zero", () => 0);

      const result = await registry.resolve("test.zero");

      expect(result).toBe(0);
    });
  });

  describe("unregister", () => {
    it("should unregister a resolver", async () => {
      registry.register("test.value", () => "test-result");
      registry.unregister("test.value");

      const result = await registry.resolve("test.value");

      expect(result).toBeUndefined();
    });
  });

  describe("has", () => {
    it("should return true for registered resolver", () => {
      registry.register("test.value", () => "test-result");

      expect(registry.has("test.value")).toBe(true);
    });

    it("should return false for non-existent resolver", () => {
      expect(registry.has("non.existent")).toBe(false);
    });
  });

  describe("keys", () => {
    it("should return all registered keys", () => {
      registry.register("test.one", () => "one");
      registry.register("test.two", () => "two");
      registry.register("test.three", () => "three");

      const keys = registry.keys();

      expect(keys).toEqual(["test.one", "test.two", "test.three"]);
    });

    it("should return empty array when no resolvers registered", () => {
      const keys = registry.keys();

      expect(keys).toEqual([]);
    });
  });

  describe("clone", () => {
    it("should create a copy with all resolvers", async () => {
      registry.register("test.value", () => "test-result");

      const cloned = registry.clone();
      const result = await cloned.resolve("test.value");

      expect(result).toBe("test-result");
    });

    it("should not affect original when modifying clone", async () => {
      registry.register("test.value", () => "original");

      const cloned = registry.clone();
      cloned.register("test.value", () => "modified");

      const originalResult = await registry.resolve("test.value");
      const clonedResult = await cloned.resolve("test.value");

      expect(originalResult).toBe("original");
      expect(clonedResult).toBe("modified");
    });
  });
});

describe("Git Resolvers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getGitConfig", () => {
    it("should return git config value when successful", () => {
      mockedExecSync.mockReturnValue("John Doe\n" as any);

      const result = getGitConfig("user.name");

      expect(result).toBe("John Doe");
      expect(mockedExecSync).toHaveBeenCalledWith(
        "git config --global user.name",
        expect.objectContaining({
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"],
        })
      );
    });

    it("should trim whitespace from git config value", () => {
      mockedExecSync.mockReturnValue("  test@example.com  \n" as any);

      const result = getGitConfig("user.email");

      expect(result).toBe("test@example.com");
    });

    it("should return undefined when git config fails", () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("Git config not found");
      });

      const result = getGitConfig("user.name");

      expect(result).toBeUndefined();
    });

    it("should return undefined when git config returns empty string", () => {
      mockedExecSync.mockReturnValue("" as any);

      const result = getGitConfig("user.name");

      expect(result).toBeUndefined();
    });
  });

  describe("git.user.name resolver", () => {
    it("should resolve git user name", async () => {
      mockedExecSync.mockReturnValue("Jane Smith\n" as any);

      const result = await globalResolverRegistry.resolve("git.user.name");

      expect(result).toBe("Jane Smith");
    });

    it("should return undefined when git config fails", async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("Git not configured");
      });

      const result = await globalResolverRegistry.resolve("git.user.name");

      expect(result).toBeUndefined();
    });
  });

  describe("git.user.email resolver", () => {
    it("should resolve git user email", async () => {
      mockedExecSync.mockReturnValue("jane@example.com\n" as any);

      const result = await globalResolverRegistry.resolve("git.user.email");

      expect(result).toBe("jane@example.com");
    });

    it("should return undefined when git config fails", async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("Git not configured");
      });

      const result = await globalResolverRegistry.resolve("git.user.email");

      expect(result).toBeUndefined();
    });
  });
});

describe("NPM Resolvers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getNpmWhoami", () => {
    it("should return npm username when logged in", () => {
      mockedExecSync.mockReturnValue("johndoe\n" as any);

      const result = getNpmWhoami();

      expect(result).toBe("johndoe");
      expect(mockedExecSync).toHaveBeenCalledWith(
        "npm whoami",
        expect.objectContaining({
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"],
        })
      );
    });

    it("should trim whitespace from npm username", () => {
      mockedExecSync.mockReturnValue("  janedoe  \n" as any);

      const result = getNpmWhoami();

      expect(result).toBe("janedoe");
    });

    it("should return undefined when not logged in to npm", () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("Not logged in");
      });

      const result = getNpmWhoami();

      expect(result).toBeUndefined();
    });

    it("should return undefined when npm whoami returns empty string", () => {
      mockedExecSync.mockReturnValue("" as any);

      const result = getNpmWhoami();

      expect(result).toBeUndefined();
    });
  });

  describe("npm.whoami resolver", () => {
    it("should resolve npm username", async () => {
      mockedExecSync.mockReturnValue("npmuser\n" as any);

      const result = await globalResolverRegistry.resolve("npm.whoami");

      expect(result).toBe("npmuser");
    });

    it("should return undefined when npm not logged in", async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("Not logged in");
      });

      const result = await globalResolverRegistry.resolve("npm.whoami");

      expect(result).toBeUndefined();
    });
  });
});

describe("Date Resolvers", () => {
  beforeEach(() => {
    // Mock Date to return consistent values
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-11-23T15:30:45.123Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("date.year", () => {
    it("should resolve current year", async () => {
      const result = await globalResolverRegistry.resolve("date.year");

      expect(result).toBe("2025");
    });
  });

  describe("date.month", () => {
    it("should resolve current month with zero padding", async () => {
      const result = await globalResolverRegistry.resolve("date.month");

      expect(result).toBe("11");
    });

    it("should zero-pad single digit months", async () => {
      jest.setSystemTime(new Date("2025-03-15T12:00:00Z"));

      const result = await globalResolverRegistry.resolve("date.month");

      expect(result).toBe("03");
    });
  });

  describe("date.day", () => {
    it("should resolve current day with zero padding", async () => {
      const result = await globalResolverRegistry.resolve("date.day");

      expect(result).toBe("23");
    });

    it("should zero-pad single digit days", async () => {
      jest.setSystemTime(new Date("2025-03-05T12:00:00Z"));

      const result = await globalResolverRegistry.resolve("date.day");

      expect(result).toBe("05");
    });
  });

  describe("date.now", () => {
    it("should resolve current ISO timestamp", async () => {
      const result = await globalResolverRegistry.resolve("date.now");

      expect(result).toBe("2025-11-23T15:30:45.123Z");
    });
  });

  describe("date.iso", () => {
    it("should resolve current date in YYYY-MM-DD format", async () => {
      const result = await globalResolverRegistry.resolve("date.iso");

      expect(result).toBe("2025-11-23");
    });
  });

  describe("date.timestamp", () => {
    it("should resolve current timestamp in milliseconds", async () => {
      const result = await globalResolverRegistry.resolve("date.timestamp");

      // 2025-11-23T15:30:45.123Z corresponds to this timestamp
      expect(result).toBe(
        String(new Date("2025-11-23T15:30:45.123Z").getTime())
      );
    });
  });
});

describe("Global Registry", () => {
  it("should have git resolvers registered by default", () => {
    expect(globalResolverRegistry.has("git.user.name")).toBe(true);
    expect(globalResolverRegistry.has("git.user.email")).toBe(true);
  });

  it("should have npm resolvers registered by default", () => {
    expect(globalResolverRegistry.has("npm.whoami")).toBe(true);
  });

  it("should have date resolvers registered by default", () => {
    expect(globalResolverRegistry.has("date.year")).toBe(true);
    expect(globalResolverRegistry.has("date.month")).toBe(true);
    expect(globalResolverRegistry.has("date.day")).toBe(true);
    expect(globalResolverRegistry.has("date.now")).toBe(true);
    expect(globalResolverRegistry.has("date.iso")).toBe(true);
    expect(globalResolverRegistry.has("date.timestamp")).toBe(true);
  });
});

describe("Convenience Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset any custom resolvers by creating a fresh state
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-11-23T15:30:45.123Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("registerDefaultResolver", () => {
    it("should register a resolver on the global registry", async () => {
      registerDefaultResolver("custom.test", () => "custom-value");

      const result = await resolveDefault("custom.test");

      expect(result).toBe("custom-value");
    });
  });

  describe("resolveDefault", () => {
    it("should resolve from the global registry", async () => {
      const result = await resolveDefault("date.year");

      expect(result).toBe("2025");
    });

    it("should return undefined for non-existent resolver", async () => {
      const result = await resolveDefault("non.existent");

      expect(result).toBeUndefined();
    });
  });
});

describe("Debug Mode", () => {
  let originalDebug: string | undefined;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    originalDebug = process.env.DEBUG;
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    if (originalDebug !== undefined) {
      process.env.DEBUG = originalDebug;
    } else {
      delete process.env.DEBUG;
    }
    consoleErrorSpy.mockRestore();
  });

  it("should log errors when DEBUG=commodore is set", async () => {
    process.env.DEBUG = "commodore";
    const registry = new DefaultResolverRegistry();

    registry.register("test.error", () => {
      throw new Error("Test error message");
    });

    await registry.resolve("test.error");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[commodore] Resolver 'test.error' failed:",
      expect.any(Error)
    );
  });

  it("should not log errors when DEBUG is not set", async () => {
    delete process.env.DEBUG;
    const registry = new DefaultResolverRegistry();

    registry.register("test.error", () => {
      throw new Error("Test error message");
    });

    await registry.resolve("test.error");

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

describe("Workspace Resolvers", () => {
  it("should have workspace resolvers registered by default", () => {
    expect(globalResolverRegistry.has("workspace.name")).toBe(true);
    expect(globalResolverRegistry.has("workspace.repo.name")).toBe(true);
    expect(globalResolverRegistry.has("workspace.repo.organization")).toBe(
      true
    );
    expect(globalResolverRegistry.has("workspace.organization.name")).toBe(
      true
    );
    expect(globalResolverRegistry.has("workspace.license")).toBe(true);
    expect(globalResolverRegistry.has("workspace.author")).toBe(true);
    expect(globalResolverRegistry.has("workspace.author.name")).toBe(true);
    expect(globalResolverRegistry.has("workspace.author.email")).toBe(true);
  });

  it("should resolve workspace.name preferring repo name", async () => {
    const result = await globalResolverRegistry.resolve("workspace.name");

    // Repository slug of dev-utils package
    expect(result).toBe("dev-utils");
  });

  it("should resolve workspace.repo.name from package.json", async () => {
    // This test runs from the dev-utils directory which has a package.json with repository
    const result = await globalResolverRegistry.resolve("workspace.repo.name");

    expect(result).toBe("dev-utils");
  });

  it("should resolve workspace.repo.organization from package.json", async () => {
    const result = await globalResolverRegistry.resolve(
      "workspace.repo.organization"
    );

    // Tests run from commodore package which has constructive-io as the org
    expect(result).toBe("constructive-io");
  });

  it("should resolve workspace.organization.name from package.json", async () => {
    const result = await globalResolverRegistry.resolve(
      "workspace.organization.name"
    );

    expect(result).toBe("constructive-io");
  });

  it("should resolve workspace.license from package.json", async () => {
    const result = await globalResolverRegistry.resolve("workspace.license");

    expect(result).toBe("MIT");
  });

  it("should resolve workspace.author from package.json", async () => {
    const result = await globalResolverRegistry.resolve("workspace.author");

    expect(result).toBe("Constructive");
  });

  it("should resolve workspace.author.email from package.json", async () => {
    const result = await globalResolverRegistry.resolve(
      "workspace.author.email"
    );

    // Tests run from commodore package which has developers@constructive.io
    expect(result).toBe("developers@constructive.io");
  });
});
