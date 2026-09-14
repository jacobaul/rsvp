/** `"use server"` files may only export async functions, so state lives here. */
export type SettingsState = {
  status: "idle" | "saved" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialSettingsState: SettingsState = { status: "idle" };
