-- ==============================================================================
-- Seed: seed.sql
-- Description: Game Catalog Seed Data
-- ==============================================================================

INSERT INTO public.games (id, slug, name, description, category, min_players, max_players, supports_spectators, is_available, thumbnail_url)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'chess',
    'Chess',
    'Classic 2-player strategic board game with real-time timers and move validation.',
    'board',
    2,
    2,
    true,
    true,
    '/thumbnails/chess.png'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'uno',
    'UNO Classic',
    'The classic fast-paced color and number matching card game for up to 4 players.',
    'card',
    2,
    4,
    true,
    true,
    '/thumbnails/uno.png'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'uno-no-mercy',
    'UNO No Mercy',
    'Brutal UNO edition with stacking penalties, wild roulette, and knockout rules.',
    'card',
    2,
    6,
    true,
    true,
    '/thumbnails/uno-no-mercy.png'
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'car-race',
    'Car Race',
    'Top-down 2D arcade physics racing with high-speed drifting and nitro boosts.',
    'racing',
    2,
    8,
    true,
    true,
    '/thumbnails/car-race.png'
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    'bike-race',
    'Bike Race',
    'Precision balance and stunt motorcycle physics racing across challenging terrain.',
    'racing',
    2,
    8,
    true,
    true,
    '/thumbnails/bike-race.png'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  min_players = EXCLUDED.min_players,
  max_players = EXCLUDED.max_players,
  supports_spectators = EXCLUDED.supports_spectators,
  is_available = EXCLUDED.is_available,
  thumbnail_url = EXCLUDED.thumbnail_url;
