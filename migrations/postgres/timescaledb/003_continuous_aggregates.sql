-- Continuous aggregate: daily event counts by type
CREATE MATERIALIZED VIEW events_daily_stats
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', timestamp) AS bucket,
    team_id,
    event_type,
    COUNT(*) AS event_count,
    COUNT(DISTINCT session_id) AS session_count,
    COUNT(DISTINCT agent_id) AS agent_count,
    AVG(duration_ms) AS avg_duration_ms,
    COUNT(*) FILTER (WHERE exit_code != 0) AS error_count
FROM events
GROUP BY bucket, team_id, event_type
WITH NO DATA;

-- Refresh policy: every hour, look back 2 days
SELECT add_continuous_aggregate_policy(
    'events_daily_stats',
    start_offset => INTERVAL '2 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

-- Continuous aggregate: daily memory growth
CREATE MATERIALIZED VIEW memories_daily_stats
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', created_at) AS bucket,
    team_id,
    memory_type,
    COUNT(*) AS memory_count,
    AVG(importance) AS avg_importance,
    AVG(confidence) AS avg_confidence,
    COUNT(*) FILTER (WHERE is_stale = true) AS stale_count
FROM memories
GROUP BY bucket, team_id, memory_type
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'memories_daily_stats',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

-- Continuous aggregate: hourly telemetry latency
CREATE MATERIALIZED VIEW telemetry_hourly_latency
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    team_id,
    name,
    COUNT(*) AS call_count,
    AVG(duration_ms) AS avg_duration_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_ms,
    MAX(duration_ms) AS max_duration_ms
FROM telemetry
WHERE signal_type = 'trace' AND duration_ms IS NOT NULL
GROUP BY bucket, team_id, name
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'telemetry_hourly_latency',
    start_offset => INTERVAL '1 day',
    end_offset => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '15 minutes'
);
