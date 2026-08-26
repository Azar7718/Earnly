# Earnly Full Demo
A small Node.js demo of a task-and-rewards platform.

Run:
1. Install Node.js.
2. Open a terminal in this folder.
3. Run: `node server.js`
4. Open: `http://localhost:3000`

Demo login can be created from the Register screen.

Included:
- Registration/login
- User wallet
- Task list and demo task completion
- Withdrawal request stored as `pending`
- JSON data storage

This is NOT production-ready for real money. Before launch, add secure password hashing, a real database, sessions/JWT with proper expiry, CSRF/rate limiting, identity/age and fraud checks where legally required, admin authentication, audit logs, privacy/terms pages, task-provider contracts, and a compliant payment provider. Never show fake balances or promise guaranteed earnings.
