-- ============================================================
--  PronosticsContest v2 — seed
-- ============================================================
--  Joué par `supabase db reset`.
--
--  Sprint 2 : FIFA World Cup 2026 (Canada / Mexico / USA)
--    Source : tirage officiel du 5 décembre 2025 (Kennedy Center,
--    Washington D.C.) + résultats des barrages UEFA et
--    intercontinentaux (26 / 31 mars 2026).
--
--    48 équipes, 12 groupes (A-L) de 4.
--
--    Barrages UEFA : Bosnie-Herzégovine → Gr. B, Tchéquie → Gr. A,
--                    Suède → Gr. F, Türkiye → Gr. D.
--    Barrages intercontinentaux : RD Congo → Gr. K, Irak → Gr. I.
-- ============================================================

-- On travaille sur un id déterministe pour re-seed proprement
-- sans dupliquer (`ON CONFLICT DO NOTHING`).
insert into public.competitions (id, code, nom, sport, date_debut, date_fin, status, logo_url)
values (
  '11111111-1111-1111-1111-111111111111',
  'fifa-wc-2026',
  'Coupe du Monde FIFA 2026',
  'football',
  '2026-06-11',
  '2026-07-19',
  'upcoming',
  null
)
on conflict (id) do nothing;

-- 48 équipes (codes FIFA à 3 lettres, groupes réels du tirage).
insert into public.equipes (competition_id, code, nom, groupe)
values
  -- Groupe A
  ('11111111-1111-1111-1111-111111111111', 'MEX', 'Mexique',              'A'),
  ('11111111-1111-1111-1111-111111111111', 'KOR', 'Corée du Sud',         'A'),
  ('11111111-1111-1111-1111-111111111111', 'RSA', 'Afrique du Sud',       'A'),
  ('11111111-1111-1111-1111-111111111111', 'CZE', 'Tchéquie',             'A'),
  -- Groupe B
  ('11111111-1111-1111-1111-111111111111', 'CAN', 'Canada',               'B'),
  ('11111111-1111-1111-1111-111111111111', 'BIH', 'Bosnie-Herzégovine',   'B'),
  ('11111111-1111-1111-1111-111111111111', 'QAT', 'Qatar',                'B'),
  ('11111111-1111-1111-1111-111111111111', 'SUI', 'Suisse',               'B'),
  -- Groupe C
  ('11111111-1111-1111-1111-111111111111', 'BRA', 'Brésil',               'C'),
  ('11111111-1111-1111-1111-111111111111', 'MAR', 'Maroc',                'C'),
  ('11111111-1111-1111-1111-111111111111', 'HAI', 'Haïti',                'C'),
  ('11111111-1111-1111-1111-111111111111', 'SCO', 'Écosse',               'C'),
  -- Groupe D
  ('11111111-1111-1111-1111-111111111111', 'USA', 'États-Unis',           'D'),
  ('11111111-1111-1111-1111-111111111111', 'PAR', 'Paraguay',             'D'),
  ('11111111-1111-1111-1111-111111111111', 'AUS', 'Australie',            'D'),
  ('11111111-1111-1111-1111-111111111111', 'TUR', 'Türkiye',              'D'),
  -- Groupe E
  ('11111111-1111-1111-1111-111111111111', 'GER', 'Allemagne',            'E'),
  ('11111111-1111-1111-1111-111111111111', 'CUW', 'Curaçao',              'E'),
  ('11111111-1111-1111-1111-111111111111', 'CIV', 'Côte d''Ivoire',       'E'),
  ('11111111-1111-1111-1111-111111111111', 'ECU', 'Équateur',             'E'),
  -- Groupe F
  ('11111111-1111-1111-1111-111111111111', 'NED', 'Pays-Bas',             'F'),
  ('11111111-1111-1111-1111-111111111111', 'JPN', 'Japon',                'F'),
  ('11111111-1111-1111-1111-111111111111', 'SWE', 'Suède',                'F'),
  ('11111111-1111-1111-1111-111111111111', 'TUN', 'Tunisie',              'F'),
  -- Groupe G
  ('11111111-1111-1111-1111-111111111111', 'BEL', 'Belgique',             'G'),
  ('11111111-1111-1111-1111-111111111111', 'EGY', 'Égypte',               'G'),
  ('11111111-1111-1111-1111-111111111111', 'IRN', 'Iran',                 'G'),
  ('11111111-1111-1111-1111-111111111111', 'NZL', 'Nouvelle-Zélande',     'G'),
  -- Groupe H
  ('11111111-1111-1111-1111-111111111111', 'ESP', 'Espagne',              'H'),
  ('11111111-1111-1111-1111-111111111111', 'CPV', 'Cap-Vert',             'H'),
  ('11111111-1111-1111-1111-111111111111', 'KSA', 'Arabie Saoudite',      'H'),
  ('11111111-1111-1111-1111-111111111111', 'URU', 'Uruguay',              'H'),
  -- Groupe I
  ('11111111-1111-1111-1111-111111111111', 'FRA', 'France',               'I'),
  ('11111111-1111-1111-1111-111111111111', 'SEN', 'Sénégal',              'I'),
  ('11111111-1111-1111-1111-111111111111', 'IRQ', 'Irak',                 'I'),
  ('11111111-1111-1111-1111-111111111111', 'NOR', 'Norvège',              'I'),
  -- Groupe J
  ('11111111-1111-1111-1111-111111111111', 'ARG', 'Argentine',            'J'),
  ('11111111-1111-1111-1111-111111111111', 'ALG', 'Algérie',              'J'),
  ('11111111-1111-1111-1111-111111111111', 'AUT', 'Autriche',             'J'),
  ('11111111-1111-1111-1111-111111111111', 'JOR', 'Jordanie',             'J'),
  -- Groupe K
  ('11111111-1111-1111-1111-111111111111', 'POR', 'Portugal',             'K'),
  ('11111111-1111-1111-1111-111111111111', 'COD', 'RD Congo',             'K'),
  ('11111111-1111-1111-1111-111111111111', 'UZB', 'Ouzbékistan',          'K'),
  ('11111111-1111-1111-1111-111111111111', 'COL', 'Colombie',             'K'),
  -- Groupe L
  ('11111111-1111-1111-1111-111111111111', 'ENG', 'Angleterre',           'L'),
  ('11111111-1111-1111-1111-111111111111', 'CRO', 'Croatie',              'L'),
  ('11111111-1111-1111-1111-111111111111', 'GHA', 'Ghana',                'L'),
  ('11111111-1111-1111-1111-111111111111', 'PAN', 'Panama',               'L')
on conflict (competition_id, code) do nothing;
