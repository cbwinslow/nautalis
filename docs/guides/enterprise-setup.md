# Enterprise Setup Guide

Deploy Nautalis at enterprise scale with governance, compliance, and high availability.

## Overview

Enterprise deployment adds:

- **Managed Infrastructure** — Supabase or managed PostgreSQL
- **SSO/SAML Authentication** — Integration with identity providers
- **Audit Trails** — Complete event audit logging
- **High Availability** — Multi-node deployment with failover
- **Compliance** — Data retention, access controls, encryption
- **Scalability** — Horizontal scaling for large teams

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Enterprise Infrastructure              │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Kubernetes Cluster                     │  │
│  │                                                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │  │
│  │  │ Nautalis    │  │ Nautalis    │  │ Nautalis   │  │  │
│  │  │ API Server  │  │ Worker      │  │ MCP Server │  │  │
│  │  │ (x3)        │  │ (x2)        │  │ (x2)       │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │  │
│  │         │                │                │         │  │
│  │         └────────────────┼────────────────┘         │  │
│  │                          │                          │  │
│  │  ┌───────────────────────▼───────────────────────┐  │  │
│  │  │              Supabase / PostgreSQL             │  │  │
│  │  │              (Managed, HA)                     │  │  │
│  │  └───────────────────────────────────────────────┘  │  │
│  │                                                      │  │
│  │  ┌───────────────────────────────────────────────┐  │  │
│  │  │              OTLP Collector                    │  │  │
│  │  │              → Grafana / Tempo                 │  │  │
│  │  └───────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Embeddings: OpenAI API / Cohere / Self-hosted vLLM       │
│  Auth: SSO / SAML / OIDC                                  │
│  Audit: Full event audit trail                            │
└──────────────────────────────────────────────────────────┘
```

## Step 1: Infrastructure Setup

### Supabase (Recommended)

1. Create a Supabase project at https://supabase.com
2. Enable pgvector in the SQL Editor
3. Configure Row Level Security policies
4. Set up SSO/SAML in Authentication settings

### Self-Hosted PostgreSQL

```yaml
# kubernetes/postgres-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: pgvector/pgvector:pg16
          env:
            - name: POSTGRES_DB
              value: nautalis
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: nautalis-secrets
                  key: postgres-user
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: nautalis-secrets
                  key: postgres-password
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 100Gi
```

## Step 2: Configuration

```toml
# nautalis.toml — Enterprise configuration
[general]
dataDir = "/var/lib/nautalis"
logLevel = "warn"

[storage]
backend = "supabase"

[storage.supabase]
url = "${SUPABASE_URL}"
apiKey = "${SUPABASE_API_KEY}"
serviceRoleKey = "${SUPABASE_SERVICE_ROLE_KEY}"
enableRls = true
enableRealtime = true
poolMode = "transaction"

[embeddings]
provider = "openai"
model = "text-embedding-3-large"
apiKey = "${OPENAI_API_KEY}"
dimensions = 3072
batchSize = 100

[telemetry]
enabled = true
serviceName = "nautalis-prod"
environment = "production"

[telemetry.traces]
exporter = "otlp"
endpoint = "http://otel-collector:4318"
sampleRate = 0.1

[telemetry.logs]
exporter = "otlp"

[telemetry.metrics]
exporter = "otlp"
interval = 30000

[telemetry.benchmarks]
enabled = true
outputPath = "/var/lib/nautalis/benchmarks"

[server]
host = "0.0.0.0"
port = 8080
corsOrigins = ["https://nautalis.company.com"]
maxRequestSize = "10mb"

[server.auth]
enabled = true
authProvider = "saml"

[server.auth.saml]
entryPoint = "${SAML_ENTRY_POINT}"
issuer = "${SAML_ISSUER}"
cert = "${SAML_CERT}"

[mcp]
enabled = true
port = 3456
transport = "streamable-http"

[team]
enabled = true
projectId = "enterprise-project"
teamName = "Engineering Organization"

[team.conflictDetection]
enabled = true
sensitivity = "high"
notifyOnConflict = true

[team.activityFeed]
enabled = true
maxAge = "30d"

