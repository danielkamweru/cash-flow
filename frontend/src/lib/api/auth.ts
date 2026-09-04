import { apiGet, apiPost, setAuthToken } from "@/lib/api/client";
import type { ApiUser } from "@/lib/api/types";

export type AuthResponse = {
  token: string;
  tokenType: string;
  user: ApiUser;
};

export type MeResponse = {
  user: ApiUser;
};

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  /** 4-digit transaction PIN, set at signup and required for send-money. */
  pin: string;
}): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>("/auth/signup", input);
  setAuthToken(data.token);
  return data;
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>("/auth/signin", input);
  setAuthToken(data.token);
  return data;
}

export async function fetchMe(): Promise<MeResponse> {
  return apiGet<MeResponse>("/auth/me");
}

export function signOut() {
  setAuthToken(null);
}
