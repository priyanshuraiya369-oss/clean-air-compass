'use strict';

const { item } = require('./item');

/** Low-emission daily routines, driven by AQI level, household and commute. */
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

module.exports = { routineItems };
