import { h } from './dom.mjs';
import { WHEN_LABEL, COST_LABEL, EXPOSURE_LABEL } from './labels.mjs';
import { state } from './state.mjs';
import { bindCheckbox } from './checklist.mjs';

function tagList(item) {
  return h(
    'ul',
    { class: 'tags', 'aria-label': 'Action details' },
    h('li', { class: `tag t-${item.when}`, text: WHEN_LABEL[item.when] || item.when }),
    h('li', { class: 'tag', text: COST_LABEL[item.cost] || item.cost }),
    item.impact.exposure ? h('li', { class: 'tag', text: EXPOSURE_LABEL[item.impact.exposure] }) : null,
    item.by === 'gemini' ? h('li', { class: 'tag t-ai', text: 'Gemini' }) : null,
  );
}

function englishOriginal(en) {
  return h(
    'details',
    {},
    h('summary', { text: 'Show the English original' }),
    h('p', {}, h('strong', { text: en.title }), ` ${en.action}`),
    h('p', { text: `Why: ${en.why} Impact: ${en.impact}` }),
  );
}

/** One plan action as a card with a "mark done" checkbox. */
export function renderItem(item, index) {
  state.uid += 1;
  const id = `chk-${state.uid}`;
  const box = h('input', { type: 'checkbox', id, checked: state.done.has(item.title) });
  const li = h(
    'li',
    { class: 'plan-item' },
    tagList(item),
    h('div', { class: 'item-head' }, box, h('h4', {}, h('label', { for: id, text: item.title }))),
    h('p', { text: item.action }),
    h('p', {}, h('span', { class: 'label', text: 'Why it matters: ' }), item.why),
    h('p', { class: 'impact' }, h('span', { class: 'label', text: 'Your impact: ' }), item.impact.text),
    item.en ? englishOriginal(item.en) : null,
  );
  li.style.setProperty('--i', String(Math.min(index, 12)));
  bindCheckbox(box, item.title, li);
  return li;
}

export function renderSection(section, offset) {
  const headingId = `sec-${section.id}`;
  return h(
    'section',
    { class: 'plan-section', 'aria-labelledby': headingId },
    h('h3', { id: headingId, text: section.title }),
    h('ul', { class: 'plan-list' }, section.items.map((item, i) => renderItem(item, offset + i))),
  );
}
