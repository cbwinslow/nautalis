-- Telemetry table for OpenTelemetry data (traces, metrics, logs)
CREATE TABLE telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Signal type
    signal_type VARCHAR(20) NOT NULL,  -- 'trace', 'metric', 'log'
    
    -- Trace data
    trace_id VARCHAR(64),
    span_id VARCHAR(32),
    parent_span_id VARCHAR(32),
    
    -- Span/metric/log data
    name VARCHAR(500),
    kind VARCHAR(50),
    status VARCHAR(20),
    
    -- Attributes
    attributes JSONB,
    resource_attributes JSONB,
    
    -- Numeric data (for metrics)
    value DOUBLE PRECISION,
    unit VARCHAR(50),
    
    -- Text data (for logs)
    message TEXT,
    severity_number INTEGER,
    severity_text VARCHAR(20),
    
    -- Timing
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_ms DOUBLE PRECISION GENERATED ALWAYS AS (
        CASE WHEN end_time IS NOT NULL AND start_time IS NOT NULL
        THEN EXTRACT(EPOCH FROM (end_time - start_time)) * 1000
        ELSE NULL END
    ) STORED,
    
    -- Timestamp
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to hypertable
SELECT create_hypertable(
    'telemetry',
    'timestamp',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

SELECT add_compression_policy(
    'telemetry',
    compress_after => INTERVAL '7 days',
    if_not_exists => TRUE
);

SELECT add_retention_policy(
    'telemetry',
    drop_after => INTERVAL '90 days',
    if_not_exists => TRUE
);

-- Indexes
CREATE INDEX idx_telemetry_team ON telemetry(team_id);
CREATE INDEX idx_telemetry_signal ON telemetry(signal_type);
CREATE INDEX idx_telemetry_trace ON telemetry(trace_id);
CREATE INDEX idx_telemetry_name ON telemetry(name);
CREATE INDEX idx_telemetry_timestamp ON telemetry(timestamp DESC);
CREATE INDEX idx_telemetry_duration ON telemetry(duration_ms) WHERE duration_ms IS NOT NULL;
