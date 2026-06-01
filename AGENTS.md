# AGENTS.md

This file provides guidance to AI agents working with the `constructive-io/dev-utils` monorepo.

## Available Skills

| Skill | Description |
|-------|-------------|
| **dev-utils** | Developer utilities — inquirerer (CLI prompts), yanse (terminal colors), appStash (state persistence), inflekt (string inflection), and 25+ other packages |

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
```
