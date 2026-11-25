'use strict';

const { categorize } = require('./aqi');
const { commuteMonthlyKg, commuteSavingKg, heaterSavingKg } = require('./impact');

/**
 * Deterministic rules engine. It guarantees a useful, safe, explainable plan even
 * when no AI key is configured or the AI call fails. Gemini only adds on top.
 *
 * Item shape: { id, title, action, why, impact:{text, co2KgPerMonth|null, exposure|null}, when, cost }
 *   when:     'today' | 'this-week' | 'long-term'
 *   cost:     'free' | 'low' | 'medium' | 'high'
 *   exposure: 'high' | 'medium' | 'low'  (how much it can cut your personal smog exposure)
 */

const item = (id, title, action, why, impact, when, cost) => ({
  id,
  title,
  action,
  why,
  impact: { text: impact.text, co2KgPerMonth: impact.co2 ?? null, exposure: impact.exposure ?? null },
  when,
  cost,
});

const HEADLINES = [
  'Air is clean today. Enjoy it and keep your habits low-emission.',
  'Air is acceptable. Take light precautions if you are sensitive.',
  'Smog is building. Protect sensitive family members today.',
  'Unhealthy air. Cut outdoor exposure and clean your indoor air.',
  'Very unhealthy air. Stay indoors as much as possible today.',
  'Hazardous air. Treat today as an indoor-only day.',
];

