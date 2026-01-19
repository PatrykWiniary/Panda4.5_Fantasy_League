import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {
  getAllItems,
  addItem,
  addUser,
  getAllUsers,
  clearUsers,
  registerUser,
  loginUser,
  getDeck,
  getAllDecks,
  saveDeck,
  getUserCurrency,
  simulateData,
  addUserScore,
  getLeaderboardTop,
  getUserRankingEntry,
  getUsersCount,
  getRegions,
  getTeamsOverview,
  getPlayersOverview,
  getPlayersGroupedByRole,
  PlayerFilters,
  getMarketPlayers,
  buyCardForDeck,
  sellCardFromDeck,
  getTransferHistory,
  getTransferState,
  listBoosts,
  assignBoostToPlayer,
  getBoostMapForUser,
  consumeBoostByIdIfApplied,
  getUserCollection,
  updateUserAvatar,
  getRecentMatchHistory,
  getMatchHistoryCount,
  getMatchHistoryById,
  getMatchHistoryPlayers,
  clearMatchHistory,
  getTournamentState,
  startTournamentForRegion,
  simulateTournamentMatches,
  isTournamentActiveForRegion,
  getPlayerProfileDetails,
  getPlayerMatchAppearances,
  createLobby,
  joinLobby,
  leaveLobby,
  getLobbyById,
  getLobbyByUser,
  updateLobbySettings,
  startLobby,
  setLobbyReady,
  resetLobbyReady,
  getLobbyLeaderboard,
  getTournamentPlayerAggregates,
} from "./db";
import {
  addCardToDeck,
  removeCardFromDeck,
  replaceCardInDeck,
  createDeck,
  DeckError,
  summarizeDeck,
} from "./deckManager";
import { Deck, DeckSummary, Player, Role, RoleInput } from "./Types";
import {
  DeckPayloadError,
  parseCardPayload,
  parseDeckPayload,
  parseUserId,
  toDeckResponse,
} from "./deckIO";
import { getSampleCards } from "./cards";
import { DeckScoreEntry, scoreDeckAgainstPlayers } from "./simulationScoring";
import {
  isValidEmail,
  isPasswordStrong,
  PASSWORD_REQUIREMENTS_DESCRIPTION,
} from "./validation";
import { normalizeProfileAvatar } from "./profileAvatars";
import FootabalolGame from "./API/FootbalolGame";

const parsePositiveIntFromEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const ROLE_QUERY_MAP: Record<string, Role> = {
  top: "Top",
  toplane: "Top",
  jgl: "Jgl",
  jungle: "Jgl",
  mid: "Mid",
  middle: "Mid",
  adc: "Adc",
  bot: "Adc",
  carry: "Adc",
  supp: "Supp",
  support: "Supp",
};

function coerceQueryString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

function parseRoleQuery(value: unknown): Role | undefined {
  const raw = coerceQueryString(value);
  if (!raw) {
    return undefined;
  }
  return ROLE_QUERY_MAP[raw.trim().toLowerCase()];
}

function parsePositiveIntQuery(value: unknown): number | undefined {
  const raw = coerceQueryString(value);
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function parsePositiveIntBody(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseBooleanQuery(value: unknown): boolean {
  const raw = coerceQueryString(value);
  if (!raw) {
    return false;
  }
  return raw === "1" || raw.toLowerCase() === "true";
}

function parseIdListQuery(value: unknown): number[] {
  const raw = coerceQueryString(value);
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((parsed) => Number.isInteger(parsed) && parsed > 0);
}

function parseRegionIdParam(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

const AUTH_RATE_LIMIT_WINDOW_MS = parsePositiveIntFromEnv(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS,
  60_000
);
const AUTH_RATE_LIMIT_MAX = parsePositiveIntFromEnv(
  process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS ?? process.env.AUTH_RATE_LIMIT_MAX,
  10
);

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/api/items", (req, res) => {
  const items = getAllItems();
  res.json(items);
});

app.get("/api/users", (req, res) => {
  const users = getAllUsers();
  res.json(users);
});

app.get("/api/users/leaderboard", (req, res) => {
  const rawUserId = Array.isArray(req.query.userId)
    ? req.query.userId[0]
    : req.query.userId;

  let userId: number | undefined;
  if (typeof rawUserId === "string" && rawUserId.trim().length > 0) {
    const parsed = Number(rawUserId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return res.status(400).json({ error: "INVALID_USER_ID" });
    }
    userId = parsed;
  }

  const top = getLeaderboardTop(10);
  const totalUsers = getUsersCount();

  let userEntry = null;
  let userInTop = false;

  if (userId !== undefined) {
    const entry = getUserRankingEntry(userId);
    if (!entry) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }
    userInTop = top.some((candidate) => candidate.id === entry.id);
    userEntry = entry;
  }

  res.json({
    top,
    totalUsers,
    userEntry,
    userInTop,
  });
});

app.get("/api/matches/history", (req, res) => {
  const rawLimit = parsePositiveIntQuery(req.query.limit) ?? 10;
  const rawPage = parsePositiveIntQuery(req.query.page) ?? 1;
  const limit = Math.min(Math.max(rawLimit, 1), 50);
  const page = Math.max(rawPage, 1);
  const offset = (page - 1) * limit;
  try {
    const total = getMatchHistoryCount();
    const series = getRecentMatchHistory(limit, offset);
    res.json({ series, total });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "MATCH_HISTORY_FAILED" });
  }
});

app.delete("/api/matches/history", (_req, res) => {
  try {
    clearMatchHistory();
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "MATCH_HISTORY_CLEAR_FAILED" });
  }
});

