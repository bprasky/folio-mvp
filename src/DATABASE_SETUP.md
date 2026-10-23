# Database setup

The current application setup instructions are in the [development guide](../docs/DEVELOPMENT.md). Database changes follow the [migration guide](../prisma/README.md).

The earlier JSON-to-PostgreSQL bootstrap instructions in this file are obsolete. Use a separate development database prepared for the current schema and keep connection strings in git-ignored environment files. Do not run historical setup, seed, or schema-push scripts against production.