function routineItems(p, level, sensitive) {
  const items = [];

  if (level >= 2) {
    items.push(
      item(
        'move-exercise-indoors',
        'Move exercise indoors',
        'Swap outdoor runs, cricket or morning walks for indoor yoga, stairs or a home workout.',
        'You breathe two to three times more air while exercising, so you also inhale far more fine particles.',
        { text: 'Avoids the largest single exposure spike of the day for active people.', exposure: 'high' },
        'today',
        'free',
      ),
    );
  } else if (level <= 1) {
    items.push(
      item(
        'walk-today',
        'Use the cleaner air for a walk',
        'Take a brisk walk or let children play outside while the air is good.',
        'Cleaner-air days are the best time to be active outdoors.',
        { text: 'Healthy exercise with low exposure.', exposure: 'low' },
        'today',
        'free',
      ),
    );
  }

  if (level >= 2 || (level >= 1 && sensitive)) {
    items.push(
      item(
        'wear-n95',
        'Wear a well-fitted N95 / FFP2 mask outdoors',
        'Choose a respirator that seals around nose and cheeks. Cloth and loose surgical masks do not stop fine particles well.',
        'PM2.5 is small enough to reach deep into the lungs; certified N95/FFP2 filters at least 95% of particles when fitted properly.',
        { text: 'Can cut the fine particles you breathe in while outside by up to ~90% with a good seal.', exposure: 'high' },
        'today',
        'low',
      ),
    );
  }

  if (level >= 4) {
    items.push(
      item(
        'stay-indoors-severe',
        'Treat today as an indoor day',
        'Postpone non-essential outings, errands and commutes if you can. If you must go out, wear a fitted N95 and keep the trip short.',
        'At very unhealthy or hazardous levels even healthy people can feel symptoms, and sensitive people face serious risk.',
        { text: 'Keeping outings to a minimum avoids the highest-exposure hours entirely.', exposure: 'high' },
        'today',
        'free',
      ),
    );
  }

  if (level >= 2 || (sensitive && level >= 1)) {
    items.push(
      item(
        'medical-signs',
        'Know when to get medical help',
        'Seek medical care promptly for chest pain, severe breathlessness, wheezing that does not settle, fainting, or a child or elder who is unusually drowsy or struggling to breathe. If you have asthma or heart or lung disease, follow your doctor\u2019s plan and keep prescribed medicines handy.',
        'Smog can trigger serious breathing and heart problems, and acting early matters.',
        { text: 'Knowing the warning signs helps you act early instead of waiting.', exposure: null },
        'today',
        'free',
      ),
    );
  }

  if (p.household.children && level >= 2) {
    items.push(
      item(
        'children-indoor-play',
        'Keep school sports and playtime indoors',
        level >= 3
          ? 'Skip outdoor play and PE today. Ask the school for indoor activities.'
          : 'Shorten outdoor play and favour low-intensity activities. Move games indoors if the air feels smoky.',
        "Children's lungs are still developing and they breathe faster than adults, so they absorb more pollution per kilogram of body weight.",
        { text: 'Protects the most vulnerable members of the family.', exposure: 'high' },
        'today',
        'free',
      ),
    );
  }

  if (p.household.elderly && level >= 2) {
    items.push(
      item(
        'elderly-routine',
        'Shift elders to indoor routines',
        'Plan indoor walking, avoid early morning and late evening outings, and keep regular medicines and doctor contacts handy.',
        'Older adults are more likely to have heart or lung conditions that smog can aggravate.',
        { text: 'Reduces risk of smog-triggered breathlessness and heart strain.', exposure: 'high' },
        'today',
        'free',
      ),
    );
  }

  if (level >= 2) {
    items.push(
      item(
        'timing-errands',
        'Do errands at midday and batch them',
        'Combine errands into one trip around late morning to afternoon, when winter smog is usually thinner than early morning and night.',
        'Cold, still winter air traps pollution near the ground overnight and at dawn; it often clears a little by afternoon.',
        { text: 'Fewer, better-timed trips mean lower exposure and less tailpipe pollution.', exposure: 'medium' },
        'today',
        'free',
      ),
    );
  }

  switch (p.commute) {
    case 'car':
      items.push(
        item(
          'car-idling',
          'Switch off the engine when stopped',
          'Turn the engine off at long red lights, railway crossings and while waiting for passengers.',
          'Idling vehicles keep emitting particles and gases without moving you anywhere.',
          { text: 'Cuts local tailpipe emissions at every stop, for free.', exposure: 'low' },
          'today',
          'free',
        ),
      );
      break;
    case 'walk':
    case 'cycle':
      if (level >= 3) {
        items.push(
          item(
            'active-commute-route',
            'Choose a low-traffic route and wear a mask',
            'Use inner lanes and parks instead of main roads, and wear an N95 for the trip. Consider public transport on the worst days.',
            'Exposure is highest next to heavy traffic, and effort raises how much you inhale.',
            { text: 'Keeps a zero-emission commute while reducing your exposure.', exposure: 'medium' },
            'today',
            'low',
          ),
        );
      }
      break;
    case 'public':
      items.push(
        item(
          'transit-mask',
          'Keep your mask on at crowded stops and stations',
          'Wear a mask while waiting at busy roadside stops and underground platforms.',
          'Waiting beside idling traffic is when many transit riders get their highest exposure.',
          { text: 'Small habit that protects you without giving up a low-emission commute.', exposure: 'medium' },
          'today',
          'low',
        ),
      );
      break;
    default:
      break;
  }

  items.push(
    item(
      'no-open-burning',
      'Never burn leaves, waste or wood for warmth',
      'Avoid open fires, garbage burning and firecrackers, and report burning in your area through local civic channels.',
      'Open burning is a major source of winter PM2.5, and your neighbours breathe it too.',
      { text: 'One small fire can spike smoke levels across a whole street.', exposure: 'medium' },
      'today',
      'free',
    ),
  );

  return items;
}

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

