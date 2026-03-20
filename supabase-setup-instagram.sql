-- ============================================================
-- BENETRIP - Tabela de Posts do Instagram
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- ============================================================

-- Tabela para armazenar histórico de posts gerados/publicados
CREATE TABLE IF NOT EXISTS instagram_posts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    estilo TEXT,
    destino_nome TEXT NOT NULL,
    destino_pais TEXT,
    destino_preco NUMERIC,
    origem TEXT,
    persona_nome TEXT,
    caption TEXT,
    hashtags JSONB,
    image_url TEXT,
    published BOOLEAN DEFAULT FALSE,
    instagram_media_id TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_instagram_posts_data ON instagram_posts (data DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_published ON instagram_posts (published);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_destino ON instagram_posts (destino_nome);

-- RLS (Row Level Security)
ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;

-- Política: leitura pública (para a página admin)
CREATE POLICY "instagram_posts_read" ON instagram_posts
    FOR SELECT USING (true);

-- Política: escrita apenas via service role (cron/api)
CREATE POLICY "instagram_posts_write" ON instagram_posts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "instagram_posts_update" ON instagram_posts
    FOR UPDATE USING (true);

-- Comentário na tabela
COMMENT ON TABLE instagram_posts IS 'Histórico de posts automáticos do Instagram - Benetrip';
