# AGENTS.md

This file provides guidance to AI agents working with the `constructive-io/dev-utils` monorepo.

## Available Skills

| Skill | Description |
|-------|-------------|
| **dev-utils** | Developer utilities — inquirerer (CLI prompts), yanse (terminal colors), appStash (state persistence), inflekt (string inflection), and 25+ other packages |
| **[static-site-deploy](.agents/skills/static-site-deploy/SKILL.md)** | Local static exports, deployment previews, and GitHub Actions OIDC provisioning |
| **[gen-llm-md](.agents/skills/gen-llm-md/SKILL.md)** | Generate an LLM index and Markdown twins from a static export |

## Skill Structure

```
.agents/skills/
  dev-utils/
    SKILL.md              # Skill definition
    references/           # Detailed documentation
      inquirerer-cli.md
      inquirerer-cli-building.md
      inquirerer-appstash.md
      inquirerer-yanse.md
      inquirerer-anti-patterns.md
      readme-formatting.md
  dev-utils.zip           # Packaged for distribution
  static-site-deploy/
    SKILL.md
  static-site-deploy.zip
  gen-llm-md/
    SKILL.md
  gen-llm-md.zip
```