function sustainableItems(p) {
  const items = [];
  const km = p.commuteKm;

  if (p.commute === 'car' || p.commute === 'two_wheeler') {
    const best = commuteSavingKg(p.commute, 'public', km);
    const half = Math.round(commuteSavingKg(p.commute, 'public', km) / 2 * 10) / 10;
    items.push(
      item(
        'commute-swap',
        'Switch part of your commute to public transport',
        `Try metro or bus for your ~${km} km trip on two or three days a week, or carpool with a colleague.`,
        'Fewer private vehicles on the road means less local particle and nitrogen-dioxide pollution, and lower carbon emissions.',
        {
          text: `Using public transport every working day would save about ${best} kg CO2e a month; half the days saves about ${half} kg.`,
          co2: best,
          exposure: 'low',
        },
        'this-week',
        'low',
      ),
    );
    items.push(
      item(
        'trip-chaining',
        'Combine short trips',
        'Plan errands into one loop and walk for anything under 1.5 km.',
        'Short, cold-start trips are the most polluting per kilometre.',
        { text: 'Fewer cold starts, less fuel, less local pollution.', co2: null, exposure: 'low' },
        'this-week',
        'free',
      ),
    );
  } else if (p.commute === 'public') {
    const carMonthly = commuteMonthlyKg('car', km);
    const actual = commuteMonthlyKg('public', km);
    items.push(
      item(
        'keep-transit',
        'Keep using public transport',
        'Tell friends and colleagues; consider a monthly pass or a workplace shuttle group.',
        'You are already avoiding most of the emissions of a private car.',
        {
          text: `Compared with driving the same ~${km} km each way, you avoid about ${Math.max(0, Math.round((carMonthly - actual) * 10) / 10)} kg CO2e a month.`,
          co2: Math.max(0, Math.round((carMonthly - actual) * 10) / 10),
          exposure: null,
        },
        'long-term',
        'free',
      ),
    );
  } else if (p.commute === 'walk' || p.commute === 'cycle') {
    const carMonthly = commuteMonthlyKg('car', km);
    items.push(
      item(
        'keep-active',
        'Keep your zero-emission commute',
        'On smoggy days use quieter streets or parks and wear a mask; keep cycling and walking on better-air days.',
        'Walking and cycling produce no tailpipe emissions and keep you fit.',
        {
          text: `Compared with driving the same ~${km} km each way, you avoid about ${carMonthly} kg CO2e a month.`,
          co2: carMonthly,
          exposure: null,
        },
        'long-term',
        'free',
      ),
    );
  } else {
    items.push(
      item(
        'wfh-benefit',
        'Working from home already saves commute emissions',
        'Use the saved commute time for a walk on a low-pollution afternoon, and avoid unnecessary short drives.',
        'No commute means no daily tailpipe emissions from you.',
        { text: 'Zero commute emissions for those days.', co2: null, exposure: null },
        'long-term',
        'free',
      ),
    );
  }

  if (p.cooking === 'lpg' || p.cooking === 'biomass' || p.cooking === 'png') {
    items.push(
      item(
        'induction-switch',
        'Try an induction hob for daily cooking',
        'Use an induction plate for boiling, tea and quick meals, and keep gas for the rest. Pressure-cook and cover pots to use less energy.',
        'Induction removes combustion fumes from the kitchen and is efficient, especially on a cleaner power grid.',
        { text: 'No combustion pollutants indoors for the meals you move over.', exposure: 'medium' },
        'long-term',
        'medium',
      ),
    );
  }

  if (p.heating === 'electric_heater') {
    const saved = heaterSavingKg(1);
    items.push(
      item(
        'heater-smart',
        'Heat the person, not the room',
        'Use a timer or thermostat, wear layers, insulate windows, and run the heater one hour less a day.',
        'Electric heaters are clean at home but draw a lot of power; layers and insulation cut the load.',
        { text: `One hour less of a 1.5 kW heater saves about ${saved} kg CO2e a month on an average grid.`, co2: saved, exposure: null },
        'this-week',
        'low',
      ),
    );
  }

  if (p.homeType === 'house') {
    items.push(
      item(
        'rooftop-solar',
        'Look into rooftop solar',
        'Ask your electricity distributor about net-metering and subsidy schemes, and get at least two quotes.',
        'Solar replaces grid electricity, much of which still comes from burning coal.',
        { text: 'A typical household system can offset much of its yearly electricity emissions.', co2: null, exposure: null },
        'long-term',
        'high',
      ),
    );
  }

  items.push(
    item(
      'community-action',
      'Start a small community action',
      'Share the AQI with neighbours, set up a school walking bus, ask your housing society to ban waste burning, and plant native trees in winter.',
      'Smog is a shared problem: neighbourhood habits change the air everyone breathes.',
      { text: 'Collective action reduces local pollution that no single household can fix alone.', co2: null, exposure: null },
      'long-term',
      'free',
    ),
  );

  return items;
}

/** Items that are always shown in the guaranteed "Safety essentials" block. */
const SAFETY_IDS = new Set([
  'wear-n95',
  'stay-indoors-severe',
  'medical-signs',
  'children-indoor-play',
  'elderly-routine',
  'clean-room',
  'cooking-biomass',
  'heating-biomass',
  'heating-gas',
]);

const RISK_LABELS = Object.freeze(['Low', 'Moderate', 'High', 'Very high', 'Severe']);
// Risk index (0-4) per AQI level (0-5). Sensitive groups reach higher risk at lower AQI.
const RISK_BY_LEVEL = Object.freeze({
  healthy: [0, 0, 1, 2, 3, 4],
  children: [0, 1, 2, 3, 4, 4],
  elderly: [0, 1, 2, 3, 4, 4],
  conditions: [0, 2, 3, 4, 4, 4],
});
const RISK_GROUPS = Object.freeze([
  ['healthy', 'Healthy adults'],
  ['children', 'Children'],
  ['elderly', 'Older adults'],
  ['conditions', 'Asthma, heart or lung conditions'],
]);

