# Accessibility (WCAG 2.2 AA oriented)

* Semantic landmarks (`header`, `main`, `footer`), one `h1`, logical heading order, `lang="en"`.
* Skip link, visible 3 px focus ring, full keyboard operation, no keyboard traps.
* Every control has a programmatically associated `<label>`; help text linked with `aria-describedby`; fieldsets and legends group related inputs.
* Status and errors are announced via `role="status"` / `role="alert"` live regions; focus moves to the results heading after a plan loads.
* Colour is never the only signal: AQI is shown as a number plus a text label.
* Contrast: text and AQI palettes are chosen for at least 4.5:1 in both light and dark schemes (`prefers-color-scheme`).
* Touch targets at least 44 px; layout reflows down to 320 px and supports 200% zoom without horizontal scrolling.
* `prefers-reduced-motion` respected; print stylesheet provided.
* Works without a mouse and with screen readers; `<noscript>` fallback gives the key safety tips.

## Motion and charts
* Every animation (hero, gauge needle, count-up, bars, reveals, loader) is disabled under `prefers-reduced-motion`, and content is visible without JavaScript-driven reveals.
* The hourly chart has a text summary (`<desc>`), per-bar tooltips and a full data table alternative.
* Risk meters expose their value as text and via `aria-label`, never by colour alone.
* The theme toggle is a labelled button whose label changes with its state; the choice is remembered in the browser.
