import { apiGet, apiPatch, API_BASE } from "@/lib/api/client";
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
  const res = await fetch(`${API_BASE}/coach/personal/loop-actions/${encodeURIComponent(actionId)}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Action failed");
  }
  return json as { success: boolean; data: PersonalCoachHome; message: string };
}
