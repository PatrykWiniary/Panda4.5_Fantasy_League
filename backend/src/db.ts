import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { User, Deck, CompleteDeck, DeckSaveResult, DeckSummary, Player } from "./Types";
import {
  createDeck,
  ensureDeckComplete,
  summarizeDeck,
  DeckError,
} from "./deckManager";
import { parseDeckPayload } from "./deckIO";

const DB_PATH = path.join(__dirname, "..", "data", "app.db");
const INIT_SQL = path.join(__dirname, "init.sql");

fs.mkdirSync(path.join(__dirname, "..", "data"), { recursive: true });

const db = new Database(DB_PATH);
const initSql = fs.readFileSync(INIT_SQL, "utf8");
db.exec(initSql);

const PASSWORD_SALT_BYTES = 16;
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_ITERATIONS = 310000;
const PASSWORD_DIGEST = "sha256";

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

// Run lightweight migrations after loading schema.
migrateDecksTable();

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

function ensureUserExists(userId: number) {
  const existing = db.prepare("SELECT 1 FROM users WHERE id = ?").get(userId);
  if (!existing) {
    throw new Error("USER_NOT_FOUND");
  }
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
  ensureUserExists(userId);

  const deckWithOwner = createDeck({
    userId,
    slots: deck.slots,
  });

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

export function addUser({ name, mail, password, currency }: User) {
  const hashedPassword = hashPassword(password);
  const stmt = db.prepare(
    "INSERT INTO users (name, mail, password, currency) VALUES (?, ?, ?, ?)"
  );
  const info = stmt.run(name, mail, hashedPassword, currency);
  return {
    id: Number(info.lastInsertRowid),
    name,
    mail,
    password: hashedPassword,
    currency,
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
      "SELECT id, name, mail, password, currency FROM users WHERE mail = ?"
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
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('players', 'matches', 'regions')").run();

  const regionArr = ["Korea", "North America", "Europe"];
  const regionStmt = db.prepare("INSERT INTO regions (name) VALUES (?)");

  const regionIds = [];
  for (const region of regionArr) {
    const info = regionStmt.run(region);
    regionIds.push(Number(info.lastInsertRowid));
  }

  const playerStmt = db.prepare(`
    INSERT INTO players (name, kills, deaths, assists, cs, region_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = 1; i <= 10; i++) {
    const name = `Faker${i}`;
    const kills = 0;
    const deaths = 0;
    const assists = 0;
    const cs = 0;
    const region_id = regionIds[Math.floor(Math.random() * regionIds.length)];
    playerStmt.run(name, kills, deaths, assists, cs, 1);
  }
}

export function simulateMatch(players: Player[], regionName: string) {
    for (const player of players) {
      const deltaKills = Math.floor(Math.random() * 5);
      const deltaDeaths = Math.floor(Math.random() * 3);
      const deltaAssists = Math.floor(Math.random() * 4);
      const deltaCs = Math.floor(Math.random() * 200);

      player.kills += deltaKills;
      player.deaths += deltaDeaths;
      player.assists += deltaAssists;
      player.cs += deltaCs;

      db.prepare(
        "UPDATE players SET kills = ?, deaths = ?, assists = ?, cs = ?, region_id = ? WHERE id = ?"
      ).run(player.kills, player.deaths, player.assists, player.cs, player.region_id, player.id);
    }

    console.log(`Simulated match in ${regionName}`);
}

export function fetchRegionNameById(regionId: number): string {
  const row = db
    .prepare("SELECT name FROM regions WHERE id = ?")
    .get(regionId) as { name: string } | undefined;
  return row ? row.name : "Unknown";
}

export function fetchAllPlayers(regionId: number):Player[]{
  const stmt = db.prepare("SELECT * FROM players WHERE region_id = ?");
  return stmt.all(regionId) as Player[];
}