app.get("/api/matches/:matchId", (req, res) => {
  const matchId = Number(req.params.matchId);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return res.status(400).json({ error: "INVALID_MATCH_ID" });
  }
  try {
    const match = getMatchHistoryById(matchId);
    if (!match) {
      return res.status(404).json({ error: "MATCH_NOT_FOUND" });
    }
    const players = getMatchHistoryPlayers(matchId);
    res.json({ match, players });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "MATCH_DETAILS_FAILED" });
  }
});

app.get("/api/players/:playerId/profile", (req, res) => {
  const playerId = Number(req.params.playerId);
  if (!Number.isInteger(playerId) || playerId <= 0) {
    return res.status(400).json({ error: "INVALID_PLAYER_ID" });
  }
  try {
    const player = getPlayerProfileDetails(playerId);
    if (!player) {
      return res.status(404).json({ error: "PLAYER_NOT_FOUND" });
    }
    const matches = getPlayerMatchAppearances(playerId, 25);
    res.json({ player, matches });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "PLAYER_PROFILE_FAILED" });
  }
});

app.post("/api/matches/simulate", (req, res) => {
  const rawRegion =
    req.body?.regionId ??
    (Array.isArray(req.query.regionId)
      ? req.query.regionId[0]
      : req.query.regionId);
  const parsed = Number(rawRegion);
  const regionId =
    Number.isInteger(parsed) && parsed > 0 ? parsed : Number(process.env.DEFAULT_REGION_ID ?? 1);
  if (isTournamentActiveForRegion(regionId)) {
    return res.status(409).json({
      error: "TOURNAMENT_ACTIVE",
      message: "Friendly matches are disabled while a tournament is active for this region.",
    });
  }
  try {
    const game = new FootabalolGame();
    game.setRegion(regionId);
    const result = game.simulateMatch();
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "MATCH_SIMULATION_FAILED" });
  }
});

app.get("/api/regions/:regionId/tournament", (req, res) => {
  const regionId = parseRegionIdParam(req.params.regionId);
  if (!regionId) {
    return res.status(400).json({ error: "INVALID_REGION_ID" });
  }
  try {
    const state = getTournamentState(regionId);
    res.json(state);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "TOURNAMENT_STATE_FAILED" });
  }
});

app.post("/api/regions/:regionId/tournament/start", (req, res) => {
  const regionId = parseRegionIdParam(req.params.regionId);
  if (!regionId) {
    return res.status(400).json({ error: "INVALID_REGION_ID" });
  }
  const { name, force } = req.body ?? {};
  const options: { name?: string; force?: boolean } = {};
  if (typeof name === "string" && name.trim().length > 0) {
    options.name = name.trim();
  }
  if (force === true) {
    options.force = true;
  }
  try {
    const state = startTournamentForRegion(regionId, {
      ...options,
    });
    res.status(201).json(state);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "REGION_NOT_FOUND") {
        return res.status(404).json({ error: "REGION_NOT_FOUND" });
      }
      if (error.message === "NOT_ENOUGH_TEAMS") {
        return res.status(400).json({ error: "NOT_ENOUGH_TEAMS" });
      }
      if (error.message === "TOURNAMENT_ALREADY_ACTIVE") {
        return res.status(409).json({ error: "TOURNAMENT_ALREADY_ACTIVE" });
      }
    }
    console.error(error);
    res.status(500).json({ error: "TOURNAMENT_START_FAILED" });
  }
});

app.post("/api/regions/:regionId/tournament/simulate", (req, res) => {
  const regionId = parseRegionIdParam(req.params.regionId);
  if (!regionId) {
    return res.status(400).json({ error: "INVALID_REGION_ID" });
  }
  const rawMode =
    (typeof req.body?.mode === "string" && req.body.mode) ||
    (typeof req.query.mode === "string" && req.query.mode) ||
    "next";
  const mode = rawMode.toLowerCase();
  if (!["next", "round", "full"].includes(mode)) {
    return res.status(400).json({ error: "INVALID_MODE" });
  }
  try {
    const result = simulateTournamentMatches(regionId, mode as "next" | "round" | "full");
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NO_ACTIVE_TOURNAMENT") {
        return res.status(409).json({ error: "NO_ACTIVE_TOURNAMENT" });
      }
      if (error.message === "NO_PENDING_MATCHES") {
        return res.status(409).json({ error: "NO_PENDING_MATCHES" });
      }
    }
    console.error(error);
    res.status(500).json({ error: "TOURNAMENT_SIMULATION_FAILED" });
  }
});

app.post("/api/items", (req, res) => {
  const { name, qty } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const item = addItem(name, qty ?? 0);
  res.status(201).json(item);
});

app.post("/api/users", (req, res) => {
  const { name, mail, password, currency } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const user = addUser({ name, mail, password, currency, avatar: null });
  res.status(201).json(user);
});

app.get("/api/cards", (_req, res) => {
  res.json(getSampleCards());
});

app.get("/api/regions", (_req, res) => {
  try {
    const regions = getRegions();
    res.json(regions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "REGION_FETCH_FAILED" });
  }
});

