// Entry point: wires the page together. Each feature lives in its own module.
import { $ } from './dom.mjs';
import { initTheme } from './theme.mjs';
import { initReveal } from './reveal.mjs';
import { initToolbox } from './toolbox.mjs';
import { onSubmit, onLocate, onDemo, clearCoords } from './form.mjs';
import { onAsk } from './ask.mjs';
import { onShare, onCopy } from './share.mjs';

initTheme();
initReveal();
initToolbox();

$('plan-form').addEventListener('submit', onSubmit);
$('locate').addEventListener('click', onLocate);
$('city').addEventListener('input', clearCoords);
$('demo').addEventListener('click', onDemo);
$('ask-form').addEventListener('submit', onAsk);
$('copy').addEventListener('click', onCopy);
$('share').addEventListener('click', onShare);
$('print').addEventListener('click', () => window.print());
