import { apiGet, apiPost, setAuthToken } from "@/lib/api/client";
import type { ApiUser } from "@/lib/api/types";

export type LoopAuthorization = {
  authorized: boolean;
  provider: string;
  product: string;
  message: string;
  tokenType?: string;
  expiresIn?: number;
  tokenUrl?: string;
  myApps?: string;
};

export type AuthResponse = {
  token: string;
  tokenType: string;
  user: ApiUser;
  loopAuthorization: LoopAuthorization;
};

export type MeResponse = {
  user: ApiUser;
  loopAuthorization: LoopAuthorization;
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

export async function reauthorizeLoop(): Promise<{ success: boolean; loopAuthorization: LoopAuthorization }> {
  return apiPost("/auth/loop-authorize");
}

export function signOut() {
  setAuthToken(null);
}
