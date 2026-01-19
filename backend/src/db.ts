import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  User,
  Card,
  Deck,
  CompleteDeck,
  DeckSaveResult,
  DeckSummary,
  Player,
  Role,
  Region,
  Team,
} from "./Types";
import {
  createDeck,
  ensureDeckComplete,
  summarizeDeck,
  DeckError,
  calculateDeckValue,
  ensureUniqueMultipliers,
  REQUIRED_ROLES,
  removeCardFromDeck,
} from "./deckManager";
import { parseDeckPayload } from "./deckIO";
import { scoreDeckAgainstPlayers, DeckScoreResult } from "./simulationScoring";
import { ProfileAvatarKey } from "./profileAvatars";
import {sampleData} from "../data/SampleData.json"

const DB_PATH = path.join(__dirname, "..", "data", "app.db");
const INIT_SQL = path.join(__dirname, "init.sql");

fs.mkdirSync(path.join(__dirname, "..", "data"), { recursive: true });

const db = new Database(DB_PATH);
const initSql = fs.readFileSync(INIT_SQL, "utf8");
db.exec(initSql);

const parsePositiveIntOrFallback = (
  value: string | undefined,
  fallback: number
) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNumberOrFallback = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseStringOrFallback = (value: string | undefined, fallback: string) =>
  value && value.trim().length > 0 ? value.trim() : fallback;

const PASSWORD_SALT_BYTES = parsePositiveIntOrFallback(
  process.env.PASSWORD_SALT_BYTES,
  16
);
const PASSWORD_HASH_BYTES = parsePositiveIntOrFallback(
  process.env.PASSWORD_HASH_BYTES,
  32
);
const PASSWORD_ITERATIONS = parsePositiveIntOrFallback(
  process.env.PASSWORD_HASH_ITERATIONS ?? process.env.PASSWORD_ITERATIONS,
  310000
);
const PASSWORD_DIGEST = parseStringOrFallback(
  process.env.PASSWORD_DIGEST,
  "sha256"
);

const PLAYER_SCORE_DECAY = Math.min(
  0.99,
  Math.max(0.1, parseNumberOrFallback(process.env.PLAYER_SCORE_DECAY, 0.78))
);
const PLAYER_SCORE_MIN = parseNumberOrFallback(
  process.env.PLAYER_SCORE_MIN,
  50
);
const PLAYER_SCORE_MAX = Math.max(
  PLAYER_SCORE_MIN,
  parseNumberOrFallback(process.env.PLAYER_SCORE_MAX, 120)
);

const TRANSFER_LIMIT_PER_TOURNAMENT = parsePositiveIntOrFallback(
  process.env.TRANSFER_LIMIT_PER_TOURNAMENT,
  3
);
const TRANSFER_FEE_PER_CARD = Math.max(
  0,
  parseNumberOrFallback(process.env.TRANSFER_FEE_PER_CARD, 6)
);
const BASE_SEASON_CURRENCY = Math.max(
  0,
  parseNumberOrFallback(process.env.BASE_SEASON_CURRENCY, 200)
);
const SEASON_BONUS_TOP1 = Math.max(
  0,
  parseNumberOrFallback(process.env.SEASON_BONUS_TOP1, 60)
);
const SEASON_BONUS_TOP2 = Math.max(
  0,
  parseNumberOrFallback(process.env.SEASON_BONUS_TOP2, 40)
);
const SEASON_BONUS_TOP3 = Math.max(
  0,
  parseNumberOrFallback(process.env.SEASON_BONUS_TOP3, 25)
);
const MARKET_TREND_WINDOW = Math.min(
  10,
  Math.max(3, parsePositiveIntOrFallback(process.env.MARKET_TREND_WINDOW, 5))
);
const MARKET_PRICE_DELTA_CAP = Math.max(
  0,
  parseNumberOrFallback(process.env.MARKET_PRICE_DELTA_CAP, 8)
);

type TableColumn = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
};

function tableColumns(table: string): TableColumn[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as TableColumn[];
}

function migrateDecksTable() {
  const columns = tableColumns("decks");
  if (columns.length === 0) {
    return;
  }

  const hasDataColumn = columns.some((column) => column.name === "data");
  const hasSlotsJsonColumn = columns.some(
    (column) => column.name === "slots_json"
  );
  const hasUpdatedAtColumn = columns.some(
    (column) => column.name === "updated_at"
  );

  // Older schema used slots_json column – rename to data for the new format.
  if (!hasDataColumn && hasSlotsJsonColumn) {
    db.prepare("ALTER TABLE decks RENAME COLUMN slots_json TO data").run();
  }

  // Ensure updated_at column exists.
  if (!hasUpdatedAtColumn) {
    db.prepare(
      "ALTER TABLE decks ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
    ).run();
  }
}

function migrateUsersTable() {
  const columns = tableColumns("users");
  if (columns.length === 0) {
    return;
  }

  const hasScoreColumn = columns.some((column) => column.name === "score");
  const hasTournamentScoreColumn = columns.some(
    (column) => column.name === "tournament_score"
  );
  const hasLobbyScoreColumn = columns.some(
    (column) => column.name === "lobby_score"
  );
  const hasAvatarColumn = columns.some((column) => column.name === "avatar");
  const hasLobbyReadyColumn = columns.some((column) => column.name === "lobby_ready");
  const hasTransferCountColumn = columns.some(
    (column) => column.name === "transfer_count"
  );
  const hasTransferTournamentColumn = columns.some(
    (column) => column.name === "transfer_tournament_id"
  );
  const hasTutorialSeenColumn = columns.some(
    (column) => column.name === "tutorial_seen"
  );

  if (!hasScoreColumn) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN score NUMBER NOT NULL DEFAULT 0"
    ).run();
  }

  if (!hasTournamentScoreColumn) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN tournament_score NUMBER NOT NULL DEFAULT 0"
    ).run();
  }

  if (!hasLobbyScoreColumn) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN lobby_score NUMBER NOT NULL DEFAULT 0"
    ).run();
  }

  if (!hasAvatarColumn) {
    db.prepare("ALTER TABLE users ADD COLUMN avatar TEXT").run();
  }

  if (!hasLobbyReadyColumn) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN lobby_ready INTEGER NOT NULL DEFAULT 0"
    ).run();
  }

  if (!hasTransferCountColumn) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN transfer_count INTEGER NOT NULL DEFAULT 0"
    ).run();
  }

  if (!hasTransferTournamentColumn) {
    db.prepare("ALTER TABLE users ADD COLUMN transfer_tournament_id INTEGER").run();
  }

  if (!hasTutorialSeenColumn) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN tutorial_seen INTEGER NOT NULL DEFAULT 0"
    ).run();
  }
}

