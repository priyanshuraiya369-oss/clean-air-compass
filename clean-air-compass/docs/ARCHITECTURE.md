# Architecture

```
Browser (public/)  --JSON-->  server.js  --> src/handlers.js
 index.html, styles.css                         |-- src/validate.js    strict allow-list validation
 js/*.mjs (safe DOM modules)                    |-- src/geo.js         live AQI, forecast, geocoding (TTL cache)
                                                |-- src/engine.js      rules (src/rules/*) -> personalised plan
                                                |-- src/gemini.js      Gemini authoring + guardrails
                                                `-- src/merge.js       merge AI output; safety block stays rules-based
 server.js also uses: src/http.js (headers, errors), src/static.js, src/ratelimit.js, src/config.js, src/net.js
```

## Why AI-first with a rules safety net?

- **Depth and personalisation.** Gemini authors the full plan (4 to 6 actions per section), local considerations for the place and season, and follow-up answers, using the household, live AQI, PM2.5/PM10 and the hourly forecast.
- **Safety.** The rules engine owns a non-negotiable Safety essentials block and a set of calculated CO2 figures. The model is told not to repeat them and cannot change them.
- **Reliability.** Model chain (`gemini-3.5-flash` then `gemini-2.5-flash`), timeouts, and a complete rules-engine plan if every model fails.
- **Explainability.** Every action carries `why` and `impact`.

## Request flow for `POST /api/plan`

1. Rate-limit by client IP, enforce `application/json`, 16 KB cap.
2. Validate and normalise the profile.
3. Resolve AQI: manual value, or coordinates, or geocode the city, then fetch live AQI (cached 10 min).
4. Build the plan with the rules engine (sorted today, this week, long term).
5. Ask Gemini to author the sections; validate and merge (rules items fill any section the model skipped).
6. Return `{ plan, ai }`; `plan.safety` is always the rules-based block.

## Problem-statement coverage

| Requirement                              | Where                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Helps families and communities           | Household inputs (children, elders, sensitive members); community actions in the plan                                         |
| Severe winter smog / urban air pollution | Live AQI + PM2.5; six AQI bands drive different advice                                                                        |
| Low-emission daily routines              | `routineItems` in `src/engine.js`                                                                                             |
| Indoor air quality hacks                 | `indoorItems` (ventilation timing, purifier or DIY Corsi-Rosenthal box, clean room, sealing gaps, cooking and heating safety) |
| Sustainable alternatives                 | `sustainableItems` (transit, induction, heater habits, solar, community action)                                               |
| Tailored to location and lifestyle       | City or GPS, commute, cooking, heating, home type, budget, purifier ownership                                                 |
| Explain direct impact                    | Every item has `why` plus `impact` with CO2e/month where computable, and an exposure rating                                   |

## Impact model assumptions (`src/impact.js`)

Car 0.18, two-wheeler 0.07, public transport 0.04 kg CO2e per passenger-km; 26 working days a month; grid 0.7 kg CO2e/kWh; 1.5 kW heater. All results are rounded planning estimates and the UI says so.
