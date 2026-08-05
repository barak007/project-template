import type { Organization } from "./api.js";

export type AuthUser = { id: string; name: string; email: string };
export type AuthError = { code: string; message: string };

export type AuthState =
  | { status: "anonymous"; error?: AuthError }
  | { status: "authenticated"; user: AuthUser };

export type ClientState = {
  auth: AuthState;
  organizations: Organization[];
};

export const initialState: ClientState = {
  auth: { status: "anonymous" },
  organizations: [],
};