function migrateLobbyTable() {
  const columns = tableColumns("lobby");
  if (columns.length === 0) {
    return;
  }

  const ensureColumn = (name: string, definition: string) => {
    const exists = columns.some((column) => column.name === name);
    if (!exists) {
      db.prepare(`ALTER TABLE lobby ADD COLUMN ${name} ${definition}`).run();
    }
  };

  ensureColumn("name", "TEXT");
  ensureColumn("entry_fee", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("host_id", "INTEGER");
  ensureColumn("status", "TEXT NOT NULL DEFAULT 'waiting'");
  ensureColumn("started_at", "TEXT");

  try {
    db.prepare(
      "UPDATE lobby SET entry_fee = betValue WHERE entry_fee = 0 AND betValue > 0"
    ).run();
  } catch (error) {
    console.warn("Failed to backfill lobby entry fees", error);
  }
}

function migratePlayersTable() {
  const columns = tableColumns("players");
  if (columns.length === 0) {
    return;
  }

  const hasRoleColumn = columns.some((column) => column.name === "role");
  if (!hasRoleColumn) {
    db.prepare(
      "ALTER TABLE players ADD COLUMN role TEXT NOT NULL DEFAULT 'Top'"
    ).run();
  }

  const hasGoldColumn = columns.some((column) => column.name === "gold");
  if (!hasGoldColumn) {
    db.prepare(
      "ALTER TABLE players ADD COLUMN gold INTEGER NOT NULL DEFAULT 0"
    ).run();
  }

  const hasNicknameColumn = columns.some(
    (column) => column.name === "nickname"
  );
  if (!hasNicknameColumn) {
    db.prepare("ALTER TABLE players ADD COLUMN nickname TEXT").run();
  }
}

function migrateMatchHistoryTable() {
  const columns = tableColumns("match_history");
  if (columns.length === 0) {
    return;
  }

  const ensureColumn = (name: string, definition: string) => {
    const exists = columns.some((column) => column.name === name);
    if (!exists) {
      db.prepare(
        `ALTER TABLE match_history ADD COLUMN ${name} ${definition}`
      ).run();
    }
  };

  ensureColumn("is_tournament", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("tournament_id", "INTEGER");
  ensureColumn("tournament_match_id", "INTEGER");
  ensureColumn("tournament_game_id", "INTEGER");
  ensureColumn("stage", "TEXT");
  ensureColumn("round_name", "TEXT");
  ensureColumn("game_number", "INTEGER");
  ensureColumn("series_best_of", "INTEGER");
  ensureColumn("series_score", "TEXT");
  ensureColumn("team_a_towers", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("team_b_towers", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("team_a_dragons", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("team_b_dragons", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("team_a_barons", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("team_b_barons", "INTEGER NOT NULL DEFAULT 0");
}

function migrateMatchHistoryPlayersTable() {
  const columns = tableColumns("match_history_players");
  if (columns.length === 0) {
    return;
  }

  const ensureColumn = (name: string, definition: string) => {
    const exists = columns.some((column) => column.name === name);
    if (!exists) {
      db.prepare(
        `ALTER TABLE match_history_players ADD COLUMN ${name} ${definition}`
      ).run();
    }
  };

  ensureColumn("team_name", "TEXT");
  ensureColumn("team_side", "TEXT");
}

function migrateTournamentsTable() {
  const columns = tableColumns("tournaments");
  if (columns.length === 0) {
    return;
  }

  const hasRewardsColumn = columns.some(
    (column) => column.name === "rewards_applied"
  );
  if (!hasRewardsColumn) {
    db.prepare(
      "ALTER TABLE tournaments ADD COLUMN rewards_applied INTEGER NOT NULL DEFAULT 0"
    ).run();
  }
}

function ensureTransferHistoryTable() {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS transfer_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      role TEXT NOT NULL,
      player_id INTEGER,
      player_name TEXT NOT NULL,
      price INTEGER NOT NULL,
      fee INTEGER NOT NULL DEFAULT 0,
      tournament_id INTEGER,
      stage TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `
  ).run();
}

function ensureUserBoostsTable() {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS user_boosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tournament_id INTEGER,
      boost_type TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'match',
      assigned_player_id INTEGER,
      uses_remaining INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `
  ).run();

  const columns = tableColumns("user_boosts");
  if (columns.length === 0) {
    return;
  }
  const hasScopeColumn = columns.some((column) => column.name === "scope");
  if (!hasScopeColumn) {
    db.prepare(
      "ALTER TABLE user_boosts ADD COLUMN scope TEXT NOT NULL DEFAULT 'match'"
    ).run();
  }
  const hasAssignedColumn = columns.some(
    (column) => column.name === "assigned_player_id"
  );
  if (!hasAssignedColumn) {
    db.prepare(
      "ALTER TABLE user_boosts ADD COLUMN assigned_player_id INTEGER"
    ).run();
  }

  db.prepare(
    "UPDATE user_boosts SET boost_type = 'HOT_STREAK', scope = 'tournament' WHERE boost_type = 'DOUBLE_TOTAL'"
  ).run();
}

function ensureUserCardsTable() {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS user_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, player_id),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `
  ).run();
}

function backfillPlayerNicknames() {
  try {
    db.prepare(
      "UPDATE players SET nickname = name WHERE nickname IS NULL OR nickname = ''"
    ).run();
  } catch (error) {
    console.warn("Failed to backfill player nicknames", error);
  }
}

function ensureSeedData() {
  try {
    const row = db
      .prepare("SELECT COUNT(*) as count FROM players")
      .get() as { count?: number } | undefined;
    if (!row || typeof row.count !== "number" || row.count === 0) {
      simulateData();
    }
  } catch (error) {
    console.warn("Failed to ensure seed data", error);
  }
}

// Run lightweight migrations after loading schema.
migrateDecksTable();
migrateUsersTable();
migrateLobbyTable();
migratePlayersTable();
migrateMatchHistoryTable();
migrateMatchHistoryPlayersTable();
migrateTournamentsTable();
ensureTransferHistoryTable();
ensureUserBoostsTable();
ensureUserCardsTable();
backfillPlayerNicknames();

type DebugDeckCardSeed = {
  role: Role;
  name: string;
  points: number;
  value: number;
  multiplier?: Card["multiplier"];
  playerId?: number;
};

type DebugUserSeed = {
  name: string;
  mail: string;
  password: string;
  currency: number;
  score: number;
  avatar?: ProfileAvatarKey;
  deck: DebugDeckCardSeed[];
};

const DEBUG_USER_SEEDS: DebugUserSeed[] = [
  {
    name: "Mia Analyst",
    mail: "mia.analyst@example.com",
    password: "Debug123!",
    currency: 160,
    score: 240,
    avatar: "jinx",
    deck: [
      {
        role: "Top",
        name: "Stonewall",
        points: 88,
        value: 26,
        multiplier: "Captain",
        playerId: 1,
      },
      {
        role: "Jgl",
        name: "FlayMaster",
        points: 82,
        value: 24,
        playerId: 2,
      },
      {
        role: "Mid",
        name: "Arcana",
        points: 91,
        value: 25,
        playerId: 3,
      },
      {
        role: "Adc",
        name: "Skybolt",
        points: 86,
        value: 24,
        multiplier: "Vice-captain",
        playerId: 4,
      },
      {
        role: "Supp",
        name: "Emberlight",
        points: 79,
        value: 21,
        playerId: 5,
      },
    ],
  },
  {
    name: "Erik Strategist",
    mail: "erik.strategist@example.com",
    password: "Debug123!",
    currency: 165,
    score: 190,
    avatar: "pyke",
    deck: [
      {
        role: "Top",
        name: "Riftbreaker",
        points: 84,
        value: 27,
        multiplier: "Captain",
        playerId: 6,
      },
      {
        role: "Jgl",
        name: "Phantom V",
        points: 80,
        value: 24,
        playerId: 7,
      },
      {
        role: "Mid",
        name: "Sage of Dawn",
        points: 87,
        value: 26,
        playerId: 8,
      },
      {
        role: "Adc",
        name: "Scarlet Viper",
        points: 89,
        value: 24,
        multiplier: "Vice-captain",
        playerId: 9,
      },
      {
        role: "Supp",
        name: "Warden Sol",
        points: 78,
        value: 22,
        playerId: 10,
      },
    ],
  },
];

const ROLE_ORDER: Role[] = ["Top", "Jgl", "Mid", "Adc", "Supp"];

export type PlayerFilters = {
  role?: Role;
  regionId?: number;
  teamId?: number;
};

type PlayerOverviewRow = {
  id: number;
  name: string;
  nickname?: string | null;
  role: Role;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  score: number;
  region_id: number;
  team_id: number;
  teamName: string;
  regionName: string;
  tournamentId: number;
  tournamentName: string;
};

export type PlayerOverview = {
  id: number;
  name: string;
  nickname?: string | null;
  role: Role;
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

export type TeamOverview = Team & {
  tournamentName: string;
  regionName: string;
  playerCount: number;
};

function calculateSeedDeckValue(deckSeed: DebugDeckCardSeed[]): number {
  return deckSeed.reduce((total, card) => total + card.value, 0);
}

function buildDeckFromSeed(userId: number, deckSeed: DebugDeckCardSeed[]): Deck {
  const slots: Partial<Record<Role, Card>> = {};
  for (const cardSeed of deckSeed) {
    const card: Card = {
      name: cardSeed.name,
      role: cardSeed.role,
      points: cardSeed.points,
      value: cardSeed.value,
    };
    if (cardSeed.multiplier) {
      card.multiplier = cardSeed.multiplier;
    }
    if (cardSeed.playerId !== undefined) {
      card.playerId = cardSeed.playerId;
    }
    slots[cardSeed.role] = card;
  }
  return createDeck({ userId, slots });
}

function seedCollectionFromDeck(userId: number, deckSeed: DebugDeckCardSeed[]): void {
  for (const cardSeed of deckSeed) {
    if (cardSeed.playerId === undefined) {
      continue;
    }
    try {
      addPlayerToCollection(userId, cardSeed.playerId);
    } catch (error) {
      // ignore duplicates
    }
  }
}

function ensureSampleUsersWithDecks(): void {
  for (const sample of DEBUG_USER_SEEDS) {
    const requiredCurrency = Math.max(
      sample.currency,
      calculateSeedDeckValue(sample.deck)
    );

    const existingUser = db
      .prepare("SELECT id, currency, score FROM users WHERE mail = ?")
      .get(sample.mail) as
      | { id: number; currency: number; score: number }
      | undefined;

    let userId: number;

    if (!existingUser) {
      const created = addUser({
        name: sample.name,
        mail: sample.mail,
        password: sample.password,
        currency: requiredCurrency,
        score: sample.score,
        avatar: sample.avatar ?? null,
      });
      userId = created.id;
    } else {
      userId = existingUser.id;
      const nextCurrency = Math.max(
        typeof existingUser.currency === "number"
          ? existingUser.currency
          : 0,
        requiredCurrency
      );
      const nextScore = Math.max(
        typeof existingUser.score === "number" ? existingUser.score : 0,
        sample.score
      );
      db.prepare(
        "UPDATE users SET name = ?, currency = ?, score = ?, avatar = ? WHERE id = ?"
      ).run(sample.name, nextCurrency, nextScore, sample.avatar ?? null, userId);
    }

    const deckToSave = buildDeckFromSeed(userId, sample.deck);
    try {
      const result = saveDeck(userId, deckToSave);
      if (result.status !== "saved") {
        console.warn(
          "Seeded debug deck with warnings for user",
          sample.mail,
          result
        );
      }
    } catch (error) {
      console.warn("Failed to seed debug deck for user", sample.mail, error);
    }

    try {
      seedCollectionFromDeck(userId, sample.deck);
    } catch (error) {
      console.warn("Failed to seed collection for user", sample.mail, error);
    }
  }
}

try {
  ensureSampleUsersWithDecks();
} catch (error) {
  console.warn("Failed to initialize debug users", error);
}

ensureSeedData();

type DeckRow = {
  user_id: number;
  data: string;
  updated_at: string;
};

type DbUserRow = {
  id: number;
  name: string;
  mail: string;
  password: string;
  currency: number;
  score: number;
  avatar: string | null;
  tutorial_seen: number;
};

type SafeUser = {
  id: number;
  name: string;
  mail: string;
  currency: number;
  score: number;
  avatar: string | null;
  tutorialSeen: boolean;
};

type DbLobbyRow = {
  id: number;
  name: string | null;
  password: string | null;
  entry_fee: number | null;
  betValue: number | null;
  winner_id: number | null;
  host_id: number | null;
  status: string | null;
  started_at: string | null;
};

type LobbyPlayerRow = {
  id: number;
  name: string;
  avatar: string | null;
  lobby_ready: number;
};

type LobbyListRow = {
  id: number;
  name: string | null;
  entry_fee: number | null;
  betValue: number | null;
  password: string | null;
  status: string | null;
  playerCount: number;
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

export type LobbyListEntry = {
  id: number;
  name: string;
  entryFee: number;
  playerCount: number;
  passwordProtected: boolean;
  status: "waiting" | "started";
};

function toSafeUser(row: DbUserRow): SafeUser {
  return {
    id: row.id,
    name: row.name,
    mail: row.mail,
    currency: row.currency,
    score: row.score,
    avatar: row.avatar,
    tutorialSeen: Boolean(row.tutorial_seen),
  };
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES).toString("hex");
  const hash = crypto
    .pbkdf2Sync(
      password,
      salt,
      PASSWORD_ITERATIONS,
      PASSWORD_HASH_BYTES,
      PASSWORD_DIGEST
    )
    .toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }
  const expectedHash = Buffer.from(hash, "hex");
  const derivedHash = crypto.pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    expectedHash.length,
    PASSWORD_DIGEST
  );
  if (expectedHash.length !== derivedHash.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedHash, derivedHash);
}

function hydrateDeckFromRow(userId: number, row?: DeckRow): Deck {
  if (!row) {
    return createDeck({ userId });
  }

  try {
    const slots = JSON.parse(row.data) as unknown;
    return parseDeckPayload({ userId, slots });
  } catch (error) {
    console.error(
      "Failed to parse persisted deck. Returning empty deck.",
      error
    );
    return createDeck({ userId });
  }
}

function persistCompleteDeck(userId: number, deck: CompleteDeck) {
  const payload = JSON.stringify(deck.slots);
  const stmt = db.prepare(`
    INSERT INTO decks (user_id, data, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      data = excluded.data,
      updated_at = excluded.updated_at
  `);
  stmt.run(userId, payload);
}

function persistDeck(userId: number, deck: Deck) {
  const payload = JSON.stringify(deck.slots);
  const stmt = db.prepare(`
    INSERT INTO decks (user_id, data, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      data = excluded.data,
      updated_at = excluded.updated_at
  `);
  stmt.run(userId, payload);
}

// Fetch only the currency column; throws when the user does not exist.
export function getUserCurrency(userId: number): number {
  const row = db
    .prepare("SELECT currency FROM users WHERE id = ?")
    .get(userId) as { currency: number } | undefined;

  if (!row) {
    throw new Error("USER_NOT_FOUND");
  }

  return row.currency;
}

export function addUserCurrency(userId: number, delta: number): number {
  const current = getUserCurrency(userId);
  const next = Math.max(0, Math.floor(current + delta));
  db.prepare("UPDATE users SET currency = ? WHERE id = ?").run(next, userId);
  return next;
}

export function getUserScore(userId: number): number {
  const row = db
    .prepare("SELECT score FROM users WHERE id = ?")
    .get(userId) as { score: number } | undefined;

  if (!row) {
    throw new Error("USER_NOT_FOUND");
  }

  return row.score;
}

export function addUserScore(userId: number, delta: number): number {
  const increment = Number(delta);
  if (!Number.isFinite(increment)) {
    throw new Error("SCORE_DELTA_INVALID");
  }

  const result = db
    .prepare("UPDATE users SET score = score + ? WHERE id = ?")
    .run(increment, userId);

  if (result.changes === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  return getUserScore(userId);
}

export function addUserTournamentScore(userId: number, delta: number): number {
  const increment = Number(delta);
  if (!Number.isFinite(increment)) {
    throw new Error("SCORE_DELTA_INVALID");
  }

  const result = db
    .prepare("UPDATE users SET tournament_score = tournament_score + ? WHERE id = ?")
    .run(increment, userId);

  if (result.changes === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  return getUserScore(userId);
}

export function addUserLobbyScore(userId: number, delta: number): number {
  const increment = Number(delta);
  if (!Number.isFinite(increment)) {
    throw new Error("SCORE_DELTA_INVALID");
  }

  const result = db
    .prepare("UPDATE users SET lobby_score = lobby_score + ? WHERE id = ?")
    .run(increment, userId);

  if (result.changes === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  return getUserScore(userId);
}

export type StoredDeck = {
  userId: number;
  deck: Deck;
  summary: DeckSummary;
  updatedAt: string;
};

export function getDeck(userId: number): Deck {
  const row = db
    .prepare("SELECT user_id, data, updated_at FROM decks WHERE user_id = ?")
    .get(userId) as DeckRow | undefined;

  return hydrateDeckFromRow(userId, row);
}

export function getAllDecks(): StoredDeck[] {
  const rows = db
    .prepare(
      "SELECT user_id, data, updated_at FROM decks ORDER BY updated_at DESC"
    )
    .all() as DeckRow[];

  return rows.map((row) => {
    const deck = hydrateDeckFromRow(row.user_id, row);
    const summary = summarizeDeck(deck);
    return {
      userId: row.user_id,
      deck,
      summary,
      updatedAt: row.updated_at,
    };
  });
}

type UserTransferState = {
  transferCount: number;
  transferTournamentId: number | null;
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getActiveTournamentForTransfers(): TournamentRow | null {
  const row = db
    .prepare(
      `
      SELECT
        id,
        name,
        region_id,
        type,
        status,
        stage,
        is_active,
        current_round,
        started_at,
        completed_at,
        rewards_applied
      FROM tournaments
      WHERE is_active = 1
      ORDER BY COALESCE(started_at, completed_at, CURRENT_TIMESTAMP) DESC, id DESC
      LIMIT 1
    `
    )
    .get() as TournamentRow | undefined;
  return row ?? null;
}

function getUserTransferState(userId: number): UserTransferState {
  const row = db
    .prepare(
      "SELECT transfer_count, transfer_tournament_id FROM users WHERE id = ?"
    )
    .get(userId) as
    | { transfer_count?: number; transfer_tournament_id?: number | null }
    | undefined;

  if (!row) {
    throw new Error("USER_NOT_FOUND");
  }

  return {
    transferCount: Number(row.transfer_count) || 0,
    transferTournamentId:
      typeof row.transfer_tournament_id === "number"
        ? Number(row.transfer_tournament_id)
        : null,
  };
}

function setUserTransferState(
  userId: number,
  tournamentId: number | null,
  transferCount: number
): void {
  db.prepare(
    "UPDATE users SET transfer_count = ?, transfer_tournament_id = ? WHERE id = ?"
  ).run(Math.max(0, Math.floor(transferCount)), tournamentId, userId);
}

function cardIdentity(card: Card | null | undefined): string | null {
  if (!card) {
    return null;
  }
  if (typeof card.playerId === "number" && Number.isFinite(card.playerId)) {
    return `player:${card.playerId}`;
  }
  return `name:${card.name.trim().toLowerCase()}`;
}

function countDeckTransfers(previous: Deck, next: Deck): number {
  const hadAnyCard = REQUIRED_ROLES.some((role) => previous.slots[role]);
  if (!hadAnyCard) {
    return 0;
  }

  let transfers = 0;
  for (const role of REQUIRED_ROLES) {
    const prevId = cardIdentity(previous.slots[role]);
    const nextId = cardIdentity(next.slots[role]);
    if (prevId !== nextId && (prevId || nextId)) {
      transfers += 1;
    }
  }
  return transfers;
}

function applyScoreDecay(currentScore: number, deltaScore: number): number {
  const decayed = currentScore * PLAYER_SCORE_DECAY + deltaScore;
  const bounded = clampNumber(decayed, PLAYER_SCORE_MIN, PLAYER_SCORE_MAX);
  return Number(bounded.toFixed(2));
}

function calculateMarketValueFromScore(score: number): number {
  const safeScore = clampNumber(score, PLAYER_SCORE_MIN, PLAYER_SCORE_MAX);
  return Math.max(10, Math.round(safeScore / 3));
}

type TransferCommit = {
  tournamentId: number;
  nextTransfers: number;
  fee: number;
  transferDelta: number;
};

function hasCompletedBracketMatches(tournamentId: number): boolean {
  const row = db
    .prepare(
      `
      SELECT COUNT(*) as total
      FROM tournament_matches
      WHERE tournament_id = ?
        AND stage = 'bracket'
        AND status = 'completed'
    `
    )
    .get(tournamentId) as { total?: number } | undefined;
  return Number(row?.total) > 0;
}

function isTransferWindowOpen(tournament: TournamentRow): boolean {
  if (tournament.stage !== "bracket") {
    return false;
  }
  return !hasCompletedBracketMatches(tournament.id);
}

function prepareTransferCommit(
  userId: number,
  transferDelta: number,
  currency: number,
  tournament: TournamentRow | null
): TransferCommit | null {
  if (transferDelta <= 0 || !tournament) {
    return null;
  }

  if (!isTransferWindowOpen(tournament)) {
    throw new DeckError(
      "TRANSFER_WINDOW_CLOSED",
      "Transfers are only allowed between tournament stages.",
      {
        tournamentId: tournament.id,
        stage: tournament.stage,
      }
    );
  }

  const transferState = getUserTransferState(userId);
  const isNewTournament =
    transferState.transferTournamentId === null ||
    transferState.transferTournamentId !== tournament.id;
  const currentTransfers = isNewTournament ? 0 : transferState.transferCount;
  const nextTransfers = currentTransfers + transferDelta;

  if (nextTransfers > TRANSFER_LIMIT_PER_TOURNAMENT) {
    throw new DeckError(
      "TRANSFER_LIMIT_EXCEEDED",
      "Transfer limit reached for the active tournament.",
      {
        tournamentId: tournament.id,
        transfersUsed: currentTransfers,
        transferLimit: TRANSFER_LIMIT_PER_TOURNAMENT,
        requestedTransfers: transferDelta,
      }
    );
  }

  const fee = Math.max(0, Math.floor(TRANSFER_FEE_PER_CARD * transferDelta));
  if (fee > currency) {
    throw new DeckError(
      "CURRENCY_LIMIT_EXCEEDED",
      "Not enough currency to pay the transfer fee.",
      {
        currency,
        transferFee: fee,
        requestedTransfers: transferDelta,
      }
    );
  }

  return {
    tournamentId: tournament.id,
    nextTransfers,
    fee,
    transferDelta,
  };
}

function commitTransfers(userId: number, commit: TransferCommit | null): number {
  if (!commit) {
    return 0;
  }

  setUserTransferState(userId, commit.tournamentId, commit.nextTransfers);
  return commit.fee;
}

export function saveDeck(userId: number, deck: Deck): DeckSaveResult {
  const deckWithOwner = createDeck({
    userId,
    slots: deck.slots,
  });

  ensureUniqueMultipliers(deckWithOwner);
  ensureDeckCardsOwned(userId, deckWithOwner);

  try {
    const completeDeck = ensureDeckComplete(deckWithOwner);
    persistCompleteDeck(userId, completeDeck);
    return { status: "saved", deck: completeDeck };
  } catch (error) {
    if (error instanceof DeckError && error.code === "ROLE_EMPTY") {
      const summary = summarizeDeck(deckWithOwner);
      return {
        status: "warning",
        deck: deckWithOwner,
        missingRoles: summary.missingRoles,
        message: "Deck is incomplete. Assign cards to all roles before saving.",
      };
    }
    throw error;
  }
}

export function getAllItems() {
  const stmt = db.prepare("SELECT id, name, qty FROM items");
  return stmt.all();
}

export function addItem(name: string, qty = 0) {
  const stmt = db.prepare("INSERT INTO items (name, qty) VALUES (?, ?)");
  const info = stmt.run(name, qty);
  return { id: info.lastInsertRowid, name, qty };
}

export function addUser({
  name,
  mail,
  password,
  currency,
  score,
  avatar,
  tutorialSeen,
}: User) {
  const hashedPassword = hashPassword(password);
  const normalizedScore =
    typeof score === "number" && Number.isFinite(score) ? score : 0;
  const normalizedAvatar =
    typeof avatar === "string" && avatar.length > 0 ? avatar : null;
  const normalizedTutorialSeen = tutorialSeen ? 1 : 0;
  const stmt = db.prepare(
    "INSERT INTO users (name, mail, password, currency, score, avatar, tutorial_seen) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const info = stmt.run(
    name,
    mail,
    hashedPassword,
    currency,
    normalizedScore,
    normalizedAvatar,
    normalizedTutorialSeen
  );
  return {
    id: Number(info.lastInsertRowid),
    name,
    mail,
    password: hashedPassword,
    currency,
    score: normalizedScore,
    avatar: normalizedAvatar,
    tutorial_seen: normalizedTutorialSeen,
  };
}

export function getAllUsers() {
  const stmt = db.prepare("SELECT * FROM users");
  return stmt.all();
}

export type LeaderboardEntry = {
  id: number;
  name: string;
  score: number;
  currency: number;
  passiveGold: number;
  position: number;
};

export type TournamentPlayerAggregate = {
  playerId: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
};

type MatchObjectives = {
  towers: number;
  dragons: number;
  barons: number;
};

type ObjectivesBySide = Record<"A" | "B", MatchObjectives>;

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

type MatchPlayerStat = {
  playerId?: number;
  name: string;
  nickname?: string | null;
  role: Role | string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  score: number;
  teamId?: number | null;
  teamName?: string | null;
  teamSide?: "A" | "B" | null;
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

export type TournamentGroupStanding = {
  teamId: number;
  teamName: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  seed?: number | null;
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

export type TournamentSimulationMode = "next" | "round" | "full";

export type TournamentSimulationResult = {
  matches: TournamentMatchSummary[];
  state: TournamentControlState;
};

export type PlayerProfileDetails = {
  id: number;
  name: string;
  nickname?: string | null;
  role: Role;
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

type TournamentRow = {
  id: number;
  name: string;
  region_id: number;
  type: string;
  status: string;
  stage: string;
  is_active: number;
  current_round: number;
  started_at: string | null;
  completed_at: string | null;
  rewards_applied: number;
};

type TournamentGroupRow = {
  id: number;
  name: string;
};

type TournamentMatchRow = {
  id: number;
  tournament_id: number;
  region_id: number;
  stage: string;
  round_name: string;
  round_number: number;
  match_number: number;
  best_of: number;
  group_id: number | null;
  team1_id: number | null;
  team2_id: number | null;
  team1_score: number;
  team2_score: number;
  winner_team_id: number | null;
  status: string;
};

function getTeamNameById(teamId: number): string | null {
  const row = db
    .prepare("SELECT name FROM teams WHERE id = ?")
    .get(teamId) as { name: string } | undefined;
  return row?.name ?? null;
}

export function getUsersCount(): number {
  const row = db
    .prepare("SELECT COUNT(*) AS total FROM users")
    .get() as { total: number } | undefined;
  return row?.total ?? 0;
}

function buildPassiveGoldMap(userIds: number[]): Map<number, number> {
  const map = new Map<number, number>();
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return map;
  }
  const placeholders = buildInClausePlaceholders(userIds.length);
  const rows = db
    .prepare(
      `
      SELECT uc.user_id as userId, p.id as playerId, p.score as score
      FROM user_cards uc
      JOIN players p ON p.id = uc.player_id
      WHERE uc.user_id IN (${placeholders})
    `
    )
    .all(...userIds) as Array<{ userId: number; playerId: number; score: number }>;

  rows.forEach((row) => {
    const recentScores = fetchRecentPlayerScores(row.playerId);
    const marketValue = calculateMarketValueFromRecent(recentScores, row.score);
    const current = map.get(row.userId) ?? 0;
    map.set(row.userId, current + marketValue);
  });

  return map;
}

export function getLeaderboardTop(
  limit = 10,
  mode: "global" | "tournament" = "global"
): LeaderboardEntry[] {
  const scoreColumn = mode === "tournament" ? "tournament_score" : "score";
  const rows = db
    .prepare(
      `SELECT id, name, ${scoreColumn} as score, currency FROM users ORDER BY ${scoreColumn} DESC, id ASC LIMIT ?`
    )
    .all(limit) as Array<{
    id: number;
    name: string;
    score: number;
    currency: number;
  }>;
  const passiveGoldMap = buildPassiveGoldMap(rows.map((row) => row.id));

  return rows.map((row, index) => ({
    id: row.id,
    name: row.name,
    score: Number(row.score) || 0,
    currency: Number(row.currency) || 0,
    passiveGold: passiveGoldMap.get(row.id) ?? 0,
    position: index + 1,
  }));
}

migrateMatchHistoryPlayersTable
export function getUserRankingEntry(
  userId: number,
  mode: "global" | "tournament" = "global"
): LeaderboardEntry | undefined {
  const scoreColumn = mode === "tournament" ? "tournament_score" : "score";
  const userRow = db
    .prepare(`SELECT id, name, ${scoreColumn} as score, currency FROM users WHERE id = ?`)
    .get(userId) as
    | {
        id: number;
        name: string;
        score: number;
        currency: number;
      }
    | undefined;

  if (!userRow) {
    return undefined;
  }

  const higherCountRow = db
    .prepare(
      `SELECT COUNT(*) AS higher FROM users WHERE ${scoreColumn} > ? OR (${scoreColumn} = ? AND id < ?)`
    )
    .get(userRow.score, userRow.score, userRow.id) as { higher: number };

  const position = Number(higherCountRow?.higher ?? 0) + 1;
  const passiveGoldMap = buildPassiveGoldMap([userRow.id]);

  return {
    id: userRow.id,
    name: userRow.name,
    score: Number(userRow.score) || 0,
    currency: Number(userRow.currency) || 0,
    passiveGold: passiveGoldMap.get(userRow.id) ?? 0,
    position,
  };
}

type MatchHistoryRow = {
  id: number;
  region: string;
  team_a: string;
  team_b: string;
  winner: string;
  mvp: string | null;
  mvp_score: number | null;
  is_tournament: number;
  tournament_id: number | null;
  tournament_match_id: number | null;
  tournament_game_id: number | null;
  stage: string | null;
  round_name: string | null;
  game_number: number | null;
  series_best_of: number | null;
  series_score: string | null;
  team_a_towers: number | null;
  team_b_towers: number | null;
  team_a_dragons: number | null;
  team_b_dragons: number | null;
  team_a_barons: number | null;
  team_b_barons: number | null;
  created_at: string;
};

type MatchHistoryInsert = {
  region: string;
  teamA: string;
  teamB: string;
  winner: string;
  mvp?: string | null;
  mvpScore?: number | null;
  isTournament?: boolean;
  tournamentId?: number | null;
  tournamentMatchId?: number | null;
  tournamentGameId?: number | null;
  stage?: string | null;
  roundName?: string | null;
  gameNumber?: number | null;
  seriesBestOf?: number | null;
  seriesScore?: string | null;
  teamATowers?: number;
  teamBTowers?: number;
  teamADragons?: number;
  teamBDragons?: number;
  teamABarons?: number;
  teamBBarons?: number;
};

function mapMatchHistoryRow(row: MatchHistoryRow): MatchHistoryEntry {
  return {
    id: row.id,
    region: row.region,
    teamA: row.team_a,
    teamB: row.team_b,
    winner: row.winner,
    mvp: row.mvp ?? null,
    mvpScore:
      typeof row.mvp_score === "number" && Number.isFinite(row.mvp_score)
        ? row.mvp_score
        : null,
    isTournament: Boolean(row.is_tournament),
    tournamentId: row.tournament_id ?? null,
    tournamentMatchId: row.tournament_match_id ?? null,
    tournamentGameId: row.tournament_game_id ?? null,
    stage: row.stage ?? null,
    roundName: row.round_name ?? null,
    gameNumber:
      typeof row.game_number === "number" && Number.isFinite(row.game_number)
        ? row.game_number
        : null,
    seriesBestOf:
      typeof row.series_best_of === "number" && Number.isFinite(row.series_best_of)
        ? row.series_best_of
        : null,
    seriesScore: row.series_score ?? null,
    createdAt: row.created_at,
    objectives: {
      teamA: {
        towers: row.team_a_towers ?? 0,
        dragons: row.team_a_dragons ?? 0,
        barons: row.team_a_barons ?? 0,
      },
      teamB: {
        towers: row.team_b_towers ?? 0,
        dragons: row.team_b_dragons ?? 0,
        barons: row.team_b_barons ?? 0,
      },
    },
  };
}

type MatchPlayerHistoryRow = {
  id: number;
  match_id: number;
  player_id: number | null;
  player_name: string;
  nickname: string | null;
  role: string | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  score: number;
  team_name: string | null;
  team_side: string | null;
};

function buildInClausePlaceholders(count: number): string {
  return new Array(Math.max(count, 0)).fill("?").join(",");
}

export function recordMatchHistory(
  entry: MatchHistoryInsert,
  players?: MatchPlayerStat[]
): number | undefined {
  const result = db
    .prepare(
      `INSERT INTO match_history
        (region, team_a, team_b, winner, mvp, mvp_score, is_tournament, tournament_id, tournament_match_id, tournament_game_id, stage, round_name, game_number, series_best_of, series_score, team_a_towers, team_b_towers, team_a_dragons, team_b_dragons, team_a_barons, team_b_barons)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry.region,
      entry.teamA,
      entry.teamB,
      entry.winner,
      entry.mvp ?? null,
      typeof entry.mvpScore === "number" ? entry.mvpScore : null,
      entry.isTournament ? 1 : 0,
      entry.tournamentId ?? null,
      entry.tournamentMatchId ?? null,
      entry.tournamentGameId ?? null,
      entry.stage ?? null,
      entry.roundName ?? null,
      typeof entry.gameNumber === "number" ? entry.gameNumber : null,
      typeof entry.seriesBestOf === "number" ? entry.seriesBestOf : null,
      entry.seriesScore ?? null,
      entry.teamATowers ?? 0,
      entry.teamBTowers ?? 0,
      entry.teamADragons ?? 0,
      entry.teamBDragons ?? 0,
      entry.teamABarons ?? 0,
      entry.teamBBarons ?? 0
    );

  const matchId = Number(result.lastInsertRowid);
  if (!players || players.length === 0) {
    return matchId;
  }

  const stmt = db.prepare(
    `INSERT INTO match_history_players
      (match_id, player_id, player_name, nickname, role, kills, deaths, assists, cs, gold, score, team_name, team_side)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const player of players) {
    stmt.run(
      matchId,
      player.playerId ?? null,
      player.name,
      player.nickname ?? null,
      typeof player.role === "string" ? player.role : player.role ?? null,
      player.kills,
      player.deaths,
      player.assists,
      player.cs,
      player.gold,
      player.score,
      player.teamName ?? null,
      player.teamSide ?? null
    );
  }

  return matchId;
}

export function getRecentMatchHistory(
  limit = 10,
  offset = 0
): MatchHistorySeriesEntry[] {
  type MatchHistorySeriesRow = {
    series_id: number;
    is_tournament: number;
    tournament_id: number | null;
    stage: string | null;
    round_name: string | null;
    series_best_of: number | null;
    started_at: string;
    completed_at: string;
    series_score: string | null;
  };

  const seriesRows = db
    .prepare(
      `
      WITH normalized AS (
        SELECT
          CASE
            WHEN tournament_match_id IS NOT NULL THEN tournament_match_id
            ELSE id
          END AS series_id,
          CASE WHEN tournament_match_id IS NOT NULL THEN 1 ELSE 0 END AS is_tournament,
          MAX(tournament_id) AS tournament_id,
          MAX(stage) AS stage,
          MAX(round_name) AS round_name,
          MAX(series_best_of) AS series_best_of,
          MIN(created_at) AS started_at,
          MAX(created_at) AS completed_at,
          MAX(series_score) AS series_score
        FROM match_history
        GROUP BY series_id, is_tournament
      )
      SELECT *
      FROM normalized
      ORDER BY completed_at DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(limit, offset) as MatchHistorySeriesRow[];

  if (seriesRows.length === 0) {
    return [];
  }

  const tournamentSeriesIds = seriesRows
    .filter((row) => row.is_tournament)
    .map((row) => row.series_id);
  const friendlySeriesIds = seriesRows
    .filter((row) => !row.is_tournament)
    .map((row) => row.series_id);

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (tournamentSeriesIds.length > 0) {
    clauses.push(
      `tournament_match_id IN (${buildInClausePlaceholders(tournamentSeriesIds.length)})`
    );
    params.push(...tournamentSeriesIds);
  }

  if (friendlySeriesIds.length > 0) {
    clauses.push(
      `id IN (${buildInClausePlaceholders(friendlySeriesIds.length)})`
    );
    params.push(...friendlySeriesIds);
  }

  if (clauses.length === 0) {
    return [];
  }

  const gamesRows = db
    .prepare(
      `
      SELECT
        id,
        region,
        team_a,
        team_b,
        winner,
        mvp,
        mvp_score,
        is_tournament,
        tournament_id,
        tournament_match_id,
        tournament_game_id,
        stage,
        round_name,
        game_number,
        series_best_of,
        series_score,
        team_a_towers,
        team_b_towers,
        team_a_dragons,
        team_b_dragons,
        team_a_barons,
        team_b_barons,
        created_at
      FROM match_history
      WHERE ${clauses.join(" OR ")}
      ORDER BY created_at ASC, id ASC
    `
    )
    .all(...params) as MatchHistoryRow[];

  const gamesBySeries = new Map<number, MatchHistoryEntry[]>();
  for (const row of gamesRows) {
    const seriesKey = row.tournament_match_id ?? row.id;
    if (!gamesBySeries.has(seriesKey)) {
      gamesBySeries.set(seriesKey, []);
    }
    gamesBySeries.get(seriesKey)!.push(mapMatchHistoryRow(row));
  }

  const tournamentMatchMap = new Map<
    number,
    {
      id: number;
      stage: string;
      round_name: string;
      best_of: number;
      team1_id: number | null;
      team2_id: number | null;
      team1_name: string | null;
      team2_name: string | null;
      team1_score: number;
      team2_score: number;
    }
  >();

  if (tournamentSeriesIds.length > 0) {
    const matchRows = db
      .prepare(
        `
        SELECT
          tm.id,
          tm.stage,
          tm.round_name,
          tm.best_of,
          tm.team1_id,
          tm.team2_id,
          tm.team1_score,
          tm.team2_score,
          t1.name AS team1_name,
          t2.name AS team2_name
        FROM tournament_matches tm
        LEFT JOIN teams t1 ON t1.id = tm.team1_id
        LEFT JOIN teams t2 ON t2.id = tm.team2_id
        WHERE tm.id IN (${buildInClausePlaceholders(tournamentSeriesIds.length)})
      `
      )
      .all(...tournamentSeriesIds) as Array<{
      id: number;
      stage: string;
      round_name: string;
      best_of: number;
      team1_id: number | null;
      team2_id: number | null;
      team1_name: string | null;
      team2_name: string | null;
      team1_score: number;
      team2_score: number;
    }>;

    for (const row of matchRows) {
      tournamentMatchMap.set(row.id, row);
    }
  }

  return seriesRows.map((series) => {
    const games = gamesBySeries.get(series.series_id) ?? [];
    const firstGame = games[0];
    const lastGame = games[games.length - 1];
    const startedAt = firstGame?.createdAt ?? series.started_at;
    const completedAt = lastGame?.createdAt ?? series.completed_at;

    let teamAName = firstGame?.teamA ?? "Team A";
    let teamBName = firstGame?.teamB ?? "Team B";
    let teamAId: number | null = null;
    let teamBId: number | null = null;
    let scoreA = 0;
    let scoreB = 0;
    let bestOf =
      typeof series.series_best_of === "number"
        ? series.series_best_of
        : games.length || 1;
    let stage = series.stage;
    let roundName = series.round_name;

    if (series.is_tournament) {
      const matchDetail = tournamentMatchMap.get(series.series_id);
      if (matchDetail) {
        teamAName = matchDetail.team1_name ?? teamAName;
        teamBName = matchDetail.team2_name ?? teamBName;
        teamAId = matchDetail.team1_id ?? null;
        teamBId = matchDetail.team2_id ?? null;
        scoreA = Number(matchDetail.team1_score) || 0;
        scoreB = Number(matchDetail.team2_score) || 0;
        bestOf = matchDetail.best_of ?? bestOf;
        stage = stage ?? matchDetail.stage;
        roundName = roundName ?? matchDetail.round_name;
      }
    } else {
      for (const game of games) {
        if (game.winner === teamAName) {
          scoreA += 1;
        } else if (game.winner === teamBName) {
          scoreB += 1;
        }
      }
      bestOf = 1;
      stage = stage ?? "Friendly";
    }

    const seriesScore = series.series_score ?? `${scoreA}-${scoreB}`;

    return {
      id: series.series_id,
      isTournament: Boolean(series.is_tournament),
      tournamentId: series.tournament_id ?? null,
      stage: stage ?? null,
      roundName: roundName ?? null,
      bestOf,
      completed: true,
      startedAt,
      completedAt,
      seriesScore,
      teamA: {
        name: teamAName,
        id: teamAId,
        score: scoreA,
      },
      teamB: {
        name: teamBName,
        id: teamBId,
        score: scoreB,
      },
      games,
    };
  });
}

export function getMatchHistoryCount(): number {
  const row = db
    .prepare(
      `
      SELECT COUNT(*) as total FROM (
        SELECT
          CASE
            WHEN tournament_match_id IS NOT NULL THEN tournament_match_id
            ELSE id
          END AS series_id,
          CASE WHEN tournament_match_id IS NOT NULL THEN 1 ELSE 0 END AS is_tournament
        FROM match_history
        GROUP BY series_id, is_tournament
      )
    `
    )
    .get() as { total: number } | undefined;
  return row?.total ?? 0;
}

export function getMatchHistoryById(
  matchId: number
): MatchHistoryEntry | undefined {
  const row = db
    .prepare(
      `
      SELECT
        id,
        region,
        team_a,
        team_b,
        winner,
        mvp,
        mvp_score,
        is_tournament,
        tournament_id,
        tournament_match_id,
        tournament_game_id,
        stage,
        round_name,
        game_number,
        series_best_of,
        series_score,
        team_a_towers,
        team_b_towers,
        team_a_dragons,
        team_b_dragons,
        team_a_barons,
        team_b_barons,
        created_at
      FROM match_history
      WHERE id = ?
    `
    )
    .get(matchId) as MatchHistoryRow | undefined;
  return row ? mapMatchHistoryRow(row) : undefined;
}

export function getMatchHistoryPlayers(
  matchId: number
): MatchPlayerHistoryEntry[] {
  const rows = db
    .prepare(
      `SELECT id, match_id, player_id, player_name, nickname, role, kills, deaths, assists, cs, gold, score, team_name, team_side
       FROM match_history_players
       WHERE match_id = ?
       ORDER BY id ASC`
    )
    .all(matchId) as MatchPlayerHistoryRow[];

  return rows.map((row) => ({
    id: row.id,
    matchId: row.match_id,
    playerId: row.player_id,
    name: row.player_name,
    nickname: row.nickname,
    role: row.role,
    kills: row.kills ?? 0,
    deaths: row.deaths ?? 0,
    assists: row.assists ?? 0,
    cs: row.cs ?? 0,
    gold: row.gold ?? 0,
    score: row.score ?? 0,
    teamName: row.team_name ?? null,
    teamSide:
      row.team_side === "A" || row.team_side === "B"
        ? (row.team_side as "A" | "B")
        : null,
  }));
}

export function getPlayerProfileDetails(
  playerId: number
): PlayerProfileDetails | undefined {
  const row = db
    .prepare(
      `
      SELECT
        p.id,
        p.name,
        p.nickname,
        p.role,
        p.kills,
        p.deaths,
        p.assists,
        p.cs,
        p.gold,
        p.score,
        p.region_id as regionId,
        r.name as regionName,
        p.team_id as teamId,
        t.name as teamName,
        tr.name as tournamentName
      FROM players p
      JOIN regions r ON r.id = p.region_id
      JOIN teams t ON t.id = p.team_id
      JOIN tournaments tr ON tr.id = t.tournament_id
      WHERE p.id = ?
    `
    )
    .get(playerId) as
    | {
        id: number;
        name: string;
        nickname: string | null;
        role: Role;
        kills: number;
        deaths: number;
        assists: number;
        cs: number;
        gold: number;
        score: number;
        regionId: number;
        regionName: string;
        teamId: number;
        teamName: string;
        tournamentName: string;
      }
    | undefined;

  if (!row) {
    return undefined;
  }

  const totals = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(kills), 0) as totalKills,
        COALESCE(SUM(deaths), 0) as totalDeaths,
        COALESCE(SUM(assists), 0) as totalAssists,
        COALESCE(SUM(cs), 0) as totalCs,
        COALESCE(SUM(gold), 0) as totalGold
      FROM match_history_players
      WHERE player_id = ?
    `
    )
    .get(playerId) as
    | {
        totalKills: number;
        totalDeaths: number;
        totalAssists: number;
        totalCs: number;
        totalGold: number;
      }
    | undefined;

  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    role: row.role,
    kills: totals?.totalKills ?? row.kills,
    deaths: totals?.totalDeaths ?? row.deaths,
    assists: totals?.totalAssists ?? row.assists,
    cs: totals?.totalCs ?? row.cs,
    gold: totals?.totalGold ?? row.gold,
    score: row.score,
    team: {
      id: row.teamId,
      name: row.teamName,
      tournamentName: row.tournamentName,
    },
    region: {
      id: row.regionId,
      name: row.regionName,
    },
  };
}

export function getPlayerMatchAppearances(
  playerId: number,
  limit = 25
): PlayerMatchAppearance[] {
  const rows = db
    .prepare(
      `
      SELECT
        m.id as matchId,
        m.region,
        m.team_a as teamA,
        m.team_b as teamB,
        m.winner,
        m.stage,
        m.round_name as roundName,
        m.series_best_of as bestOf,
        m.is_tournament as isTournament,
        m.created_at as createdAt,
        mh.role,
        mh.kills,
        mh.deaths,
        mh.assists,
        mh.cs,
        mh.gold,
        mh.score,
        mh.team_name as playerTeamName,
        mh.team_side as playerTeamSide
      FROM match_history_players mh
      JOIN match_history m ON m.id = mh.match_id
      WHERE mh.player_id = ?
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ?
    `
    )
    .all(playerId, limit) as Array<{
    matchId: number;
    region: string;
    teamA: string;
    teamB: string;
    winner: string;
    stage: string | null;
    roundName: string | null;
    bestOf: number | null;
    isTournament: number;
    createdAt: string;
    role: string | null;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    gold: number;
    score: number;
    playerTeamName: string | null;
    playerTeamSide: string | null;
  }>;

  return rows.map((row) => ({
    matchId: row.matchId,
    createdAt: row.createdAt,
    region: row.region,
    stage: row.stage ?? null,
    roundName: row.roundName ?? null,
    bestOf: row.bestOf ?? null,
    isTournament: Boolean(row.isTournament),
    teamA: row.teamA,
    teamB: row.teamB,
    winner: row.winner,
    stats: {
      role: row.role,
      kills: row.kills ?? 0,
      deaths: row.deaths ?? 0,
      assists: row.assists ?? 0,
      cs: row.cs ?? 0,
      gold: row.gold ?? 0,
      score: row.score ?? 0,
      teamName: row.playerTeamName ?? null,
      teamSide:
        row.playerTeamSide === "A" || row.playerTeamSide === "B"
          ? (row.playerTeamSide as "A" | "B")
          : null,
    },
  }));
}

function applyMatchResultsToDecks(
  players: Player[],
  options?: { userIds?: number[]; scoreMode?: "global" | "lobby" | "tournament" }
): void {
  if (!Array.isArray(players) || players.length === 0) {
    return;
  }

  const allowedUsers = options?.userIds
    ? new Set(options.userIds)
    : null;
  const scoreMode = options?.scoreMode ?? "global";

  const decks = getAllDecks();
  for (const storedDeck of decks) {
    const userId = storedDeck.userId;
    if (!userId) {
      continue;
    }
    if (allowedUsers && !allowedUsers.has(userId)) {
      continue;
    }

    const boostInfo = getBoostMapForUser(userId, "match", null);
    const result = scoreDeckAgainstPlayers(
      storedDeck.deck,
      players,
      boostInfo.map
    );

    const awardedPoints = Math.max(result.totalScore, 0);
    try {
      if (scoreMode === "tournament") {
        addUserTournamentScore(userId, awardedPoints);
        addUserScore(userId, awardedPoints);
      } else if (scoreMode === "lobby") {
        addUserScore(userId, awardedPoints);
      } else {
        addUserScore(userId, awardedPoints);
      }
    } catch (error) {
      console.warn("Failed to add score for user after match", userId, error);
    }

    try {
      saveDeck(userId, result.deck);
    } catch (error) {
      console.warn("Failed to persist deck after match simulation", userId, error);
    }

    consumeBoostByIdIfApplied(boostInfo.boost, result);
  }
}

export function clearMatchHistory(): void {
  db.prepare("DELETE FROM match_history_players").run();
  db.prepare("DELETE FROM match_history").run();
}

export function clearUsers() {
  const stmt = db.prepare("DELETE FROM users");
  return stmt.run();
}

export function registerUser(user: User) {
  const existingUser = db
    .prepare("SELECT id FROM users WHERE mail = ?")
    .get(user.mail) as { id: number } | undefined;

  if (existingUser) {
    throw new Error("USER_ALREADY_EXISTS");
  }

  const insertedUser = addUser(user);
  return toSafeUser(insertedUser);
}

export function loginUser(mail: string, password: string) {
  const storedUser = db
    .prepare(
      "SELECT id, name, mail, password, currency, score, avatar, tutorial_seen FROM users WHERE mail = ?"
    )
    .get(mail) as DbUserRow | undefined;

  if (!storedUser) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (!verifyPassword(password, storedUser.password)) {
    throw new Error("INVALID_CREDENTIALS");
  }

  return toSafeUser(storedUser);
}

function fetchUserRowById(userId: number): DbUserRow | undefined {
  return db
    .prepare(
      "SELECT id, name, mail, password, currency, score, avatar, tutorial_seen FROM users WHERE id = ?"
    )
    .get(userId) as DbUserRow | undefined;
}

export function getUserById(userId: number): SafeUser | undefined {
  const row = fetchUserRowById(userId);
  return row ? toSafeUser(row) : undefined;
}

export function updateUserAvatar(
  userId: number,
  avatar: string | null
): SafeUser | undefined {
  db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(avatar, userId);
  return getUserById(userId);
}

export function updateUserTutorialSeen(
  userId: number,
  tutorialSeen: boolean
): SafeUser | undefined {
  db.prepare("UPDATE users SET tutorial_seen = ? WHERE id = ?").run(
    tutorialSeen ? 1 : 0,
    userId
  );
  return getUserById(userId);
}

function fetchLobbyRowById(lobbyId: number): DbLobbyRow | undefined {
  return db
    .prepare(
      "SELECT id, name, password, entry_fee, betValue, winner_id, host_id, status, started_at FROM lobby WHERE id = ?"
    )
    .get(lobbyId) as DbLobbyRow | undefined;
}

function getLobbyPlayers(lobbyId: number): LobbyPlayerRow[] {
  return db
    .prepare(
      "SELECT id, name, avatar, lobby_ready FROM users WHERE lobby_id = ? ORDER BY id"
    )
    .all(lobbyId) as LobbyPlayerRow[];
}

function buildLobbyResponse(row: DbLobbyRow, players: LobbyPlayerRow[]): LobbyResponse {
  const entryFee =
    typeof row.entry_fee === "number"
      ? row.entry_fee
      : typeof row.betValue === "number"
        ? row.betValue
        : 0;
  const hostId = row.host_id ?? (players.length > 0 ? players[0].id : null);
  const name =
    row.name && row.name.trim().length > 0
      ? row.name
      : `Lobby #${row.id}`;
  const status = row.status === "started" ? "started" : "waiting";
  const readyCount = players.filter((player) => Boolean(player.lobby_ready)).length;
  const allReady = players.length > 0 && readyCount === players.length;
  return {
    lobby: {
      id: row.id,
      name,
      entryFee,
      hostId,
      playerCount: players.length,
      passwordProtected: Boolean(row.password && row.password.length > 0),
      status,
      startedAt: row.started_at ?? null,
      readyCount,
      allReady,
    },
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      isHost: hostId === player.id,
      ready: Boolean(player.lobby_ready),
    })),
  };
}

export function getLobbyById(lobbyId: number): LobbyResponse | null {
  const row = fetchLobbyRowById(lobbyId);
  if (!row) {
    return null;
  }
  const players = getLobbyPlayers(row.id);
  if (!row.host_id && players.length > 0) {
    db.prepare("UPDATE lobby SET host_id = ? WHERE id = ?").run(
      players[0].id,
      row.id
    );
    row.host_id = players[0].id;
  }
  return buildLobbyResponse(row, players);
}

export function getLobbyByUser(userId: number): LobbyResponse | null {
  const userRow = db
    .prepare("SELECT lobby_id FROM users WHERE id = ?")
    .get(userId) as { lobby_id: number | null } | undefined;
  if (!userRow) {
    throw new Error("USER_NOT_FOUND");
  }
  if (!userRow.lobby_id) {
    return null;
  }
  return getLobbyById(userRow.lobby_id);
}

export function listLobbies(
  query?: string,
  options?: { openOnly?: boolean }
): LobbyListEntry[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (typeof query === "string" && query.trim().length > 0) {
    where.push("lower(COALESCE(l.name, '')) LIKE ?");
    params.push(`%${query.trim().toLowerCase()}%`);
  }
  if (options?.openOnly) {
    where.push("l.status <> 'started'");
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const havingClause = options?.openOnly
    ? "HAVING COUNT(u.id) < 5"
    : "";
  const rows = db
    .prepare(
      `
      SELECT
        l.id,
        l.name,
        l.entry_fee,
        l.betValue,
        l.password,
        l.status,
        COUNT(u.id) as playerCount
      FROM lobby l
      LEFT JOIN users u ON u.lobby_id = l.id
      ${whereClause}
      GROUP BY l.id
      ${havingClause}
      ORDER BY CASE l.status WHEN 'waiting' THEN 0 ELSE 1 END, l.id DESC
    `
    )
    .all(...params) as LobbyListRow[];

  return rows.map((row) => {
    const entryFee =
      typeof row.entry_fee === "number"
        ? row.entry_fee
        : typeof row.betValue === "number"
          ? row.betValue
          : 0;
    const name =
      row.name && row.name.trim().length > 0 ? row.name : `Lobby #${row.id}`;
    return {
      id: row.id,
      name,
      entryFee,
      playerCount: Number(row.playerCount) || 0,
      passwordProtected: Boolean(row.password && row.password.length > 0),
      status: row.status === "started" ? "started" : "waiting",
    };
  });
}

export function createLobby(options: {
  userId: number;
  name?: string;
  password?: string;
  entryFee?: number;
}): LobbyResponse {
  const userRow = db
    .prepare("SELECT lobby_id FROM users WHERE id = ?")
    .get(options.userId) as { lobby_id: number | null } | undefined;
  if (!userRow) {
    throw new Error("USER_NOT_FOUND");
  }
  if (userRow.lobby_id) {
    throw new Error("USER_ALREADY_IN_LOBBY");
  }
  const name =
    typeof options.name === "string" ? options.name.trim() : "";
  const password =
    typeof options.password === "string" ? options.password : "";
  const entryFee =
    typeof options.entryFee === "number" && Number.isFinite(options.entryFee)
      ? Math.max(0, Math.floor(options.entryFee))
      : 0;
  const insert = db.prepare(
    "INSERT INTO lobby (name, password, entry_fee, betValue, winner_id, host_id, status, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const result = insert.run(
    name,
    password,
    entryFee,
    0,
    null,
    options.userId,
    "waiting",
    null
  );
  const lobbyId = Number(result.lastInsertRowid);
  db.prepare(
    "UPDATE users SET lobby_id = ?, lobby_ready = 0, lobby_score = 0 WHERE id = ?"
  ).run(lobbyId, options.userId);
  const row = fetchLobbyRowById(lobbyId);
  if (!row) {
    throw new Error("LOBBY_NOT_FOUND");
  }
  const players = getLobbyPlayers(lobbyId);
  return buildLobbyResponse(row, players);
}

export function joinLobby(options: {
  userId: number;
  lobbyId: number;
  password?: string;
}): LobbyResponse {
  const lobby = fetchLobbyRowById(options.lobbyId);
  if (!lobby) {
    throw new Error("LOBBY_NOT_FOUND");
  }
  if (lobby.status === "started") {
    throw new Error("LOBBY_ALREADY_STARTED");
  }
  if (lobby.password && lobby.password.length > 0) {
    if (options.password !== lobby.password) {
      throw new Error("INVALID_LOBBY_PASSWORD");
    }
  }
  const userRow = db
    .prepare("SELECT lobby_id FROM users WHERE id = ?")
    .get(options.userId) as { lobby_id: number | null } | undefined;
  if (!userRow) {
    throw new Error("USER_NOT_FOUND");
  }
  if (userRow.lobby_id && userRow.lobby_id !== options.lobbyId) {
    throw new Error("USER_ALREADY_IN_LOBBY");
  }
  if (!userRow.lobby_id) {
    db.prepare(
      "UPDATE users SET lobby_id = ?, lobby_ready = 0, lobby_score = 0 WHERE id = ?"
    ).run(options.lobbyId, options.userId);
  }
  const players = getLobbyPlayers(options.lobbyId);
  if (!lobby.host_id && players.length > 0) {
    db.prepare("UPDATE lobby SET host_id = ? WHERE id = ?").run(
      players[0].id,
      options.lobbyId
    );
    lobby.host_id = players[0].id;
  }
  return buildLobbyResponse(lobby, players);
}

export function leaveLobby(options: {
  userId: number;
  lobbyId?: number;
}): { leftLobbyId: number; deleted: boolean } {
  const userRow = db
    .prepare("SELECT lobby_id FROM users WHERE id = ?")
    .get(options.userId) as { lobby_id: number | null } | undefined;
  if (!userRow) {
    throw new Error("USER_NOT_FOUND");
  }
  if (!userRow.lobby_id) {
    throw new Error("USER_NOT_IN_LOBBY");
  }
  if (
    typeof options.lobbyId === "number" &&
    options.lobbyId !== userRow.lobby_id
  ) {
    throw new Error("LOBBY_MISMATCH");
  }
  const lobbyId = userRow.lobby_id;
  db.prepare("UPDATE users SET lobby_id = NULL, lobby_ready = 0 WHERE id = ?").run(
    options.userId
  );

  const remaining = db
    .prepare("SELECT id FROM users WHERE lobby_id = ? ORDER BY id")
    .all(lobbyId) as Array<{ id: number }>;
  const lobbyRow = fetchLobbyRowById(lobbyId);

  if (!lobbyRow) {
    return { leftLobbyId: lobbyId, deleted: false };
  }

  if (remaining.length === 0) {
    db.prepare("DELETE FROM lobby WHERE id = ?").run(lobbyId);
    return { leftLobbyId: lobbyId, deleted: true };
  }

  if (lobbyRow.host_id === options.userId) {
    db.prepare("UPDATE lobby SET host_id = ? WHERE id = ?").run(
      remaining[0].id,
      lobbyId
    );
  }

  return { leftLobbyId: lobbyId, deleted: false };
}

export function updateLobbySettings(options: {
  lobbyId: number;
  userId: number;
  name?: string;
  password?: string;
  entryFee?: number;
}): LobbyResponse {
  const lobby = fetchLobbyRowById(options.lobbyId);
  if (!lobby) {
    throw new Error("LOBBY_NOT_FOUND");
  }
  if (lobby.host_id !== options.userId) {
    throw new Error("NOT_LOBBY_HOST");
  }
  if (lobby.status === "started") {
    throw new Error("LOBBY_ALREADY_STARTED");
  }
  const updates: Array<{ field: string; value: unknown }> = [];
  if (typeof options.name === "string") {
    updates.push({ field: "name", value: options.name.trim() });
  }
  if (typeof options.password === "string") {
    updates.push({ field: "password", value: options.password });
  }
  if (typeof options.entryFee === "number" && Number.isFinite(options.entryFee)) {
    updates.push({
      field: "entry_fee",
      value: Math.max(0, Math.floor(options.entryFee)),
    });
  }
  if (updates.length > 0) {
    const setClause = updates.map((item) => `${item.field} = ?`).join(", ");
    db.prepare(`UPDATE lobby SET ${setClause} WHERE id = ?`).run(
      ...updates.map((item) => item.value),
      options.lobbyId
    );
  }
  const row = fetchLobbyRowById(options.lobbyId);
  if (!row) {
    throw new Error("LOBBY_NOT_FOUND");
  }
  const players = getLobbyPlayers(options.lobbyId);
  return buildLobbyResponse(row, players);
}

export function setLobbyReady(options: {
  lobbyId: number;
  userId: number;
  ready: boolean;
}): LobbyResponse {
  const lobby = fetchLobbyRowById(options.lobbyId);
  if (!lobby) {
    throw new Error("LOBBY_NOT_FOUND");
  }
  if (lobby.status !== "started") {
    throw new Error("LOBBY_NOT_STARTED");
  }
  const userRow = db
    .prepare("SELECT lobby_id FROM users WHERE id = ?")
    .get(options.userId) as { lobby_id: number | null } | undefined;
  if (!userRow) {
    throw new Error("USER_NOT_FOUND");
  }
  if (userRow.lobby_id !== options.lobbyId) {
    throw new Error("USER_NOT_IN_LOBBY");
  }
  db.prepare("UPDATE users SET lobby_ready = ? WHERE id = ?").run(
    options.ready ? 1 : 0,
    options.userId
  );
  const players = getLobbyPlayers(options.lobbyId);
  return buildLobbyResponse(lobby, players);
}

export function resetLobbyReady(lobbyId: number): void {
  db.prepare("UPDATE users SET lobby_ready = 0 WHERE lobby_id = ?").run(lobbyId);
}

export function getLobbyLeaderboard(lobbyId: number): LeaderboardEntry[] {
  const rows = db
    .prepare(
      "SELECT id, name, tournament_score as score, currency FROM users WHERE lobby_id = ? ORDER BY tournament_score DESC, id ASC"
    )
    .all(lobbyId) as Array<{
      id: number;
      name: string;
      score: number;
      currency: number;
    }>;
  const passiveGoldMap = buildPassiveGoldMap(rows.map((row) => row.id));
  return rows.map((row, index) => ({
    id: row.id,
    name: row.name,
    score: Number(row.score) || 0,
    currency: Number(row.currency) || 0,
    position: index + 1,
    passiveGold: passiveGoldMap.get(row.id) ?? 0,
  }));
}

export function getTournamentPlayerAggregates(
  tournamentId: number,
  playerIds: number[]
): TournamentPlayerAggregate[] {
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return [];
  }

  const placeholders = buildInClausePlaceholders(playerIds.length);
  const rows = db
    .prepare(
      `SELECT mhp.player_id as playerId,
        COALESCE(SUM(mhp.kills), 0) as kills,
        COALESCE(SUM(mhp.deaths), 0) as deaths,
        COALESCE(SUM(mhp.assists), 0) as assists,
        COALESCE(SUM(mhp.score), 0) as score
      FROM match_history_players mhp
      JOIN match_history mh ON mhp.match_id = mh.id
      WHERE mh.is_tournament = 1
        AND mh.tournament_id = ?
        AND mhp.player_id IN (${placeholders})
      GROUP BY mhp.player_id`
    )
    .all(tournamentId, ...playerIds) as TournamentPlayerAggregate[];

  return rows.map((row) => ({
    playerId: Number(row.playerId),
    kills: Number(row.kills) || 0,
    deaths: Number(row.deaths) || 0,
    assists: Number(row.assists) || 0,
    score: Number(row.score) || 0,
  }));
}

export function startLobby(options: {
  lobbyId: number;
  userId: number;
}): LobbyResponse {
  const lobby = fetchLobbyRowById(options.lobbyId);
  if (!lobby) {
    throw new Error("LOBBY_NOT_FOUND");
  }
  if (lobby.host_id !== options.userId) {
    throw new Error("NOT_LOBBY_HOST");
  }
  if (lobby.status === "started") {
    const players = getLobbyPlayers(options.lobbyId);
    return buildLobbyResponse(lobby, players);
  }
  db.prepare("UPDATE lobby SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    "started",
    options.lobbyId
  );
  const updated = fetchLobbyRowById(options.lobbyId);
  if (!updated) {
    throw new Error("LOBBY_NOT_FOUND");
  }
  const players = getLobbyPlayers(options.lobbyId);
  return buildLobbyResponse(updated, players);
}

export function getRegions(): Region[] {
  const stmt = db.prepare("SELECT id, name FROM regions ORDER BY id");
  return stmt.all() as Region[];
}

export function getTeamsOverview(regionId?: number): TeamOverview[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (typeof regionId === "number" && Number.isInteger(regionId)) {
    clauses.push("r.id = ?");
    params.push(regionId);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `
      SELECT
        t.id,
        t.name,
        t.tournament_id as tournamentId,
        r.id as regionId,
        r.name as regionName,
        tr.name as tournamentName,
        (
          SELECT COUNT(*) FROM players p WHERE p.team_id = t.id
        ) as playerCount
      FROM teams t
      JOIN tournaments tr ON tr.id = t.tournament_id
      JOIN regions r ON r.id = tr.region_id
      ${where}
      ORDER BY t.name
    `
    )
    .all(...params) as Array<{
    id: number;
    name: string;
    tournamentId: number;
    regionId: number;
    regionName: string;
    tournamentName: string;
    playerCount: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    tournamentId: row.tournamentId,
    regionId: row.regionId,
    regionName: row.regionName,
    tournamentName: row.tournamentName,
    playerCount: Number(row.playerCount) || 0,
  }));
}

export function getPlayersOverview(
  filters: PlayerFilters = {}
): PlayerOverview[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.role) {
    clauses.push("p.role = ?");
    params.push(filters.role);
  }

  if (
    typeof filters.regionId === "number" &&
    Number.isInteger(filters.regionId)
  ) {
    clauses.push("p.region_id = ?");
    params.push(filters.regionId);
  }

  if (
    typeof filters.teamId === "number" &&
    Number.isInteger(filters.teamId)
  ) {
    clauses.push("p.team_id = ?");
    params.push(filters.teamId);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `
      SELECT
        p.id,
        p.name,
        p.nickname as nickname,
        p.role,
        p.kills,
        p.deaths,
        p.assists,
        p.cs,
        p.gold,
        p.score,
        p.region_id as region_id,
        p.team_id as team_id,
        t.name as teamName,
        r.name as regionName,
        tr.id as tournamentId,
        tr.name as tournamentName
      FROM players p
      JOIN teams t ON t.id = p.team_id
      JOIN tournaments tr ON tr.id = t.tournament_id
      JOIN regions r ON r.id = tr.region_id
      ${where}
    `
    )
    .all(...params) as PlayerOverviewRow[];

  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      nickname: row.nickname ?? null,
      role: row.role,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      cs: row.cs,
      gold: row.gold,
      score: row.score,
      region: {
        id: row.region_id,
        name: row.regionName,
      },
      team: {
        id: row.team_id,
        name: row.teamName,
        tournamentId: row.tournamentId,
        tournamentName: row.tournamentName,
      },
    }))
    .sort((a, b) => {
      if (a.team.id !== b.team.id) {
        return a.team.name.localeCompare(b.team.name);
      }
      const roleIndexA = ROLE_ORDER.indexOf(a.role);
      const roleIndexB = ROLE_ORDER.indexOf(b.role);
      const safeA = roleIndexA === -1 ? ROLE_ORDER.length : roleIndexA;
      const safeB = roleIndexB === -1 ? ROLE_ORDER.length : roleIndexB;
      return safeA - safeB;
    });
}

