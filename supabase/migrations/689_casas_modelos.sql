-- Migration: 688_casas_modelos.sql
-- Recria 430_casas_modelos.sql com numero correto e JSONB em linha unica.

-- =============================================
-- TABELA: casas_modelos
-- =============================================
CREATE TABLE IF NOT EXISTS casas_modelos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          text NOT NULL UNIQUE,
  nome            text NOT NULL,
  area_m2         numeric(8,2) NOT NULL,
  num_suites      int NOT NULL DEFAULT 0,
  num_banheiros   int NOT NULL DEFAULT 0,
  num_vagas       int NOT NULL DEFAULT 0,
  dimensoes       text,
  preco_base      numeric(14,2),
  descricao       text,
  imagens         jsonb NOT NULL DEFAULT '[]',
  especificacoes  jsonb NOT NULL DEFAULT '{}',
  ativo           boolean NOT NULL DEFAULT true,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE casas_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "casas_modelos_select" ON casas_modelos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "casas_modelos_admin" ON casas_modelos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','team')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','team')));

-- =============================================
-- TABELA: livros_empreendimento
-- =============================================
CREATE TABLE IF NOT EXISTS livros_empreendimento (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casa_modelo_id  uuid REFERENCES casas_modelos(id),
  condominio_id   uuid REFERENCES condominios(id),
  kanban_card_id  uuid REFERENCES kanban_cards(id),
  gerado_por      uuid REFERENCES profiles(id),
  storage_path    text,
  versao          int NOT NULL DEFAULT 1,
  contexto_json   jsonb,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE livros_empreendimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "livros_empreendimento_select" ON livros_empreendimento
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "livros_empreendimento_insert" ON livros_empreendimento
  FOR INSERT TO authenticated WITH CHECK (gerado_por = auth.uid());

-- =============================================
-- STORAGE: bucket livros-empreendimento
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('livros-empreendimento', 'livros-empreendimento', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "livros_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'livros-empreendimento');

-- =============================================
-- SEED: 12 modelos de casa
-- Base URL imagens: https://pub-f88479dcde19436782f2cdc1eb048fdb.r2.dev/
-- =============================================
INSERT INTO casas_modelos (codigo, nome, area_m2, num_suites, num_banheiros, num_vagas, dimensoes, preco_base, imagens) VALUES
('al','ALE',47.0,2,1,1,'3.50x12.00',288553.20,'[{"path":"casas/al/1793911127224_blob","alt":"Fachada","tipo":"render"},{"path":"casas/al/1793911155814_blob","alt":"Interior","tipo":"render"},{"path":"casas/al/1793911165234_blob","alt":"Interior","tipo":"render"},{"path":"casas/al/1793911498878_ALE_LAYOUT_03__1_.png","alt":"Layout","tipo":"planta"}]'::jsonb),
('du','DUDA',103.0,3,2,2,'9.00x13.00',533937.05,'[{"path":"casas/du/1792701139363_blob","alt":"Fachada","tipo":"render"},{"path":"casas/du/1792701148241_blob","alt":"Interior","tipo":"render"},{"path":"casas/du/1792701160278_CO_Planta_Humanizada.png","alt":"Planta Cobertura","tipo":"planta"},{"path":"casas/du/1792701174026_AC_Planta_Humanizada.png","alt":"Planta Acesso","tipo":"planta"}]'::jsonb),
('lu','LU',191.5,3,3,2,'12.20x19',1151798.00,'[{"path":"casas/lu/1783366592780_blob","alt":"Fachada","tipo":"render"},{"path":"casas/lu/1783366614938_blob","alt":"Fachada Posterior","tipo":"render"},{"path":"casas/lu/1783366625931_blob","alt":"Interior","tipo":"render"},{"path":"casas/lu/1787693956566_INC_LU_Fundos_2_FINAL_IA.png","alt":"Fundos","tipo":"render"},{"path":"casas/lu/1787693967146_INC_LU_Cozinha_FINAL_IA.png","alt":"Cozinha","tipo":"render"},{"path":"casas/lu/1787693998597_INC_LU_Sala_FINAL_IA.png","alt":"Sala","tipo":"render"},{"path":"casas/lu/1784298070825_Design_sem_nome__4_.png","alt":"Layout","tipo":"planta"}]'::jsonb),
('is','ISA',237.1,3,4,2,'8x17',1352110.00,'[{"path":"casas/is/1784316949542_blob","alt":"Fachada","tipo":"render"},{"path":"casas/is/1784316971343_blob","alt":"Fachada Posterior","tipo":"render"},{"path":"casas/is/1784316983135_blob","alt":"Interior","tipo":"render"},{"path":"casas/is/1784315704495_Layout_CO_ISA_T_rreo.jpg","alt":"Layout Terreo","tipo":"planta"},{"path":"casas/is/1784315722260_Layout_CO_ISA_Superior_3S.jpg","alt":"Layout Superior","tipo":"planta"}]'::jsonb),
('li','LIZ',234.2,4,5,2,'10.5x21',1687745.00,'[{"path":"casas/li/1773194847364_blob","alt":"Fachada","tipo":"render"},{"path":"casas/li/1773195155922_blob","alt":"Fachada Posterior","tipo":"render"},{"path":"casas/li/1773195170731_blob","alt":"Interior","tipo":"render"},{"path":"casas/li/1773195181132_blob","alt":"Interior","tipo":"render"},{"path":"casas/li/1773195235542_blob","alt":"Interior","tipo":"render"},{"path":"casas/li/1773195247226_blob","alt":"Interior","tipo":"render"},{"path":"casas/li/1773195255220_blob","alt":"Interior","tipo":"render"},{"path":"casas/li/1773198886607_CO_LIZ-R01.jpeg","alt":"Layout","tipo":"planta"}]'::jsonb),
('va','VAL',360.5,4,4,3,'10x20',1747719.00,'[{"path":"casas/va/1783521711069_blob","alt":"Fachada","tipo":"render"},{"path":"casas/va/1783521730430_blob","alt":"Fachada Posterior","tipo":"render"},{"path":"casas/va/1783521744588_blob","alt":"Interior","tipo":"render"},{"path":"casas/va/1783521756915_blob","alt":"Interior","tipo":"render"},{"path":"casas/va/1783521767231_blob","alt":"Interior","tipo":"render"},{"path":"casas/va/1783521776581_blob","alt":"Interior","tipo":"render"},{"path":"casas/va/1783521785201_blob","alt":"Interior","tipo":"render"},{"path":"casas/va/1783521793910_blob","alt":"Interior","tipo":"render"},{"path":"casas/va/1783521801540_blob","alt":"Interior","tipo":"render"}]'::jsonb),
('iv','IVY',305.9,4,5,3,'10x17',1925960.00,'[{"path":"casas/iv/1784329349109_blob","alt":"Fachada","tipo":"render"},{"path":"casas/iv/1784329363625_blob","alt":"Fachada Posterior","tipo":"render"},{"path":"casas/iv/1784329380503_blob","alt":"Living","tipo":"render"},{"path":"casas/iv/1784329394164_blob","alt":"Living","tipo":"render"},{"path":"casas/iv/1784329402079_blob","alt":"Living","tipo":"render"},{"path":"casas/iv/1784329415618_blob","alt":"Living","tipo":"render"},{"path":"casas/iv/1784329434521_blob","alt":"Suite Master","tipo":"render"},{"path":"casas/iv/1784329444985_blob","alt":"Suite Master","tipo":"render"},{"path":"casas/iv/1784329456211_blob","alt":"Banho Master","tipo":"render"},{"path":"casas/iv/1784329467231_blob","alt":"Rooftop","tipo":"render"},{"path":"casas/iv/1773295715620_CO_IVY_LAYOUT_T_RREO.jpeg","alt":"Layout Terreo","tipo":"planta"},{"path":"casas/iv/1773295771884_CO_IVY_LAYOUT_SUPERIOR.jpeg","alt":"Layout Superior","tipo":"planta"}]'::jsonb),
('ev','EVA',369.6,4,5,3,'10x20',2330656.00,'[{"path":"casas/ev/1773193680849_blob","alt":"Fachada","tipo":"render"},{"path":"casas/ev/1773193707920_EVA_02-Living.png","alt":"Living","tipo":"render"},{"path":"casas/ev/1773193720608_EVA_03-Cozinha.png","alt":"Cozinha","tipo":"render"},{"path":"casas/ev/1773193731078_EVA_04-Gourmet.png","alt":"Gourmet","tipo":"render"},{"path":"casas/ev/1773193747769_EVA_06-Master.png","alt":"Suite Master","tipo":"render"},{"path":"casas/ev/1773193950152_EVA_11-Rooftop.png","alt":"Rooftop","tipo":"render"},{"path":"casas/ev/1775168160715_blob","alt":"Layout","tipo":"planta"}]'::jsonb),
('ci','CISSA',425.0,4,5,3,'11x35',2408889.00,'[{"path":"casas/ci/1773119523335_cissa-fachada-01.jpg","alt":"Fachada","tipo":"render"},{"path":"casas/ci/1773119713741_CISSA-PR_VIA-01-LIVING.png","alt":"Living","tipo":"render"},{"path":"casas/ci/1773296356736_blob","alt":"Interior","tipo":"render"},{"path":"casas/ci/1773272072088_blob","alt":"Layout","tipo":"planta"}]'::jsonb),
('so','SOL',339.6,4,5,3,'10x21',2529190.00,'[{"path":"casas/so/1773194224659_blob","alt":"Fachada","tipo":"render"},{"path":"casas/so/1773194240652_blob","alt":"Fachada Posterior","tipo":"render"},{"path":"casas/so/1773194257697_SOL_04_LIVING-R00.png","alt":"Living","tipo":"render"},{"path":"casas/so/1773194275540_SOL_09_LIVING-R00.png","alt":"Living","tipo":"render"},{"path":"casas/so/1773194284809_SOL_12_LIVING-R00.png","alt":"Living","tipo":"render"},{"path":"casas/so/1773194309573_SOL_14_Master-R00.png","alt":"Suite Master","tipo":"render"},{"path":"casas/so/1773194321274_SOL_22_Banho_Master-R00.png","alt":"Banho Master","tipo":"render"},{"path":"casas/so/1773194339535_SOL_27_Banho_Master-R00.png","alt":"Banho Master","tipo":"render"},{"path":"casas/so/1773194378279_SOL_38_Rooftop-R00.png","alt":"Rooftop","tipo":"render"},{"path":"casas/so/1773194389798_SOL_41_Rooftop-R00.png","alt":"Rooftop","tipo":"render"},{"path":"casas/so/1773194402419_CO_SOL_LAYOUT_TERREO-R00__1_.jpg","alt":"Layout Terreo","tipo":"planta"},{"path":"casas/so/1773194419879_CO_SOL_LAYOUT_SUPERIOR-R00__1_.jpg","alt":"Layout Superior","tipo":"planta"}]'::jsonb),
('ga','GAL',393.5,4,5,4,'11.60x20',2639884.00,'[{"path":"casas/ga/1773294683901_blob","alt":"Fachada","tipo":"render"},{"path":"casas/ga/1773294693460_blob","alt":"Fachada Posterior","tipo":"render"},{"path":"casas/ga/1773294704003_blob","alt":"Patio central","tipo":"render"},{"path":"casas/ga/1773294728714_blob","alt":"Living","tipo":"render"},{"path":"casas/ga/1773294736510_blob","alt":"Living","tipo":"render"},{"path":"casas/ga/1773294747491_blob","alt":"Living","tipo":"render"},{"path":"casas/ga/1773294759157_blob","alt":"Corredor","tipo":"render"},{"path":"casas/ga/1773294768551_blob","alt":"Gourmet","tipo":"render"},{"path":"casas/ga/1773294777880_blob","alt":"Piscina","tipo":"render"},{"path":"casas/ga/1773294785158_blob","alt":"Rooftop","tipo":"render"},{"path":"casas/ga/1783377125777_blob","alt":"Layout Terreo","tipo":"planta"},{"path":"casas/ga/1783377144245_blob","alt":"Layout Superior","tipo":"planta"}]'::jsonb),
('le','LENA',708.3,6,8,4,'24x42',3527092.00,'[{"path":"casas/le/1790961478911_png.png","alt":"Fachada","tipo":"render"},{"path":"casas/le/1790961493997_f25229bb-57d4-434d-8573-aeea1ce9cc0a.png","alt":"Living","tipo":"render"},{"path":"casas/le/1790968401363_blob","alt":"Quintal","tipo":"render"},{"path":"casas/le/1790968418300_blob","alt":"Deck","tipo":"render"},{"path":"casas/le/1790968488025_Planta_Baixa_-_lena.png","alt":"Layout","tipo":"planta"}]'::jsonb)
ON CONFLICT (codigo) DO NOTHING;

NOTIFY pgrst, 'reload schema';
