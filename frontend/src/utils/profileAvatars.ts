import defaultAvatar from "../assets/user.svg";

export type ProfileAvatarOption = {
  key: string;
  label: string;
  image: string;
};

const avatarModules = import.meta.glob("../assets/profilePics/*", {
  eager: true,
  import: "default",
});

function fileNameFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function stripSuffixPatterns(baseName: string): string {
  let result = baseName;
  result = result.replace(/(?:[_-]?profileicon)$/i, "");
  result = result.replace(/(?:[-_]?icon[-_]?\d+)$/i, "");
  return result.replace(/[-_]+$/g, "");
}

function baseName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return stripSuffixPatterns(withoutExtension);
}

function createKeyFromFileName(fileName: string): string {
  return baseName(fileName)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function createLabelFromFileName(fileName: string): string {
  const cleaned = baseName(fileName)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "Avatar";
  }
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

const generatedOptions: ProfileAvatarOption[] = Object.entries(avatarModules)
  .map(([path, moduleExport]) => {
    const src = moduleExport as string;
    const fileName = fileNameFromPath(path);
    return {
      key: createKeyFromFileName(fileName),
      label: createLabelFromFileName(fileName),
      image: src,
    };
  })
  .filter((option) => Boolean(option.image))
  .sort((a, b) => a.label.localeCompare(b.label));

export const PROFILE_AVATAR_OPTIONS: ProfileAvatarOption[] =
  generatedOptions.length > 0
    ? generatedOptions
    : [
        {
          key: "default",
          label: "Default",
          image: defaultAvatar,
        },
      ];

export function resolveProfileAvatar(key?: string | null): string {
  if (!key) {
    return defaultAvatar;
  }
  const match = PROFILE_AVATAR_OPTIONS.find((option) => option.key === key);
  return match?.image ?? defaultAvatar;
}
