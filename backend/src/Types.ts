export interface Room {
    id: number
}

export type Role = "Mid" | "Top" | "Jgl" | "Adc" | "Supp";

export type RoleInput =
    | Role
    | Lowercase<Role>
    | "jg"
    | "bot"
    | "sup";

export interface Card {
    name: string;
    points: number;
    value: number;
    multiplier?: "Captain" | "Vice-captain";
    role: Role;
}

export type DeckSlots = Record<Role, Card | null>;

export interface Deck {
    userId?: number;
    slots: DeckSlots;
}

export type CompleteDeck = {
    userId?: number;
    slots: Record<Role, Card>;
};

export type DeckSummary = {
    complete: boolean;
    missingRoles: Role[];
};

export type DeckSaveResult =
    | {
        status: "saved";
        deck: CompleteDeck;
    }
    | {
        status: "warning";
        deck: Deck;
        missingRoles: Role[];
        message: string;
    };

export interface User {
    name: string,
    mail: string,
    password: string
    currency: number
    //deck: Deck
}

export interface Region{
    id: number,
    name: string
}

export interface Player {
  id: number;
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  region_id: number;
}
