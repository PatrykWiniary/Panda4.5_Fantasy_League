import { Card, Role } from "./Types";

export type SampleCard = Card & {
  id: string;
  description: string;
};

const makeCard = (
  id: string,
  name: string,
  role: Role,
  points: number,
  value: number,
  description: string,
  multiplier?: Card["multiplier"],
  playerId?: number
): SampleCard => ({
  id,
  name,
  role,
  points,
  value,
  description,
  ...(multiplier ? { multiplier } : {}),
  ...(playerId ? { playerId } : {}),
});

export const SAMPLE_CARDS: SampleCard[] = [
  makeCard(
    "top-stone",
    "Stonewall",
    "Top",
    12,
    8,
    "Tank na topie z poteznym engage.",
    undefined,
    1
  ),
  makeCard(
    "jgl-flay",
    "FlayMaster",
    "Jgl",
    14,
    9,
    "Agresywny jungler nastawiony na szybkie ganki.",
    undefined,
    2
  ),
  makeCard(
    "mid-arcana",
    "Arcana",
    "Mid",
    16,
    10,
    "Kontrolujacy mid laner z silna faza linii.",
    "Captain",
    3
  ),
  makeCard(
    "adc-skybolt",
    "Skybolt",
    "Adc",
    18,
    11,
    "Hypercarry w poznej fazie gry.",
    "Vice-captain",
    4
  ),
  makeCard(
    "sup-ember",
    "Emberlight",
    "Supp",
    10,
    6,
    "Support wspierajacy druzyne tarczami i leczeniem.",
    undefined,
    5
  ),
  makeCard(
    "top-rift",
    "Riftbreaker",
    "Top",
    11,
    7,
    "Bruiser laczacy ofensywe z defensywa.",
    undefined,
    6
  ),
  makeCard(
    "jgl-phantom",
    "Phantom V",
    "Jgl",
    13,
    7,
    "Farmiacy jungler skalujacy sie w mid game.",
    undefined,
    7
  ),
  makeCard(
    "mid-sage",
    "Sage of Dawn",
    "Mid",
    15,
    9,
    "Mag z duzym zasiegiem kontroli tlumu.",
    undefined,
    8
  ),
  makeCard(
    "adc-viper",
    "Scarlet Viper",
    "Adc",
    17,
    10,
    "Snajper pozycjonujacy sie na tylach walki.",
    undefined,
    9
  ),
  makeCard(
    "sup-warden",
    "Warden Sol",
    "Supp",
    9,
    5,
    "Support inicjujacy walki i broniacy carry.",
    undefined,
    10
  ),
];

export function getSampleCards() {
  return SAMPLE_CARDS;
}
