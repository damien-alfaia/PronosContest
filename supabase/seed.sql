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

-- =============================================================
-- Sprint 3 — Mise à jour fifa_id + insertion des 72 matchs
-- =============================================================

-- Mapping des squadId FIFA officiels sur les équipes du seed.
update public.equipes e
set fifa_id = v.fifa_id
from (values
  (8, 'MEX'),
  (32, 'KOR'),
  (47, 'CZE'),
  (23, 'RSA'),
  (44, 'SUI'),
  (4, 'CAN'),
  (33, 'QAT'),
  (24, 'BIH'),
  (3, 'BRA'),
  (20, 'MAR'),
  (43, 'SCO'),
  (30, 'HAI'),
  (12, 'USA'),
  (46, 'TUR'),
  (25, 'AUS'),
  (21, 'PAR'),
  (7, 'GER'),
  (38, 'ECU'),
  (27, 'CIV'),
  (16, 'CUW'),
  (9, 'NED'),
  (19, 'JPN'),
  (35, 'SWE'),
  (45, 'TUN'),
  (2, 'BEL'),
  (31, 'IRN'),
  (17, 'EGY'),
  (40, 'NZL'),
  (11, 'ESP'),
  (48, 'URU'),
  (34, 'KSA'),
  (14, 'CPV'),
  (6, 'FRA'),
  (22, 'SEN'),
  (41, 'NOR'),
  (28, 'IRQ'),
  (1, 'ARG'),
  (26, 'AUT'),
  (13, 'ALG'),
  (39, 'JOR'),
  (10, 'POR'),
  (37, 'COL'),
  (18, 'COD'),
  (36, 'UZB'),
  (5, 'ENG'),
  (15, 'CRO'),
  (42, 'PAN'),
  (29, 'GHA')
) as v(fifa_id, code)
where e.competition_id = '11111111-1111-1111-1111-111111111111'
  and e.code = v.code;

-- Insertion des 72 matchs de phase de groupes.
-- Jointure sur equipes via competition_id + fifa_id pour
-- retrouver l'uuid généré (pas de dépendance à un UUID fixe).
insert into public.matchs
  (competition_id, fifa_match_id, phase, round, kick_off_at,
   venue_name, equipe_a_id, equipe_b_id)
select
  '11111111-1111-1111-1111-111111111111'::uuid,
  v.fifa_match_id,
  'groupes',
  v.round,
  v.kick_off_at,
  v.venue_name,
  ea.id,
  eb.id
