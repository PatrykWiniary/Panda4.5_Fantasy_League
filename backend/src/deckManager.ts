import { Card, CompleteDeck, Deck, DeckSlots, DeckSummary, Role, RoleInput } from "./Types";

export const REQUIRED_ROLES: Role[] = ["Top", "Jgl", "Mid", "Adc", "Supp"];
const UNIQUE_MULTIPLIERS: Array<NonNullable<Card["multiplier"]>> = ["Captain", "Vice-captain"];

const ROLE_ALIAS_MAP: Record<string, Role> = { //Not used roles can be deleted, for now only roles from REQUIRED_ROLES are valid
    top: "Top",
    jg: "Jgl",
    jgl: "Jgl",
    jungle: "Jgl",
    mid: "Mid",
    middle: "Mid",
    adc: "Adc",
    bot: "Adc",
    bottom: "Adc",
    support: "Supp",
    supp: "Supp",
    sup: "Supp",
};

export type DeckErrorCode =
    | "ROLE_NOT_FOUND"
    | "ROLE_ALREADY_OCCUPIED"
    | "ROLE_EMPTY"
    | "ROLE_MISMATCH"
    | "CURRENCY_LIMIT_EXCEEDED"
    | "MULTIPLIER_CONFLICT";

export class DeckError extends Error {
    constructor(
        public readonly code: DeckErrorCode,
        message: string,
        public readonly meta?: Record<string, unknown>
    ) {
        super(message);
        this.name = "DeckError";
    }
}

export function normalizeRole(role: RoleInput): Role {
    if (REQUIRED_ROLES.includes(role as Role)) {
        return role as Role;
    }

    const normalized = role.toString().trim().toLowerCase();
    const mapped = ROLE_ALIAS_MAP[normalized];

    if (!mapped) {
        throw new DeckError("ROLE_NOT_FOUND", `Unsupported role: ${role}`);
    }

    return mapped;
}

export function createDeck(options: { userId?: number; slots?: Partial<Record<Role, Card | null>> } = {}): Deck {
    const { userId, slots = {} } = options;
    const normalizedSlots: DeckSlots = REQUIRED_ROLES.reduce((acc, role) => {
        const card = slots[role] ?? null;
        acc[role] = card ? { ...card, role } : null;
        return acc;
    }, {} as DeckSlots);

    const deck: Deck = { slots: normalizedSlots };
    if (userId !== undefined) {
        deck.userId = userId;
    }
    return deck;
}

export function createEmptyDeck(): Deck {
    return createDeck();
}

export function cloneDeck(deck: Deck): Deck {
    const options: { userId?: number; slots?: Partial<Record<Role, Card | null>> } = {
        slots: deck.slots,
    };
    if (deck.userId !== undefined) {
        options.userId = deck.userId;
    }
    return createDeck(options);
}

export function addCardToDeck(deck: Deck, card: Card): Deck {
    const role = normalizeRole(card.role);
    validateCardRole(card, role);
    assertMultiplierAvailability(deck, card.multiplier);
    const nextDeck = cloneDeck(deck);
    const slots = nextDeck.slots;

    if (slots[role]) {
        throw new DeckError("ROLE_ALREADY_OCCUPIED", `Role ${role} already has a card assigned.`, {
            role,
            occupiedBy: slots[role],
        });
    }

    slots[role] = card;
    return nextDeck;
}

export function removeCardFromDeck(deck: Deck, roleInput: RoleInput): Deck {
    const role = normalizeRole(roleInput);
    const nextDeck = cloneDeck(deck);
    const slots = nextDeck.slots;

    if (!slots[role]) {
        throw new DeckError("ROLE_EMPTY", `Role ${role} does not have a card to remove.`, { role });
    }

    slots[role] = null;
    return nextDeck;
}

export function replaceCardInDeck(deck: Deck, roleInput: RoleInput, newCard: Card): Deck {
    const role = normalizeRole(roleInput);
    validateCardRole(newCard, role);
    assertMultiplierAvailability(deck, newCard.multiplier, role);
    const nextDeck = cloneDeck(deck);
    const slots = nextDeck.slots;

    if (!slots[role]) {
        throw new DeckError("ROLE_EMPTY", `Role ${role} is empty. Use addCardToDeck instead.`, { role });
    }

    slots[role] = newCard;
    return nextDeck;
}
//todo: remove if not used in future
export function upsertCardInDeck(deck: Deck, roleInput: RoleInput, card: Card): Deck {
    const role = normalizeRole(roleInput);
    validateCardRole(card, role);
    assertMultiplierAvailability(deck, card.multiplier, role);
    const nextDeck = cloneDeck(deck);
    const slots = nextDeck.slots;

    slots[role] = card;
    return nextDeck;
}

export function isDeckComplete(deck: Deck): deck is CompleteDeck {
    return REQUIRED_ROLES.every((role) => Boolean(deck.slots[role]));
}

export function getMissingRoles(deck: Deck): Role[] {
    return REQUIRED_ROLES.filter((role) => !deck.slots[role]);
}

export function calculateDeckValue(deck: Deck): number {
    // Sum the value of every assigned card; empty slots contribute nothing.
    return REQUIRED_ROLES.reduce((total, role) => {
        const card = deck.slots[role];
        return card ? total + card.value : total;
    }, 0);
}

export function summarizeDeck(deck: Deck): DeckSummary {
    const missingRoles = getMissingRoles(deck);
    return {
        complete: missingRoles.length === 0,
        missingRoles,
        totalValue: calculateDeckValue(deck),
    };
}

export function ensureUniqueMultipliers(deck: Deck): void {
    for (const role of REQUIRED_ROLES) {
        const card = deck.slots[role];
        if (card?.multiplier) {
            assertMultiplierAvailability(deck, card.multiplier, role);
        }
    }
}

export function ensureDeckComplete(deck: Deck): CompleteDeck {
    if (!isDeckComplete(deck)) {
        throw new DeckError(
            "ROLE_EMPTY",
            "Deck is incomplete - every role must have a card before saving.",
            { missingRoles: getMissingRoles(deck) }
        );
    }

    const slots = REQUIRED_ROLES.reduce((acc, role) => {
        const card = deck.slots[role];
        if (!card) {
            throw new DeckError("ROLE_EMPTY", `Role ${role} is missing while validating completion.`);
        }
        acc[role] = card;
        return acc;
    }, {} as Record<Role, Card>);

    if (deck.userId === undefined) {
        return { slots };
    }

    return {
        userId: deck.userId,
        slots,
    };
}

function assertMultiplierAvailability(deck: Deck, multiplier?: Card["multiplier"], ignoredRole?: Role) {
    if (!multiplier || !UNIQUE_MULTIPLIERS.includes(multiplier)) {
        return;
    }

    const conflictRole = REQUIRED_ROLES.find((role) => {
        if (role === ignoredRole) {
            return false;
        }
        const existing = deck.slots[role];
        return existing?.multiplier === multiplier;
    });

    if (conflictRole) {
        throw new DeckError(
            "MULTIPLIER_CONFLICT",
            `Only one ${multiplier.toLowerCase()} card is allowed per deck.`,
            { multiplier, conflictRole }
        );
    }
}

function validateCardRole(card: Card, role: Role) {
    if (normalizeRole(card.role) !== role) {
        throw new DeckError(
            "ROLE_MISMATCH",
            `Card role (${card.role}) does not match requested slot (${role}).`,
            { card, role }
        );
    }
}