[compliance]
auditEnabled = true
auditRetention = "365d"
dataEncryption = true
encryptionKey = "${ENCRYPTION_KEY}"
piiDetection = true
autoRedact = true
```

## Step 3: Database Setup

Run the enterprise migration:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create audit table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for audit queries
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Create team-based policies
CREATE POLICY "Team members can read memories"
  ON memories FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM team_members
    WHERE team_id = memories.project_id
    AND status = 'active'
  ));

CREATE POLICY "Team members can write memories"
  ON memories FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM team_members
    WHERE team_id = memories.project_id
    AND status = 'active'
  ));

-- Admin-only policy for audit log
CREATE POLICY "Admins can read audit log"
  ON audit_log FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM team_members
    WHERE role = 'admin'
  ));
```

## Step 4: Deploy to Kubernetes

```yaml
# kubernetes/nautalis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nautalis-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nautalis-api
  template:
    metadata:
      labels:
        app: nautalis-api
    spec:
      containers:
        - name: nautalis
          image: nautalis/orchestrator:latest
          ports:
            - containerPort: 8080
            - containerPort: 3456
          env:
            - name: NAUTALIS_STORAGE_BACKEND
              value: "supabase"
            - name: NAUTALIS_STORAGE_SUPABASE_URL
              valueFrom:
                secretKeyRef:
                  name: nautalis-secrets
                  key: supabase-url
            - name: NAUTALIS_STORAGE_SUPABASE_SERVICE_ROLE_KEY
              valueFrom:
                secretKeyRef:
                  name: nautalis-secrets
                  key: supabase-service-role-key
            - name: NAUTALIS_EMBEDDINGS_PROVIDER
              value: "openai"
            - name: NAUTALIS_EMBEDDINGS_API_KEY
              valueFrom:
                secretKeyRef:
                  name: nautalis-secrets
                  key: openai-api-key
            - name: NAUTALIS_TELEMETRY_TRACES_ENDPOINT
              value: "http://otel-collector:4318"
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "2Gi"
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
```

```bash
# Apply Kubernetes manifests
kubectl apply -f kubernetes/

# Run migrations
kubectl exec -it deploy/nautalis-api -- nautalis db migrate

# Verify deployment
kubectl get pods -l app=nautalis-api
```

## Step 5: Configure SSO/SAML

### Supabase SAML Setup

1. Go to Supabase Dashboard → Authentication → SAML
2. Add your identity provider (Okta, Azure AD, Google Workspace, etc.)
3. Configure attribute mapping:
   - Email → `email`
   - Name → `name`
   - Groups → `groups`
4. Test SSO connection

### Environment Variables

```bash
export SAML_ENTRY_POINT="https://your-idp.com/saml/sso"
export SAML_ISSUER="nautalis-enterprise"
export SAML_CERT="-----BEGIN CERTIFICATE-----..."
```

## Step 6: Set Up Observability

### OpenTelemetry Collector

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  batch:
    timeout: 10s
    send_batch_size: 1000

exporters:
  otlphttp:
    endpoint: "https://tempo.internal:44138"
  prometheus:
    endpoint: "0.0.0.0:8889"
  logging:
    loglevel: debug

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [logging]
```

### Grafana Dashboards

Pre-built dashboards for:

- Memory ingestion rates
- Query latency percentiles
- Connector health
- Team activity overview
- Conflict detection metrics
- System resource utilization

## Step 7: Data Governance

### PII Detection and Redaction

```toml
[compliance]
piiDetection = true
autoRedact = true
piiPatterns = [
  "email",
  "phone",
  "ssn",
  "credit_card",
  "api_key",
  "password",
]
```

### Data Retention Policies

```toml
[compliance.retention]
events = "365d"
memories = "730d"
audit_log = "2555d"  # 7 years
embeddings = "730d"
```

### Access Auditing

```bash
# View audit log
nautalis audit log --since 7d

# View audit log for specific user
nautalis audit log --user alice --since 30d

# Export audit log for compliance
nautalis audit export --since 2026-01-01 --format csv --output audit-2026.csv
```

## Step 8: Monitoring and Alerting

### Health Checks

```bash
# API health
curl https://nautalis.company.com/health

# Database health
nautalis db check

# Embedding provider health
nautalis embeddings check

# Full system status
nautalis status
```

### Alerting Rules

Configure alerts for:

- Memory ingestion failure rate > 5%
- Query latency p95 > 2s
- Database connection pool exhaustion
- Embedding provider errors
- Conflict detection spikes
- Storage capacity > 80%

## Next Steps

- [Team Deployment](team-deployment.md)
- [Configuration Reference](../knowledge-base/configuration.md)
- [Troubleshooting](../knowledge-base/troubleshooting.md)