app.get("/api/teams", (req, res) => {
  try {
    const regionId = parsePositiveIntQuery(req.query.regionId);
    if (req.query.regionId !== undefined && regionId === undefined) {
      return res.status(400).json({ error: "INVALID_REGION_ID" });
    }
    const teams = getTeamsOverview(regionId);
    res.json({
      teams,
      filters: {
        regionId,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "TEAM_FETCH_FAILED" });
  }
});

app.get("/api/players", (req, res) => {
  try {
    const role = parseRoleQuery(req.query.role);
    if (req.query.role !== undefined && !role) {
      return res.status(400).json({ error: "INVALID_ROLE" });
    }

    const regionId = parsePositiveIntQuery(req.query.regionId);
    if (req.query.regionId !== undefined && regionId === undefined) {
      return res.status(400).json({ error: "INVALID_REGION_ID" });
    }

    const teamId = parsePositiveIntQuery(req.query.teamId);
    if (req.query.teamId !== undefined && teamId === undefined) {
      return res.status(400).json({ error: "INVALID_TEAM_ID" });
    }

    const filters: PlayerFilters = {};
    if (role) {
      filters.role = role;
    }
    if (regionId !== undefined) {
      filters.regionId = regionId;
    }
    if (teamId !== undefined) {
      filters.teamId = teamId;
    }

    const grouped = parseBooleanQuery(req.query.grouped);

    if (grouped) {
      const groupedByRole = getPlayersGroupedByRole(filters);
      return res.json({
        groupedByRole,
        filters,
      });
    }

    const players = getPlayersOverview(filters);
    res.json({
      players,
      filters,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "PLAYER_FETCH_FAILED" });
  }
});

app.get("/api/market/players", (req, res) => {
  try {
    const role = parseRoleQuery(req.query.role);
    if (req.query.role !== undefined && !role) {
      return res.status(400).json({ error: "INVALID_ROLE" });
    }

    const regionId = parsePositiveIntQuery(req.query.regionId);
    if (req.query.regionId !== undefined && regionId === undefined) {
      return res.status(400).json({ error: "INVALID_REGION_ID" });
    }

    const teamId = parsePositiveIntQuery(req.query.teamId);
    if (req.query.teamId !== undefined && teamId === undefined) {
      return res.status(400).json({ error: "INVALID_TEAM_ID" });
    }

    const filters: PlayerFilters = {};
    if (role) {
      filters.role = role;
    }
    if (regionId !== undefined) {
      filters.regionId = regionId;
    }
    if (teamId !== undefined) {
      filters.teamId = teamId;
    }

    const trendLimit = parsePositiveIntQuery(req.query.trendLimit);
    const clampedTrend = Math.min(Math.max(trendLimit ?? 5, 3), 10);
    const players = getMarketPlayers(filters, clampedTrend);
    res.json({
      players,
      filters,
      trendLimit: clampedTrend,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "MARKET_PLAYER_FETCH_FAILED" });
  }
});

app.post("/api/register", authLimiter, (req, res) => {
  const { name, mail, password, currency } = req.body;
  if (!name || !mail || !password) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  if (!isValidEmail(mail)) {
    return res
      .status(400)
      .json({
        error: "INVALID_EMAIL",
        message: "Podaj poprawny adres e-mail.",
      });
  }

  if (!isPasswordStrong(password)) {
    return res.status(400).json({
      error: "WEAK_PASSWORD",
      message: PASSWORD_REQUIREMENTS_DESCRIPTION,
    });
  }

  const rawAvatar = req.body?.avatar;
  let avatar: string | null = null;
  if (rawAvatar !== undefined && rawAvatar !== null && rawAvatar !== "") {
    const normalized = normalizeProfileAvatar(rawAvatar);
    if (!normalized) {
      return res.status(400).json({ error: "INVALID_AVATAR" });
    }
    avatar = normalized;
  }

  try {
    const user = registerUser({
      name,
      mail,
      password,
      currency: Number.isFinite(currency) ? Number(currency) : 0,
      avatar,
    });
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof Error && error.message === "USER_ALREADY_EXISTS") {
      return res.status(409).json({ error: "USER_ALREADY_EXISTS" });
    }
    console.error(error);
    res.status(500).json({ error: "REGISTER_FAILED" });
  }
});

app.post("/api/login", authLimiter, (req, res) => {
  const { mail, password } = req.body;
  if (!mail || !password) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    const user = loginUser(mail, password);
    res.json(user);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    }
    console.error(error);
    res.status(500).json({ error: "LOGIN_FAILED" });
  }
});

app.get("/api/lobbies/:lobbyId", (req, res) => {
  const lobbyId = parsePositiveIntBody(req.params.lobbyId);
  if (!lobbyId) {
    return res.status(400).json({ error: "INVALID_LOBBY_ID" });
  }
  try {
    const lobby = getLobbyById(lobbyId);
    if (!lobby) {
      return res.status(404).json({ error: "LOBBY_NOT_FOUND" });
    }
    res.json(lobby);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "LOBBY_FETCH_FAILED" });
  }
});

app.get("/api/lobbies", (req, res) => {
  const userId = parsePositiveIntQuery(req.query.userId);
  if (req.query.userId !== undefined && !userId) {
    return res.status(400).json({ error: "INVALID_USER_ID" });
  }
  if (!userId) {
    return res.status(400).json({ error: "USER_ID_REQUIRED" });
  }
  try {
    const lobby = getLobbyByUser(userId);
    res.json({ lobby });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }
    console.error(error);
    res.status(500).json({ error: "LOBBY_FETCH_FAILED" });
  }
});

app.post("/api/lobbies", (req, res) => {
  const userId = parsePositiveIntBody(req.body?.userId);
  if (!userId) {
    return res.status(400).json({ error: "INVALID_USER_ID" });
  }
  const name = typeof req.body?.name === "string" ? req.body.name : undefined;
  const password =
    typeof req.body?.password === "string" ? req.body.password : undefined;
  const entryFeeRaw = req.body?.entryFee;
  const entryFeeParsed =
    typeof entryFeeRaw === "number" ? entryFeeRaw : Number(entryFeeRaw);
  const entryFee = Number.isFinite(entryFeeParsed) ? entryFeeParsed : undefined;
  try {
    const lobby = createLobby({
      userId,
      name,
      password,
      entryFee,
    });
    res.status(201).json(lobby);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "USER_NOT_FOUND") {
        return res.status(404).json({ error: "USER_NOT_FOUND" });
      }
      if (error.message === "USER_ALREADY_IN_LOBBY") {
        return res.status(409).json({ error: "USER_ALREADY_IN_LOBBY" });
      }
    }
    console.error(error);
    res.status(500).json({ error: "LOBBY_CREATE_FAILED" });
  }
});