from (values
  (2, 1, '2026-06-11 19:00:00+00'::timestamptz, 'Mexico City Stadium', 8, 23),
  (56, 1, '2026-06-12 02:00:00+00'::timestamptz, 'Guadalajara Stadium', 32, 47),
  (60, 1, '2026-06-12 19:00:00+00'::timestamptz, 'Toronto Stadium', 4, 24),
  (13, 1, '2026-06-13 01:00:00+00'::timestamptz, 'Los Angeles Stadium', 12, 21),
  (4, 1, '2026-06-13 19:00:00+00'::timestamptz, 'San Francisco Bay Area Stadium', 33, 44),
  (11, 1, '2026-06-13 22:00:00+00'::timestamptz, 'New York/New Jersey Stadium', 3, 20),
  (8, 1, '2026-06-14 01:00:00+00'::timestamptz, 'Boston Stadium', 30, 43),
  (63, 1, '2026-06-14 04:00:00+00'::timestamptz, 'BC Place Vancouver', 25, 46),
  (16, 1, '2026-06-14 17:00:00+00'::timestamptz, 'Houston Stadium', 7, 16),
  (22, 1, '2026-06-14 20:00:00+00'::timestamptz, 'Dallas Stadium', 9, 19),
  (19, 1, '2026-06-14 23:00:00+00'::timestamptz, 'Philadelphia Stadium', 27, 38),
  (66, 1, '2026-06-15 02:00:00+00'::timestamptz, 'Monterrey Stadium', 35, 45),
  (32, 1, '2026-06-15 16:00:00+00'::timestamptz, 'Atlanta Stadium', 11, 14),
  (28, 1, '2026-06-15 19:00:00+00'::timestamptz, 'Seattle Stadium', 2, 17),
  (35, 1, '2026-06-15 22:00:00+00'::timestamptz, 'Miami Stadium', 34, 48),
  (25, 1, '2026-06-16 01:00:00+00'::timestamptz, 'Los Angeles Stadium', 31, 40),
  (38, 1, '2026-06-16 19:00:00+00'::timestamptz, 'New York/New Jersey Stadium', 6, 22),
  (67, 1, '2026-06-16 22:00:00+00'::timestamptz, 'Boston Stadium', 28, 41),
  (43, 1, '2026-06-17 01:00:00+00'::timestamptz, 'Kansas City Stadium', 1, 13),
  (45, 1, '2026-06-17 04:00:00+00'::timestamptz, 'San Francisco Bay Area Stadium', 26, 39),
  (72, 1, '2026-06-17 17:00:00+00'::timestamptz, 'Houston Stadium', 10, 18),
  (50, 1, '2026-06-17 20:00:00+00'::timestamptz, 'Dallas Stadium', 5, 15),
  (53, 1, '2026-06-17 23:00:00+00'::timestamptz, 'Toronto Stadium', 29, 42),
  (47, 1, '2026-06-18 02:00:00+00'::timestamptz, 'Mexico City Stadium', 36, 37),
  (55, 2, '2026-06-18 16:00:00+00'::timestamptz, 'Atlanta Stadium', 47, 23),
  (58, 2, '2026-06-18 19:00:00+00'::timestamptz, 'Los Angeles Stadium', 44, 24),
  (5, 2, '2026-06-18 22:00:00+00'::timestamptz, 'BC Place Vancouver', 4, 33),
  (1, 2, '2026-06-19 01:00:00+00'::timestamptz, 'Guadalajara Stadium', 8, 32),
  (15, 2, '2026-06-19 19:00:00+00'::timestamptz, 'Seattle Stadium', 12, 25),
  (9, 2, '2026-06-19 22:00:00+00'::timestamptz, 'Boston Stadium', 43, 20),
  (12, 2, '2026-06-20 01:00:00+00'::timestamptz, 'Philadelphia Stadium', 3, 30),
  (62, 2, '2026-06-20 04:00:00+00'::timestamptz, 'San Francisco Bay Area Stadium', 46, 21),
  (65, 2, '2026-06-20 17:00:00+00'::timestamptz, 'Houston Stadium', 9, 35),
  (21, 2, '2026-06-20 20:00:00+00'::timestamptz, 'Toronto Stadium', 7, 27),
  (17, 2, '2026-06-21 00:00:00+00'::timestamptz, 'Kansas City Stadium', 38, 16),
  (24, 2, '2026-06-21 04:00:00+00'::timestamptz, 'Monterrey Stadium', 45, 19),
  (31, 2, '2026-06-21 16:00:00+00'::timestamptz, 'Atlanta Stadium', 11, 34),
  (26, 2, '2026-06-21 19:00:00+00'::timestamptz, 'Los Angeles Stadium', 2, 31),
  (36, 2, '2026-06-21 22:00:00+00'::timestamptz, 'Miami Stadium', 48, 14),
  (29, 2, '2026-06-22 01:00:00+00'::timestamptz, 'BC Place Vancouver', 40, 17),
  (41, 2, '2026-06-22 17:00:00+00'::timestamptz, 'Dallas Stadium', 1, 26),
  (68, 2, '2026-06-22 21:00:00+00'::timestamptz, 'Philadelphia Stadium', 6, 28),
  (39, 2, '2026-06-23 00:00:00+00'::timestamptz, 'New York/New Jersey Stadium', 41, 22),
  (44, 2, '2026-06-23 03:00:00+00'::timestamptz, 'San Francisco Bay Area Stadium', 39, 13),
  (46, 2, '2026-06-23 17:00:00+00'::timestamptz, 'Houston Stadium', 10, 36),
  (49, 2, '2026-06-23 20:00:00+00'::timestamptz, 'Boston Stadium', 5, 29),
  (54, 2, '2026-06-23 23:00:00+00'::timestamptz, 'Toronto Stadium', 42, 15),
  (71, 2, '2026-06-24 02:00:00+00'::timestamptz, 'Guadalajara Stadium', 37, 18),
  (6, 3, '2026-06-24 19:00:00+00'::timestamptz, 'BC Place Vancouver', 44, 4),
  (59, 3, '2026-06-24 19:00:00+00'::timestamptz, 'Seattle Stadium', 24, 33),
  (7, 3, '2026-06-24 22:00:00+00'::timestamptz, 'Atlanta Stadium', 20, 30),
  (10, 3, '2026-06-24 22:00:00+00'::timestamptz, 'Miami Stadium', 43, 3),
  (3, 3, '2026-06-25 01:00:00+00'::timestamptz, 'Monterrey Stadium', 23, 32),
  (57, 3, '2026-06-25 01:00:00+00'::timestamptz, 'Mexico City Stadium', 47, 8),
  (18, 3, '2026-06-25 20:00:00+00'::timestamptz, 'New York/New Jersey Stadium', 38, 7),
  (20, 3, '2026-06-25 20:00:00+00'::timestamptz, 'Philadelphia Stadium', 16, 27),
  (23, 3, '2026-06-25 23:00:00+00'::timestamptz, 'Kansas City Stadium', 45, 9),
  (64, 3, '2026-06-25 23:00:00+00'::timestamptz, 'Dallas Stadium', 19, 35),
  (14, 3, '2026-06-26 02:00:00+00'::timestamptz, 'San Francisco Bay Area Stadium', 21, 25),
  (61, 3, '2026-06-26 02:00:00+00'::timestamptz, 'Los Angeles Stadium', 46, 12),
  (37, 3, '2026-06-26 19:00:00+00'::timestamptz, 'Boston Stadium', 41, 6),
  (69, 3, '2026-06-26 19:00:00+00'::timestamptz, 'Toronto Stadium', 22, 28),
  (33, 3, '2026-06-27 00:00:00+00'::timestamptz, 'Guadalajara Stadium', 48, 11),
  (34, 3, '2026-06-27 00:00:00+00'::timestamptz, 'Houston Stadium', 14, 34),
  (27, 3, '2026-06-27 03:00:00+00'::timestamptz, 'Seattle Stadium', 17, 31),
  (30, 3, '2026-06-27 03:00:00+00'::timestamptz, 'BC Place Vancouver', 40, 2),
  (51, 3, '2026-06-27 21:00:00+00'::timestamptz, 'New York/New Jersey Stadium', 42, 5),
  (52, 3, '2026-06-27 21:00:00+00'::timestamptz, 'Philadelphia Stadium', 15, 29),
  (48, 3, '2026-06-27 23:30:00+00'::timestamptz, 'Miami Stadium', 37, 10),
  (70, 3, '2026-06-27 23:30:00+00'::timestamptz, 'Atlanta Stadium', 18, 36),
  (40, 3, '2026-06-28 02:00:00+00'::timestamptz, 'Dallas Stadium', 39, 1),
  (42, 3, '2026-06-28 02:00:00+00'::timestamptz, 'Kansas City Stadium', 13, 26)
) as v(fifa_match_id, round, kick_off_at, venue_name, home_fifa_id, away_fifa_id)
join public.equipes ea on ea.competition_id = '11111111-1111-1111-1111-111111111111' and ea.fifa_id = v.home_fifa_id
join public.equipes eb on eb.competition_id = '11111111-1111-1111-1111-111111111111' and eb.fifa_id = v.away_fifa_id
on conflict (competition_id, fifa_match_id) do nothing;

