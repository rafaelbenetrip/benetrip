-- ============================================================
-- BENETRIP DISCOVERY PAGES - Setup do Supabase
-- Execute este SQL no painel: Supabase → SQL Editor → New Query
-- ============================================================

-- 1. Tabela principal: snapshots diários de descoberta
CREATE TABLE IF NOT EXISTS discovery_snapshots (
    id BIGSERIAL PRIMARY KEY,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    origem VARCHAR(10) NOT NULL,          -- Código IATA: GRU, GIG, BSB...
    origem_nome VARCHAR(100) NOT NULL,     -- Nome legível: São Paulo, Rio...
    tipo VARCHAR(50) NOT NULL DEFAULT 'destinos-baratos',
    destinos JSONB NOT NULL DEFAULT '[]',  -- Array de destinos com preços
    total_destinos INTEGER NOT NULL DEFAULT 0,
    moeda VARCHAR(3) NOT NULL DEFAULT 'BRL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_discovery_data ON discovery_snapshots (data DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_origem ON discovery_snapshots (origem);
CREATE INDEX IF NOT EXISTS idx_discovery_tipo ON discovery_snapshots (tipo);
CREATE INDEX IF NOT EXISTS idx_discovery_origem_data ON discovery_snapshots (origem, data DESC);

-- 3. Constraint: apenas 1 snapshot por origem/tipo/dia
ALTER TABLE discovery_snapshots
    ADD CONSTRAINT unique_snapshot_per_day UNIQUE (data, origem, tipo);

-- 4. RLS (Row Level Security) - leitura pública, escrita apenas via service_role
ALTER TABLE discovery_snapshots ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode LER (dados públicos, SEO)
CREATE POLICY "discovery_read_public" ON discovery_snapshots
    FOR SELECT USING (true);

-- Apenas service_role pode INSERIR (cron job)
CREATE POLICY "discovery_insert_service" ON discovery_snapshots
    FOR INSERT WITH CHECK (true);

-- Apenas service_role pode DELETAR (limpeza)
CREATE POLICY "discovery_delete_service" ON discovery_snapshots
    FOR DELETE USING (true);

-- 5. Função de limpeza automática (manter 90 dias de histórico)
CREATE OR REPLACE FUNCTION cleanup_old_snapshots()
RETURNS void AS $$
BEGIN
    DELETE FROM discovery_snapshots
    WHERE data < CURRENT_DATE - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- 6. Verificação: listar tabela criada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'discovery_snapshots'
ORDER BY ordinal_position;