app.post("/api/lobbies/:lobbyId/join", (req, res) => {
  const lobbyId = parsePositiveIntBody(req.params.lobbyId);
  if (!lobbyId) {
    return res.status(400).json({ error: "INVALID_LOBBY_ID" });
  }
  const userId = parsePositiveIntBody(req.body?.userId);
  if (!userId) {
    return res.status(400).json({ error: "INVALID_USER_ID" });
  }
  const password =
    typeof req.body?.password === "string" ? req.body.password : undefined;
  try {
    const lobby = joinLobby({ lobbyId, userId, password });
    res.json(lobby);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "LOBBY_NOT_FOUND") {
        return res.status(404).json({ error: "LOBBY_NOT_FOUND" });
      }
      if (error.message === "INVALID_LOBBY_PASSWORD") {
        return res.status(401).json({ error: "INVALID_LOBBY_PASSWORD" });
      }
      if (error.message === "USER_NOT_FOUND") {
        return res.status(404).json({ error: "USER_NOT_FOUND" });
      }
      if (error.message === "USER_ALREADY_IN_LOBBY") {
        return res.status(409).json({ error: "USER_ALREADY_IN_LOBBY" });
      }
      if (error.message === "LOBBY_ALREADY_STARTED") {
        return res.status(409).json({ error: "LOBBY_ALREADY_STARTED" });
      }
    }
    console.error(error);
    res.status(500).json({ error: "LOBBY_JOIN_FAILED" });
  }
});

app.post("/api/lobbies/:lobbyId/leave", (req, res) => {
  const lobbyId = parsePositiveIntBody(req.params.lobbyId);
  if (!lobbyId) {
    return res.status(400).json({ error: "INVALID_LOBBY_ID" });
  }
  const userId = parsePositiveIntBody(req.body?.userId);
  if (!userId) {
    return res.status(400).json({ error: "INVALID_USER_ID" });
  }
  try {
    const result = leaveLobby({ lobbyId, userId });
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "USER_NOT_FOUND") {
        return res.status(404).json({ error: "USER_NOT_FOUND" });
      }
      if (error.message === "USER_NOT_IN_LOBBY") {
        return res.status(409).json({ error: "USER_NOT_IN_LOBBY" });
      }
      if (error.message === "LOBBY_MISMATCH") {
        return res.status(409).json({ error: "LOBBY_MISMATCH" });
      }
    }
    console.error(error);
    res.status(500).json({ error: "LOBBY_LEAVE_FAILED" });
  }
});

app.get("/api/regions/:regionId/tournament/player-stats", (req, res) => {
  const regionId = parseRegionIdParam(req.params.regionId);
  if (!regionId) {
    return res.status(400).json({ error: "INVALID_REGION_ID" });
  }
  const ids = parseIdListQuery(req.query.ids);
  if (req.query.ids !== undefined && ids.length === 0) {
    return res.status(400).json({ error: "INVALID_PLAYER_IDS" });
  }
  try {
    const state = getTournamentState(regionId);
    if (!state.tournament) {
      return res.json({ players: [] });
    }
    const players = getTournamentPlayerAggregates(state.tournament.id, ids);
    res.json({ tournamentId: state.tournament.id, players });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "TOURNAMENT_STATS_FAILED" });
  }
});

app.post("/api/lobbies/:lobbyId/ready", (req, res) => {
  const lobbyId = parsePositiveIntBody(req.params.lobbyId);
  if (!lobbyId) {
    return res.status(400).json({ error: "INVALID_LOBBY_ID" });
  }
  const userId = parsePositiveIntBody(req.body?.userId);
  if (!userId) {
    return res.status(400).json({ error: "INVALID_USER_ID" });
  }
  const readyFlag = req.body?.ready;
  const ready = readyFlag !== false;
  try {
    const lobby = setLobbyReady({ lobbyId, userId, ready });
    res.json(lobby);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "LOBBY_NOT_FOUND") {
        return res.status(404).json({ error: "LOBBY_NOT_FOUND" });
      }
      if (error.message === "LOBBY_NOT_STARTED") {
        return res.status(409).json({ error: "LOBBY_NOT_STARTED" });
      }
      if (error.message === "USER_NOT_FOUND") {
        return res.status(404).json({ error: "USER_NOT_FOUND" });
      }
      if (error.message === "USER_NOT_IN_LOBBY") {
        return res.status(409).json({ error: "USER_NOT_IN_LOBBY" });
      }
    }
    console.error(error);
    res.status(500).json({ error: "LOBBY_READY_FAILED" });
  }
});

app.put("/api/lobbies/:lobbyId", (req, res) => {
  const lobbyId = parsePositiveIntBody(req.params.lobbyId);
  if (!lobbyId) {
    return res.status(400).json({ error: "INVALID_LOBBY_ID" });
  }
  const userId = parsePositiveIntBody(req.body?.userId);
  if (!userId) {
    return res.status(400).json({ error: "INVALID_USER_ID" });
  }
  const name = typeof req.body?.name === "string" ? req.body.name : undefined;
  const password =
    typeof req.body?.password === "string" ? req.body.password : undefined;
  const entryFeeRaw = req.body?.entryFee;
  const entryFeeParsed =
    typeof entryFeeRaw === "number" ? entryFeeRaw : Number(entryFeeRaw);
  const entryFee = Number.isFinite(entryFeeParsed) ? entryFeeParsed : undefined;
  try {
    const lobby = updateLobbySettings({
      lobbyId,
      userId,
      name,
      password,
      entryFee,
    });
    res.json(lobby);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "LOBBY_NOT_FOUND") {
        return res.status(404).json({ error: "LOBBY_NOT_FOUND" });
      }
      if (error.message === "NOT_LOBBY_HOST") {
        return res.status(403).json({ error: "NOT_LOBBY_HOST" });
      }
      if (error.message === "LOBBY_ALREADY_STARTED") {
        return res.status(409).json({ error: "LOBBY_ALREADY_STARTED" });
      }
    }
    console.error(error);
    res.status(500).json({ error: "LOBBY_UPDATE_FAILED" });
  }
});

