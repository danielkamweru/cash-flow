import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type { AutomationRule, RuleRun } from "@/lib/types";

export type RuleEvaluation = {
  ruleId: string;
  ruleName: string;
  status: string;
  autoApprove: boolean;
  evaluation: {
    fired: boolean;
    outcome: "proposed" | "guarded" | "skipped";
    amount?: number | null;
    detail: string;
    actions: string[];
  };
};

export type RuleActionResponse = {
  ruleId: string;
  ruleName: string;
  run: RuleRun;
  runs: RuleRun[];
};

export function evaluateEntityAutomation(entityId: string) {
  return apiPost<{ results: RuleEvaluation[] }>(
    `/entities/${entityId}/automation/evaluate`,
  );
}

export function evaluateRuleAutomation(ruleId: string) {
  return apiPost<RuleEvaluation & { runs: RuleRun[] }>(
    `/automation/rules/${ruleId}/evaluate`,
  );
}

export function approveRule(ruleId: string, body: { pin?: string; live?: boolean }) {
  return apiPost<RuleActionResponse>(`/automation/rules/${ruleId}/approve`, body);
}

export function declineRule(ruleId: string) {
  return apiPost<RuleActionResponse>(`/automation/rules/${ruleId}/decline`);
}

export function enableRule(ruleId: string, autoApprove?: boolean) {
  return apiPost<{ id: string; name: string; status: string; autoApprove: boolean; runs: RuleRun[] }>(
    `/automation/rules/${ruleId}/enable`,
    autoApprove === undefined ? {} : { autoApprove },
  );
}

export function patchRule(ruleId: string, body: { autoApprove?: boolean }) {
  return apiPatch<{ id: string; status: string; autoApprove: boolean }>(
    `/automation/rules/${ruleId}`,
    body,
  );
}

export async function fetchEntityRuleRuns(entityId: string): Promise<RuleRun[]> {
  return apiGet<RuleRun[]>(`/entities/${entityId}/automation/runs`);
}

export type { AutomationRule, RuleRun };