# Security

| Area | Measure |
|------|---------|
| Secrets | `GEMINI_API_KEY` is read from the environment on the server only, sent in the `x-goog-api-key` header (never in a URL), and never reaches the browser. `.env` is git-ignored. |
| Input | Allow-list validation for every field (`src/validate.js`): enums, numeric ranges, length caps, control characters stripped, city names restricted to letters, digits and basic punctuation. |
| Output / XSS | The frontend never uses `innerHTML`; server and AI text is rendered with `textContent`. Gemini output is parsed as JSON, length-capped and shape-checked before use. |
| CSP | `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'`. No inline scripts or styles exist. |
| Headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP/CORP. |
| AI output | Gemini output is parsed as JSON, shape-checked, length-capped and enum-checked; unsafe advice (ozone generators, indoor burning, dosages, diagnoses) is filtered; the guaranteed Safety essentials block is rules-based and independent of the model; CO2 figures are computed locally and never taken from the model. |
| Prompt injection | User notes are passed to the model as JSON data inside the prompt, and the system prompt instructs the model to treat them as untrusted data. The UI only ever shows validated, capped fields. |
| Abuse | 30 requests/min/IP rate limit, 16 KB body cap, request/header timeouts, bounded caches and limiter tables. Proxy IP trust is explicit (`TRUST_PROXY_HOPS`). |
| Static serving | Only an allow-list of files loaded at start-up can be served, so path traversal is impossible. |
| Privacy | No accounts, cookies, analytics or database. Location is used for one air-quality lookup and not stored or logged. |
| Dependencies | Zero runtime dependencies, so there is no third-party supply-chain surface. |
| Failure modes | Every upstream (geocoder, air data, Gemini) has a timeout and a graceful fallback. |

Report vulnerabilities by opening a private security advisory on the repository.
