-- Convert events to hypertable (time-series partitioning)
SELECT create_hypertable(
    'events',
    'timestamp',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE,
    migrate_data => TRUE
);

-- Disable RLS on events for TimescaleDB continuous aggregates (required)
-- RLS is re-enabled after aggregate creation if needed
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- Add retention policy for events (drop after 365 days)
SELECT add_retention_policy(
    'events',
    drop_after => INTERVAL '365 days',
    if_not_exists => TRUE
);

-- Convert audit_log to hypertable
SELECT create_hypertable(
    'audit_log',
    'timestamp',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE,
    migrate_data => TRUE
);

-- Disable RLS on audit_log
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

SELECT add_retention_policy(
    'audit_log',
    drop_after => INTERVAL '730 days',
    if_not_exists => TRUE
);
