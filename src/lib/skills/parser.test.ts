import { describe, expect, it } from "bun:test";
import {
	parseSkillMd,
	serializeSkillMd,
	type SkillFile,
} from "./parser";

describe("parseSkillMd", () => {
	it("should parse valid SKILL.md with frontmatter and body", () => {
		const content = `---
name: test-skill
description: A test skill
license: MIT
metadata:
  audience: developers
---

## Test Content

This is the body.`;

		const result = parseSkillMd(content);

		expect(result.frontmatter.name).toBe("test-skill");
		expect(result.frontmatter.description).toBe("A test skill");
		expect(result.frontmatter.license).toBe("MIT");
		expect(result.frontmatter.metadata).toEqual({ audience: "developers" });
		expect(result.body).toContain("## Test Content");
	});

	it("should throw error for missing frontmatter", () => {
		const content = `Just a body without frontmatter`;

		expect(() => parseSkillMd(content)).toThrow(
			"Formato inválido de SKILL.md: frontmatter YAML ausente ou inválido",
		);
	});

	it("should throw error for missing required fields", () => {
		const content = `---
license: MIT
---

Body content`;

		expect(() => parseSkillMd(content)).toThrow(
			"Frontmatter inválido: 'name' e 'description' são obrigatórios",
		);
	});

	it("should handle multiline description", () => {
		const content = `---
name: multiline-skill
description: |
  This is a multiline
  description
---

Body`;

		const result = parseSkillMd(content);
		expect(result.frontmatter.description).toContain("multiline");
	});
});

describe("serializeSkillMd", () => {
	it("should serialize skill to valid SKILL.md format", () => {
		const skill: SkillFile = {
			frontmatter: {
				name: "test-skill",
				description: "A test skill",
				license: "MIT",
			},
			body: "## Test Content\n\nThis is the body.",
		};

		const result = serializeSkillMd(skill);

		expect(result).toContain("---");
		expect(result).toContain("name: test-skill");
		expect(result).toContain("description: A test skill");
		expect(result).toContain("## Test Content");
	});

	it("should round-trip parse and serialize", () => {
		const original = `---
name: round-trip
description: Test round-trip
license: MIT
---

## Content

Body text here.`;

		const parsed = parseSkillMd(original);
		const serialized = serializeSkillMd(parsed);
		const reparsed = parseSkillMd(serialized);

		expect(reparsed.frontmatter.name).toBe(parsed.frontmatter.name);
		expect(reparsed.frontmatter.description).toBe(
			parsed.frontmatter.description,
		);
		expect(reparsed.body).toBe(parsed.body);
	});
});
