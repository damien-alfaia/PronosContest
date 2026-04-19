-- ============================================================
--  PronosticsContest v2 — seed
-- ============================================================
--  Joué par `supabase db reset`.
--
--  Sprint 2 : FIFA World Cup 2026 (USA / Canada / Mexico)
--    - 48 équipes, 12 groupes (A-L) de 4.
--    - La composition des groupes est PROVISOIRE (draw officiel
--      non encore injecté). Ordre alphabétique pour l'instant.
--    - Qualifiés supposés connus au 2026-04 : hôtes + qualifiés
--      UEFA/CONMEBOL/AFC/CAF/CONCACAF/OFC + 2 play-offs placeholders.
--  À réalimenter côté admin via UI quand les données officielles sont dispo.
-- ============================================================

-- On travaille sur un id déterministe pour pouvoir re-seed proprement
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

-- 48 équipes (codes FIFA à 3 lettres, groupes placeholder A-L).
insert into public.equipes (competition_id, code, nom, groupe)
values
  -- Groupe A
  ('11111111-1111-1111-1111-111111111111', 'ALG', 'Algérie',     'A'),
  ('11111111-1111-1111-1111-111111111111', 'ARG', 'Argentine',   'A'),
  ('11111111-1111-1111-1111-111111111111', 'AUS', 'Australie',   'A'),
  ('11111111-1111-1111-1111-111111111111', 'AUT', 'Autriche',    'A'),
  -- Groupe B
  ('11111111-1111-1111-1111-111111111111', 'BEL', 'Belgique',    'B'),
  ('11111111-1111-1111-1111-111111111111', 'BOL', 'Bolivie',     'B'),
  ('11111111-1111-1111-1111-111111111111', 'BRA', 'Brésil',      'B'),
  ('11111111-1111-1111-1111-111111111111', 'CMR', 'Cameroun',    'B'),
  -- Groupe C
  ('11111111-1111-1111-1111-111111111111', 'CAN', 'Canada',      'C'),
  ('11111111-1111-1111-1111-111111111111', 'COL', 'Colombie',    'C'),
  ('11111111-1111-1111-1111-111111111111', 'CRC', 'Costa Rica',  'C'),
  ('11111111-1111-1111-1111-111111111111', 'CRO', 'Croatie',     'C'),
  -- Groupe D
  ('11111111-1111-1111-1111-111111111111', 'DEN', 'Danemark',    'D'),
  ('11111111-1111-1111-1111-111111111111', 'ECU', 'Équateur',    'D'),
  ('11111111-1111-1111-1111-111111111111', 'EGY', 'Égypte',      'D'),
  ('11111111-1111-1111-1111-111111111111', 'ENG', 'Angleterre',  'D'),
  -- Groupe E
  ('11111111-1111-1111-1111-111111111111', 'FRA', 'France',      'E'),
  ('11111111-1111-1111-1111-111111111111', 'GER', 'Allemagne',   'E'),
  ('11111111-1111-1111-1111-111111111111', 'GHA', 'Ghana',       'E'),
  ('11111111-1111-1111-1111-111111111111', 'IRN', 'Iran',        'E'),
  -- Groupe F
  ('11111111-1111-1111-1111-111111111111', 'IRQ', 'Irak',        'F'),
  ('11111111-1111-1111-1111-111111111111', 'ITA', 'Italie',      'F'),
  ('11111111-1111-1111-1111-111111111111', 'CIV', 'Côte d''Ivoire', 'F'),
  ('11111111-1111-1111-1111-111111111111', 'JAM', 'Jamaïque',    'F'),
  -- Groupe G
  ('11111111-1111-1111-1111-111111111111', 'JPN', 'Japon',       'G'),
  ('11111111-1111-1111-1111-111111111111', 'MEX', 'Mexique',     'G'),
  ('11111111-1111-1111-1111-111111111111', 'MAR', 'Maroc',       'G'),
  ('11111111-1111-1111-1111-111111111111', 'NED', 'Pays-Bas',    'G'),
  -- Groupe H
  ('11111111-1111-1111-1111-111111111111', 'NZL', 'Nouvelle-Zélande', 'H'),
  ('11111111-1111-1111-1111-111111111111', 'NGA', 'Nigeria',     'H'),
  ('11111111-1111-1111-1111-111111111111', 'PAN', 'Panama',      'H'),
  ('11111111-1111-1111-1111-111111111111', 'PAR', 'Paraguay',    'H'),
  -- Groupe I
  ('11111111-1111-1111-1111-111111111111', 'POL', 'Pologne',     'I'),
  ('11111111-1111-1111-1111-111111111111', 'POR', 'Portugal',    'I'),
  ('11111111-1111-1111-1111-111111111111', 'QAT', 'Qatar',       'I'),
  ('11111111-1111-1111-1111-111111111111', 'KSA', 'Arabie Saoudite', 'I'),
  -- Groupe J
  ('11111111-1111-1111-1111-111111111111', 'SEN', 'Sénégal',     'J'),
  ('11111111-1111-1111-1111-111111111111', 'SRB', 'Serbie',      'J'),
  ('11111111-1111-1111-1111-111111111111', 'KOR', 'Corée du Sud','J'),
  ('11111111-1111-1111-1111-111111111111', 'ESP', 'Espagne',     'J'),
  -- Groupe K
  ('11111111-1111-1111-1111-111111111111', 'SUI', 'Suisse',      'K'),
  ('11111111-1111-1111-1111-111111111111', 'TUN', 'Tunisie',     'K'),
  ('11111111-1111-1111-1111-111111111111', 'TUR', 'Türkiye',     'K'),
  ('11111111-1111-1111-1111-111111111111', 'UAE', 'Émirats arabes unis', 'K'),
  -- Groupe L
  ('11111111-1111-1111-1111-111111111111', 'UKR', 'Ukraine',     'L'),
  ('11111111-1111-1111-1111-111111111111', 'URU', 'Uruguay',     'L'),
  ('11111111-1111-1111-1111-111111111111', 'USA', 'États-Unis',  'L'),
  ('11111111-1111-1111-1111-111111111111', 'UZB', 'Ouzbékistan', 'L')
on conflict (competition_id, code) do nothing;