export function getPlayersGroupedByRole(
  filters: PlayerFilters = {}
): Record<Role, PlayerOverview[]> {
  const grouped: Record<Role, PlayerOverview[]> = {
    Top: [],
    Jgl: [],
    Mid: [],
    Adc: [],
    Supp: [],
  };

  const players = getPlayersOverview(filters);
  for (const player of players) {
    grouped[player.role].push(player);
  }

  return grouped;
}

export type MarketPlayerListing = PlayerOverview & {
  marketValue: number;
  recentPrices: number[];
  trendDelta: number;
};

type MarketPlayerRow = {
  id: number;
  name: string;
  nickname: string | null;
  role: Role;
  score: number;
};

function fetchMarketPlayerById(playerId: number): MarketPlayerRow | undefined {
  const row = db
    .prepare("SELECT id, name, nickname, role, score FROM players WHERE id = ?")
    .get(playerId) as MarketPlayerRow | undefined;
  return row;
}

function fetchMarketPlayerByName(name: string): MarketPlayerRow | undefined {
  const normalized = name.trim().toLowerCase();
  const row = db
    .prepare(
      `
      SELECT id, name, nickname, role, score
      FROM players
      WHERE LOWER(name) = ? OR LOWER(nickname) = ?
      LIMIT 1
    `
    )
    .get(normalized, normalized) as MarketPlayerRow | undefined;
  return row;
}

