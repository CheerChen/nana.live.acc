-- 演出历史表
CREATE TABLE live_history (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    performance_name VARCHAR(255) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 添加表注释
COMMENT ON TABLE live_history IS '演出历史表';
COMMENT ON COLUMN live_history.date IS '演出日期';
COMMENT ON COLUMN live_history.performance_name IS '公演名';
COMMENT ON COLUMN live_history.venue IS '演出场所';
COMMENT ON COLUMN live_history.url IS '详情页面URL';

-- 歌曲表
CREATE TABLE live_song (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    song_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 添加唯一约束
ALTER TABLE live_song ADD CONSTRAINT uk_song_name UNIQUE (name);

-- 为 live_history 添加唯一约束（日期+公演名）
ALTER TABLE live_history ADD CONSTRAINT uk_live_history_date_name UNIQUE (date, performance_name);

-- 添加表注释
COMMENT ON TABLE live_song IS '歌曲表';
COMMENT ON COLUMN live_song.name IS '歌曲名';
COMMENT ON COLUMN live_song.song_url IS '歌曲详情链接';

-- 演出歌曲关联表
CREATE TABLE live_history_song (
    id SERIAL PRIMARY KEY,
    live_history_id INTEGER NOT NULL,
    live_song_id INTEGER NOT NULL,
    song_order INTEGER,
    remark VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_live_history FOREIGN KEY (live_history_id) REFERENCES live_history(id) ON DELETE CASCADE,
    CONSTRAINT fk_live_song FOREIGN KEY (live_song_id) REFERENCES live_song(id) ON DELETE CASCADE
);

-- 添加唯一约束
ALTER TABLE live_history_song ADD CONSTRAINT uk_live_song UNIQUE (live_history_id, live_song_id);

-- 添加表注释
COMMENT ON TABLE live_history_song IS '演出歌曲关联表';
COMMENT ON COLUMN live_history_song.live_history_id IS '演出历史ID';
COMMENT ON COLUMN live_history_song.live_song_id IS '歌曲ID';
COMMENT ON COLUMN live_history_song.song_order IS '歌曲顺序';
COMMENT ON COLUMN live_history_song.remark IS '备注字段';

-- 创建索引
CREATE INDEX idx_live_history_date ON live_history(date);
CREATE INDEX idx_live_history_song_live_id ON live_history_song(live_history_id);
CREATE INDEX idx_live_history_song_song_id ON live_history_song(live_song_id);
