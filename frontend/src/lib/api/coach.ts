import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type { PersonalAutomationState, PersonalCoachHome } from "@/lib/types";

export async function fetchPersonalCoach() {
  return apiGet<PersonalCoachHome>("/coach/personal/home");
}

export async function fetchPersonalAutomation() {
  return apiGet<PersonalAutomationState>("/coach/personal/automation");
}

export async function setPersonalAutomation(enabled: boolean) {
  return apiPatch<{
    success: boolean;
    automation: PersonalAutomationState;
    coach: PersonalCoachHome;
  }>("/coach/personal/automation", { enabled });
}

export async function executeLoopAction(actionId: string) {
  return apiPost<{ success: boolean; data: PersonalCoachHome; message: string }>(
    `/coach/personal/loop-actions/${encodeURIComponent(actionId)}/execute`,
    { confirm: true },
  );
}
