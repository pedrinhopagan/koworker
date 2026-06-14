import { type PrinciplesFinding, type PrinciplesInput, RULES } from "./rules";

export type { PrinciplesFinding, PrinciplesInput } from "./rules";

export function lintPrinciples(input: PrinciplesInput): PrinciplesFinding[] {
	const findings: PrinciplesFinding[] = [];

	for (const rule of RULES) {
		if (!rule.appliesTo.includes(input.kind)) {
			continue;
		}

		if (!rule.check(input)) {
			continue;
		}

		findings.push({
			ruleId: rule.id,
			title: rule.title,
			severity: rule.severity,
			detail: rule.detail,
		});
	}

	return findings;
}