/** Indicative risk for each group at an AQI level. Not a medical assessment. */
function groupRisk(level) {
  const lvl = Math.min(5, Math.max(0, level));
  return RISK_GROUPS.map(([id, label]) => ({
    id,
    label,
    risk: RISK_BY_LEVEL[id][lvl],
    riskLabel: RISK_LABELS[RISK_BY_LEVEL[id][lvl]],
  }));
}

const WHEN_ORDER = { today: 0, 'this-week': 1, 'long-term': 2 };

const MYTHS = Object.freeze([
  {
    myth: 'Houseplants clean the air in my home.',
    fact: 'You would need a jungle. Plants have a negligible effect on indoor air in real homes; filtration and ventilation timing do the real work.',
  },
  {
    myth: 'A cloth mask or dupatta is enough against smog.',
    fact: 'Cloth masks block few fine particles. A fitted N95 / FFP2 is the right tool for PM2.5.',
  },
  {
    myth: 'Indoor air is always safe on a smoggy day.',
    fact: 'Without filtration, indoor PM2.5 can follow outdoor levels closely, and cooking, incense and sweeping add more.',
  },
  {
    myth: 'I only need to worry when I can see smoke.',
    fact: 'The most harmful particles are invisible. Check the AQI, not the sky.',
  },
]);

/**
 * @param {object} profile validated profile (see validate.js)
 * @param {{aqi:number,pm25?:number|null,pm10?:number|null,city?:string,source:string}} air
 */
function buildPlan(profile, air) {
  const cat = categorize(air.aqi);
  const sensitive =
    profile.household.children || profile.household.elderly || profile.household.sensitive;

  const sections = [
    { id: 'routine', title: 'Low-emission daily routine', items: routineItems(profile, cat.level, sensitive) },
    { id: 'indoor', title: 'Indoor air quality hacks', items: indoorItems(profile, cat.level, sensitive) },
    { id: 'sustainable', title: 'Sustainable alternatives', items: sustainableItems(profile) },
  ];

  const safety = [];
  for (const s of sections) {
    s.items = s.items.filter((i) => {
      if (!SAFETY_IDS.has(i.id)) return true;
      safety.push({ ...i, safety: true });
      return false;
    });
    s.items.sort((a, b) => WHEN_ORDER[a.when] - WHEN_ORDER[b.when]);
  }
  safety.sort((a, b) => WHEN_ORDER[a.when] - WHEN_ORDER[b.when]);

  const co2KgPerMonth =
    Math.round(sections[2].items.reduce((sum, i) => sum + (i.impact.co2KgPerMonth || 0), 0) * 10) / 10;

  const where = air.city || profile.city || 'your area';
  return {
    air: {
      aqi: Math.round(air.aqi),
      level: cat.level,
      id: cat.id,
      label: cat.label,
      pm25: air.pm25 ?? null,
      pm10: air.pm10 ?? null,
      forecast: air.forecast ?? null,
      city: where,
      source: air.source,
    },
    headline: HEADLINES[cat.level],
    summary: `${where}: AQI ${Math.round(air.aqi)} (${cat.label}). ${sensitive ? 'Because your household includes sensitive members, the plan leans cautious.' : 'Here is a plan matched to your home and daily routine.'}`,
    groupRisk: groupRisk(cat.level),
    safety,
    sections,
    computed: sections[2].items
      .filter((i) => i.impact.co2KgPerMonth)
      .map((i) => ({ title: i.title, co2KgPerMonth: i.impact.co2KgPerMonth })),
    totals: { co2KgPerMonth, actions: safety.length + sections.reduce((n, s) => n + s.items.length, 0) },
    myths: MYTHS,
    disclaimer:
      'Impact figures are rounded planning estimates, not measurements. This is general guidance, not medical advice. If you have heart or lung disease or feel unwell, follow your doctor\u2019s advice and seek care when needed.',
  };
}

module.exports = { buildPlan, MYTHS, SAFETY_IDS, groupRisk };
