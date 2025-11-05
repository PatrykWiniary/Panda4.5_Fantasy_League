export interface Room {
  id: number;
}

export type Role = "Mid" | "Top" | "Jgl" | "Adc" | "Supp";

export type RoleInput = Role | Lowercase<Role>;

export interface Card {
  name: string;
  points: number;
  value: number;
  multiplier?: "Captain" | "Vice-captain";
  playerId?: number;
  tournamentPoints?: number;
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
  totalValue: number;
  // Optional snapshot of the currency cap used during validation.
  currencyCap?: number;
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
      overBudgetBy?: number;
    };

export interface User {
  name: string;
  mail: string;
  password: string;
  currency: number;
  score?: number;
  //deck: Deck
}

export interface Region {
  id: number;
  name: string;
}

export interface Player {
  id: number;
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  role: string;
  gold: number;
  region_id: number;
  team_id: number;
}
