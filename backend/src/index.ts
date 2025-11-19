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
  updateUserAvatar,
} from "./db";
import {
  addCardToDeck,
  removeCardFromDeck,
  replaceCardInDeck,
  createDeck,
  DeckError,
  calculateDeckValue,
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

function parseBooleanQuery(value: unknown): boolean {
  const raw = coerceQueryString(value);
  if (!raw) {
    return false;
  }
  return raw === "1" || raw.toLowerCase() === "true";
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
    res.json({ regions: getRegions() });
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

    const currency = getUserCurrency(userId);
    const updatedDeck = addCardToDeck(deck, card);
    const totalValue = calculateDeckValue(updatedDeck);

    if (totalValue > currency) {
      throw new DeckError(
        "CURRENCY_LIMIT_EXCEEDED",
        "Adding this card exceeds available currency.",
        {
          totalValue,
          currency,
          overBudgetBy: totalValue - currency,
        }
      );
    }

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

    const currency = getUserCurrency(userId);
    const updatedDeck = replaceCardInDeck(deck, role as RoleInput, card);
    const totalValue = calculateDeckValue(updatedDeck);

    if (totalValue > currency) {
      throw new DeckError(
        "CURRENCY_LIMIT_EXCEEDED",
        "Replacing this card exceeds available currency.",
        {
          totalValue,
          currency,
          overBudgetBy: totalValue - currency,
        }
      );
    }

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

    const rounds: Array<{ region: number; players: Player[]; gameNumber: number }> =
      [];
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
        region: regionId,
        players: lastRound ? lastRound.players : ([] as Player[]),
        winner: "Blue" as const,
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
      const scoreResult = scoreDeckAgainstPlayers(storedDeck.deck, finalPlayers);
      if (scoreResult.deck.userId === undefined) {
        scoreResult.deck.userId = storedDeck.deck.userId ?? storedDeck.userId;
      }
      const summaryForDeck = summarizeDeck(scoreResult.deck);
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
      const fallbackScore = scoreDeckAgainstPlayers(deck, finalPlayers);
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
