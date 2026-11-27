import { $, h, clear } from './dom.mjs';

/** Animated risk meters for each population group. */
export function renderGroupRisk(groups) {
  const list = $('group-risk');
  clear(list);
  const fills = groups.map((group) => {
    const fill = h('div', { class: `meter-fill r${group.risk}` });
    fill.style.setProperty('--w', `${((group.risk + 1) / 5) * 100}%`);
    list.append(
      h(
        'li',
        { class: 'risk-row' },
        h(
          'div',
          { class: 'risk-head' },
          h('span', { text: group.label }),
          h('span', { class: 'risk-level', text: group.riskLabel }),
        ),
        h('div', { class: 'meter', role: 'img', 'aria-label': `${group.label}: ${group.riskLabel} risk` }, fill),
      ),
    );
    return fill;
  });
  setTimeout(() => fills.forEach((fill) => fill.classList.add('go')), 150);
}
