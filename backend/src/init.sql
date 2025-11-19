CREATE TABLE
  IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 0
  );

CREATE TABLE
  IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mail TEXT,
    password TEXT NOT NULL,
    currency NUMBER NOT NULL,
    score NUMBER NOT NULL DEFAULT 0,
    avatar TEXT
  );

CREATE TABLE
  IF NOT EXISTS decks (
    user_id INTEGER PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

-- Regions table
DROP TABLE regions;
CREATE TABLE IF NOT EXISTS regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

-- Tournaments table
DROP TABLE tournaments;
CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  region_id INTEGER NOT NULL,
  FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE CASCADE
);

-- Teams table (each team belongs to 1 tournament & region)
DROP TABLE teams;
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tournament_id INTEGER NOT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE
);

-- Players table (each player belongs to 1 team & region)
DROP TABLE players;
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  nickname TEXT,
  kills INTEGER NOT NULL,
  deaths INTEGER NOT NULL,
  assists INTEGER NOT NULL,
  cs INTEGER NOT NULL,
  gold INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  region_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
);

-- Matches table (each match belongs to 1 tournament & region, between 2 teams)
DROP TABLE matches;
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_id INTEGER NOT NULL,
  tournament_id INTEGER NOT NULL,
  team1_id INTEGER NOT NULL,
  team2_id INTEGER NOT NULL,
  winner_team_id INTEGER,
  match_date TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE CASCADE,
  FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE,
  FOREIGN KEY (team1_id) REFERENCES teams (id) ON DELETE CASCADE,
  FOREIGN KEY (team2_id) REFERENCES teams (id) ON DELETE CASCADE,
  FOREIGN KEY (winner_team_id) REFERENCES teams (id) ON DELETE SET NULL
);
