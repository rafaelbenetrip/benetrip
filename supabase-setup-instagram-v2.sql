-- ============================================================
-- BENETRIP - Tabela de Posts do Instagram v2.0
-- Adiciona coluna 'formato' para suportar 7 formatos de post
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- ============================================================

-- Adicionar coluna formato à tabela existente (se já existe)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'instagram_posts') THEN
        -- Adicionar coluna formato se não existir
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'instagram_posts' AND column_name = 'formato') THEN
            ALTER TABLE instagram_posts ADD COLUMN formato TEXT DEFAULT 'descobridor';
        END IF;
    ELSE
        -- Criar tabela do zero se não existe
        CREATE TABLE instagram_posts (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            data DATE NOT NULL DEFAULT CURRENT_DATE,
            formato TEXT DEFAULT 'descobridor',
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

        CREATE INDEX idx_instagram_posts_data ON instagram_posts (data DESC);
        CREATE INDEX idx_instagram_posts_published ON instagram_posts (published);
        CREATE INDEX idx_instagram_posts_destino ON instagram_posts (destino_nome);

        ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "instagram_posts_read" ON instagram_posts FOR SELECT USING (true);
        CREATE POLICY "instagram_posts_write" ON instagram_posts FOR INSERT WITH CHECK (true);
        CREATE POLICY "instagram_posts_update" ON instagram_posts FOR UPDATE USING (true);
    END IF;
END $$;

-- Índice para consultar por formato
CREATE INDEX IF NOT EXISTS idx_instagram_posts_formato ON instagram_posts (formato);

COMMENT ON TABLE instagram_posts IS 'Histórico de posts automáticos do Instagram v2.0 - 7 formatos semanais';
COMMENT ON COLUMN instagram_posts.formato IS 'Formato do post: descobridor, top5, economia, origens, roteiro, ranking';
