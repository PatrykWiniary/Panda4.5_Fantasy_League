import fakerImage from "../assets/playerPics/Faker.webp";

const playerImageModules = import.meta.glob("../assets/playerPics/*.webp", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const PLAYER_IMAGE_MAP: Record<string, string> = Object.entries(
  playerImageModules
).reduce((acc, [path, src]) => {
  const fileName = path.split("/").pop() ?? "";
  const key = normalizeImageKey(fileName.replace(/\.webp$/i, ""));
  acc[key] = src;
  return acc;
}, {} as Record<string, string>);

function normalizeImageKey(value: string | undefined | null): string {
  if (!value) {
    return "";
  }
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function resolvePlayerImage(name?: string | null): string {
  const key = normalizeImageKey(name);
  if (key && PLAYER_IMAGE_MAP[key]) {
    return PLAYER_IMAGE_MAP[key];
  }
  return fakerImage;
}
