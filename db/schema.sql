CREATE TABLE IF NOT EXISTS tracks (
    id          VARCHAR(128) PRIMARY KEY,           -- persistent slug from trends.json, e.g. 'tr-sezen-aksu-gidiyorum'
    title       VARCHAR(255) NOT NULL,
    artist      VARCHAR(255) NOT NULL,
    region      VARCHAR(10)  NOT NULL CHECK (region IN ('GLOBAL', 'TR')),
    likes_count INT          NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
