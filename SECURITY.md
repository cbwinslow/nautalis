# Security Policy

## Supported Versions

The following versions of nautalis are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

We strongly recommend using the latest stable version to benefit from the most recent security patches.

## Reporting a Vulnerability

We take the security of nautalis seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do NOT report security vulnerabilities through public GitHub issues.**

### How to Report

1. **Email**: Send a detailed report to [security@nautalis.dev](mailto:security@nautalis.dev)
2. **Subject line**: `[SECURITY] Brief description of the vulnerability`
3. **Include the following information**:
   - Type of vulnerability
   - Full path of source file(s) affected
   - Step-by-step instructions to reproduce
   - Impact assessment
   - Suggested fix (if any)
   - Your contact information for follow-up

### What to Expect

- **Acknowledgment**: Within **48 hours** of receiving your report
- **Initial assessment**: Within **5 business days**
- **Status updates**: Every **5 business days** until resolution
- **Fix timeline**: Critical vulnerabilities within **7 days**, others within **30 days**

### Disclosure Policy

- We will confirm receipt of your vulnerability report
- We will investigate and keep you informed of progress
- We will notify you when the issue is resolved
- We will credit you in the release notes (unless you prefer to remain anonymous)
- We request that you keep the vulnerability confidential until a fix is released

### Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services
- Only interact with accounts you own or with explicit permission of the account holder
- Do not exploit a security vulnerability beyond what is necessary to demonstrate it
- Do not exfiltrate or share sensitive data from production systems
- Report the vulnerability to us promptly

## Security Best Practices for Contributors

When contributing to nautalis, please follow these security guidelines:

### Secrets Management

- **Never** commit secrets, API keys, tokens, or credentials to the repository
- Use environment variables or `.env` files (which must be in `.gitignore`)
- Use secret scanning tools before committing

### Dependency Security

- Keep dependencies up to date
- Run `bun audit` regularly to check for known vulnerabilities
- Review dependency changes carefully in PRs

### Code Review

- All code changes must go through pull request review
- Security-sensitive changes require additional review from core maintainers
- Enable branch protection rules on main branches

### Connector Security

When building connectors:

- Validate and sanitize all input from external APIs
- Never log sensitive data (tokens, API keys, PII)
- Implement proper authentication handling
- Respect rate limits and implement retry logic
- Use HTTPS for all external communications

## Security Features

Nautalis includes the following security features:

- **Memory encryption** at rest for sensitive data
- **Token management** with automatic rotation support
- **Audit logging** for all agent actions
- **Access control** for connector configurations
- **Input validation** on all external data sources

## Contact

- **Security email**: [security@nautalis.dev](mailto:security@nautalis.dev)
- **General inquiries**: [hello@nautalis.dev](mailto:hello@nautalis.dev)
- **GitHub Security Advisories**: Enable notifications in your repository settings