app.post("/api/lobbies/:lobbyId/start", (req, res) => {
  const lobbyId = parsePositiveIntBody(req.params.lobbyId);
  if (!lobbyId) {
    return res.status(400).json({ error: "INVALID_LOBBY_ID" });
  }
  const userId = parsePositiveIntBody(req.body?.userId);
  if (!userId) {
    return res.status(400).json({ error: "INVALID_USER_ID" });
  }
  try {
    const lobby = startLobby({ lobbyId, userId });
    res.json(lobby);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "LOBBY_NOT_FOUND") {
        return res.status(404).json({ error: "LOBBY_NOT_FOUND" });
      }
      if (error.message === "NOT_LOBBY_HOST") {
        return res.status(403).json({ error: "NOT_LOBBY_HOST" });
      }
    }
    console.error(error);
    res.status(500).json({ error: "LOBBY_START_FAILED" });
  }
});

app.post("/api/lobbies/:lobbyId/simulate", (req, res) => {
  const lobbyId = parsePositiveIntBody(req.params.lobbyId);
  if (!lobbyId) {
    return res.status(400).json({ error: "INVALID_LOBBY_ID" });
  }
  const userId = parsePositiveIntBody(req.body?.userId);
  if (!userId) {
    return res.status(400).json({ error: "INVALID_USER_ID" });
  }
  const lobby = getLobbyById(lobbyId);
  if (!lobby) {
    return res.status(404).json({ error: "LOBBY_NOT_FOUND" });
  }
  if (lobby.lobby.hostId !== userId) {
    return res.status(403).json({ error: "NOT_LOBBY_HOST" });
  }
  if (lobby.lobby.status !== "started") {
    return res.status(409).json({ error: "LOBBY_NOT_STARTED" });
  }
  if (!lobby.lobby.allReady) {
    return res.status(409).json({ error: "NOT_ALL_READY" });
  }
  try {
    const regionId = parsePositiveIntBody(req.body?.regionId) ?? Number(process.env.DEFAULT_REGION_ID ?? 1);
    const game = new FootabalolGame();
    game.setRegion(regionId);
    const match = game.simulateMatch();
    resetLobbyReady(lobbyId);
    const updatedLobby = getLobbyById(lobbyId);
    res.json({
      match,
      lobby: updatedLobby,
      leaderboard: getLobbyLeaderboard(lobbyId),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "LOBBY_SIMULATION_FAILED" });
  }
});

app.get("/api/lobbies/:lobbyId/leaderboard", (req, res) => {
  const lobbyId = parsePositiveIntBody(req.params.lobbyId);
  if (!lobbyId) {
    return res.status(400).json({ error: "INVALID_LOBBY_ID" });
  }
  try {
    const lobby = getLobbyById(lobbyId);
    if (!lobby) {
      return res.status(404).json({ error: "LOBBY_NOT_FOUND" });
    }
    res.json({ leaderboard: getLobbyLeaderboard(lobbyId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "LOBBY_LEADERBOARD_FAILED" });
  }
});

app.post("/api/users/:userId/avatar", (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "INVALID_USER_ID" });
  }

  const rawAvatar = req.body?.avatar;
  let avatar: string | null = null;
  if (rawAvatar !== undefined && rawAvatar !== null && rawAvatar !== "") {
    const normalized = normalizeProfileAvatar(rawAvatar);
    if (!normalized) {
      return res.status(400).json({ error: "INVALID_AVATAR" });
    }
    avatar = normalized;
  }

  try {
    const updated = updateUserAvatar(userId, avatar);
    if (!updated) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AVATAR_UPDATE_FAILED" });
  }
});

function handleDeckError(res: express.Response, error: unknown) {
  if (error instanceof DeckPayloadError) {
    return res.status(400).json({
      error: error.code,
      message: error.message,
      meta: error.meta,
    });
  }

  if (error instanceof DeckError) {
    return res.status(400).json({
      error: error.code,
      message: error.message,
      meta: error.meta,
    });
  }

  console.error(error);
  return res.status(500).json({ error: "DECK_OPERATION_FAILED" });
}

// Currency lookup helper that suppresses missing-user errors when we only need a hint.
function safeGetUserCurrency(userId: number): number | undefined {
  try {
    return getUserCurrency(userId);
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return undefined;
    }
    throw error;
  }
}

function sendDeck(
  res: express.Response,
  deck: Deck,
  options: { currency?: number } = {}
) {
  const payload = toDeckResponse(deck);
  const currency =
    options.currency ??
    (deck.userId !== undefined ? safeGetUserCurrency(deck.userId) : undefined);

  if (currency !== undefined) {
    // Propagate the spending cap so the client can display remaining budget.
    payload.summary.currencyCap = currency;
  }

  res.json(payload);
}

app.get("/api/decks", (_req, res) => {
  try {
    const decks = getAllDecks().map((entry) => ({
      userId: entry.userId,
      updatedAt: entry.updatedAt,
      deck: entry.deck,
      summary: {
        ...entry.summary,
        ...(entry.summary.currencyCap !== undefined
          ? {}
          : { currencyCap: safeGetUserCurrency(entry.userId) }),
      },
    }));
    res.json(decks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "DECK_FETCH_FAILED" });
  }
});

