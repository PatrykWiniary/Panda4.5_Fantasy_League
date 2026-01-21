export type ProfileAvatarKey = string;

const AVATAR_KEY_REGEX = /^[a-z0-9-]{1,80}$/i;

export function isValidProfileAvatar(value: unknown): value is ProfileAvatarKey {
  if (typeof value !== "string") {
    return false;
  }
  return AVATAR_KEY_REGEX.test(value.trim());
}

export function normalizeProfileAvatar(
  value: unknown
): ProfileAvatarKey | null {
  if (!isValidProfileAvatar(value)) {
    return null;
  }
  return value.trim().toLowerCase();
}
