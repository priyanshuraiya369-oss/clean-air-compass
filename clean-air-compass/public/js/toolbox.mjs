import { $, h } from './dom.mjs';
import { LEVEL_NAMES, LEVEL_RANGES } from './labels.mjs';
import { tools } from './state.mjs';

export function purifierMessage(size) {
  return size
    ? `Your room is about ${size.areaM2} m\u00b2 (${size.volumeM3} m\u00b3). Look for a purifier with a CADR of at least ${size.cadrM3h} m\u00b3/h (about ${size.cadrCfm} cfm). A higher rating cleans the room faster on smoggy days.`
    : 'Please enter sensible room sizes (length and width 1 to 30 m, height 2 to 6 m).';
}

export function initToolbox() {
  const legend = $('legend');
  LEVEL_NAMES.forEach((name, i) => {
    legend.append(
      h('li', {}, h('span', { class: `swatch sw-${i}`, 'aria-hidden': 'true' }), h('span', {}, h('strong', { text: `${LEVEL_RANGES[i]}: ` }), name)),
    );
  });
  $('tool-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const size = tools().purifierSizing({
      lengthM: Number($('roomL').value),
      widthM: Number($('roomW').value),
      heightM: Number($('roomH').value),
    });
    $('tool-result').textContent = purifierMessage(size);
  });
}
