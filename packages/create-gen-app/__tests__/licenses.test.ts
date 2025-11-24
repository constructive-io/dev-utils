import { renderLicense, isSupportedLicense, listSupportedLicenses } from "../src/licenses";

describe("license templates", () => {
  const context = {
    year: "2099",
    author: "Test User",
    email: "test@example.com",
  };

  it("renders MIT license with author and email", () => {
    const content = renderLicense("MIT", context);
    expect(content).toContain("Test User");
    expect(content).toContain("<test@example.com>");
    expect(content).toContain("2099");
  });

  it("falls back when license not supported", () => {
    expect(renderLicense("UNKNOWN", {})).toBeNull();
    expect(isSupportedLicense("UNKNOWN")).toBe(false);
  });

  it("lists all bundled licenses", () => {
    const supported = listSupportedLicenses();
    expect(supported).toEqual(
      expect.arrayContaining([
        "MIT",
        "APACHE-2.0",
        "ISC",
        "GPL-3.0",
        "BSD-3-CLAUSE",
        "UNLICENSE",
        "MPL-2.0",
      ])
    );
  });

  it("handles case-insensitive lookups", () => {
    expect(isSupportedLicense("mit")).toBe(true);
    expect(renderLicense("mit", { author: "User" })).toContain("User");
  });
});

