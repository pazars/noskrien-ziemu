-- Schema v2: Clean architecture
-- Removes participants.season (people race across seasons)
-- Adds normalized_name for fast search and deduplication

DROP TABLE IF EXISTS races;
DROP TABLE IF EXISTS participants;

CREATE TABLE participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  distance TEXT NOT NULL,          -- 'Tautas' or 'Sporta'
  gender TEXT NOT NULL,             -- 'V' (men) or 'S' (women)
  normalized_name TEXT NOT NULL,   -- Latvian-normalized for search/deduplication
  UNIQUE(normalized_name, distance, gender)
);

CREATE TABLE races (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL,
  date TEXT NOT NULL,              -- 'YYYY-MM-DD'
  result TEXT NOT NULL,             -- 'MM:SS' or 'HH:MM:SS'
  km TEXT NOT NULL,                 -- Distance with comma/period decimals
  location TEXT NOT NULL,
  season TEXT NOT NULL,             -- Derived: '2023-2024' (Nov-Mar window)
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

-- Indexes optimized for production query pattern
CREATE INDEX idx_participants_distance_gender ON participants(distance, gender);
CREATE INDEX idx_participants_normalized_name ON participants(normalized_name);
CREATE INDEX idx_races_participant_date ON races(participant_id, date);
CREATE INDEX idx_races_season_location ON races(season, location);