function fetchRecentPlayerScores(
  playerId: number,
  limit = MARKET_TREND_WINDOW
): number[] {
  const safeLimit = Math.min(10, Math.max(1, Math.floor(limit)));
  const rows = db
    .prepare(
      `
      SELECT mhp.score as score
      FROM match_history_players mhp
      JOIN match_history mh ON mh.id = mhp.match_id
      WHERE mhp.player_id = ?
      ORDER BY mh.created_at DESC, mhp.id DESC
      LIMIT ?
    `
    )
    .all(playerId, safeLimit) as Array<{ score: number }>;
  return rows.map((row) => Number(row.score) || 0);
}

function calculateMarketValueFromRecent(
  recentScores: number[],
  fallbackScore: number
): number {
  if (recentScores.length === 0) {
    return calculateMarketValueFromScore(fallbackScore);
  }
  const avg =
    recentScores.reduce((sum, value) => sum + value, 0) / recentScores.length;
  const target = calculateMarketValueFromScore(avg);
  if (recentScores.length < 2 || MARKET_PRICE_DELTA_CAP <= 0) {
    return target;
  }
  const previous = calculateMarketValueFromScore(recentScores[1]);
  const delta = clampNumber(
    target - previous,
    -MARKET_PRICE_DELTA_CAP,
    MARKET_PRICE_DELTA_CAP
  );
  return previous + delta;
}

