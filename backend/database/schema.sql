PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Seasons
CREATE TABLE IF NOT EXISTS seasons (
    season_year     INTEGER PRIMARY KEY,
    total_rounds    INTEGER,
    champion_driver TEXT,
    champion_team   TEXT
);

-- Circuits
CREATE TABLE IF NOT EXISTS circuits (
    circuit_id      TEXT PRIMARY KEY,
    circuit_name    TEXT NOT NULL,
    country         TEXT,
    city            TEXT,
    circuit_type    TEXT  -- 'street', 'permanent', 'hybrid'
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
    team_id         TEXT PRIMARY KEY,
    team_name       TEXT NOT NULL,
    nationality     TEXT,
    base            TEXT
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
    driver_id       TEXT PRIMARY KEY,  -- abbreviation e.g. 'VER'
    full_name       TEXT NOT NULL,
    abbreviation    TEXT,
    nationality     TEXT,
    date_of_birth   TEXT
);

-- Races
CREATE TABLE IF NOT EXISTS races (
    race_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    season_year     INTEGER NOT NULL REFERENCES seasons(season_year),
    round_number    INTEGER NOT NULL,
    circuit_id      TEXT REFERENCES circuits(circuit_id),
    race_name       TEXT,
    race_date       TEXT,
    total_laps      INTEGER,
    UNIQUE (season_year, round_number)
);

-- Race Results
CREATE TABLE IF NOT EXISTS race_results (
    result_id           INTEGER PRIMARY KEY AUTOINCREMENT,
    race_id             INTEGER NOT NULL REFERENCES races(race_id),
    driver_id           TEXT NOT NULL REFERENCES drivers(driver_id),
    team_id             TEXT REFERENCES teams(team_id),
    grid_position       INTEGER,
    finish_position     INTEGER,
    classified_position TEXT,
    points              REAL,
    laps_completed      INTEGER,
    status              TEXT,
    fastest_lap         INTEGER DEFAULT 0,  -- boolean
    fastest_lap_time    REAL
);

-- Lap Times
CREATE TABLE IF NOT EXISTS lap_times (
    lap_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    race_id             INTEGER NOT NULL REFERENCES races(race_id),
    driver_id           TEXT NOT NULL REFERENCES drivers(driver_id),
    lap_number          INTEGER,
    lap_time_seconds    REAL,
    sector1_seconds     REAL,
    sector2_seconds     REAL,
    sector3_seconds     REAL,
    is_personal_best    INTEGER DEFAULT 0,  -- boolean
    compound            TEXT,
    tyre_life           INTEGER,
    track_status        TEXT,
    position            INTEGER
);

-- Pit Stops
CREATE TABLE IF NOT EXISTS pit_stops (
    pit_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    race_id             INTEGER NOT NULL REFERENCES races(race_id),
    driver_id           TEXT NOT NULL REFERENCES drivers(driver_id),
    lap_number          INTEGER,
    pit_duration_seconds REAL,
    compound_in         TEXT,
    compound_out        TEXT,
    stop_number         INTEGER
);

-- Qualifying Results
CREATE TABLE IF NOT EXISTS qualifying_results (
    qual_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    race_id         INTEGER NOT NULL REFERENCES races(race_id),
    driver_id       TEXT NOT NULL REFERENCES drivers(driver_id),
    team_id         TEXT REFERENCES teams(team_id),
    q1_seconds      REAL,
    q2_seconds      REAL,
    q3_seconds      REAL,
    grid_position   INTEGER
);

-- Driver Season Stats
CREATE TABLE IF NOT EXISTS driver_season_stats (
    stat_id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    season_year             INTEGER NOT NULL REFERENCES seasons(season_year),
    driver_id               TEXT NOT NULL REFERENCES drivers(driver_id),
    team_id                 TEXT REFERENCES teams(team_id),
    total_points            REAL DEFAULT 0,
    wins                    INTEGER DEFAULT 0,
    podiums                 INTEGER DEFAULT 0,
    poles                   INTEGER DEFAULT 0,
    fastest_laps            INTEGER DEFAULT 0,
    dnfs                    INTEGER DEFAULT 0,
    avg_finish_position     REAL,
    avg_grid_position       REAL,
    avg_lap_consistency     REAL,  -- stddev of clean lap times (lower = more consistent)
    overperformance_score   REAL,  -- avg(grid_pos - finish_pos), positive = outperformed
    UNIQUE (season_year, driver_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lap_times_race_id    ON lap_times(race_id);
CREATE INDEX IF NOT EXISTS idx_lap_times_driver_id  ON lap_times(driver_id);
CREATE INDEX IF NOT EXISTS idx_race_results_race_id ON race_results(race_id);
CREATE INDEX IF NOT EXISTS idx_pit_stops_race_id    ON pit_stops(race_id);
CREATE INDEX IF NOT EXISTS idx_races_season_year    ON races(season_year);
