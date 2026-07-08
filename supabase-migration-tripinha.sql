-- ============================================================
-- BENETRIP - Migração: insight + escolha da Tripinha no snapshot
-- Execute este SQL no painel: Supabase → SQL Editor → New Query
--
-- Adiciona ao discovery_snapshots os campos pré-gerados pelo cron:
--   insight       → frase da Tripinha do dia (texto, entra no HTML SSR)
--   tripinha_pick → escolha do dia: { "nome": "...", "motivo": "..." }
--
-- Enquanto esta migração não rodar, o cron continua funcionando e
-- salva os snapshots sem esses campos (com warning no log).
-- ============================================================

ALTER TABLE discovery_snapshots
    ADD COLUMN IF NOT EXISTS insight TEXT,
    ADD COLUMN IF NOT EXISTS tripinha_pick JSONB;

-- Verificação
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'discovery_snapshots'
ORDER BY ordinal_position;
