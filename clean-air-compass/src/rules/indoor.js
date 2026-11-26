'use strict';

const { item } = require('./item');

/** Indoor air quality hacks: ventilation, filtration, cooking, heating, cleaning. */
function indoorItems(p, level, sensitive) {
  const items = [];

  items.push(
    item(
      'ventilation-timing',
      level >= 2 ? 'Keep windows shut, air out briefly at midday' : 'Ventilate normally',
      level >= 2
        ? 'Keep windows and doors closed most of the day. If you must ventilate, open them for about 10 minutes when the outdoor AQI is lowest, usually early afternoon.'
        : 'Open windows for cross-ventilation, especially while cooking, to flush out indoor pollutants.',
      level >= 2
        ? 'Outdoor smog leaks indoors whenever windows are open; short, well-timed airing balances fresh air against pollution.'
        : 'Indoor air can be more polluted than outdoor air when it is not refreshed.',
      { text: 'Keeps outdoor smog out of the rooms where you spend most of your time.', exposure: level >= 2 ? 'high' : 'low' },
      'today',
      'free',
    ),
  );

  if (p.hasPurifier) {
    items.push(
      item(
        'use-purifier',
        'Run your purifier correctly',
        'Keep it on auto mode in the room you use most (bedroom at night), with the door closed. Clean the pre-filter every two weeks and replace the filter on schedule.',
        'A purifier only helps when its filter is fresh and the room is reasonably sealed.',
        { text: 'Typically cuts indoor PM2.5 by roughly 50-80% in a closed room.', exposure: 'high' },
        'today',
        'free',
      ),
    );
  } else if (p.budget === 'low') {
    items.push(
      item(
        'corsi-rosenthal',
        'Build a Corsi-Rosenthal box',
        'Tape four MERV-13 filters into a cube around a standard box fan, with a cardboard top. Run it on low in the room you use most.',
        'This DIY design was shown in studies to clean air about as well as many commercial HEPA purifiers for a fraction of the cost.',
        { text: 'Low-cost purifier alternative; can substantially cut indoor fine particles.', exposure: 'high' },
        'this-week',
        'low',
      ),
    );
  } else {
    items.push(
      item(
        'buy-hepa',
        'Add a HEPA purifier sized for your room',
        'Pick a true-HEPA unit whose clean air delivery rate (CADR) is at least two-thirds of the room floor area in square feet. Start with the bedroom.',
        'Correct sizing is what decides whether a purifier cleans the whole room or just the air next to it.',
        { text: 'Typically cuts indoor PM2.5 by roughly 50-80% in a closed room.', exposure: 'high' },
        'this-week',
        'medium',
      ),
    );
  }

  if (sensitive && level >= 2) {
    items.push(
      item(
        'clean-room',
        'Make one "clean room"',
        'Choose the bedroom as a clean room: door closed, purifier or Corsi-Rosenthal box running, no incense, candles or sprays.',
        'Concentrating cleaning in one room is more effective than trying to clean the whole home.',
        { text: 'Gives children, elders or anyone sensitive a refuge from smog.', exposure: 'high' },
        'today',
        'low',
      ),
    );
  }

  switch (p.cooking) {
    case 'biomass':
      items.push(
        item(
          'cooking-biomass',
          'Move away from wood, dung or coal cooking',
          'Switch to LPG, piped gas or induction. Until then, cook in a well-ventilated space with a chimney or open door, and keep children away from the fire.',
          'Solid-fuel cooking is one of the largest sources of household PM2.5 and carbon monoxide.',
          { text: 'Can cut kitchen PM2.5 several-fold and removes a major source of CO.', exposure: 'high' },
          'long-term',
          'medium',
        ),
      );
      break;
    case 'lpg':
    case 'png':
      items.push(
        item(
          'cooking-gas',
          'Ventilate while cooking',
          'Run the chimney or exhaust fan and crack a window while cooking, and use the back burners for high-heat frying.',
          'Frying and gas flames release fine particles and nitrogen dioxide indoors.',
          { text: 'Lowers indoor spikes from cooking, which are often the biggest daily source indoors.', exposure: 'medium' },
          'today',
          'free',
        ),
      );
      break;
    default:
      items.push(
        item(
          'cooking-electric',
          'Still use the exhaust fan when frying',
          'Electric and induction cooking avoid combustion fumes, but oil frying still releases particles.',
          'Cooking oil smoke contains fine particles even without a flame.',
          { text: 'Keeps your cleanest cooking setup clean.', exposure: 'low' },
          'today',
          'free',
        ),
      );
  }

  if (p.heating === 'biomass') {
    items.push(
      item(
        'heating-biomass',
        'Do not burn coal, charcoal or wood indoors',
        'Use warm layers, blankets, hot-water bottles or an electric heater instead. Never use an angithi or sigri in a closed room.',
        'Indoor burning produces carbon monoxide, which can be fatal, as well as heavy smoke.',
        { text: 'Removes a serious safety risk and a major indoor smoke source.', exposure: 'high' },
        'today',
        'low',
      ),
    );
  } else if (p.heating === 'gas') {
    items.push(
      item(
        'heating-gas',
        'Ventilate when using a gas heater',
        'Use only vented or certified heaters and keep a small opening for fresh air. Consider a battery-powered CO alarm.',
        'Unvented gas heaters release carbon monoxide and nitrogen dioxide.',
        { text: 'Prevents carbon monoxide build-up.', exposure: 'medium' },
        'today',
        'low',
      ),
    );
  }

  items.push(
    item(
      'clean-smart',
      'Clean with a damp cloth instead of dry sweeping',
      'Wet-mop floors and wipe surfaces with a damp cloth. Skip incense, candles and aerosol sprays on smoggy days.',
      'Dry sweeping lifts settled dust back into the air, and incense and candles add their own particles.',
      { text: 'Stops you adding indoor pollution on top of outdoor smog.', exposure: 'medium' },
      'today',
      'free',
    ),
  );

  items.push(
    item(
      'seal-gaps',
      'Seal gaps around doors and windows',
      'Fit draught-proofing strips or rolled towels at the bottom of doors and around loose windows.',
      'Less leakage means less outdoor smog entering, and it also keeps heat in.',
      { text: 'Makes any purifier work better and cuts heating needs.', exposure: 'medium' },
      'this-week',
      'low',
    ),
  );

  return items;
}

module.exports = { indoorItems };
