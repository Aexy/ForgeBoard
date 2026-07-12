# Change Log

This file records meaningful product, architecture, code, schema, configuration, and documentation changes. Update it whenever new code or a material design change is added.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) with an `Unreleased` section during active development.

## Update rules

- Add entries under `Added`, `Changed`, `Fixed`, `Security`, `Deprecated`, or `Removed`.
- Describe user-visible behavior or architectural impact, not individual file edits.
- Include the relevant milestone (`M0`–`M4`) when applicable.
- Record database migrations by migration identifier.
- Record material plan changes and the reason for them.
- Keep entries concise; link to deeper decision documents when needed.

## [Unreleased]

### Added

- Product and architecture baseline for LedgerFlow, targeting independent accounting firms. (`M0`)
- Milestone exit criteria and decision guardrails to prevent uncontrolled scope expansion. (`M0`)
- Change-log convention requiring updates alongside meaningful code additions. (`M0`)
- Spring Boot backend foundation with security defaults, platform metadata, PostgreSQL configuration, and module architecture verification. (`M0`)
- Initial tenancy migration `V001` for firms, users, memberships, and auditable activity events. (`M0`)
- React and TypeScript application shell presenting the first accounting workflow board. (`M0`)
- Docker Compose PostgreSQL environment and GitHub Actions verification workflows. (`M0`)

### Changed

- Chose a shared modular application core with separate REST and MCP adapters instead of independent web and MCP products. This preserves consistent permissions, validation, transactions, and audit history while allowing later deployment separation. (`M0`)

### Security

- Established tenant isolation, scoped MCP tokens, auditable mutations, EU deployment, and GDPR-aware data handling as baseline requirements. (`M0`)
