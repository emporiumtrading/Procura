-- Migration: Seed default pipeline_config in system_settings
-- This sets the pipeline to 'manual' mode by default (safest option).
-- Can be changed via Admin → Pipeline Config UI.

INSERT INTO system_settings (key, value)
VALUES (
  'pipeline_config',
  '{
    "autonomy_mode": "manual",
    "fit_threshold": 80,
    "auto_threshold": 90,
    "max_auto_value": 500000
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
