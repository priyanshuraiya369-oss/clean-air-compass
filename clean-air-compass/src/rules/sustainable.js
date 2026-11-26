'use strict';

const { item } = require('./item');
const { commuteMonthlyKg, commuteSavingKg, heaterSavingKg } = require('../impact');

/** Lower-emission alternatives with calculated CO2 savings where possible. */
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

module.exports = { sustainableItems };
