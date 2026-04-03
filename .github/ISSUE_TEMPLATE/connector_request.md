---
name: Connector Request
about: Request a new AI tool integration/connector for nautalis
title: "[CONNECTOR] "
labels: connector, enhancement
assignees: ""
---

## Tool Information

- **Tool Name**: [e.g. Linear, Figma, Jira]
- **Tool Website**: [URL to the tool]
- **Current Version**: [e.g. API v2, latest as of 2024-01]
- **Category**: [e.g. Project Management, Design, Communication, Code Repository, CRM]

## Data Sources Available

List the data sources/endpoints the tool exposes that would be valuable for AI memory:

- [ ] Documents/Files
- [ ] Messages/Conversations
- [ ] Tasks/Issues
- [ ] Calendar Events
- [ ] Contacts/Users
- [ ] Media/Assets
- [ ] Other: [describe]

## Hook/API Availability

- **REST API**: [Yes/No — link to docs]
- **GraphQL API**: [Yes/No — link to docs]
- **Webhooks**: [Yes/No — link to docs]
- **WebSocket/Real-time**: [Yes/No — link to docs]
- **OAuth Support**: [Yes/No — OAuth 2.0 / OAuth 1.0a]
- **API Rate Limits**: [describe if known]

## Integration Method

How should this connector integrate with nautalis?

- [ ] **Memory Store** — Store tool data in nautalis memory for AI context
- [ ] **Action Executor** — Allow AI agents to perform actions in the tool
- [ ] **Event Listener** — React to webhooks/events from the tool
- [ ] **Search Provider** — Enable semantic search across tool data
- [ ] **Other**: [describe]

## Priority & Use Cases

### Why is this connector important?

Describe the primary use cases and why this integration would be valuable.

### Who would benefit?

[e.g. Engineering teams, designers, product managers, all users]

## Additional Context

### Existing SDKs/Libraries

Are there existing TypeScript/JavaScript SDKs for this tool?

- [Official SDK](link)
- [Community SDK](link)
- None known

### Authentication Requirements

Describe any special authentication requirements (API keys, OAuth scopes, etc.).

### References

- API Documentation: [URL]
- Webhook Documentation: [URL]
- Authentication Guide: [URL]

## Willing to Contribute

- [ ] I'm willing to help build this connector
- [ ] I have access to the tool's API for development
- [ ] I can provide test credentials/sandbox access
