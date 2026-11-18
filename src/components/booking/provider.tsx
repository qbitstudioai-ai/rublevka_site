import type { ComponentType } from "react";
import type { Stay } from "@/content/stay-request";
export const providerModes = ["none", "bnovo", "travelline"] as const;
export type ProviderMode = (typeof providerModes)[number];
// A contracted adapter owns its official embed, redirect or date widget and parameter mapping.
export const bookingAdapters: Partial<
  Record<ProviderMode, ComponentType<{ stay: Stay }>>
> = {};
export function configuredMode(value: string | undefined): ProviderMode {
  return providerModes.find((mode) => mode === value) ?? "none";
}
