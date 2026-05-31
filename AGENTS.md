# AGENTS.md

This file provides guidance to AI coding agents working with code in this repository.

## Available Skills

| Skill | Description |
|-------|-------------|
| **inquirerer-cli** | inquirerer CLI framework — interactive prompts, appStash state persistence, yanse terminal colors, and README formatting conventions. Use when building CLIs with inquirerer or formatting documentation. |

## Skill Structure

```
.agents/skills/
  inquirerer-cli/
    SKILL.md              # Skill definition
    references/           # Detailed documentation
      inquirerer-cli.md
      inquirerer-cli-building.md
      inquirerer-appstash.md
      inquirerer-yanse.md
      inquirerer-anti-patterns.md
      readme-formatting.md
  inquirerer-cli.zip      # Packaged for distribution
```