function buildRecentPrices(
  recentScores: number[],
  fallbackScore: number
): number[] {
  if (recentScores.length === 0) {
    return [calculateMarketValueFromScore(fallbackScore)];
  }
  return recentScores.map((score) => calculateMarketValueFromScore(score));
}

function buildMarketTrend(recentPrices: number[]): number {
  if (recentPrices.length < 2) {
    return 0;
  }
  const newest = recentPrices[0] ?? 0;
  const oldest = recentPrices[recentPrices.length - 1] ?? 0;
  return Number((newest - oldest).toFixed(2));
}

function resolveMarketPriceForCard(card: Card): {
  playerId?: number;
  name: string;
  role: Role;
  score?: number;
  marketValue: number;
  source: "player" | "card";
} {
  const player =
    (typeof card.playerId === "number" ? fetchMarketPlayerById(card.playerId) : undefined) ??
    fetchMarketPlayerByName(card.name);

  if (!player) {
    return {
      playerId: card.playerId,
      name: card.name,
      role: card.role,
      marketValue: Math.max(0, Math.floor(card.value)),
      source: "card",
    };
  }

  const recentScores = fetchRecentPlayerScores(player.id);
  return {
    playerId: player.id,
    name: player.nickname ?? player.name,
    role: player.role,
    score: player.score,
    marketValue: calculateMarketValueFromRecent(recentScores, player.score),
    source: "player",
  };
}

export function getMarketPlayers(
  filters: PlayerFilters = {},
  trendLimit = MARKET_TREND_WINDOW
): MarketPlayerListing[] {
  const players = getPlayersOverview(filters);
  return players.map((player) => {
    const recentScores = fetchRecentPlayerScores(player.id, trendLimit);
    const recentPrices = buildRecentPrices(recentScores, player.score);
    return {
      ...player,
      marketValue: calculateMarketValueFromRecent(recentScores, player.score),
      recentPrices,
      trendDelta: buildMarketTrend(recentPrices),
    };
  });
}

function buildMarketCardFromPlayer(player: MarketPlayerRow): Card {
  const recentScores = fetchRecentPlayerScores(player.id);
  return {
    name: player.nickname ?? player.name,
    role: player.role,
    points: Math.max(20, Math.round(player.score)),
    value: calculateMarketValueFromRecent(recentScores, player.score),
    playerId: player.id,
  };
}

export type MarketSaleResult = {
  deck: Deck;
  summary: DeckSummary;
  currency: number;
  sold: {
    role: Role;
    playerId?: number;
    name: string;
    previousValue: number;
    marketValue: number;
    score?: number;
    source: "player" | "card";
  };
};

export type MarketPurchaseResult = {
  currency: number;
  purchased: {
    role: Role;
    playerId: number;
    name: string;
    marketValue: number;
    score: number;
  };
};

export type OwnedPlayer = PlayerOverview & {
  marketValue: number;
  recentPrices: number[];
  trendDelta: number;
  acquiredAt: string;
};

export function getUserCollection(
  userId: number,
  trendLimit = MARKET_TREND_WINDOW
): OwnedPlayer[] {
  const rows = db
    .prepare(
      `
      SELECT
        p.id,
        p.name,
        p.nickname as nickname,
        p.role,
        p.kills,
        p.deaths,
        p.assists,
        p.cs,
        p.gold,
        p.score,
        p.region_id as region_id,
        p.team_id as team_id,
        t.name as teamName,
        r.name as regionName,
        tr.id as tournamentId,
        tr.name as tournamentName,
        uc.acquired_at as acquiredAt
      FROM user_cards uc
      JOIN players p ON p.id = uc.player_id
      JOIN teams t ON t.id = p.team_id
      JOIN tournaments tr ON tr.id = t.tournament_id
      JOIN regions r ON r.id = tr.region_id
      WHERE uc.user_id = ?
      ORDER BY uc.acquired_at DESC
    `
    )
    .all(userId) as Array<PlayerOverviewRow & { acquiredAt: string }>;

  return rows.map((row) => {
    const recentScores = fetchRecentPlayerScores(row.id, trendLimit);
    const recentPrices = buildRecentPrices(recentScores, row.score);
    return {
      id: row.id,
      name: row.name,
      nickname: row.nickname ?? null,
      role: row.role,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      cs: row.cs,
      gold: row.gold,
      score: row.score,
      region: {
        id: row.region_id,
        name: row.regionName,
      },
      team: {
        id: row.team_id,
        name: row.teamName,
        tournamentId: row.tournamentId,
        tournamentName: row.tournamentName,
      },
      marketValue: calculateMarketValueFromRecent(recentScores, row.score),
      recentPrices,
      trendDelta: buildMarketTrend(recentPrices),
      acquiredAt: row.acquiredAt,
    };
  });
}

function isPlayerOwned(userId: number, playerId: number): boolean {
  const row = db
    .prepare(
      "SELECT 1 as hasCard FROM user_cards WHERE user_id = ? AND player_id = ?"
    )
    .get(userId, playerId) as { hasCard?: number } | undefined;
  return Boolean(row?.hasCard);
}

function addPlayerToCollection(userId: number, playerId: number): void {
  db.prepare(
    "INSERT INTO user_cards (user_id, player_id) VALUES (?, ?)"
  ).run(userId, playerId);
}

function removePlayerFromCollection(userId: number, playerId: number): void {
  db.prepare(
    "DELETE FROM user_cards WHERE user_id = ? AND player_id = ?"
  ).run(userId, playerId);
}

function ensureDeckCardsOwned(userId: number, deck: Deck): void {
  const owned = db
    .prepare("SELECT player_id FROM user_cards WHERE user_id = ?")
    .all(userId) as Array<{ player_id: number }>;
  const ownedIds = new Set(owned.map((row) => row.player_id));

  for (const role of REQUIRED_ROLES) {
    const card = deck.slots[role];
    if (!card) {
      continue;
    }
    if (typeof card.playerId === "number" && ownedIds.has(card.playerId)) {
      continue;
    }
    throw new DeckError(
      "CARD_NOT_OWNED",
      "Deck contains a player that is not owned.",
      { role, playerId: card.playerId, name: card.name }
    );
  }
}

export type TransferHistoryEntry = {
  id: number;
  action: "buy" | "sell";
  role: Role;
  playerId?: number | null;
  playerName: string;
  price: number;
  fee: number;
  tournamentId?: number | null;
  stage?: string | null;
  createdAt: string;
};

