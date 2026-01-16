DROP TABLE IF EXISTS races;
DROP TABLE IF EXISTS participants;

CREATE TABLE participants (
  id INTEGER PRIMARY KEY,
  name TEXT,
  link TEXT,
  season TEXT,
  distance TEXT,
  gender TEXT
);

CREATE TABLE races (
  id INTEGER PRIMARY KEY,
  participant_id INTEGER,
  date TEXT,
  result TEXT,
  km TEXT,
  location TEXT,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE INDEX idx_participants_season_gender ON participants(season, gender);
CREATE INDEX idx_races_participant_id ON races(participant_id);
