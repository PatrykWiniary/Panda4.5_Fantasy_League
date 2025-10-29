import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  User,
  Deck,
  CompleteDeck,
  DeckSaveResult,
  DeckSummary,
  Player,
  Role,
} from "./Types";
import {
  createDeck,
  ensureDeckComplete,
  summarizeDeck,
  DeckError,
  calculateDeckValue,
  ensureUniqueMultipliers,
} from "./deckManager";
import { parseDeckPayload } from "./deckIO";

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

  if (!hasScoreColumn) {
    db.prepare(
      "ALTER TABLE users ADD COLUMN score NUMBER NOT NULL DEFAULT 0"
    ).run();
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
}

// Run lightweight migrations after loading schema.
migrateDecksTable();
migrateUsersTable();
migratePlayersTable();

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
};

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

export function saveDeck(userId: number, deck: Deck): DeckSaveResult {
  const currency = getUserCurrency(userId);

  const deckWithOwner = createDeck({
    userId,
    slots: deck.slots,
  });

  ensureUniqueMultipliers(deckWithOwner);

  const deckValue = calculateDeckValue(deckWithOwner);
  if (deckValue > currency) {
    // Make overspending a hard failure so client callers can surface the deficit.
    throw new DeckError(
      "CURRENCY_LIMIT_EXCEEDED",
      "Deck exceeds available currency.",
      {
        totalValue: deckValue,
        currency,
        overBudgetBy: deckValue - currency,
      }
    );
  }

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

export function addUser({ name, mail, password, currency, score }: User) {
  const hashedPassword = hashPassword(password);
  const normalizedScore =
    typeof score === "number" && Number.isFinite(score) ? score : 0;
  const stmt = db.prepare(
    "INSERT INTO users (name, mail, password, currency, score) VALUES (?, ?, ?, ?, ?)"
  );
  const info = stmt.run(name, mail, hashedPassword, currency, normalizedScore);
  return {
    id: Number(info.lastInsertRowid),
    name,
    mail,
    password: hashedPassword,
    currency,
    score: normalizedScore,
  };
}

export function getAllUsers() {
  const stmt = db.prepare("SELECT * FROM users");
  return stmt.all();
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
  const { password, ...safeUser } = insertedUser;
  return safeUser;
}

export function loginUser(mail: string, password: string) {
  const storedUser = db
    .prepare(
      "SELECT id, name, mail, password, currency, score FROM users WHERE mail = ?"
    )
    .get(mail) as DbUserRow | undefined;

  if (!storedUser) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (!verifyPassword(password, storedUser.password)) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const { password: _password, ...safeUser } = storedUser;
  return safeUser;
}

export function simulateData() {
  db.prepare("DELETE FROM players").run();
  db.prepare("DELETE FROM matches").run();
  db.prepare("DELETE FROM regions").run();
  db.prepare(
    "DELETE FROM sqlite_sequence WHERE name IN ('players', 'matches', 'regions')"
  ).run();

  const regionArr = ["Korea", "North America", "Europe"];
  const regionStmt = db.prepare("INSERT INTO regions (name) VALUES (?)");

  const regionIds = [];
  for (const region of regionArr) {
    const info = regionStmt.run(region);
    regionIds.push(Number(info.lastInsertRowid));
  }

  const primaryRegionId = regionIds[0] ?? 1;
  const samplePlayers: Array<{ name: string; role: Role }> = [
    { name: "Stonewall", role: "Top" },
    { name: "FlayMaster", role: "Jgl" },
    { name: "Arcana", role: "Mid" },
    { name: "Skybolt", role: "Adc" },
    { name: "Emberlight", role: "Supp" },
    { name: "Riftbreaker", role: "Top" },
    { name: "Phantom V", role: "Jgl" },
    { name: "Sage of Dawn", role: "Mid" },
    { name: "Scarlet Viper", role: "Adc" },
    { name: "Warden Sol", role: "Supp" },
  ];

  const playerStmt = db.prepare(`
    INSERT INTO players (name, kills, deaths, assists, cs, region_id, role, gold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const { name, role } of samplePlayers) {
    playerStmt.run(name, 0, 0, 0, 0, primaryRegionId, role, 0);
  }
}

export function simulateMatch(players: Player[], regionName: string) {
  for (const player of players) {
    const deltaKills = Math.floor(Math.random() * 5);
    const deltaDeaths = Math.floor(Math.random() * 3);
    const deltaAssists = Math.floor(Math.random() * 4);
    const deltaCs = Math.floor(Math.random() * 200);
    const deltaGold = Math.floor(Math.random() * 1500);

    player.kills += deltaKills;
    player.deaths += deltaDeaths;
    player.assists += deltaAssists;
    player.cs += deltaCs;
    player.gold = (player.gold ?? 0) + deltaGold;

    db.prepare(
      "UPDATE players SET kills = ?, deaths = ?, assists = ?, cs = ?, gold = ?, region_id = ? WHERE id = ?"
    ).run(
      player.kills,
      player.deaths,
      player.assists,
      player.cs,
      player.gold,
      player.region_id,
      player.id
    );
  }

  console.log(`Simulated match in ${regionName}`);
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
