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
    multiplier?: Card["multiplier"]
): SampleCard => ({
    id,
    name,
    role,
    points,
    value,
    description,
    ...(multiplier ? { multiplier } : {}),
});

export const SAMPLE_CARDS: SampleCard[] = [
    makeCard("jgl-flay", "FlayMaster", "Jgl", 14, 9, "Agresywny jungler nastawiony na szybkie ganki."),
    makeCard("mid-arcana", "Arcana", "Mid", 16, 10, "Kontrolujący mid laner z silną fazą linii.", "Captain"),
    makeCard("top-stone", "Stonewall", "Top", 12, 8, "Tank na topie z potężnym engage."),
    makeCard("adc-skybolt", "Skybolt", "Adc", 18, 11, "Hypercarry w późnej fazie gry.", "Vice-captain"),
    makeCard("sup-ember", "Emberlight", "Supp", 10, 6, "Support wspierający drużynę tarczami i leczeniem."),
    makeCard("jgl-phantom", "Phantom V", "Jgl", 13, 7, "Farmiący jungler skalujący się w mid-game."),
    makeCard("mid-sage", "Sage of Dawn", "Mid", 15, 9, "Mag z dużym zasięgiem kontroli tłumu."),
    makeCard("top-rift", "Riftbreaker", "Top", 11, 7, "Bruiser łączący ofensywę z defensywą."),
    makeCard("adc-viper", "Scarlet Viper", "Adc", 17, 10, "Snajper pozycjonujący się na tyłach walki."),
    makeCard("sup-warden", "Warden Sol", "Supp", 9, 5, "Support inicjujący walki i broniący carry."),
];

export function getSampleCards() {
    return SAMPLE_CARDS;
}
