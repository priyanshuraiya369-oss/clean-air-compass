# Clean Air Compass

**A GenAI-powered assistant that helps families and communities navigate severe winter smog.**
It fetches live air quality for your location, then builds a personalised plan of **low-emission daily routines**, **indoor air-quality hacks** and **sustainable alternatives**, and explains the **direct impact** of every choice.

Built for PromptWars Virtual, Challenge 6: Urban Air Quality Assistant.

## Highlights

- **Live data:** city search or device location, real-time US AQI and PM2.5 via Open-Meteo (no API key). Manual AQI fallback works offline.
- **Truly personalised:** children, elders, sensitive members, commute mode and distance, cooking fuel, heating, home type, budget, existing purifier, free-text notes.
- **Explains impact:** each action shows _why it matters_ and _your impact_ (kg CO2e per month where computable, plus an exposure-reduction rating).
- **Hybrid AI:** a deterministic rules engine guarantees safe advice; Gemini adds a personalised summary, extra tips and free-form Q&A. If AI is unavailable, the app still works fully.
- **Zero runtime dependencies** (Node.js built-ins only): tiny, fast and nothing to compromise.
- **Secure by design:** strict validation, CSP without inline code, rate limiting, secrets server-side only. See [SECURITY.md](SECURITY.md).
- **Accessible:** WCAG-oriented, keyboard and screen-reader friendly, dark mode, reduced motion, print. See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).
- **Tested:** automated unit and HTTP integration tests with mocked upstreams, run in CI.

## Quick start

Requires Node.js 20 or 22.

```bash
git clone <your-repo-url> && cd clean-air-compass
cp .env.example .env        # optional: add GEMINI_API_KEY
# Node 20+: load env automatically
node --env-file=.env server.js
# or simply:
npm start
```

Open http://localhost:8080 and press **Try an example**.

```bash
npm test        # no network required
npm run check   # syntax check
npm install     # optional: install development tools for linting
npm run lint
```

## Configuration

| Variable           | Default            | Purpose                                                                  |
| ------------------ | ------------------ | ------------------------------------------------------------------------ |
| `GEMINI_API_KEY`   | none               | Enables Gemini enrichment and Q&A. Optional.                             |
| `GEMINI_MODEL`     | `gemini-2.5-flash` | Model name.                                                              |
| `PORT`             | `8080`             | HTTP port.                                                               |
| `TRUST_PROXY_HOPS` | `0`                | Trusted reverse-proxy hops for client-IP rate limiting (Cloud Run: `1`). |

## Deploy to Google Cloud Run

```bash
gcloud run deploy clean-air-compass --source . --region asia-south1 \
  --allow-unauthenticated --set-env-vars GEMINI_API_KEY=your-key
```

(Use Secret Manager for the key in production.)

## API

| Endpoint          | Body                                                                       | Returns                   |
| ----------------- | -------------------------------------------------------------------------- | ------------------------- |
| `GET /api/health` | none                                                                       | `{status, ai}`            |
| `POST /api/plan`  | profile JSON (`city` or `lat`+`lon` or `manualAqi`, plus lifestyle fields) | `{plan, enhancement, ai}` |
| `POST /api/ask`   | `{question, context:{city, aqi}}`                                          | `{answer, source}`        |

## Project structure

```
server.js            HTTP server, routing, security headers, static files
api/index.js         Vercel serverless entry point
src/                 Validation, AQI, data clients, rules engine, AI guardrails and HTTP helpers
src/rules/            Personalised routine, indoor-air and sustainable-action rules
public/               Accessible UI (HTML, CSS, modular browser JavaScript)
test/                 node:test suites
docs/                 Architecture and accessibility notes
```

## Evaluation criteria mapping

| Criterion         | How it is addressed                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Code quality      | Small single-purpose modules, JSDoc, no dependencies, consistent style, CI                                         |
| Security          | See [SECURITY.md](SECURITY.md)                                                                                     |
| Efficiency        | Pre-compressed static files, ETags, TTL caches, bounded memory, no framework                                       |
| Testing           | Unit and integration coverage for validation, rules, impact maths, limiter, AI fallback, HTTP and security headers |
| Accessibility     | See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md)                                                                 |
| Problem alignment | See coverage table in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                                                 |

## Disclaimer

General guidance, not medical advice. Impact numbers are rounded planning estimates.

## License

MIT
