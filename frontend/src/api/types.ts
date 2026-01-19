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
  tutorialSeen?: boolean;
};

export type LobbySummary = {
  id: number;
  name: string;
  entryFee: number;
  hostId: number | null;
  playerCount: number;
  passwordProtected: boolean;
  status: "waiting" | "started";
  startedAt: string | null;
  readyCount: number;
  allReady: boolean;
};

export type LobbyListEntry = {
  id: number;
  name: string;
  entryFee: number;
  playerCount: number;
  passwordProtected: boolean;
  status: "waiting" | "started";
};

export type LobbyPlayer = {
  id: number;
  name: string;
  avatar: string | null;
  isHost: boolean;
  ready: boolean;
};

export type LobbyResponse = {
  lobby: LobbySummary;
  players: LobbyPlayer[];
};

export type LobbyListResponse = {
  lobbies: LobbyListEntry[];
};

export type LobbyByUserResponse = {
  lobby: LobbyResponse | null;
};

export type LeaderboardEntry = {
  id: number;
  name: string;
  score: number;
  currency: number;
  passiveGold: number;
  position: number;
};

export type LeaderboardResponse = {
  top: LeaderboardEntry[];
  totalUsers: number;
  userEntry: LeaderboardEntry | null;
  userInTop: boolean;
};

export type LobbyLeaderboardResponse = {
  leaderboard: LeaderboardEntry[];
};

export type TournamentPlayerAggregate = {
  playerId: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
};

export type TournamentPlayerStatsResponse = {
  tournamentId?: number;
  players: TournamentPlayerAggregate[];
};

export type MatchObjectives = {
  towers: number;
  dragons: number;
  barons: number;
};

export type MatchHistoryEntry = {
  id: number;
  region: string;
  teamA: string;
  teamB: string;
  winner: string;
  mvp?: string | null;
  mvpScore?: number | null;
  createdAt: string;
  isTournament: boolean;
  tournamentId?: number | null;
  tournamentMatchId?: number | null;
  tournamentGameId?: number | null;
  stage?: string | null;
  roundName?: string | null;
  gameNumber?: number | null;
  seriesBestOf?: number | null;
  seriesScore?: string | null;
  objectives: {
    teamA: MatchObjectives;
    teamB: MatchObjectives;
  };
};

export type MatchPlayerHistoryEntry = {
  id: number;
  matchId: number;
  playerId?: number | null;
  name: string;
  nickname?: string | null;
  role?: string | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  score: number;
  teamName?: string | null;
  teamSide?: "A" | "B" | null;
};

export type MatchHistoryResponse = {
  series: MatchHistorySeriesEntry[];
  total: number;
};

export type MatchHistoryDetailResponse = {
  match: MatchHistoryEntry;
  players: MatchPlayerHistoryEntry[];
};

export type MatchHistorySeriesEntry = {
  id: number;
  isTournament: boolean;
  stage?: string | null;
  roundName?: string | null;
  bestOf: number;
  completed: boolean;
  startedAt: string;
  completedAt: string;
  seriesScore?: string | null;
  tournamentId?: number | null;
  teamA: {
    name: string;
    id?: number | null;
    score: number;
  };
  teamB: {
    name: string;
    id?: number | null;
    score: number;
  };
  games: MatchHistoryEntry[];
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

export type MarketPlayer = PlayerOverview & {
  marketValue: number;
  recentPrices: number[];
  trendDelta: number;
};

export type MarketPlayersResponse = {
  players: MarketPlayer[];
  filters: {
    role?: DeckRole;
    regionId?: number;
    teamId?: number;
  };
  trendLimit: number;
};

export type OwnedPlayer = PlayerOverview & {
  marketValue: number;
  recentPrices: number[];
  trendDelta: number;
  acquiredAt: string;
};

export type CollectionResponse = {
  players: OwnedPlayer[];
  trendLimit: number;
};

export type MarketSellResponse = {
  deck: Deck;
  summary: DeckSummary;
  sold: {
    role: DeckRole;
    playerId?: number;
    name: string;
    previousValue: number;
    marketValue: number;
    score?: number;
    source: "player" | "card";
  };
  currency: number;
};

export type TransferStateResponse = {
  tournamentId?: number | null;
  stage?: string | null;
  currency: number;
  windowOpen: boolean;
  windowLabel: string;
  transferLimit?: number | null;
  transfersUsed?: number | null;
  transferFeePerCard: number;
  remainingTransfers?: number | null;
};

export type TransferHistoryEntry = {
  id: number;
  action: "buy" | "sell";
  role: DeckRole;
  playerId?: number | null;
  playerName: string;
  price: number;
  fee: number;
  tournamentId?: number | null;
  stage?: string | null;
  createdAt: string;
};

export type TransferHistoryResponse = {
  history: TransferHistoryEntry[];
  limit: number;
};

export type UserBoost = {
  id: number;
  userId: number;
  tournamentId?: number | null;
  boostType: "DOUBLE_POINTS" | "HOT_STREAK";
  scope: "match" | "tournament";
  assignedPlayerId?: number | null;
  usesRemaining: number;
  createdAt: string;
};

export type BoostsResponse = {
  boosts: UserBoost[];
};

export type BoostAssignResponse = {
  boost: UserBoost;
};

export type MarketBuyResponse = {
  purchased: {
    role: DeckRole;
    playerId: number;
    name: string;
    marketValue: number;
    score: number;
  };
  currency: number;
};

export type GroupedPlayersResponse = {
  groupedByRole: Record<DeckRole, PlayerOverview[]>;
  filters: {
    role?: DeckRole;
    regionId?: number;
    teamId?: number;
  };
};

export type TournamentMatchTeam = {
  id?: number | null;
  name?: string | null;
  score: number;
};

export type TournamentMatchSummary = {
  id: number;
  stage: string;
  roundName: string;
  roundNumber: number;
  matchNumber: number;
  bestOf: number;
  status: string;
  teamA: TournamentMatchTeam | null;
  teamB: TournamentMatchTeam | null;
  winnerTeamId?: number | null;
  seriesScore?: string | null;
  games?: MatchHistoryEntry[];
};

export type TournamentGroupStanding = {
  teamId: number;
  teamName: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  seed?: number | null;
};

export type TournamentGroupSummary = {
  id: number;
  name: string;
  teams: TournamentGroupStanding[];
  matches: TournamentMatchSummary[];
};

export type TournamentBracketRound = {
  name: string;
  matches: TournamentMatchSummary[];
};

export type TournamentControlState = {
  tournament: {
    id: number;
    name: string;
    region: Region;
    status: string;
    stage: string;
    isActive: boolean;
    startedAt?: string | null;
    completedAt?: string | null;
    nextMatch?: TournamentMatchSummary | null;
  } | null;
  groups: TournamentGroupSummary[];
  bracket: {
    rounds: TournamentBracketRound[];
  };
};

export type TournamentSimulationResult = {
  matches: TournamentMatchSummary[];
  state: TournamentControlState;
};

export type PlayerProfileDetails = {
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
  team: {
    id: number;
    name: string;
    tournamentName: string;
  };
  region: Region;
};

export type PlayerMatchAppearance = {
  matchId: number;
  createdAt: string;
  region: string;
  stage?: string | null;
  roundName?: string | null;
  bestOf?: number | null;
  isTournament: boolean;
  teamA: string;
  teamB: string;
  winner: string;
  stats: {
    role?: string | null;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    gold: number;
    score: number;
    teamName?: string | null;
    teamSide?: "A" | "B" | null;
  };
};

export type PlayerProfileResponse = {
  player: PlayerProfileDetails;
  matches: PlayerMatchAppearance[];
};
