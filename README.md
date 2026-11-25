# Clean Air Compass

**A GenAI-powered assistant that helps families and communities navigate severe winter smog.**
It fetches live air quality for your location, then builds a personalised plan of **low-emission daily routines**, **indoor air-quality hacks** and **sustainable alternatives**, and explains the **direct impact** of every choice.

Built for PromptWars Virtual, Challenge 6: Urban Air Quality Assistant.

## Highlights

* **Live data:** city search or device location, real-time US AQI and PM2.5 via Open-Meteo (no API key). Manual AQI fallback works offline.
* **Truly personalised:** children, elders, sensitive members, commute mode and distance, cooking fuel, heating, home type, budget, existing purifier, free-text notes.
* **Explains impact:** each action shows *why it matters* and *your impact* (kg CO2e per month where computable, plus an exposure-reduction rating).
* **AI-first, safety-guaranteed:** Gemini (default `gemini-3.5-flash`, automatic fallback to `gemini-2.5-flash`) writes the whole personalised plan, local considerations and follow-up answers. A rules-based **Safety essentials** block (N95 use, indoor-day advice at severe levels, warning signs for medical help, child/elder protections, carbon-monoxide risks) is always shown and can never be removed or altered by the model. If Gemini is unavailable the rules engine produces a complete plan.
* **Animated, classic-modern UI:** serif headings with a calm paper-and-forest palette, animated hero, a live AQI gauge with count-up, animated risk meters and bar chart, scroll reveals, light/dark theme toggle. All motion respects `prefers-reduced-motion`.
* **Who is most at risk:** animated risk meters for healthy adults, children, older adults and people with lung or heart conditions.
* **9 languages:** English, Hindi, Bengali, Marathi, Gujarati, Tamil, Telugu, Punjabi, Urdu. Gemini writes the plan in your language and faithfully translates the safety checklist (the English original stays one click away).
* **Progress tracker:** tick actions as you do them; a progress ring saves locally in your browser only.
* **Share with your community:** Web Share or WhatsApp with a short "do today" list.
* **Toolbox:** purifier size helper (CADR) and an AQI scale legend.
* **Best time outside:** uses the hourly AQI forecast to show the cleanest and dirtiest windows of the next 24 hours.
* **Model output is guard-railed:** schema-checked, length-capped, unsafe advice filtered (ozone generators, indoor burning, dosages, diagnoses) and CO2 numbers always come from the app's own calculator.
* **Zero runtime dependencies** (Node.js built-ins only): tiny, fast and nothing to compromise.
* **Secure by design:** strict validation, CSP without inline code, rate limiting, secrets server-side only. See [SECURITY.md](SECURITY.md).
* **Accessible:** WCAG-oriented, keyboard and screen-reader friendly, dark mode, reduced motion, print. See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).
* **Tested:** 82 automated tests (unit + HTTP integration with mocked upstreams), run in CI.

## Quick start

Requires Node.js 18.18+ (20 or 22 recommended).

```bash
git clone <your-repo-url> && cd clean-air-compass
cp .env.example .env        # optional: add GEMINI_API_KEY
npm start                   # .env is loaded automatically
```

Open http://localhost:8080 and press **Try an example**.

```bash
npm test        # 82 tests, no network required
npm run check   # syntax check
npm run diagnose  # tests every outside service and prints the real reason if one fails
```

## Troubleshooting

* **"Live air-quality data is unavailable"**: run `npm run diagnose`. It shows which service fails and why (for example `ENOTFOUND` = DNS or firewall, `ETIMEDOUT` = blocked or slow network). The server terminal also logs the cause. Meanwhile, type the AQI manually under "No live data?".
* **Free fallbacks:** place search falls back to OpenStreetMap automatically. For air data, add a free `WAQI_TOKEN` from https://aqicn.org/data-platform/token/ and the app falls back to the nearest monitoring station.
* **`ENOTFOUND` in the server log** means your system DNS cannot resolve a host. The app automatically retries through public DNS (8.8.8.8 / 1.1.1.1). For a permanent fix set your network adapter's DNS to 8.8.8.8 and 1.1.1.1.
* **Old page after updating:** hard-refresh the browser (Ctrl+Shift+R). Assets are now always revalidated.
* **"Use my location" fails:** allow location for the site; on Windows enable Settings > Privacy > Location.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | none | Enables Gemini enrichment and Q&A. Optional. |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Primary Gemini model. |
| `GEMINI_FALLBACK_MODELS` | `gemini-2.5-flash` | Comma-separated models tried if the primary fails. |
| `WAQI_TOKEN` | none | Optional free fallback for live AQI (nearest station, aqicn.org). |
| `PORT` | `8080` | HTTP port. |
| `TRUST_PROXY_HOPS` | `0` | Trusted reverse-proxy hops for client-IP rate limiting (Cloud Run: `1`). |

## Deploy to Google Cloud Run

```bash
gcloud run deploy clean-air-compass --source . --region asia-south1 \
  --allow-unauthenticated --set-env-vars GEMINI_API_KEY=your-key
```
(Use Secret Manager for the key in production.)

## API

| Endpoint | Body | Returns |
|----------|------|---------|
| `GET /api/health` | none | `{status, ai}` |
| `GET /api/reverse?lat=&lon=` | none | `{name}` place name for coordinates |
| `POST /api/plan` | profile JSON (`city` or `lat`+`lon` or `manualAqi`, plus lifestyle fields) | `{plan, ai}` |
| `POST /api/ask` | `{question, context:{city, aqi}}` | `{answer, source}` |

## Project structure

```
server.js            HTTP server, routing, security headers, static files
src/aqi.js           AQI categories, PM2.5 to AQI
src/validate.js      Allow-list input validation
src/geo.js           Geocoding + live air quality + TTL cache
src/engine.js        Rules engine that builds the plan
src/impact.js        CO2 / exposure estimate model
src/gemini.js        Gemini client: plan authoring, model fallback, output guardrails
src/net.js           DNS-resilient fetch (public-DNS retry)
src/env.js           Tiny .env loader
src/faq.js           Offline follow-up answers
src/ratelimit.js     Bounded rate limiter
public/              Accessible UI: index.html, styles.css, app.js, tools.js (pure helpers), theme.js
test/                node:test suites
docs/                Architecture and accessibility notes
```

## Evaluation criteria mapping

| Criterion | How it is addressed |
|-----------|---------------------|
| Code quality | Small single-purpose modules, JSDoc, no dependencies, consistent style, CI |
| Security | See [SECURITY.md](SECURITY.md) |
| Efficiency | Pre-compressed static files, ETags, TTL caches, bounded memory, no framework |
| Testing | 82 tests covering validation, rules, impact maths, limiter, AI fallback, HTTP and security headers |
| Accessibility | See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) |
| Problem alignment | See coverage table in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |

## Disclaimer

General guidance, not medical advice. Impact numbers are rounded planning estimates.

## License

MIT
