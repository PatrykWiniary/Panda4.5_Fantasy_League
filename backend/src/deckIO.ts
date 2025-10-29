import { Card, Deck, DeckSummary, Role, RoleInput } from "./Types";
import {
  createDeck,
  normalizeRole,
  REQUIRED_ROLES,
  summarizeDeck,
} from "./deckManager";

export type DeckPayloadErrorCode =
  | "INVALID_CARD"
  | "INVALID_DECK"
  | "INVALID_USER_ID";

export class DeckPayloadError extends Error {
  constructor(
    public readonly code: DeckPayloadErrorCode,
    message: string,
    public readonly meta?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DeckPayloadError";
  }
}

type UnknownRecord = Record<string, unknown>;

function coerceNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function safeNormalizeRole(role: RoleInput | string | undefined): Role | null {
  if (!role) {
    return null;
  }

  try {
    return normalizeRole(role as RoleInput);
  } catch {
    return null;
  }
}

export function parseCardPayload(payload: unknown, roleHint?: RoleInput): Card {
  if (!payload || typeof payload !== "object") {
    throw new DeckPayloadError(
      "INVALID_CARD",
      "Card payload must be an object."
    );
  }

  const raw = payload as UnknownRecord;
  const name = raw.name;
  const roleCandidate = roleHint ?? (raw.role as RoleInput | undefined);
  const role = safeNormalizeRole(roleCandidate);

  if (typeof name !== "string" || name.trim() === "" || !role) {
    throw new DeckPayloadError(
      "INVALID_CARD",
      "Card payload is missing mandatory fields.",
      {
        name,
        role: roleCandidate,
      }
    );
  }

  const card: Card = {
    name: name.trim(),
    role,
    points: coerceNumber(raw.points),
    value: coerceNumber(raw.value),
  };

  if (raw.multiplier === "Captain" || raw.multiplier === "Vice-captain") {
    card.multiplier = raw.multiplier;
  }

  if (
    typeof raw.playerId === "number" &&
    Number.isInteger(raw.playerId) &&
    raw.playerId > 0
  ) {
    card.playerId = raw.playerId;
  }

  if (typeof raw.tournamentPoints === "number") {
    const normalizedScore = Number(raw.tournamentPoints);
    if (Number.isFinite(normalizedScore)) {
      card.tournamentPoints = normalizedScore;
    }
  }

  return card;
}

export function parseDeckPayload(payload: unknown): Deck {
  if (!payload || typeof payload !== "object") {
    return createDeck();
  }

  const raw = payload as UnknownRecord;
  const slotsInput =
    typeof raw.slots === "object" && raw.slots
      ? (raw.slots as UnknownRecord)
      : {};

  const slots: Partial<Record<Role, Card | null>> = {};

  for (const [key, value] of Object.entries(slotsInput)) {
    const role = safeNormalizeRole(key);
    if (!role) {
      continue;
    }

    if (value && typeof value === "object") {
      slots[role] = parseCardPayload(value, role);
    } else {
      slots[role] = null;
    }
  }

  for (const role of REQUIRED_ROLES) {
    if (!(role in slots)) {
      slots[role] = null;
    }
  }

  const userId =
    typeof raw.userId === "number" && Number.isInteger(raw.userId)
      ? raw.userId
      : undefined;

  const options: {
    userId?: number;
    slots?: Partial<Record<Role, Card | null>>;
  } = { slots };
  if (userId !== undefined) {
    options.userId = userId;
  }

  return createDeck(options);
}

export function parseUserId(value: unknown): number {
  const userId = Number(value);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new DeckPayloadError(
      "INVALID_USER_ID",
      "User identifier must be a positive integer.",
      { value }
    );
  }
  return userId;
}

export function toDeckResponse(deck: Deck): {
  deck: Deck;
  summary: DeckSummary;
} {
  return {
    deck,
    summary: summarizeDeck(deck),
  };
}
