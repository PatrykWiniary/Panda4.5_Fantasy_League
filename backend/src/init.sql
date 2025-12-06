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
    avatar TEXT,
    lobby_id NUMBER,
    FOREIGN KEY (lobby_id) REFERENCES lobby (id) ON DELETE CASCADE
  );

CREATE TABLE
  IF NOT EXISTS decks (
    user_id INTEGER PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

-- Regions table
DROP TABLE IF EXISTS regions;
CREATE TABLE IF NOT EXISTS regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

-- Tournaments table
DROP TABLE IF EXISTS tournaments;
CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  region_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'league',
  status TEXT NOT NULL DEFAULT 'archived',
  stage TEXT NOT NULL DEFAULT 'idle',
  is_active INTEGER NOT NULL DEFAULT 0,
  current_round INTEGER NOT NULL DEFAULT 1,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE CASCADE
);

-- Teams table (each team belongs to 1 tournament & region)
DROP TABLE IF EXISTS teams;
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tournament_id INTEGER NOT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE
);

-- Players table (each player belongs to 1 team & region)
DROP TABLE IF EXISTS players;
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
DROP TABLE IF EXISTS matches;
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

-- Tournament helper tables
DROP TABLE IF EXISTS tournament_groups;
CREATE TABLE IF NOT EXISTS tournament_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  region_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE,
  FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS tournament_group_teams;
CREATE TABLE IF NOT EXISTS tournament_group_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  seed INTEGER,
  FOREIGN KEY (group_id) REFERENCES tournament_groups (id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS tournament_matches;
CREATE TABLE IF NOT EXISTS tournament_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  region_id INTEGER NOT NULL,
  stage TEXT NOT NULL,
  round_name TEXT NOT NULL,
  round_number INTEGER NOT NULL DEFAULT 1,
  match_number INTEGER NOT NULL DEFAULT 1,
  group_id INTEGER,
  best_of INTEGER NOT NULL DEFAULT 1,
  team1_id INTEGER,
  team2_id INTEGER,
  team1_score INTEGER NOT NULL DEFAULT 0,
  team2_score INTEGER NOT NULL DEFAULT 0,
  winner_team_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT,
  completed_at TEXT,
  source_match1_id INTEGER,
  source_match2_id INTEGER,
  FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE,
  FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES tournament_groups (id) ON DELETE CASCADE,
  FOREIGN KEY (team1_id) REFERENCES teams (id) ON DELETE SET NULL,
  FOREIGN KEY (team2_id) REFERENCES teams (id) ON DELETE SET NULL,
  FOREIGN KEY (winner_team_id) REFERENCES teams (id) ON DELETE SET NULL,
  FOREIGN KEY (source_match1_id) REFERENCES tournament_matches (id) ON DELETE SET NULL,
  FOREIGN KEY (source_match2_id) REFERENCES tournament_matches (id) ON DELETE SET NULL
);

DROP TABLE IF EXISTS tournament_games;
CREATE TABLE IF NOT EXISTS tournament_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  match_id INTEGER NOT NULL,
  region_id INTEGER NOT NULL,
  game_number INTEGER NOT NULL,
  winner_team_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE,
  FOREIGN KEY (match_id) REFERENCES tournament_matches (id) ON DELETE CASCADE,
  FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE CASCADE,
  FOREIGN KEY (winner_team_id) REFERENCES teams (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS match_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region TEXT NOT NULL,
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  winner TEXT NOT NULL,
  mvp TEXT,
  mvp_score REAL,
  is_tournament INTEGER NOT NULL DEFAULT 0,
  tournament_id INTEGER,
  tournament_match_id INTEGER,
  tournament_game_id INTEGER,
  stage TEXT,
  round_name TEXT,
  game_number INTEGER,
  series_best_of INTEGER,
  series_score TEXT,
  team_a_towers INTEGER NOT NULL DEFAULT 0,
  team_b_towers INTEGER NOT NULL DEFAULT 0,
  team_a_dragons INTEGER NOT NULL DEFAULT 0,
  team_b_dragons INTEGER NOT NULL DEFAULT 0,
  team_a_barons INTEGER NOT NULL DEFAULT 0,
  team_b_barons INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE,
  FOREIGN KEY (tournament_match_id) REFERENCES tournament_matches (id) ON DELETE CASCADE,
  FOREIGN KEY (tournament_game_id) REFERENCES tournament_games (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_history_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  player_id INTEGER,
  player_name TEXT NOT NULL,
  nickname TEXT,
  role TEXT,
  kills INTEGER,
  deaths INTEGER,
  assists INTEGER,
  cs INTEGER,
  gold INTEGER,
  score REAL,
  team_name TEXT,
  team_side TEXT,
  FOREIGN KEY (match_id) REFERENCES match_history (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lobby (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  password TEXT,
  betValue INTEGER,
  winner_id INTEGER,
  FOREIGN KEY (winner_id) REFERENCES players (id) ON DELETE CASCADE
)
