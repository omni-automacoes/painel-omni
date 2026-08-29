-- ============================================================
-- SCHEMA FINANCEIRO EMPRESARIAL — OMNI AUTOMAÇÕES
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ── TIPOS ENUM ──────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tipo_receita  AS ENUM ('pontual', 'recorrente');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_receita AS ENUM ('pendente', 'recebido', 'atrasado', 'cancelado');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_despesa AS ENUM ('pontual', 'recorrente', 'parcelada');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_despesa AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── TABELA: receitas ─────────────────────────────────────────
-- Registra todas as entradas financeiras da empresa.
-- tipo = 'pontual'    → venda avulsa (ex: site, consultoria única)
-- tipo = 'recorrente' → SaaS / mensalidade de cliente
--
-- Para receitas recorrentes, use `recorrente_grupo_id` para
-- agrupar os lançamentos mensais de um mesmo cliente/serviço.

CREATE TABLE IF NOT EXISTS public.receitas (
  receita_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao           TEXT NOT NULL,
  tipo                tipo_receita NOT NULL DEFAULT 'pontual',
  categoria           TEXT NOT NULL DEFAULT 'Outros',
  valor               NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status              status_receita NOT NULL DEFAULT 'pendente',

  data_competencia    DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  data_vencimento     DATE NOT NULL DEFAULT CURRENT_DATE,
  data_recebimento    DATE,

  cliente_nome        TEXT,
  lead_id             UUID REFERENCES public.leads(lead_id) ON DELETE SET NULL,

  -- Agrupa lançamentos de uma mesma recorrência (mesmo UUID por grupo)
  recorrente_grupo_id UUID,

  observacoes         TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.receitas IS 'Entradas financeiras da Omni Automações (vendas, SaaS, consultorias).';
COMMENT ON COLUMN public.receitas.tipo              IS 'pontual = venda única | recorrente = mensalidade de cliente';
COMMENT ON COLUMN public.receitas.recorrente_grupo_id IS 'Agrupa meses de uma mesma receita recorrente (mesmo UUID por série).';
COMMENT ON COLUMN public.receitas.data_competencia  IS 'Mês de competência (primeiro dia do mês).';

-- ── TABELA: despesas ─────────────────────────────────────────
-- Registra todas as saídas financeiras da empresa.
-- tipo = 'pontual'    → gasto único (ex: design, equipamento)
-- tipo = 'recorrente' → custo fixo mensal (ex: servidor, meta ads)
-- tipo = 'parcelada'  → compra parcelada (ex: notebook em 12x)
--
-- Para parceladas, `parcela_atual` e `total_parcelas` controlam o progresso.
-- Para recorrentes, `recorrente_grupo_id` agrupa os meses.

CREATE TABLE IF NOT EXISTS public.despesas (
  despesa_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao           TEXT NOT NULL,
  tipo                tipo_despesa NOT NULL DEFAULT 'pontual',
  categoria           TEXT NOT NULL DEFAULT 'Outros',

  valor_parcela       NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  valor_total         NUMERIC(12,2) NOT NULL DEFAULT 0.00,

  status              status_despesa NOT NULL DEFAULT 'pendente',

  data_competencia    DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  data_vencimento     DATE NOT NULL DEFAULT CURRENT_DATE,
  data_pagamento      DATE,

  -- Controle de parcelas (apenas para tipo = 'parcelada')
  parcela_atual       INTEGER CHECK (parcela_atual >= 1),
  total_parcelas      INTEGER CHECK (total_parcelas >= 1),

  -- Agrupa lançamentos de uma mesma recorrência ou série parcelada
  recorrente_grupo_id UUID,

  fornecedor          TEXT,
  observacoes         TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.despesas IS 'Saídas financeiras da Omni Automações (custos, despesas, parcelas).';
COMMENT ON COLUMN public.despesas.tipo               IS 'pontual = único | recorrente = fixo mensal | parcelada = compra em parcelas';
COMMENT ON COLUMN public.despesas.valor_parcela      IS 'Valor desta parcela / este mês.';
COMMENT ON COLUMN public.despesas.valor_total        IS 'Valor total da compra (igual a valor_parcela para pontuais/recorrentes).';
COMMENT ON COLUMN public.despesas.recorrente_grupo_id IS 'Agrupa meses de uma mesma despesa recorrente ou série parcelada.';

-- ── ÍNDICES PARA PERFORMANCE ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_receitas_data_vencimento ON public.receitas(data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_receitas_data_competencia ON public.receitas(data_competencia DESC);
CREATE INDEX IF NOT EXISTS idx_receitas_status ON public.receitas(status);
CREATE INDEX IF NOT EXISTS idx_receitas_tipo ON public.receitas(tipo);
CREATE INDEX IF NOT EXISTS idx_receitas_grupo ON public.receitas(recorrente_grupo_id) WHERE recorrente_grupo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_data_vencimento ON public.despesas(data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_despesas_data_competencia ON public.despesas(data_competencia DESC);
CREATE INDEX IF NOT EXISTS idx_despesas_status ON public.despesas(status);
CREATE INDEX IF NOT EXISTS idx_despesas_tipo ON public.despesas(tipo);
CREATE INDEX IF NOT EXISTS idx_despesas_grupo ON public.despesas(recorrente_grupo_id) WHERE recorrente_grupo_id IS NOT NULL;

-- ── ROW LEVEL SECURITY ───────────────────────────────────────

ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Receitas - Acesso Total" ON public.receitas;
CREATE POLICY "Receitas - Acesso Total"
  ON public.receitas FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Despesas - Acesso Total" ON public.despesas;
CREATE POLICY "Despesas - Acesso Total"
  ON public.despesas FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── DADOS INICIAIS (SEED — DADOS REAIS OMNI) ─────────────────

-- Receitas
INSERT INTO public.receitas (descricao, tipo, categoria, valor, status, data_competencia, data_vencimento, data_recebimento, cliente_nome, observacoes) VALUES
  ('Desenvolvimento Landing Page · JM Poços', 'pontual', 'Sites e Landing Pages', 997.00, 'recebido', '2026-08-01', '2026-08-10', '2026-08-10', 'JM Poços Bauru', 'Pago via Pix na entrega'),
  ('Mensalidade Painel Omni · Cliente Rex', 'recorrente', 'SaaS / Recorrência', 450.00, 'recebido', '2026-08-01', '2026-08-15', '2026-08-15', 'Auto Center Rex', 'Cobrança mensal automática'),
  ('Consultoria Automação IA · Rede Bom Café', 'pontual', 'Consultoria e IA', 2500.00, 'pendente', '2026-08-01', '2026-08-30', NULL, 'Rede Bom Café', 'Aguardando homologação do workflow N8N'),
  ('Criação Site Institucional · Grupo Sena', 'pontual', 'Sites e Landing Pages', 3200.00, 'recebido', '2026-07-01', '2026-07-25', '2026-07-25', 'Grupo Sena', 'Projeto entregue e aprovado em Julho'),
  ('Mensalidade Painel Omni · Cliente Rex', 'recorrente', 'SaaS / Recorrência', 450.00, 'recebido', '2026-07-01', '2026-07-15', '2026-07-15', 'Auto Center Rex', 'Recorrência de Julho'),
  ('Automação N8N + IA · Lead Advogado Silva', 'pontual', 'Automação N8N', 1800.00, 'pendente', '2026-08-01', '2026-09-05', NULL, 'Dr. Carlos Silva', 'Proposta enviada, aguardando resposta')
ON CONFLICT DO NOTHING;

-- Despesas
INSERT INTO public.despesas (descricao, tipo, categoria, valor_parcela, valor_total, status, data_competencia, data_vencimento, data_pagamento, fornecedor, observacoes) VALUES
  ('Servidores Cloud N8N + Supabase', 'recorrente', 'Infraestrutura e Cloud', 180.00, 180.00, 'pago', '2026-08-01', '2026-08-05', '2026-08-05', 'Hostinger / Supabase', 'Infraestrutura mensal'),
  ('Meta Ads · Campanha de Leads Sites', 'recorrente', 'Marketing e Tráfego', 850.00, 850.00, 'pago', '2026-08-01', '2026-08-12', '2026-08-12', 'Meta (Facebook/Instagram)', 'Tráfego pago em anúncios'),
  ('Licenças de Softwares Dev', 'recorrente', 'Ferramentas e SaaS', 290.00, 290.00, 'pendente', '2026-08-01', '2026-08-28', NULL, 'JetBrains / Figma / etc.', 'Renovação de licenças mensais'),
  ('Simples Nacional (DAS)', 'recorrente', 'Impostos e Taxas', 640.00, 640.00, 'pago', '2026-07-01', '2026-07-20', '2026-07-20', 'Receita Federal', 'DAS mensal quitado'),
  ('Servidores Cloud N8N + Supabase', 'recorrente', 'Infraestrutura e Cloud', 180.00, 180.00, 'pago', '2026-07-01', '2026-07-05', '2026-07-05', 'Hostinger / Supabase', 'Infraestrutura de Julho'),
  ('Meta Ads · Campanha de Leads Sites', 'recorrente', 'Marketing e Tráfego', 850.00, 850.00, 'pago', '2026-07-01', '2026-07-12', '2026-07-12', 'Meta (Facebook/Instagram)', 'Tráfego pago Julho')
ON CONFLICT DO NOTHING;

-- Confirmar criação
SELECT 
  'receitas' AS tabela, COUNT(*) AS registros FROM public.receitas
UNION ALL
SELECT 
  'despesas' AS tabela, COUNT(*) AS registros FROM public.despesas;