export type TransferState = {
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

function recordTransferHistory(options: {
  userId: number;
  action: "buy" | "sell";
  role: Role;
  playerId?: number;
  playerName: string;
  price: number;
  fee: number;
  tournament?: TournamentRow | null;
}): void {
  db.prepare(
    `
    INSERT INTO transfer_history (
      user_id,
      action,
      role,
      player_id,
      player_name,
      price,
      fee,
      tournament_id,
      stage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    options.userId,
    options.action,
    options.role,
    options.playerId ?? null,
    options.playerName,
    Math.max(0, Math.floor(options.price)),
    Math.max(0, Math.floor(options.fee)),
    options.tournament?.id ?? null,
    options.tournament?.stage ?? null
  );
}

export function getTransferHistory(
  userId: number,
  limit = 20
): TransferHistoryEntry[] {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const rows = db
    .prepare(
      `
      SELECT
        id,
        action,
        role,
        player_id as playerId,
        player_name as playerName,
        price,
        fee,
        tournament_id as tournamentId,
        stage,
        created_at as createdAt
      FROM transfer_history
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `
    )
    .all(userId, safeLimit) as Array<TransferHistoryEntry>;
  return rows.map((row) => ({
    ...row,
    action: row.action === "sell" ? "sell" : "buy",
  }));
}

export function getTransferState(userId: number): TransferState {
  const currency = getUserCurrency(userId);
  const tournament = getActiveTournamentForTransfers();
  if (!tournament) {
    return {
      tournamentId: null,
      stage: null,
      currency,
      windowOpen: true,
      windowLabel: "between-tournaments",
      transferLimit: null,
      transfersUsed: null,
      remainingTransfers: null,
      transferFeePerCard: 0,
    };
  }

  ensureUserTournamentBoosts(userId, tournament.id);
  const transferState = getUserTransferState(userId);
  const isNewTournament =
    transferState.transferTournamentId === null ||
    transferState.transferTournamentId !== tournament.id;
  const transfersUsed = isNewTournament ? 0 : transferState.transferCount;
  const remaining = Math.max(TRANSFER_LIMIT_PER_TOURNAMENT - transfersUsed, 0);
  const windowOpen = isTransferWindowOpen(tournament);
  return {
    tournamentId: tournament.id,
    stage: tournament.stage,
    currency,
    windowOpen,
    windowLabel: windowOpen ? "between-stages" : "locked",
    transferLimit: TRANSFER_LIMIT_PER_TOURNAMENT,
    transfersUsed,
    remainingTransfers: remaining,
    transferFeePerCard: TRANSFER_FEE_PER_CARD,
  };
}

export type BoostType = "DOUBLE_POINTS" | "HOT_STREAK";

function normalizeBoostType(raw: string): BoostType {
  if (raw === "DOUBLE_TOTAL") {
    return "HOT_STREAK";
  }
  if (raw === "HOT_STREAK") {
    return "HOT_STREAK";
  }
  return "DOUBLE_POINTS";
}

export type UserBoost = {
  id: number;
  userId: number;
  tournamentId?: number | null;
  boostType: BoostType;
  scope: "match" | "tournament";
  assignedPlayerId?: number | null;
  usesRemaining: number;
  createdAt: string;
};

function ensureUserTournamentBoosts(
  userId: number,
  tournamentId: number | null
): void {
  if (!tournamentId) {
    return;
  }

  const existing = db
    .prepare(
      `
      SELECT boost_type as boostType
      FROM user_boosts
      WHERE user_id = ? AND tournament_id = ? AND uses_remaining > 0
    `
    )
    .all(userId, tournamentId) as Array<{ boostType: string }>;
  const existingTypes = new Set(
    existing.map((row) => normalizeBoostType(row.boostType))
  );

  const missing: Array<{ boostType: BoostType; scope: "match" | "tournament" }> =
    [];
  if (!existingTypes.has("DOUBLE_POINTS")) {
    missing.push({ boostType: "DOUBLE_POINTS", scope: "match" });
  }
  if (!existingTypes.has("HOT_STREAK")) {
    missing.push({ boostType: "HOT_STREAK", scope: "tournament" });
  }

  if (missing.length === 0) {
    return;
  }

  const stmt = db.prepare(
    `
    INSERT INTO user_boosts (user_id, tournament_id, boost_type, scope, uses_remaining)
    VALUES (?, ?, ?, ?, 1)
  `
  );
  missing.forEach((entry) => {
    stmt.run(userId, tournamentId, entry.boostType, entry.scope);
  });
}

export function listBoosts(userId: number): UserBoost[] {
  const activeTournament = getActiveTournamentForTransfers();
  ensureUserTournamentBoosts(userId, activeTournament?.id ?? null);
  const rows = db
    .prepare(
      `
      SELECT
        id,
        user_id as userId,
        tournament_id as tournamentId,
        boost_type as boostType,
        scope,
        assigned_player_id as assignedPlayerId,
        uses_remaining as usesRemaining,
        created_at as createdAt
      FROM user_boosts
      WHERE user_id = ? AND uses_remaining > 0
      ORDER BY id DESC
    `
    )
    .all(userId) as Array<UserBoost & { boostType: string }>;
  const normalized = rows.map((row) => ({
    ...row,
    boostType: normalizeBoostType(row.boostType),
  })) as UserBoost[];
  const seen = new Set<string>();
  return normalized.filter((boost) => {
    const key = `${boost.boostType}:${boost.scope}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function assignBoostToPlayer(
  userId: number,
  boostType: BoostType,
  playerId: number,
  tournamentId: number | null
): UserBoost {
  if (!isPlayerOwned(userId, playerId)) {
    throw new DeckError(
      "CARD_NOT_OWNED",
      "Player is not owned.",
      { playerId }
    );
  }

  const row = db
    .prepare(
      `
      SELECT id, scope
      FROM user_boosts
      WHERE user_id = ?
        AND boost_type = ?
        AND uses_remaining > 0
        AND (tournament_id = ? OR tournament_id IS NULL)
      ORDER BY id DESC
      LIMIT 1
    `
    )
    .get(userId, boostType, tournamentId) as
    | { id: number; scope: "match" | "tournament" }
    | undefined;

  if (!row) {
    throw new DeckError("ROLE_NOT_FOUND", "Boost not available.");
  }

  db.prepare(
    "UPDATE user_boosts SET assigned_player_id = ? WHERE id = ?"
  ).run(playerId, row.id);

  return {
    id: row.id,
    userId,
    tournamentId,
    boostType,
    scope: row.scope,
    assignedPlayerId: playerId,
    usesRemaining: 1,
    createdAt: new Date().toISOString(),
  };
}

export function selectBoost(
  userId: number,
  boostType: BoostType,
  tournamentId?: number | null
): UserBoost {
  const active = db
    .prepare(
      `
      SELECT id, uses_remaining
      FROM user_boosts
      WHERE user_id = ?
        AND boost_type = ?
        AND uses_remaining > 0
      ORDER BY id DESC
      LIMIT 1
    `
    )
    .get(userId, boostType) as { id: number; uses_remaining: number } | undefined;

  if (active) {
    return {
      id: active.id,
      userId,
      tournamentId: tournamentId ?? null,
      boostType,
      scope: boostType === "HOT_STREAK" ? "tournament" : "match",
      assignedPlayerId: null,
      usesRemaining: active.uses_remaining ?? 1,
      createdAt: new Date().toISOString(),
    };
  }

  const scope = boostType === "HOT_STREAK" ? "tournament" : "match";
  const info = db
    .prepare(
      `
      INSERT INTO user_boosts (user_id, tournament_id, boost_type, scope, uses_remaining)
      VALUES (?, ?, ?, ?, 1)
    `
    )
    .run(userId, tournamentId ?? null, boostType, scope);

  return {
    id: Number(info.lastInsertRowid),
    userId,
    tournamentId: tournamentId ?? null,
    boostType,
    scope,
    assignedPlayerId: null,
    usesRemaining: 1,
    createdAt: new Date().toISOString(),
  };
}

export function consumeBoost(
  userId: number,
  scope: "match" | "tournament",
  tournamentId?: number | null
): UserBoost | null {
  const row = db
    .prepare(
      `
      SELECT id, boost_type as boostType, uses_remaining as usesRemaining, tournament_id as tournamentId, created_at as createdAt, scope, assigned_player_id as assignedPlayerId
      FROM user_boosts
      WHERE user_id = ?
        AND scope = ?
        AND uses_remaining > 0
        AND (tournament_id = ? OR tournament_id IS NULL)
      ORDER BY id DESC
      LIMIT 1
    `
    )
    .get(userId, scope, tournamentId ?? null) as UserBoost | undefined;

  if (!row) {
    return null;
  }

  db.prepare(
    "UPDATE user_boosts SET uses_remaining = uses_remaining - 1 WHERE id = ?"
  ).run(row.id);

  return row;
}

function consumeBoostById(boostId: number): void {
  db.prepare(
    "UPDATE user_boosts SET uses_remaining = uses_remaining - 1 WHERE id = ?"
  ).run(boostId);
}

function getAssignedBoost(
  userId: number,
  scope: "match" | "tournament",
  tournamentId?: number | null
): UserBoost | null {
  const row = db
    .prepare(
      `
      SELECT id, boost_type as boostType, uses_remaining as usesRemaining, tournament_id as tournamentId, created_at as createdAt, scope, assigned_player_id as assignedPlayerId
      FROM user_boosts
      WHERE user_id = ?
        AND scope = ?
        AND assigned_player_id IS NOT NULL
        AND uses_remaining > 0
        AND (tournament_id = ? OR tournament_id IS NULL)
      ORDER BY id DESC
      LIMIT 1
    `
    )
    .get(userId, scope, tournamentId ?? null) as UserBoost | undefined;
  return row ?? null;
}

function boostMultiplier(boostType: BoostType): number {
  switch (boostType) {
    case "HOT_STREAK":
      return 1.25;
    case "DOUBLE_POINTS":
    default:
      return 2;
  }
}

export type ActiveBoost = {
  id: number;
  boostType: BoostType;
  assignedPlayerId: number;
};

export function getBoostMapForUser(
  userId: number,
  scope: "match" | "tournament",
  tournamentId?: number | null
): { map: Map<number, number>; boost: ActiveBoost | null } {
  const boost = getAssignedBoost(userId, scope, tournamentId);
  if (!boost?.assignedPlayerId) {
    return { map: new Map(), boost: null };
  }
  const map = new Map<number, number>();
  map.set(boost.assignedPlayerId, boostMultiplier(boost.boostType));
  return {
    map,
    boost: {
      id: boost.id,
      boostType: boost.boostType,
      assignedPlayerId: boost.assignedPlayerId,
    },
  };
}

export function consumeBoostByIdIfApplied(
  boost: ActiveBoost | null,
  result: DeckScoreResult
): void {
  if (!boost) {
    return;
  }
  const applied = result.entries.some(
    (entry) => entry.playerId === boost.assignedPlayerId
  );
  if (applied) {
    consumeBoostById(boost.id);
  }
}

export function buyCardForDeck(
  userId: number,
  playerId: number
): MarketPurchaseResult {
  const player = fetchMarketPlayerById(playerId);
  if (!player) {
    throw new DeckError("ROLE_NOT_FOUND", "Player not found.");
  }

  const role = player.role;
  if (isPlayerOwned(userId, player.id)) {
    throw new DeckError(
      "ROLE_ALREADY_OCCUPIED",
      "Player already owned.",
      { playerId: player.id }
    );
  }

  const activeTournament = getActiveTournamentForTransfers();
  ensureUserTournamentBoosts(userId, activeTournament?.id ?? null);
  const transferCommit = prepareTransferCommit(
    userId,
    1,
    getUserCurrency(userId),
    activeTournament
  );

  const price = calculateMarketValueFromRecent(
    fetchRecentPlayerScores(player.id),
    player.score
  );
  const currency = getUserCurrency(userId);
  const totalCost = price + (transferCommit?.fee ?? 0);
  if (totalCost > currency) {
    throw new DeckError(
      "CURRENCY_LIMIT_EXCEEDED",
      "Not enough currency to buy this player.",
      {
        price,
        currency,
        transferFee: transferCommit?.fee ?? 0,
        overBudgetBy: totalCost - currency,
      }
    );
  }

  const nextCurrency = db.transaction(() => {
    const fee = commitTransfers(userId, transferCommit);
    addUserCurrency(userId, -(price + fee));
    addPlayerToCollection(userId, player.id);
    recordTransferHistory({
      userId,
      action: "buy",
      role,
      playerId: player.id,
      playerName: player.nickname ?? player.name,
      price,
      fee,
      tournament: activeTournament,
    });
    return getUserCurrency(userId);
  })();

  return {
    currency: nextCurrency,
    purchased: {
      role,
      playerId: player.id,
      name: player.nickname ?? player.name,
      marketValue: price,
      score: player.score,
    },
  };
}

export function sellCardFromDeck(
  userId: number,
  playerId: number
): MarketSaleResult {
  const player = fetchMarketPlayerById(playerId);
  if (!player) {
    throw new DeckError("ROLE_NOT_FOUND", "Player not found.");
  }

  if (!isPlayerOwned(userId, player.id)) {
    throw new DeckError(
      "CARD_NOT_OWNED",
      "Player is not owned.",
      { playerId: player.id }
    );
  }

  const ownedDeck = getDeck(userId);
  const updatedDeck = createDeck({ userId, slots: ownedDeck.slots });
  const slots = updatedDeck.slots;
  let removedCard: Card | null = null;
  for (const role of REQUIRED_ROLES) {
    const card = slots[role];
    if (card?.playerId === player.id) {
      removedCard = card;
      slots[role] = null;
    }
  }

  const price = resolveMarketPriceForCard({
    name: player.nickname ?? player.name,
    role: player.role,
    points: player.score,
    value: calculateMarketValueFromRecent(
      fetchRecentPlayerScores(player.id),
      player.score
    ),
    playerId: player.id,
  });
  const activeTournament = getActiveTournamentForTransfers();
  ensureUserTournamentBoosts(userId, activeTournament?.id ?? null);
  const transferCommit = prepareTransferCommit(
    userId,
    1,
    getUserCurrency(userId),
    activeTournament
  );

  const currency = db.transaction(() => {
    const fee = commitTransfers(userId, transferCommit);
    const nextCurrency = addUserCurrency(userId, price.marketValue - fee);
    removePlayerFromCollection(userId, player.id);
    persistDeck(userId, updatedDeck);
    recordTransferHistory({
      userId,
      action: "sell",
      role: player.role,
      playerId: player.id,
      playerName: price.name,
      price: price.marketValue,
      fee,
      tournament: activeTournament,
    });
    return nextCurrency;
  })();

  return {
    deck: updatedDeck,
    summary: summarizeDeck(updatedDeck),
    currency,
    sold: {
      role: player.role,
      playerId: price.playerId,
      name: price.name,
      previousValue: removedCard?.value ?? price.marketValue,
      marketValue: price.marketValue,
      score: price.score,
      source: price.source,
    },
  };
}

function cleanDB(){
  db.prepare("DELETE FROM players").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name='players';")
  
  db.prepare("DELETE FROM matches").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name='matches';")
  
  db.prepare("DELETE FROM regions").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name='regions';")
  
  db.prepare("DELETE FROM teams").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name='teams';")
  
  db.prepare("DELETE FROM tournaments").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name='tournaments';")
}

export function simulateData() {
  cleanDB();

  const regionArr = ["Korea", "North America", "Europe"];
  const regionStmt = db.prepare("INSERT INTO regions (name) VALUES (?)");
  const regionIds = [];
  for (const region of regionArr) {
    const info = regionStmt.run(region);
    regionIds.push(Number(info.lastInsertRowid));
  }
  const primaryRegionId = regionIds[0] ?? 1;

  const tournaments = ["LCK", "LCK Academy", "LCK Challenge League"];
  const tournamentStmt = db.prepare("INSERT INTO tournaments (name, region_id) VALUES (?, ?)");
  const tournamentIds = [];
  for(const tour of tournaments){
    const info = tournamentStmt.run(tour, primaryRegionId);
    tournamentIds.push(Number(info.lastInsertRowid));
  }
  const tournamentId = tournamentIds[0] ?? 1;
  
  const sampleTeams: string[] = sampleData.teams ?? [];
  const teamsStmt = db.prepare(
    "INSERT INTO teams (name, tournament_id) VALUES (?, ?)"
  );
  const insertedTeamIds: number[] = [];
  for (const team of sampleTeams) {
    const info = teamsStmt.run(team, tournamentId);
    insertedTeamIds.push(Number(info.lastInsertRowid));
  }

  const roles: Role[] = ["Top", "Jgl", "Mid", "Adc", "Supp"];
  const playerSeeds = sampleData.players ?? [];

  type PlayerSeed = {
    name?: string;
    nickname?: string;
    score?: number;
  };

  const ROLE_BASE_SCORES: Record<Role, number> = {
    Top: 95,
    Jgl: 98,
    Mid: 105,
    Adc: 103,
    Supp: 92,
  };

  const samplePlayers: Array<{
    name: string;
    nickname: string | null;
    role: Role;
    team_id: number;
    score: number;
  }> = [];

  if (insertedTeamIds.length === 0) {
    insertedTeamIds.push(1);
  }

  let seedIndex = 0;
  for (const teamId of insertedTeamIds) {
    for (const role of roles) {
      const seed: PlayerSeed | undefined = playerSeeds[seedIndex];
      const nickname = (seed?.nickname ?? "").trim();
      const realName = (seed?.name ?? "").trim();
      const displayName = nickname || realName || `Player ${seedIndex + 1}`;
      const storedName = realName || displayName;

      const seededScore = Math.max(
        60,
        Number.isFinite(seed?.score as number)
          ? Number(seed?.score)
          : ROLE_BASE_SCORES[role]
      );

      samplePlayers.push({
        name: storedName,
        nickname: nickname || null,
        role,
        team_id: teamId,
        score: seededScore,
      });

      seedIndex = (seedIndex + 1) % (playerSeeds.length || roles.length);
    }
  }

  const playerStmt = db.prepare(`
    INSERT INTO players (name, nickname, kills, deaths, assists, cs, region_id, role, gold, score, team_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const { name, nickname, role, team_id, score } of samplePlayers) {
    playerStmt.run(
      name,
      nickname ?? name,
      0,
      0,
      0,
      0,
      primaryRegionId,
      role,
      0,
      score,
      team_id
    );
  }

  try {
    ensureSampleUsersWithDecks();
  } catch (error) {
    console.warn("Failed to refresh debug users after simulateData()", error);
  }

}

function calculateScore(kills:number, deaths:number, assists:number, cs:number, gold:number):number{
  const score =
    (kills * 3) +
    (assists * 1.5) -
    (deaths * 2) +
    (cs / 10) +
    (gold / 1000);

  return Number(score.toFixed(2));
}

export function simulateMatch(
  players: Player[],
  regionName: string,
  options?: { userIds?: number[]; scoreMode?: "global" | "lobby" }
) {
  const playersByTeam = new Map<number, Player[]>();
  for (const player of players) {
    if (!player.team_id) continue;
    if (!playersByTeam.has(player.team_id)) {
      playersByTeam.set(player.team_id, []);
    }
    playersByTeam.get(player.team_id)!.push(player);
  }

  const teamEntries = Array.from(playersByTeam.entries()).filter(
    ([, roster]) => roster.length > 0
  );

  const randomTeamIds: number[] = [];
  const taken = new Set<number>();
  while (randomTeamIds.length < 2 && teamEntries.length > 0) {
    const index = Math.floor(Math.random() * teamEntries.length);
    const entry = teamEntries.splice(index, 1)[0];
    if (!entry) {
      continue;
    }
    const [teamId] = entry;
    if (!taken.has(teamId)) {
      randomTeamIds.push(teamId);
      taken.add(teamId);
    }
  }

  let activeTeamNames: string[] = randomTeamIds
    .map((teamId) => getTeamNameById(teamId) ?? `Team ${teamId}`)
    .filter((name) => name);

  let activePlayers: Player[] = randomTeamIds.flatMap(
    (teamId) => playersByTeam.get(teamId) ?? []
  );

  if (activePlayers.length === 0 || randomTeamIds.length < 2) {
    let teams = [...sampleData.teams];
    while (teams.length > 2) {
      const randomIndex = Math.floor(Math.random() * teams.length);
      teams.splice(randomIndex, 1);
    }
    activeTeamNames = teams;
    activePlayers = [...players];
  }

  const teamsForMatch =
    activeTeamNames.length >= 2
      ? activeTeamNames.slice(0, 2)
      : [...sampleData.teams.slice(0, 2)];

  const teamNameCache = new Map<number, string | null>();
  const resolveTeamNameByIdCached = (teamId: number): string | null => {
    if (!teamNameCache.has(teamId)) {
      teamNameCache.set(teamId, getTeamNameById(teamId));
    }
    return teamNameCache.get(teamId) ?? null;
  };

  const assignmentById = new Map<
    number,
    { name: string; side: "A" | "B" }
  >();
  const assignmentByName = new Map<
    string,
    { name: string; side: "A" | "B" }
  >();

  const sideAssignments = teamsForMatch.slice(0, 2).map((name, index) => ({
    name,
    side: index === 0 ? ("A" as const) : ("B" as const),
  }));

  sideAssignments.forEach((assignment, index) => {
    assignmentByName.set(assignment.name.toLowerCase(), assignment);
    const teamId = randomTeamIds[index];
    if (typeof teamId === "number") {
      assignmentById.set(teamId, assignment);
    }
  });

  const resolveTeamAssignment = (
    playerTeamId?: number | null
  ): { name: string | null; side: "A" | "B" | null } => {
    if (typeof playerTeamId === "number") {
      const mapped = assignmentById.get(playerTeamId);
      if (mapped) {
        return { name: mapped.name, side: mapped.side };
      }
      const cachedName = resolveTeamNameByIdCached(playerTeamId);
      if (cachedName) {
        const mappedByName =
          assignmentByName.get(cachedName.toLowerCase()) ?? null;
        return {
          name: cachedName,
          side: mappedByName?.side ?? null,
        };
      }
    }
    return { name: null, side: null };
  };

  const winningIndex = Math.floor(Math.random() * teamsForMatch.length);
  const winningTeam =
    teamsForMatch[winningIndex] ?? teamsForMatch[0] ?? "Unknown";
  const winningTeamId = randomTeamIds[winningIndex] ?? randomTeamIds[0];
  const winningSide = sideAssignments[winningIndex]?.side ?? "A";
  const losingSide = winningSide === "A" ? ("B" as const) : ("A" as const);

  let MVP = { name: "", score: 0 };
  const matchPlayers: Player[] = [];
  const playerStatsForHistory: MatchPlayerStat[] = [];
  const matchDurationMinutes = 20 + Math.random() * 20;
  const passiveGoldPerPlayer = Math.round(
    ((matchDurationMinutes * 60) / 5) * 5
  );
  const towerTakedowns = Math.floor(Math.random() * 5);
  const dragonTakedowns = Math.floor(Math.random() * 4);
  const baronTakedowns = Math.random() < 0.4 ? 1 : 0;
  const sharedObjectiveGold = Math.round(
    (towerTakedowns * 250 + dragonTakedowns * 25 + baronTakedowns * 300) / 5
  );
  const averageMinionGold = Math.min(35, 18 + matchDurationMinutes * 0.6);

  const roleProfiles: Record<
    Role,
    {
      cs: [number, number];
      kills: [number, number];
      deaths: [number, number];
      assists: [number, number];
    }
  > = {
    Top: { cs: [90, 280], kills: [1, 9], deaths: [0, 7], assists: [2, 14] },
    Jgl: { cs: [70, 240], kills: [2, 11], deaths: [1, 6], assists: [4, 18] },
    Mid: { cs: [100, 320], kills: [3, 13], deaths: [1, 8], assists: [3, 16] },
    Adc: { cs: [120, 360], kills: [3, 15], deaths: [0, 7], assists: [3, 14] },
    Supp: { cs: [20, 120], kills: [0, 5], deaths: [1, 8], assists: [6, 24] },
  };
  const randomInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;
  const playerTeamInfo = new Map<
    number,
    { name: string | null; side: "A" | "B" | null }
  >();
  const sidePlayers: Record<"A" | "B", Player[]> = { A: [], B: [] };

  activePlayers.forEach((player) => {
    const info = resolveTeamAssignment(player.team_id ?? null);
    playerTeamInfo.set(player.id, info);
    if (info.side === "A" || info.side === "B") {
      sidePlayers[info.side].push(player);
    }
  });

  if (sidePlayers.A.length === 0 || sidePlayers.B.length === 0) {
    const midpoint = Math.max(1, Math.ceil(activePlayers.length / 2));
    const fallbackA = activePlayers.slice(0, midpoint);
    const fallbackB = activePlayers.slice(midpoint);
    if (fallbackB.length === 0 && fallbackA.length > 1) {
      fallbackB.push(fallbackA.pop()!);
    } else if (fallbackB.length === 0) {
      fallbackB.push(...fallbackA);
    }
    sidePlayers.A = fallbackA;
    sidePlayers.B = fallbackB;
    sidePlayers.A.forEach((player) => {
      const existing = playerTeamInfo.get(player.id) ?? { name: null, side: null };
      if (!existing.side) {
        playerTeamInfo.set(player.id, { ...existing, side: "A" });
      }
    });
    sidePlayers.B.forEach((player) => {
      const existing = playerTeamInfo.get(player.id) ?? { name: null, side: null };
      if (!existing.side) {
        playerTeamInfo.set(player.id, { ...existing, side: "B" });
      }
    });
  }

  const distributeObjective = (total: number, baseBias: number) => {
    if (total <= 0) {
      return { A: 0, B: 0 };
    }
    const dynamicBias = Math.min(
      0.9,
      Math.max(0.5, baseBias + (Math.random() - 0.5) * 0.2)
    );
    let winnerShare = Math.round(total * dynamicBias);
    if (winnerShare <= 0 && total > 0) {
      winnerShare = 1;
    }
    if (winnerShare > total) {
      winnerShare = total;
    }
    const loserShare = Math.max(0, total - winnerShare);
    return winningSide === "A"
      ? { A: winnerShare, B: loserShare }
      : { A: loserShare, B: winnerShare };
  };

  const towerSplit = distributeObjective(towerTakedowns, 0.7);
  const dragonSplit = distributeObjective(dragonTakedowns, 0.65);
  const baronSplit = distributeObjective(baronTakedowns, 0.8);

  const objectivesBySide: ObjectivesBySide = {
    A: {
      towers: towerSplit.A,
      dragons: dragonSplit.A,
      barons: baronSplit.A,
    },
    B: {
      towers: towerSplit.B,
      dragons: dragonSplit.B,
      barons: baronSplit.B,
    },
  };

  const killWeights: Record<Role, number> = {
    Top: 1.05,
    Jgl: 1.15,
    Mid: 1.35,
    Adc: 1.5,
    Supp: 0.6,
  };
  const deathWeights: Record<Role, number> = {
    Top: 1.0,
    Jgl: 1.05,
    Mid: 0.9,
    Adc: 1.2,
    Supp: 1.4,
  };

  const allocateStat = (
    roster: Player[],
    total: number,
    weightResolver: (player: Player) => number
  ) => {
    const allocations = new Map<number, number>();
    if (roster.length === 0 || total <= 0) {
      return allocations;
    }
    const weighted = roster.map((player) => {
      const weight = Math.max(0.1, weightResolver(player));
      return { player, weight };
    });
    const weightSum = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let assigned = 0;
    const fractional: {
      player: Player;
      fraction: number;
    }[] = [];
    weighted.forEach((entry) => {
      const raw = (entry.weight / weightSum) * total;
      const base = Math.floor(raw);
      allocations.set(entry.player.id, base);
      assigned += base;
      fractional.push({ player: entry.player, fraction: raw - base });
    });
    let remaining = total - assigned;
    fractional
      .sort((a, b) => b.fraction - a.fraction)
      .forEach((entry) => {
        if (remaining <= 0) return;
        allocations.set(entry.player.id, (allocations.get(entry.player.id) ?? 0) + 1);
        remaining--;
      });
    let index = 0;
    while (remaining > 0 && roster.length > 0) {
      const target = roster[index % roster.length];
      allocations.set(target.id, (allocations.get(target.id) ?? 0) + 1);
      remaining--;
      index++;
    }
    return allocations;
  };

  const baseKillRate = 0.8 + Math.random() * 0.9;
  const totalKills = Math.max(
    10,
    Math.round(matchDurationMinutes * baseKillRate + randomInt(0, 6))
  );
  const winnerKillShare = 0.55 + Math.random() * 0.25;
  let winnerKills = Math.max(5, Math.round(totalKills * winnerKillShare));
  let loserKills = Math.max(1, totalKills - winnerKills);
  if (loserKills < 0) {
    loserKills = 0;
    winnerKills = totalKills;
  }
  const sideKillTargets: Record<"A" | "B", number> = {
    [winningSide]: winnerKills,
    [losingSide]: loserKills,
  };
  const sideDeathTargets: Record<"A" | "B", number> = {
    A: sideKillTargets.B,
    B: sideKillTargets.A,
  };

  const killAllocations = new Map<number, number>();
  const deathAllocations = new Map<number, number>();
  (["A", "B"] as const).forEach((side) => {
    const killMap = allocateStat(
      sidePlayers[side],
      sideKillTargets[side] ?? 0,
      (player) => killWeights[player.role as Role] ?? 1
    );
    killMap.forEach((value, playerId) => killAllocations.set(playerId, value));
    const deathMap = allocateStat(
      sidePlayers[side],
      sideDeathTargets[side] ?? 0,
      (player) => deathWeights[player.role as Role] ?? 1
    );
    deathMap.forEach((value, playerId) => deathAllocations.set(playerId, value));
  });

  for (const player of activePlayers) {
    const roleKey = player.role as Role;
    const profile = roleProfiles[roleKey] ?? roleProfiles.Top;
    const deltaKills =
      killAllocations.get(player.id) ??
      randomInt(profile.kills[0], profile.kills[1]);
    const deltaDeaths =
      deathAllocations.get(player.id) ??
      randomInt(profile.deaths[0], profile.deaths[1]);
    const assistBase = randomInt(profile.assists[0], profile.assists[1]);
    const deltaAssists = Math.min(
      profile.assists[1],
      Math.max(assistBase, deltaKills + randomInt(0, 4))
    );
    const csScale = 0.6 + Math.min(1.2, matchDurationMinutes / 30);
    const csMin = Math.max(0, Math.round(profile.cs[0] * csScale * 0.6));
    const csMax = Math.max(csMin + 10, Math.round(profile.cs[1] * csScale));
    const deltaCs = randomInt(csMin, csMax);

    let killGold = 0;
    for (let k = 0; k < deltaKills; k++) {
      killGold += 300 + Math.max(0, k - 2) * 40;
    }
    const assistGold = deltaAssists * 150;
    const csGold = Math.round(deltaCs * averageMinionGold);
    const deathPenalty = deltaDeaths * 35;
    const deltaGold = Math.max(
      50,
      Math.round(
        passiveGoldPerPlayer +
          sharedObjectiveGold +
          killGold +
          assistGold +
          csGold -
          deathPenalty +
          randomInt(-150, 150)
      )
    );

    player.kills += deltaKills;
    player.deaths += deltaDeaths;
    player.assists += deltaAssists;
    player.cs += deltaCs;
    player.gold += deltaGold;

    const deltaScore = calculateScore(
      deltaKills,
      deltaDeaths,
      deltaAssists,
      deltaCs,
      deltaGold
    );
    player.score = applyScoreDecay(player.score, deltaScore);
    if (deltaScore > MVP.score) {
      MVP.name = player.nickname ?? player.name;
      MVP.score = deltaScore;
    }

    const teamInfo =
      playerTeamInfo.get(player.id) ?? resolveTeamAssignment(player.team_id ?? null);

    matchPlayers.push({
      ...player,
      kills: deltaKills,
      deaths: deltaDeaths,
      assists: deltaAssists,
      cs: deltaCs,
      gold: deltaGold,
    });

    playerStatsForHistory.push({
      playerId: player.id,
      name: player.name,
      nickname: player.nickname ?? null,
      role: player.role,
      kills: deltaKills,
      deaths: deltaDeaths,
      assists: deltaAssists,
      cs: deltaCs,
      gold: deltaGold,
      score: deltaScore,
      teamId: player.team_id ?? null,
      teamName: teamInfo.name,
      teamSide: teamInfo.side,
    });

    db.prepare(
      "UPDATE players SET kills = ?, deaths = ?, assists = ?, cs = ?, gold = ?, score = ? WHERE id = ?"
    ).run(
      player.kills,
      player.deaths,
      player.assists,
      player.cs,
      player.gold,
      player.score,
      player.id
    );
  }

  const returnData = {
    region: regionName,
    teams: teamsForMatch,
    teamIds: randomTeamIds,
    winningTeam: winningTeam,
    winningTeamId,
    MVP: MVP,
    playerStats: playerStatsForHistory,
    objectivesBySide,
  };

  try {
    applyMatchResultsToDecks(matchPlayers, options);
  } catch (error) {
    console.warn("Failed to update deck scores after match", error);
  }

  return returnData;
}

const GROUP_NAMES = ["Group A", "Group B", "Group C", "Group D"];
const BRACKET_BEST_OF = 5;

type SimpleTeam = {
  id: number;
  name: string;
};

function shuffleArray<T>(items: T[]): T[] {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = clone[i]!;
    clone[i] = clone[j]!;
    clone[j] = temp;
  }
  return clone;
}

function fetchRegionRecord(regionId: number): Region | undefined {
  const row = db
    .prepare("SELECT id, name FROM regions WHERE id = ?")
    .get(regionId) as Region | undefined;
  return row;
}

function fetchTeamsForRegion(regionId: number): SimpleTeam[] {
  const rows = db
    .prepare(
      `
      SELECT tm.id, tm.name
      FROM teams tm
      JOIN tournaments tr ON tr.id = tm.tournament_id
      WHERE tr.region_id = ?
      ORDER BY tm.name
    `
    )
    .all(regionId) as SimpleTeam[];
  return rows;
}

function fetchTournamentRow(
  regionId: number,
  predicate: string,
  params: unknown[] = []
): TournamentRow | undefined {
  const row = db
    .prepare(
      `
      SELECT
        id,
        name,
        region_id,
        type,
        status,
        stage,
        is_active,
        current_round,
        started_at,
        completed_at,
        rewards_applied
      FROM tournaments
      WHERE region_id = ?
        AND type = 'worlds'
        ${predicate}
      ORDER BY COALESCE(started_at, completed_at, CURRENT_TIMESTAMP) DESC, id DESC
      LIMIT 1
    `
    )
    .get(regionId, ...params) as TournamentRow | undefined;
  return row;
}

function getActiveTournamentRow(regionId: number): TournamentRow | undefined {
  return fetchTournamentRow(
    regionId,
    "AND is_active = 1 AND stage <> 'completed'"
  );
}

function getLatestTournamentRow(regionId: number): TournamentRow | undefined {
  return fetchTournamentRow(regionId, "", []);
}

type GroupAssignment = {
  id: number;
  name: string;
  teams: SimpleTeam[];
};

function createTournamentGroups(
  tournament: TournamentRow,
  teams: SimpleTeam[]
): GroupAssignment[] {
  const insertGroupStmt = db.prepare(
    `
    INSERT INTO tournament_groups (tournament_id, region_id, name)
    VALUES (?, ?, ?)
  `
  );
  const insertMemberStmt = db.prepare(
    `
    INSERT INTO tournament_group_teams (group_id, team_id, seed)
    VALUES (?, ?, ?)
  `
  );

  const groups: GroupAssignment[] = [];
  for (const name of GROUP_NAMES) {
    const info = insertGroupStmt.run(tournament.id, tournament.region_id, name);
    groups.push({
      id: Number(info.lastInsertRowid),
      name,
      teams: [],
    });
  }

  const shuffled = shuffleArray(teams);
  if (groups.length === 0) {
    return [];
  }
  shuffled.forEach((team, index) => {
    const group = groups[index % groups.length];
    if (!group) {
      return;
    }
    group.teams.push(team);
    insertMemberStmt.run(group.id, team.id, group.teams.length);
  });

  return groups;
}

function scheduleGroupMatches(
  tournament: TournamentRow,
  groups: GroupAssignment[]
): void {
  const insertMatchStmt = db.prepare(
    `
    INSERT INTO tournament_matches (
      tournament_id,
      region_id,
      stage,
      round_name,
      round_number,
      match_number,
      group_id,
      best_of,
      team1_id,
      team2_id
    )
    VALUES (?, ?, 'group', ?, ?, ?, ?, 1, ?, ?)
  `
  );

  const maxMatchRow = db
    .prepare(
      "SELECT MAX(match_number) as maxMatch FROM tournament_matches WHERE tournament_id = ?"
    )
    .get(tournament.id) as { maxMatch?: number } | undefined;
  let matchNumber = Number(maxMatchRow?.maxMatch ?? 0) + 1;

  for (const group of groups) {
    const teamIds: number[] = group.teams.map((team) => team.id);
    if (teamIds.length < 2) {
      continue;
    }

    const pairings: Array<[number, number]> = [];
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        const firstId = teamIds[i];
        const secondId = teamIds[j];
        if (
          typeof firstId !== "number" ||
          typeof secondId !== "number"
        ) {
          continue;
        }
        pairings.push([firstId, secondId]);
      }
    }

    const matchesPerRound = Math.max(1, Math.floor(teamIds.length / 2));
    pairings.forEach((pair, index) => {
      const roundNumber = Math.floor(index / matchesPerRound) + 1;
      const roundName = `${group.name} - Round ${roundNumber}`;
      insertMatchStmt.run(
        tournament.id,
        tournament.region_id,
        roundName,
        roundNumber,
        matchNumber++,
        group.id,
        pair[0],
        pair[1]
      );
    });
  }
}

type MatchRowWithNames = TournamentMatchRow & {
  team1_name: string | null;
  team2_name: string | null;
};

function fetchTournamentMatchRows(
  tournamentId: number
): MatchRowWithNames[] {
  const rows = db
    .prepare(
      `
      SELECT
        tm.id,
        tm.tournament_id,
        tm.region_id,
        tm.stage,
        tm.round_name,
        tm.round_number,
        tm.match_number,
        tm.best_of,
        tm.group_id,
        tm.team1_id,
        tm.team2_id,
        tm.team1_score,
        tm.team2_score,
        tm.winner_team_id,
        tm.status,
        t1.name AS team1_name,
        t2.name AS team2_name
      FROM tournament_matches tm
      LEFT JOIN teams t1 ON t1.id = tm.team1_id
      LEFT JOIN teams t2 ON t2.id = tm.team2_id
      WHERE tm.tournament_id = ?
      ORDER BY CASE tm.stage WHEN 'group' THEN 0 ELSE 1 END, tm.round_number, tm.match_number
    `
    )
    .all(tournamentId) as MatchRowWithNames[];
  return rows;
}

function matchRowToSummary(
  row: MatchRowWithNames,
  games?: MatchHistoryEntry[]
): TournamentMatchSummary {
  const resolvedTeamAName =
    row.team1_name ??
    (typeof row.team1_id === "number" ? getTeamNameById(row.team1_id) : null);
  const resolvedTeamBName =
    row.team2_name ??
    (typeof row.team2_id === "number" ? getTeamNameById(row.team2_id) : null);

  const hasTeamA =
    row.team1_id !== null &&
    row.team1_id !== undefined &&
    row.team1_id >= 0
      ? true
      : Boolean(resolvedTeamAName);
  const hasTeamB =
    row.team2_id !== null &&
    row.team2_id !== undefined &&
    row.team2_id >= 0
      ? true
      : Boolean(resolvedTeamBName);

  const teamA: TournamentMatchTeam | null = hasTeamA
    ? {
        id: row.team1_id ?? null,
        name: resolvedTeamAName ?? null,
        score: Number(row.team1_score) || 0,
      }
    : null;
  const teamB: TournamentMatchTeam | null = hasTeamB
    ? {
        id: row.team2_id ?? null,
        name: resolvedTeamBName ?? null,
        score: Number(row.team2_score) || 0,
      }
    : null;

  const summary: TournamentMatchSummary = {
    id: row.id,
    stage: row.stage,
    roundName: row.round_name,
    roundNumber: row.round_number,
    matchNumber: row.match_number,
    bestOf: row.best_of,
    status: row.status,
    teamA,
    teamB,
    winnerTeamId: row.winner_team_id ?? null,
    seriesScore: `${teamA?.score ?? 0}-${teamB?.score ?? 0}`,
  };

  if (games) {
    summary.games = games;
  }

  return summary;
}

function fetchGroupSummaries(
  tournamentId: number
): TournamentGroupSummary[] {
  const rows = db
    .prepare(
      `
      SELECT
        g.id as group_id,
        g.name as group_name,
        tgt.team_id,
        t.name as team_name,
        tgt.wins,
        tgt.losses,
        tgt.games_played,
        tgt.seed
      FROM tournament_groups g
      LEFT JOIN tournament_group_teams tgt ON tgt.group_id = g.id
      LEFT JOIN teams t ON t.id = tgt.team_id
      WHERE g.tournament_id = ?
      ORDER BY g.name, tgt.wins DESC, tgt.losses ASC, tgt.games_played DESC, t.name
    `
    )
    .all(tournamentId) as Array<{
    group_id: number;
    group_name: string;
    team_id: number | null;
    team_name: string | null;
    wins: number | null;
    losses: number | null;
    games_played: number | null;
    seed: number | null;
  }>;

  const matchRows = fetchTournamentMatchRows(tournamentId);
  const matchesByGroup = new Map<number, TournamentMatchSummary[]>();
  for (const row of matchRows.filter((match) => match.stage === "group")) {
    const summary = matchRowToSummary(row);
    const groupId = row.group_id;
    if (!groupId) continue;
    if (!matchesByGroup.has(groupId)) {
      matchesByGroup.set(groupId, []);
    }
    matchesByGroup.get(groupId)!.push(summary);
  }

  const summaries = new Map<number, TournamentGroupSummary>();
  for (const row of rows) {
    if (!summaries.has(row.group_id)) {
      summaries.set(row.group_id, {
        id: row.group_id,
        name: row.group_name,
        teams: [],
        matches: matchesByGroup.get(row.group_id) ?? [],
      });
    }
    if (row.team_id) {
      summaries.get(row.group_id)!.teams.push({
        teamId: row.team_id,
        teamName: row.team_name ?? "TBD",
        wins: Number(row.wins) || 0,
        losses: Number(row.losses) || 0,
        gamesPlayed: Number(row.games_played) || 0,
        seed: row.seed ?? null,
      });
    }
  }

  return Array.from(summaries.values());
}

function fetchBracketRounds(tournamentId: number): TournamentBracketRound[] {
  const matchRows = fetchTournamentMatchRows(tournamentId).filter(
    (match) => match.stage === "bracket"
  );
  const roundOrder = new Map<string, number>();
  for (const row of matchRows) {
    if (!roundOrder.has(row.round_name)) {
      roundOrder.set(row.round_name, row.round_number);
    }
  }
  const rounds = new Map<string, TournamentBracketRound>();
  for (const row of matchRows) {
    const key = `${row.round_number}:${row.round_name}`;
    if (!rounds.has(key)) {
      rounds.set(key, {
        name: row.round_name,
        matches: [],
      });
    }
    rounds.get(key)!.matches.push(matchRowToSummary(row));
  }
  return Array.from(rounds.values()).sort((a, b) => {
    const aIdx = roundOrder.get(a.name) ?? 0;
    const bIdx = roundOrder.get(b.name) ?? 0;
    return aIdx - bIdx;
  });
}

function findNextMatchSummary(
  tournamentId: number
): TournamentMatchSummary | null {
  const row = db
    .prepare(
      `
      SELECT
        tm.id,
        tm.tournament_id,
        tm.region_id,
        tm.stage,
        tm.round_name,
        tm.round_number,
        tm.match_number,
        tm.best_of,
        tm.group_id,
        tm.team1_id,
        tm.team2_id,
        tm.team1_score,
        tm.team2_score,
        tm.winner_team_id,
        tm.status,
        t1.name as team1_name,
        t2.name as team2_name
      FROM tournament_matches tm
      LEFT JOIN teams t1 ON t1.id = tm.team1_id
      LEFT JOIN teams t2 ON t2.id = tm.team2_id
      WHERE tm.tournament_id = ?
        AND tm.team1_id IS NOT NULL
        AND tm.team2_id IS NOT NULL
        AND tm.status <> 'completed'
      ORDER BY CASE tm.stage WHEN 'group' THEN 0 ELSE 1 END, tm.round_number, tm.match_number
      LIMIT 1
    `
    )
    .get(tournamentId) as MatchRowWithNames | undefined;
  return row ? matchRowToSummary(row) : null;
}

export function getTournamentState(
  regionId: number
): TournamentControlState {
  const tournament = getLatestTournamentRow(regionId);
  const region = fetchRegionRecord(regionId) ?? {
    id: regionId,
    name: fetchRegionNameById(regionId),
  };

  if (!tournament) {
    return {
      tournament: null,
      groups: [],
      bracket: { rounds: [] },
    };
  }

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      region,
      status: tournament.status,
      stage: tournament.stage,
      isActive: Boolean(tournament.is_active),
      startedAt: tournament.started_at,
      completedAt: tournament.completed_at,
      nextMatch: findNextMatchSummary(tournament.id),
    },
    groups: fetchGroupSummaries(tournament.id),
    bracket: {
      rounds: fetchBracketRounds(tournament.id),
    },
  };
}

export function startTournamentForRegion(
  regionId: number,
  options: { name?: string; force?: boolean } = {}
): TournamentControlState {
  const region = fetchRegionRecord(regionId);
  if (!region) {
    throw new Error("REGION_NOT_FOUND");
  }

  const allTeams = fetchTeamsForRegion(regionId);
  if (allTeams.length < 2) {
    throw new Error("NOT_ENOUGH_TEAMS");
  }

  const teams = allTeams.slice(0, 16);
  const active = getActiveTournamentRow(regionId);
  const force = options.force === true;

  const tournamentId = db.transaction(() => {
    if (active) {
      if (!force) {
        throw new Error("TOURNAMENT_ALREADY_ACTIVE");
      }
      db.prepare(
        "UPDATE tournaments SET status = 'cancelled', stage = 'completed', is_active = 0, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(active.id);
    }

    const fallbackName = `${region.name} Worlds ${new Date().getFullYear()}`;
    const name =
      typeof options.name === "string" && options.name.trim().length > 0
        ? options.name.trim()
        : fallbackName;

    const insertInfo = db
      .prepare(
        `
        INSERT INTO tournaments (name, region_id, type, status, stage, is_active, current_round, started_at)
        VALUES (?, ?, 'worlds', 'running', 'groups', 1, 1, CURRENT_TIMESTAMP)
      `
      )
      .run(name, regionId);

    db.prepare("UPDATE users SET tournament_score = 0").run();

    const newTournament: TournamentRow = {
      id: Number(insertInfo.lastInsertRowid),
      name,
      region_id: regionId,
      type: "worlds",
      status: "running",
      stage: "groups",
      is_active: 1,
      current_round: 1,
      started_at: new Date().toISOString(),
      completed_at: null,
      rewards_applied: 0,
    };

    const groups = createTournamentGroups(newTournament, teams);
    scheduleGroupMatches(newTournament, groups);
    return newTournament.id;
  })();

  return getTournamentState(regionId);
}

function updateGroupStandingsAfterMatch(
  matchRow: MatchRowWithNames,
  winnerTeamId?: number | null
): void {
  if (
    !matchRow.group_id ||
    !matchRow.team1_id ||
    !matchRow.team2_id ||
    !winnerTeamId
  ) {
    return;
  }

  const loserTeamId =
    winnerTeamId === matchRow.team1_id
      ? matchRow.team2_id
      : matchRow.team1_id;

  const updateStmt = db.prepare(
    `
    UPDATE tournament_group_teams
    SET wins = wins + ?, losses = losses + ?, games_played = games_played + 1
    WHERE group_id = ? AND team_id = ?
  `
  );

  updateStmt.run(1, 0, matchRow.group_id, winnerTeamId);
  updateStmt.run(0, 1, matchRow.group_id, loserTeamId);
}

function propagateWinnerToNextRounds(
  matchId: number,
  winnerTeamId?: number | null
): void {
  if (!winnerTeamId) {
    return;
  }

  const dependents = db
    .prepare(
      `
      SELECT id, source_match1_id, source_match2_id
      FROM tournament_matches
      WHERE source_match1_id = ? OR source_match2_id = ?
    `
    )
    .all(matchId, matchId) as Array<{
    id: number;
    source_match1_id: number | null;
    source_match2_id: number | null;
  }>;

  for (const dependent of dependents) {
    const column =
      dependent.source_match1_id === matchId ? "team1_id" : "team2_id";
    db.prepare(
      `UPDATE tournament_matches SET ${column} = ? WHERE id = ?`
    ).run(winnerTeamId, dependent.id);
  }
}

function ensureBracketMatches(tournament: TournamentRow): void {
  const existing = db
    .prepare(
      "SELECT COUNT(*) as total FROM tournament_matches WHERE tournament_id = ? AND stage = 'bracket'"
    )
    .get(tournament.id) as { total: number } | undefined;
  if (Number(existing?.total ?? 0) > 0) {
    return;
  }

  const standings = db
    .prepare(
      `
      SELECT
        g.name as group_name,
        tgt.team_id,
        t.name as team_name,
        tgt.wins,
        tgt.losses,
        tgt.games_played,
        tgt.seed
      FROM tournament_group_teams tgt
      JOIN tournament_groups g ON g.id = tgt.group_id
      JOIN teams t ON t.id = tgt.team_id
      WHERE g.tournament_id = ?
      ORDER BY g.name, tgt.wins DESC, tgt.losses ASC, tgt.games_played DESC, tgt.seed ASC
    `
    )
    .all(tournament.id) as Array<{
    group_name: string;
    team_id: number;
    team_name: string | null;
  }>;

  const grouped = new Map<string, Array<{ id: number; name: string | null }>>();
  for (const row of standings) {
    if (!grouped.has(row.group_name)) {
      grouped.set(row.group_name, []);
    }
    grouped.get(row.group_name)!.push({
      id: row.team_id,
      name: row.team_name,
    });
  }

  const quarterPairs: Array<{
    a: string;
    aIndex: number;
    b: string;
    bIndex: number;
  }> = [
    { a: "Group A", aIndex: 0, b: "Group B", bIndex: 1 },
    { a: "Group C", aIndex: 0, b: "Group D", bIndex: 1 },
    { a: "Group B", aIndex: 0, b: "Group A", bIndex: 1 },
    { a: "Group D", aIndex: 0, b: "Group C", bIndex: 1 },
  ];

  const insertMatchStmt = db.prepare(
    `
    INSERT INTO tournament_matches (
      tournament_id,
      region_id,
      stage,
      round_name,
      round_number,
      match_number,
      group_id,
      best_of,
      team1_id,
      team2_id,
      source_match1_id,
      source_match2_id
    ) VALUES (?, ?, 'bracket', ?, ?, ?, NULL, ?, ?, ?, ?, ?)
  `
  );

  const maxMatchRow = db
    .prepare(
      "SELECT MAX(match_number) as maxMatch FROM tournament_matches WHERE tournament_id = ?"
    )
    .get(tournament.id) as { maxMatch?: number } | undefined;
  let matchNumber = Number(maxMatchRow?.maxMatch ?? 0) + 1;

  const quarterMatchIds: number[] = [];
  for (const pair of quarterPairs) {
    const teamA = grouped.get(pair.a)?.[pair.aIndex];
    const teamB = grouped.get(pair.b)?.[pair.bIndex];
    if (!teamA || !teamB) {
      continue;
    }
    const info = insertMatchStmt.run(
      tournament.id,
      tournament.region_id,
      "Quarterfinals",
      1,
      matchNumber++,
      BRACKET_BEST_OF,
      teamA.id,
      teamB.id,
      null,
      null
    );
    quarterMatchIds.push(Number(info.lastInsertRowid));
  }

  const semifinalPairs: Array<[number, number]> = [
    [quarterMatchIds[0], quarterMatchIds[1]],
    [quarterMatchIds[2], quarterMatchIds[3]],
  ].filter(
    (pair): pair is [number, number] =>
      typeof pair[0] === "number" && typeof pair[1] === "number"
  );

  const semifinalIds: number[] = [];
  for (const [first, second] of semifinalPairs) {
    const info = insertMatchStmt.run(
      tournament.id,
      tournament.region_id,
      "Semifinals",
      2,
      matchNumber++,
      BRACKET_BEST_OF,
      null,
      null,
      first,
      second
    );
    semifinalIds.push(Number(info.lastInsertRowid));
  }

  if (semifinalIds.length >= 2) {
    insertMatchStmt.run(
      tournament.id,
      tournament.region_id,
      "Finals",
      3,
      matchNumber++,
      BRACKET_BEST_OF,
      null,
      null,
      semifinalIds[0],
      semifinalIds[1]
    );
  }
}

function refreshTournamentStatus(tournament: TournamentRow): void {
  const pendingGroup = db
    .prepare(
      "SELECT COUNT(*) as total FROM tournament_matches WHERE tournament_id = ? AND stage = 'group' AND status <> 'completed'"
    )
    .get(tournament.id) as { total: number };
  if (Number(pendingGroup.total ?? 0) === 0) {
    ensureBracketMatches(tournament);
    db.prepare(
      "UPDATE tournaments SET stage = CASE WHEN stage = 'groups' THEN 'bracket' ELSE stage END WHERE id = ?"
    ).run(tournament.id);
  }

  const pendingBracket = db
    .prepare(
      "SELECT COUNT(*) as total FROM tournament_matches WHERE tournament_id = ? AND stage = 'bracket' AND status <> 'completed'"
    )
    .get(tournament.id) as { total: number };

  if (
    Number(pendingGroup.total ?? 0) === 0 &&
    Number(pendingBracket.total ?? 0) === 0
  ) {
    db.prepare(
      "UPDATE tournaments SET stage = 'completed', status = 'completed', is_active = 0, completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP) WHERE id = ?"
    ).run(tournament.id);
    const completed = db
      .prepare(
        "SELECT id, name, region_id, type, status, stage, is_active, current_round, started_at, completed_at, rewards_applied FROM tournaments WHERE id = ?"
      )
      .get(tournament.id) as TournamentRow | undefined;
    if (completed) {
      applySeasonReset(completed);
    }
  }
}

function applySeasonReset(tournament: TournamentRow): void {
  if (tournament.rewards_applied) {
    return;
  }

  const leaderboard = db
    .prepare("SELECT id, score FROM users ORDER BY score DESC, id ASC LIMIT 3")
    .all() as Array<{ id: number; score: number }>;

  const bonuses = [SEASON_BONUS_TOP1, SEASON_BONUS_TOP2, SEASON_BONUS_TOP3];

  db.transaction(() => {
    db.prepare("UPDATE users SET currency = ?").run(BASE_SEASON_CURRENCY);
    db.prepare(
      "UPDATE users SET transfer_count = 0, transfer_tournament_id = NULL"
    ).run();
    db.prepare("UPDATE user_boosts SET uses_remaining = 0").run();

    leaderboard.forEach((entry, index) => {
      const bonus = bonuses[index] ?? 0;
      if (bonus > 0) {
        addUserCurrency(entry.id, bonus);
      }
    });

    db.prepare(
      "UPDATE tournaments SET rewards_applied = 1 WHERE id = ?"
    ).run(tournament.id);
  })();
}

type PendingMatchRow = MatchRowWithNames;

function fetchPendingMatches(
  tournamentId: number
): PendingMatchRow[] {
  const rows = db
    .prepare(
      `
      SELECT
        tm.id,
        tm.tournament_id,
        tm.region_id,
        tm.stage,
        tm.round_name,
        tm.round_number,
        tm.match_number,
        tm.best_of,
        tm.group_id,
        tm.team1_id,
        tm.team2_id,
        tm.team1_score,
        tm.team2_score,
        tm.winner_team_id,
        tm.status,
        t1.name as team1_name,
        t2.name as team2_name
      FROM tournament_matches tm
      LEFT JOIN teams t1 ON t1.id = tm.team1_id
      LEFT JOIN teams t2 ON t2.id = tm.team2_id
      WHERE tm.tournament_id = ?
        AND tm.team1_id IS NOT NULL
        AND tm.team2_id IS NOT NULL
        AND tm.status <> 'completed'
      ORDER BY CASE tm.stage WHEN 'group' THEN 0 ELSE 1 END, tm.round_number, tm.match_number
    `
    )
    .all(tournamentId) as PendingMatchRow[];
  return rows;
}

function simulateTournamentMatchRow(
  matchRow: PendingMatchRow
): { summary: TournamentMatchSummary; games: MatchHistoryEntry[] } {
  if (!matchRow.team1_id || !matchRow.team2_id) {
    throw new Error("MATCH_NOT_READY");
  }

  const regionName = fetchRegionNameById(matchRow.region_id);
  const players = [
    ...fetchPlayersByTeamId(matchRow.team1_id),
    ...fetchPlayersByTeamId(matchRow.team2_id),
  ];
  const winsNeeded = Math.ceil(Math.max(matchRow.best_of, 1) / 2);
  let wins1 = Number(matchRow.team1_score) || 0;
  let wins2 = Number(matchRow.team2_score) || 0;
  let gameCounter = wins1 + wins2;
  const games: MatchHistoryEntry[] = [];

  while (wins1 < winsNeeded && wins2 < winsNeeded) {
    gameCounter += 1;
    const result = simulateMatch(players, regionName, { scoreMode: "tournament" });
    const gameWinnerTeamId: number | null =
      result.winningTeamId === matchRow.team1_id
        ? matchRow.team1_id ?? null
        : matchRow.team2_id ?? null;

    if (gameWinnerTeamId === matchRow.team1_id) {
      wins1 += 1;
    } else {
      wins2 += 1;
    }

    const gameInfo = db
      .prepare(
        `
        INSERT INTO tournament_games (tournament_id, match_id, region_id, game_number, winner_team_id)
        VALUES (?, ?, ?, ?, ?)
      `
      )
      .run(
        matchRow.tournament_id,
        matchRow.id,
        matchRow.region_id,
        gameCounter,
        gameWinnerTeamId ?? null
      );

    const matchHistoryId = recordMatchHistory(
      {
        region: regionName,
        teamA: matchRow.team1_name ?? "Team A",
        teamB: matchRow.team2_name ?? "Team B",
        winner: result.winningTeam,
        mvp: result.MVP.name || null,
        mvpScore: result.MVP.score,
        isTournament: true,
        tournamentId: matchRow.tournament_id,
        tournamentMatchId: matchRow.id,
        tournamentGameId: Number(gameInfo.lastInsertRowid),
        stage: matchRow.stage,
        roundName: matchRow.round_name,
        gameNumber: gameCounter,
        seriesBestOf: matchRow.best_of,
        seriesScore: `${wins1}-${wins2}`,
        ...(() => {
          const objectivesBySide = result.objectivesBySide as
            | ObjectivesBySide
            | undefined;
          if (!objectivesBySide) {
            return {
              teamATowers: 0,
              teamBTowers: 0,
              teamADragons: 0,
              teamBDragons: 0,
              teamABarons: 0,
              teamBBarons: 0,
            };
          }
          const resolveSide = (
            teamId?: number | null,
            teamName?: string | null
          ): "A" | "B" | null => {
            if (Array.isArray(result.teamIds) && typeof teamId === "number") {
              const index = result.teamIds.findIndex((id) => id === teamId);
              if (index === 0) return "A";
              if (index === 1) return "B";
            }
            if (Array.isArray(result.teams) && teamName) {
              const normalized = teamName.trim().toLowerCase();
              const index = result.teams.findIndex(
                (name) => name?.trim().toLowerCase() === normalized
              );
              if (index === 0) return "A";
              if (index === 1) return "B";
            }
            return null;
          };
          const objectivesForSide = (side: "A" | "B" | null): MatchObjectives => {
            if (!side) {
              return { towers: 0, dragons: 0, barons: 0 };
            }
            const source = objectivesBySide[side];
            return {
              towers: source.towers ?? 0,
              dragons: source.dragons ?? 0,
              barons: source.barons ?? 0,
            };
          };
          const teamASide = resolveSide(matchRow.team1_id ?? null, matchRow.team1_name ?? null);
          const teamBSide = resolveSide(matchRow.team2_id ?? null, matchRow.team2_name ?? null);
          const objectivesA = objectivesForSide(teamASide);
          const objectivesB = objectivesForSide(teamBSide);
          return {
            teamATowers: objectivesA.towers,
            teamBTowers: objectivesB.towers,
            teamADragons: objectivesA.dragons,
            teamBDragons: objectivesB.dragons,
            teamABarons: objectivesA.barons,
            teamBBarons: objectivesB.barons,
          };
        })(),
      },
      result.playerStats
    );

    if (matchHistoryId) {
      const recorded = getMatchHistoryById(matchHistoryId);
      if (recorded) {
        games.push(recorded);
      }
    }
  }

  const winnerTeamId: number | null =
    wins1 > wins2
      ? matchRow.team1_id ?? null
      : matchRow.team2_id ?? null;

  db.prepare(
    `
    UPDATE tournament_matches
    SET team1_score = ?, team2_score = ?, winner_team_id = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(wins1, wins2, winnerTeamId, matchRow.id);

  updateGroupStandingsAfterMatch(matchRow, winnerTeamId);
  propagateWinnerToNextRounds(matchRow.id, winnerTeamId ?? undefined);

  const summary = matchRowToSummary(
    {
      ...matchRow,
      team1_score: wins1,
      team2_score: wins2,
      winner_team_id: winnerTeamId ?? null,
      status: "completed",
    },
    games
  );

  return { summary, games };
}

function simulateTournamentBatch(
  tournament: TournamentRow,
  selection: "next" | "round"
): TournamentMatchSummary[] {
  const pending = fetchPendingMatches(tournament.id);
  if (pending.length === 0) {
    refreshTournamentStatus(tournament);
    throw new Error("NO_PENDING_MATCHES");
  }

  const [first] = pending;
  if (!first) {
    refreshTournamentStatus(tournament);
    throw new Error("NO_PENDING_MATCHES");
  }

  let selected: PendingMatchRow[] = [];
  if (selection === "round") {
    selected = pending.filter(
      (match) =>
        match.stage === first.stage && match.round_number === first.round_number
    );
  } else {
    selected = pending.slice(0, 1);
  }

  const summaries: TournamentMatchSummary[] = [];
  db.transaction(() => {
    for (const match of selected) {
      const { summary } = simulateTournamentMatchRow(match);
      summaries.push(summary);
      db.prepare(
        "UPDATE tournaments SET current_round = ? WHERE id = ?"
      ).run(match.round_number, tournament.id);
    }
  })();

  refreshTournamentStatus(tournament);
  return summaries;
}

export function simulateTournamentMatches(
  regionId: number,
  mode: TournamentSimulationMode
): TournamentSimulationResult {
  const initialTournament = getActiveTournamentRow(regionId);
  if (!initialTournament) {
    throw new Error("NO_ACTIVE_TOURNAMENT");
  }

  if (mode === "full") {
    const aggregated: TournamentMatchSummary[] = [];
    let currentTournament: TournamentRow | undefined = initialTournament;
    while (currentTournament) {
      try {
        const batch = simulateTournamentBatch(currentTournament, "round");
        aggregated.push(...batch);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "NO_PENDING_MATCHES"
        ) {
          if (aggregated.length === 0) {
            throw error;
          }
          break;
        }
        throw error;
      }
      currentTournament = getActiveTournamentRow(regionId);
    }

    return {
      matches: aggregated,
      state: getTournamentState(regionId),
    };
  }

  const selection = mode === "round" ? "round" : "next";
  const matches = simulateTournamentBatch(initialTournament, selection);
  return {
    matches,
    state: getTournamentState(regionId),
  };
}

export function isTournamentActiveForRegion(regionId: number): boolean {
  return Boolean(getActiveTournamentRow(regionId));
}

export function fetchRegionNameById(regionId: number): string {
  const row = db
    .prepare("SELECT name FROM regions WHERE id = ?")
    .get(regionId) as { name: string } | undefined;
  return row ? row.name : "Unknown";
}

export function fetchAllPlayers(regionId: number): Player[] {
  const stmt = db.prepare("SELECT * FROM players WHERE region_id = ?");
  return stmt.all(regionId) as Player[];
}

export function fetchPlayersByTeamId(teamId: number): Player[] {
  const stmt = db.prepare("SELECT * FROM players WHERE team_id = ?");
  return stmt.all(teamId) as Player[];
}

export function getTeamId(teamName: string): number {
  const row = db
    .prepare("SELECT id FROM teams WHERE name = ?")
    .get(teamName) as { id: number } | undefined;

  if (!row) {
    throw new Error("TEAM_NOT_FOUND");
  }

  return Number(row.id);
}