-- ============================================================
--  Sprint 5 — Placeholders KO (Round of 32 → Finale)
-- ============================================================
--
--  32 matchs d'élimination directe seedés SANS équipes
--  (equipe_a_id = NULL, equipe_b_id = NULL). L'admin remplira les
--  équipes au fil des qualifications via la page /app/admin/matchs.
--
--  Planning FIFA 2026 :
--    - Round of 32 (seiziemes) : 28 juin → 3 juillet 2026 — 16 matchs
--    - Round of 16 (huitiemes) : 4 → 7 juillet 2026 — 8 matchs
--    - Quarts                   : 9 → 11 juillet 2026 — 4 matchs
--    - Demis                    : 14 → 15 juillet 2026 — 2 matchs
--    - Petite finale            : 18 juillet 2026 — 1 match
--    - Finale                   : 19 juillet 2026 — 1 match (MetLife)
--
--  Les horaires et stades sont approximatifs (dispatch raisonnable
--  sur les 16 sites FIFA WC 2026). L'admin peut les corriger au
--  cas par cas via l'UI admin. Le fifa_match_id continue la
--  numérotation des groupes : 73..104.
--
--  `round` est null pour tous les KO (pas de notion de journée dans
--  une phase à élimination directe).
--
-- ============================================================

insert into public.matchs
  (competition_id, fifa_match_id, phase, round, kick_off_at,
   venue_name, equipe_a_id, equipe_b_id)
select
  '11111111-1111-1111-1111-111111111111'::uuid,
  v.fifa_match_id,
  v.phase,
  null::smallint,
  v.kick_off_at,
  v.venue_name,
  null::uuid,
  null::uuid