app.get("/api/decks/:userId", (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const deck = getDeck(userId);
    sendDeck(res, deck);
  } catch (error) {
    if (error instanceof DeckPayloadError && error.code === "INVALID_USER_ID") {
      return res.status(400).json({ error: "INVALID_USER_ID" });
    }
    console.error(error);
    res.status(500).json({ error: "DECK_FETCH_FAILED" });
  }
});

app.post("/api/decks/empty", (req, res) => {
  try {
    const rawUserId = req.body?.userId;
    if (rawUserId !== undefined) {
      const userId = parseUserId(rawUserId);
      const deck = createDeck({ userId });
      return sendDeck(res, deck);
    }
  } catch (error) {
    if (error instanceof DeckPayloadError && error.code === "INVALID_USER_ID") {
      return res.status(400).json({ error: "INVALID_USER_ID" });
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res
        .status(404)
        .json({
          error: "USER_NOT_FOUND",
          message: "User must exist before creating a deck.",
        });
    }
    console.error(error);
    return res.status(500).json({ error: "DECK_OPERATION_FAILED" });
  }

  const deck = createDeck();
  sendDeck(res, deck);
});

app.post("/api/decks/add-card", (req, res) => {
  const { deck: deckPayload, card: cardPayload } = req.body ?? {};
  if (
    !deckPayload ||
    typeof deckPayload !== "object" ||
    !cardPayload ||
    typeof cardPayload !== "object"
  ) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  try {
    let deck = parseDeckPayload(deckPayload);
    const card = parseCardPayload(cardPayload);
    // Resolve owning user so we can validate wallet limits for the mutation.
    const rawUserId =
      deck.userId ??
      (typeof (deckPayload as { userId?: unknown }).userId !== "undefined"
        ? (deckPayload as { userId?: unknown }).userId
        : req.body?.userId);
    const userId = parseUserId(rawUserId);

    if (deck.userId !== userId) {
      deck = createDeck({ userId, slots: deck.slots });
    }

    const updatedDeck = addCardToDeck(deck, card);
    sendDeck(res, updatedDeck);
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res
        .status(404)
        .json({
          error: "USER_NOT_FOUND",
          message: "User must exist before modifying a deck.",
        });
    }
    handleDeckError(res, error);
  }
});

app.post("/api/decks/remove-card", (req, res) => {
  const { deck: deckPayload, role } = req.body ?? {};
  if (!deckPayload || typeof deckPayload !== "object" || !role) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  try {
    let deck = parseDeckPayload(deckPayload);
    // Resolve owning user so we can validate wallet limits for the mutation.
    const rawUserId =
      deck.userId ??
      (typeof (deckPayload as { userId?: unknown }).userId !== "undefined"
        ? (deckPayload as { userId?: unknown }).userId
        : req.body?.userId);
    const userId = parseUserId(rawUserId);

    if (deck.userId !== userId) {
      deck = createDeck({ userId, slots: deck.slots });
    }

    const currency = getUserCurrency(userId);
    const updatedDeck = removeCardFromDeck(deck, role as RoleInput);
    sendDeck(res, updatedDeck, { currency });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res
        .status(404)
        .json({
          error: "USER_NOT_FOUND",
          message: "User must exist before modifying a deck.",
        });
    }
    handleDeckError(res, error);
  }
});

app.post("/api/decks/replace-card", (req, res) => {
  const { deck: deckPayload, role, card: cardPayload } = req.body ?? {};
  if (
    !deckPayload ||
    typeof deckPayload !== "object" ||
    !role ||
    !cardPayload ||
    typeof cardPayload !== "object"
  ) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  try {
    let deck = parseDeckPayload(deckPayload);
    const card = parseCardPayload({ ...cardPayload, role }, role as RoleInput);
    // Resolve owning user so we can fetch the available currency.
    const rawUserId =
      deck.userId ??
      (typeof (deckPayload as { userId?: unknown }).userId !== "undefined"
        ? (deckPayload as { userId?: unknown }).userId
        : req.body?.userId);
    const userId = parseUserId(rawUserId);

    if (deck.userId !== userId) {
      deck = createDeck({ userId, slots: deck.slots });
    }

    const updatedDeck = replaceCardInDeck(deck, role as RoleInput, card);
    sendDeck(res, updatedDeck);
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res
        .status(404)
        .json({
          error: "USER_NOT_FOUND",
          message: "User must exist before modifying a deck.",
        });
    }
    handleDeckError(res, error);
  }
});

app.post("/api/market/sell", (req, res) => {
  const { userId: rawUserId, playerId } = req.body ?? {};
  if (!playerId) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  try {
    const userId = parseUserId(rawUserId);
    const parsedPlayerId = Number(playerId);
    if (!Number.isInteger(parsedPlayerId) || parsedPlayerId <= 0) {
      return res.status(400).json({ error: "INVALID_PLAYER_ID" });
    }

    const result = sellCardFromDeck(userId, parsedPlayerId);
    const response = toDeckResponse(result.deck);
    response.summary.currencyCap = result.currency;

    res.json({
      deck: response.deck,
      summary: response.summary,
      sold: result.sold,
      currency: result.currency,
    });
  } catch (error) {
    if (error instanceof DeckPayloadError && error.code === "INVALID_USER_ID") {
      return res.status(400).json({ error: "INVALID_USER_ID" });
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }
    handleDeckError(res, error);
  }
});

