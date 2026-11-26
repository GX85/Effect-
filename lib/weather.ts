export type Weather = 'storm' | 'rain' | 'sun';
export const WEATHER_DELAY_MS = 850;
export const WEATHER_FADE_MS = 3600;
export const WEATHER_ASSETS = {
  storm: '/images/storm-base.webp',
  rain: '/images/rain-sky.webp',
  sun: '/images/sun-sky.webp',
};
export function weatherWeights(weather: Weather): [number, number, number] {
  return weather === 'storm'
    ? [1, 0, 0]
    : weather === 'rain'
      ? [0, 1, 0]
      : [0, 0, 1];
}
export function smoothWeatherBlend(
  from: number[],
  to: number[],
  progress: number,
) {
  const p = Math.max(0, Math.min(1, progress));
  const eased = p * p * (3 - 2 * p);
  return from.map((value, index) => value + (to[index] - value) * eased);
}
