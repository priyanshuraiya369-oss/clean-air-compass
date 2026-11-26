// User-facing label tables.
export const WHEN_LABEL = { today: 'Do today', 'this-week': 'This week', 'long-term': 'Long term' };
export const COST_LABEL = { free: 'Free', low: 'Low cost', medium: 'Medium cost', high: 'Higher cost' };
export const EXPOSURE_LABEL = {
  high: 'Big cut in exposure',
  medium: 'Moderate cut in exposure',
  low: 'Small cut in exposure',
};
export const SOURCE_LABEL = {
  manual: 'Source: value you entered',
  'open-meteo': 'Source: Open-Meteo live data',
  waqi: 'Source: aqicn.org nearest monitoring station',
};
export const LEVEL_NAMES = ['Good', 'Moderate', 'Unhealthy for sensitive groups', 'Unhealthy', 'Very unhealthy', 'Hazardous'];
export const LEVEL_RANGES = ['0 to 50', '51 to 100', '101 to 150', '151 to 200', '201 to 300', '301 and above'];