app.post("/api/market/buy", (req, res) => {
  const { userId: rawUserId, playerId } = req.body ?? {};
  if (!playerId) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  try {
    const userId = parseUserId(rawUserId);
    const parsedPlayerId = Number(playerId);
    if (!Number.isInteger(parsedPlayerId) || parsedPlayerId <= 0) {
      return res.status(400).json({ error: "INVALID_PLAYER_ID" });
    }

    const result = buyCardForDeck(userId, parsedPlayerId);
    res.json({
      purchased: result.purchased,
      currency: result.currency,
    });
  } catch (error) {
    if (error instanceof DeckPayloadError && error.code === "INVALID_USER_ID") {
      return res.status(400).json({ error: "INVALID_USER_ID" });
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }
    handleDeckError(res, error);
  }
});

app.get("/api/collection", (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    const rawTrend = parsePositiveIntQuery(req.query.trendLimit) ?? 5;
    const trendLimit = Math.min(Math.max(rawTrend, 3), 10);
    const players = getUserCollection(userId, trendLimit);
    res.json({ players, trendLimit });
  } catch (error) {
    if (error instanceof DeckPayloadError && error.code === "INVALID_USER_ID") {
      return res.status(400).json({ error: "INVALID_USER_ID" });
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }
    console.error(error);
    res.status(500).json({ error: "COLLECTION_FETCH_FAILED" });
  }
});

app.get("/api/market/transfer-state", (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    const state = getTransferState(userId);
    res.json(state);
  } catch (error) {
    if (error instanceof DeckPayloadError && error.code === "INVALID_USER_ID") {
      return res.status(400).json({ error: "INVALID_USER_ID" });
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }
    console.error(error);
    res.status(500).json({ error: "TRANSFER_STATE_FETCH_FAILED" });
  }
});

app.get("/api/market/history", (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    const rawLimit = parsePositiveIntQuery(req.query.limit) ?? 20;
    const limit = Math.min(Math.max(rawLimit, 1), 50);
    const history = getTransferHistory(userId, limit);
    res.json({ history, limit });
  } catch (error) {
    if (error instanceof DeckPayloadError && error.code === "INVALID_USER_ID") {
      return res.status(400).json({ error: "INVALID_USER_ID" });
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }
    console.error(error);
    res.status(500).json({ error: "TRANSFER_HISTORY_FETCH_FAILED" });
  }
});

app.get("/api/boosts", (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    const boosts = listBoosts(userId);
    res.json({ boosts });
  } catch (error) {
    if (error instanceof DeckPayloadError && error.code === "INVALID_USER_ID") {
      return res.status(400).json({ error: "INVALID_USER_ID" });
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }
    console.error(error);
    res.status(500).json({ error: "BOOST_FETCH_FAILED" });
  }
});

app.post("/api/boosts/assign", (req, res) => {
  const { userId: rawUserId, boostType, playerId } = req.body ?? {};
  if (!boostType || !playerId) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }
  try {
    const userId = parseUserId(rawUserId);
    const parsedPlayerId = Number(playerId);
    if (!Number.isInteger(parsedPlayerId) || parsedPlayerId <= 0) {
      return res.status(400).json({ error: "INVALID_PLAYER_ID" });
    }
    const tournament = getTransferState(userId);
    const normalizedBoostType =
      boostType === "HOT_STREAK" || boostType === "DOUBLE_TOTAL"
        ? "HOT_STREAK"
        : "DOUBLE_POINTS";
    const boost = assignBoostToPlayer(
      userId,
      normalizedBoostType,
      parsedPlayerId,
      tournament.tournamentId ?? null
    );
    res.json({ boost });
  } catch (error) {
    if (error instanceof DeckPayloadError && error.code === "INVALID_USER_ID") {
      return res.status(400).json({ error: "INVALID_USER_ID" });
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }
    handleDeckError(res, error);
  }
});