from (values
  -- ---------- Round of 32 (16 matchs, 28 juin → 3 juillet) ----------
  (73,  'seiziemes',     '2026-06-28 16:00:00+00'::timestamptz, 'Philadelphia Stadium'),
  (74,  'seiziemes',     '2026-06-28 20:00:00+00'::timestamptz, 'Dallas Stadium'),
  (75,  'seiziemes',     '2026-06-29 00:00:00+00'::timestamptz, 'Atlanta Stadium'),
  (76,  'seiziemes',     '2026-06-29 16:00:00+00'::timestamptz, 'Mexico City Stadium'),
  (77,  'seiziemes',     '2026-06-29 20:00:00+00'::timestamptz, 'Boston Stadium'),
  (78,  'seiziemes',     '2026-06-30 00:00:00+00'::timestamptz, 'Seattle Stadium'),
  (79,  'seiziemes',     '2026-06-30 16:00:00+00'::timestamptz, 'Houston Stadium'),
  (80,  'seiziemes',     '2026-06-30 20:00:00+00'::timestamptz, 'New York/New Jersey Stadium'),
  (81,  'seiziemes',     '2026-07-01 00:00:00+00'::timestamptz, 'Los Angeles Stadium'),
  (82,  'seiziemes',     '2026-07-01 20:00:00+00'::timestamptz, 'Toronto Stadium'),
  (83,  'seiziemes',     '2026-07-02 00:00:00+00'::timestamptz, 'Monterrey Stadium'),
  (84,  'seiziemes',     '2026-07-02 20:00:00+00'::timestamptz, 'Guadalajara Stadium'),
  (85,  'seiziemes',     '2026-07-03 00:00:00+00'::timestamptz, 'BC Place Vancouver'),
  (86,  'seiziemes',     '2026-07-03 16:00:00+00'::timestamptz, 'Kansas City Stadium'),
  (87,  'seiziemes',     '2026-07-03 20:00:00+00'::timestamptz, 'Miami Stadium'),
  (88,  'seiziemes',     '2026-07-04 00:00:00+00'::timestamptz, 'San Francisco Bay Area Stadium'),

  -- ---------- Round of 16 (8 matchs, 4 → 7 juillet) ----------
  (89,  'huitiemes',     '2026-07-04 20:00:00+00'::timestamptz, 'Philadelphia Stadium'),
  (90,  'huitiemes',     '2026-07-05 00:00:00+00'::timestamptz, 'Atlanta Stadium'),
  (91,  'huitiemes',     '2026-07-05 20:00:00+00'::timestamptz, 'Boston Stadium'),
  (92,  'huitiemes',     '2026-07-06 00:00:00+00'::timestamptz, 'Dallas Stadium'),
  (93,  'huitiemes',     '2026-07-06 20:00:00+00'::timestamptz, 'Los Angeles Stadium'),
  (94,  'huitiemes',     '2026-07-07 00:00:00+00'::timestamptz, 'New York/New Jersey Stadium'),
  (95,  'huitiemes',     '2026-07-07 20:00:00+00'::timestamptz, 'Houston Stadium'),
  (96,  'huitiemes',     '2026-07-08 00:00:00+00'::timestamptz, 'Mexico City Stadium'),

  -- ---------- Quarts (4 matchs, 9 → 11 juillet) ----------
  (97,  'quarts',        '2026-07-09 20:00:00+00'::timestamptz, 'Boston Stadium'),
  (98,  'quarts',        '2026-07-10 00:00:00+00'::timestamptz, 'Los Angeles Stadium'),
  (99,  'quarts',        '2026-07-11 20:00:00+00'::timestamptz, 'Kansas City Stadium'),
  (100, 'quarts',        '2026-07-12 00:00:00+00'::timestamptz, 'Miami Stadium'),

  -- ---------- Demis (2 matchs, 14 → 15 juillet) ----------
  (101, 'demis',         '2026-07-14 20:00:00+00'::timestamptz, 'Dallas Stadium'),
  (102, 'demis',         '2026-07-15 20:00:00+00'::timestamptz, 'Atlanta Stadium'),

  -- ---------- Petite finale (1 match, 18 juillet) ----------
  (103, 'petite_finale', '2026-07-18 20:00:00+00'::timestamptz, 'Miami Stadium'),

  -- ---------- Finale (1 match, 19 juillet, MetLife) ----------
  (104, 'finale',        '2026-07-19 19:00:00+00'::timestamptz, 'New York/New Jersey Stadium')
) as v(fifa_match_id, phase, kick_off_at, venue_name)
on conflict (competition_id, fifa_match_id) do nothing;
