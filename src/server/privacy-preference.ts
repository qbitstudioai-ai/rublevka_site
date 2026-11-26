export const privacyChoicePath = "/privacy-choice";
export const privacyPreferenceCookie = "rublevka_cookie_preference_v2";
export const privacyPreferenceLifetime = 30 * 24 * 60 * 60;

export function isPrivacyPreference(value: unknown): value is "accepted" | "declined" {
  return value === "accepted" || value === "declined";
}
