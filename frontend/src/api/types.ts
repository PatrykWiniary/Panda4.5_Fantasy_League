export type DeckRole = "Top" | "Jgl" | "Mid" | "Adc" | "Supp";

export type DeckCard = {
  name: string;
  role: DeckRole;
  points: number;
  value: number;
  multiplier?: "Captain" | "Vice-captain";
  playerId?: number;
  tournamentPoints?: number;
};

export type Deck = {
  userId?: number;
  slots: Record<DeckRole, DeckCard | null>;
};

export type DeckSummary = {
  complete: boolean;
  missingRoles: DeckRole[];
  totalValue: number;
  currencyCap?: number;
};

export type DeckResponse = {
  deck: Deck;
  summary: DeckSummary;
};

export type DeckSaveSuccess = {
  deck: Deck;
  summary: DeckSummary;
  status?: "saved";
};

export type DeckSaveWarning = {
  error: "DECK_INCOMPLETE";
  message: string;
  missingRoles: DeckRole[];
  deck: Deck;
  summary: DeckSummary;
};

export type ApiUser = {
  id: number;
  name: string;
  mail: string;
  currency: number;
  score?: number;
  avatar?: string | null;
};

export type Region = {
  id: number;
  name: string;
};

export type TeamOverview = {
  id: number;
  name: string;
  regionId: number;
  regionName: string;
  tournamentId: number;
  tournamentName: string;
  playerCount: number;
};

export type PlayerOverview = {
  id: number;
  name: string;
  nickname?: string | null;
  role: DeckRole;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  score: number;
  region: Region;
  team: {
    id: number;
    name: string;
    tournamentId: number;
    tournamentName: string;
  };
};

export type GroupedPlayersResponse = {
  groupedByRole: Record<DeckRole, PlayerOverview[]>;
  filters: {
    role?: DeckRole;
    regionId?: number;
    teamId?: number;
  };
};
