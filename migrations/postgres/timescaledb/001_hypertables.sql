-- Convert events to hypertable (time-series partitioning)
SELECT create_hypertable(
    'events',
    'timestamp',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Add compression policy for events (compress after 30 days)
SELECT add_compression_policy(
    'events',
    compress_after => INTERVAL '30 days',
    if_not_exists => TRUE
);

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
    if_not_exists => TRUE
);

SELECT add_compression_policy(
    'audit_log',
    compress_after => INTERVAL '30 days',
    if_not_exists => TRUE
);

SELECT add_retention_policy(
    'audit_log',
    drop_after => INTERVAL '730 days',
    if_not_exists => TRUE
);
