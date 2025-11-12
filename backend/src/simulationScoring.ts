import { Card, Deck, Player, Role } from "./Types";
import { cloneDeck, REQUIRED_ROLES } from "./deckManager";

const MULTIPLIER_VALUES: Record<NonNullable<Card["multiplier"]>, number> = {
  Captain: 2,
  "Vice-captain": 1.5,
};

export type DeckScoreEntry = {
  role: Role;
  playerId?: number;
  playerName: string;
  baseScore: number;
  multiplier: number;
  multiplierLabel?: Card["multiplier"];
  totalScore: number;
};

export type DeckScoreResult = {
  deck: Deck;
  totalScore: number;
  entries: DeckScoreEntry[];
  missingRoles: Role[];
};

export function calculatePlayerScore(player: Player): number {
  const csContribution = Math.floor(player.cs / 10);
  const goldContribution = Math.floor((player.gold ?? 0) / 500);
  return (
    player.kills * 3 +
    player.assists * 2 -
    player.deaths +
    csContribution +
    goldContribution
  );
}

function resolveMultiplier(multiplier?: Card["multiplier"]): number {
  if (!multiplier) {
    return 1;
  }
  return MULTIPLIER_VALUES[multiplier] ?? 1;
}

export function scoreDeckAgainstPlayers(deck: Deck, players: Player[]): DeckScoreResult {
  const scoredDeck = cloneDeck(deck);
  const entries: DeckScoreEntry[] = [];
  const missingRoles: Role[] = [];

  const playersById = new Map<number, Player>();
  const playersByName = new Map<string, Player>();

  for (const player of players) {
    playersById.set(player.id, player);
    playersByName.set(player.name.toLowerCase(), player);
    if (player.nickname) {
      playersByName.set(player.nickname.toLowerCase(), player);
    }
  }

  for (const role of REQUIRED_ROLES) {
    const card = scoredDeck.slots[role];
    if (!card) {
      missingRoles.push(role);
      continue;
    }

    const candidate =
      (card.playerId ? playersById.get(card.playerId) : undefined) ??
      playersByName.get(card.name.toLowerCase());

    if (!candidate) {
      card.tournamentPoints = 0;
      missingRoles.push(role);
      continue;
    }

    const baseScore = calculatePlayerScore(candidate);
    const multiplierValue = resolveMultiplier(card.multiplier);
    const totalScore = Math.round(baseScore * multiplierValue);

    card.tournamentPoints = totalScore;

    entries.push({
      role,
      playerId: candidate.id,
      playerName: candidate.nickname ?? candidate.name,
      baseScore,
      multiplier: multiplierValue,
      multiplierLabel: card.multiplier,
      totalScore,
    });
  }

  const totalScore = entries.reduce((acc, entry) => acc + entry.totalScore, 0);

  return {
    deck: scoredDeck,
    totalScore,
    entries,
    missingRoles,
  };
}