app.post("/api/decks/save", (req, res) => {
  const { userId: rawUserId, deck: deckPayload } = req.body ?? {};
  if (!deckPayload || typeof deckPayload !== "object") {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  try {
    const userId = parseUserId(rawUserId);
    const deck = parseDeckPayload({ ...deckPayload, userId });
    const currency = getUserCurrency(userId);
    const result = saveDeck(userId, deck);

    if (result.status === "saved") {
      return sendDeck(res, { ...result.deck, userId }, { currency });
    }

    const response = toDeckResponse(result.deck);
    response.summary.currencyCap = currency;

    return res.status(400).json({
      error: "DECK_INCOMPLETE",
      message: result.message,
      missingRoles: result.missingRoles,
      deck: result.deck,
      summary: response.summary,
    });
  } catch (error) {
    if (error instanceof DeckPayloadError && error.code === "INVALID_USER_ID") {
      return res.status(400).json({ error: "INVALID_USER_ID" });
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res
        .status(404)
        .json({
          error: "USER_NOT_FOUND",
          message: "User must exist before saving a deck.",
        });
    }
    handleDeckError(res, error);
  }
});

app.post("/api/tournaments/simulate", (req, res) => {
  const {
    userId: rawUserId,
    regionId: rawRegionId,
    games: rawGames,
    resetData: resetFlag,
  } = req.body ?? {};

  try {
    const userId = parseUserId(rawUserId);
    const parsedRegionId = Number(rawRegionId);
    const regionId =
      Number.isInteger(parsedRegionId) && parsedRegionId > 0
        ? parsedRegionId
        : 1;

    const parsedGames = Number(rawGames);
    if (
      rawGames !== undefined &&
      (!Number.isInteger(parsedGames) || parsedGames <= 0)
    ) {
      return res.status(400).json({ error: "INVALID_GAME_COUNT" });
    }
    const gameCount =
      Number.isInteger(parsedGames) && parsedGames > 0 ? parsedGames : 5;

    const deck = getDeck(userId);
    const deckSummary = summarizeDeck(deck);

    if (!deckSummary.complete) {
      return res.status(400).json({
        error: "DECK_INCOMPLETE",
        message: "Deck must be complete before running a tournament.",
        missingRoles: deckSummary.missingRoles,
      });
    }

    const shouldReset = resetFlag !== false;
    if (shouldReset) {
      simulateData();
    }

    const game = new FootabalolGame();
    game.setRegion(regionId);

    const rounds: Array<{
      region: string;
      teams: string[];
      winner: string;
      MVP: { name?: string; score?: number };
      players: Player[];
      teamIds: number[];
      gameNumber: number;
    }> = [];
    const iterator = game.simulateTournament(regionId, gameCount);
    let iteration = iterator.next();

    while (!iteration.done) {
      rounds.push(iteration.value);
      iteration = iterator.next();
    }

    const lastRound =
      rounds.length > 0 ? rounds[rounds.length - 1] : undefined;
    const finalResult =
      iteration.value ?? {
        region: game.getRegion().name,
        teams: lastRound ? lastRound.teams : [],
        players: lastRound ? lastRound.players : ([] as Player[]),
        winner: "Blue" as const,
        MVP: lastRound?.MVP ?? { name: "", score: 0 },
        teamIds: lastRound?.teamIds ?? [],
        gameNumber: lastRound?.gameNumber ?? gameCount,
      };

    const finalPlayers = finalResult.players ?? [];

    type DeckScoreSnapshot = {
      userId: number;
      deck: Deck;
      summary: DeckSummary;
      score: number;
      awarded: number;
      breakdown: DeckScoreEntry[];
      missingRoles: Role[];
    };

    const storedDecks = getAllDecks();
    const allDeckScores: DeckScoreSnapshot[] = storedDecks.map((storedDeck) => {
      const transferState = getTransferState(storedDeck.userId);
      const boostInfo = getBoostMapForUser(
        storedDeck.userId,
        "tournament",
        transferState.tournamentId ?? null
      );
      const scoreResult = scoreDeckAgainstPlayers(
        storedDeck.deck,
        finalPlayers,
        boostInfo.map
      );
      if (scoreResult.deck.userId === undefined) {
        scoreResult.deck.userId = storedDeck.deck.userId ?? storedDeck.userId;
      }
      const summaryForDeck = summarizeDeck(scoreResult.deck);
      consumeBoostByIdIfApplied(boostInfo.boost, scoreResult);
      return {
        userId: storedDeck.userId,
        deck: scoreResult.deck,
        summary: summaryForDeck,
        score: scoreResult.totalScore,
        awarded: Math.max(scoreResult.totalScore, 0),
        breakdown: scoreResult.entries,
        missingRoles: scoreResult.missingRoles,
      };
    });

    let userDeckScoreEntry: DeckScoreSnapshot | undefined =
      allDeckScores.find((entry) => entry.userId === userId);

    if (!userDeckScoreEntry) {
      const transferState = getTransferState(userId);
      const boostInfo = getBoostMapForUser(
        userId,
        "tournament",
        transferState.tournamentId ?? null
      );
      const fallbackScore = scoreDeckAgainstPlayers(
        deck,
        finalPlayers,
        boostInfo.map
      );
      consumeBoostByIdIfApplied(boostInfo.boost, fallbackScore);
      if (fallbackScore.deck.userId === undefined) {
        fallbackScore.deck.userId = userId;
      }
      const fallbackEntry: DeckScoreSnapshot = {
        userId,
        deck: fallbackScore.deck,
        summary: summarizeDeck(fallbackScore.deck),
        score: fallbackScore.totalScore,
        awarded: Math.max(fallbackScore.totalScore, 0),
        breakdown: fallbackScore.entries,
        missingRoles: fallbackScore.missingRoles,
      };
      userDeckScoreEntry = fallbackEntry;
      allDeckScores.unshift(fallbackEntry);
    }

    if (!userDeckScoreEntry) {
      throw new Error("USER_DECK_SCORING_FAILED");
    }

    const awardedPoints = Math.max(userDeckScoreEntry.score, 0);
    const updatedScore = addUserScore(userId, awardedPoints);

    let persistedDeck = userDeckScoreEntry.deck;
    try {
      const saveOutcome = saveDeck(userId, userDeckScoreEntry.deck);
      if (saveOutcome.status === "saved") {
        persistedDeck = { ...saveOutcome.deck, userId };
      }
    } catch (saveError) {
      console.warn(
        "Failed to persist deck with tournament points for user",
        userId,
        saveError
      );
    }

    if (persistedDeck !== userDeckScoreEntry.deck) {
      userDeckScoreEntry.deck = persistedDeck;
      userDeckScoreEntry.summary = summarizeDeck(persistedDeck);
    }

    const deckResponse = toDeckResponse(persistedDeck);
    const currency = safeGetUserCurrency(userId);
    if (currency !== undefined) {
      deckResponse.summary.currencyCap = currency;
    }

    res.json({
      tournament: {
        region: game.getRegion(),
        rounds,
        final: finalResult,
        games: gameCount,
        resetPerformed: shouldReset,
      },
      deck: deckResponse.deck,
      deckSummary: deckResponse.summary,
      deckScore: {
        total: userDeckScoreEntry.score,
        awarded: awardedPoints,
        breakdown: userDeckScoreEntry.breakdown,
        missingRoles: userDeckScoreEntry.missingRoles,
      },
      user: {
        id: userId,
        score: updatedScore,
        awardedPoints,
        currency,
      },
      allDeckScores: allDeckScores,
    });
  } catch (error) {
    if (error instanceof DeckPayloadError) {
      return res.status(400).json({
        error: error.code,
        message: error.message,
        meta: error.meta,
      });
    }

    if (error instanceof DeckError) {
      return res.status(400).json({
        error: error.code,
        message: error.message,
        meta: error.meta,
      });
    }

    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    console.error(error);
    res.status(500).json({ error: "TOURNAMENT_SIMULATION_FAILED" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
