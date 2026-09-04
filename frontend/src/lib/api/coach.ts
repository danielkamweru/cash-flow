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

export async function executePaymentAction(actionId: string) {
  return apiPost<{ success: boolean; data: PersonalCoachHome; message: string }>(
    `/coach/personal/payment-actions/${encodeURIComponent(actionId)}/execute`,
    { confirm: true },
  );
}
