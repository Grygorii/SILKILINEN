import { DELIVERY_COUNTRIES } from './deliveryCountries';

export type Destination = { code: string; name: string; longitude: number; latitude: number };
export type ShipmentMode = 'shipped' | 'available';
// Country-level illustrative positions, never customer coordinates.
export const ORIGIN = { longitude: -7.6, latitude: 55 };
export const CONFIRMED_DESTINATIONS = ['IE','GB','FR','DE','AT','IT','DK','FI','US','CA','AU'] as const;
const PLACES: Record<string, [string, number, number]> = {
  IE: ['Ireland',-8,53.1], GB:['United Kingdom',-2.5,54], FR:['France',2.2,46.5],
  DE:['Germany',10.3,51], AT:['Austria',14.5,47.5], IT:['Italy',12.6,42.8],
  DK:['Denmark',9.5,56.1], FI:['Finland',25.7,64.1], US:['United States',-98,39],
  CA:['Canada',-106,56], AU:['Australia',134,-25], NZ:['New Zealand',173,-41],
  IM:['Isle of Man',-4.5,54.2], JE:['Jersey',-2.1,49.2], GG:['Guernsey',-2.6,49.5],
  BE:['Belgium',4.5,50.5], BG:['Bulgaria',25.5,42.7], HR:['Croatia',16,45.2],
  CY:['Cyprus',33,35], CZ:['Czechia',15.5,49.8], EE:['Estonia',25.5,58.6],
  GR:['Greece',23,39], HU:['Hungary',19.5,47.2], LV:['Latvia',24.6,57],
  LT:['Lithuania',24,55.2], LU:['Luxembourg',6.1,49.8], MT:['Malta',14.4,35.9],
  NL:['Netherlands',5.3,52.2], PL:['Poland',19.1,52], PT:['Portugal',-8,39.5],
  RO:['Romania',25,46], SK:['Slovakia',19.5,48.7], SI:['Slovenia',14.9,46.1],
  ES:['Spain',-3.8,40.2], SE:['Sweden',15,62], CH:['Switzerland',8.2,46.8],
  NO:['Norway',9,62], IS:['Iceland',-19,65],
};
export function destinationsFor(mode: ShipmentMode, additional: readonly string[] = []): Destination[] {
  const codes = mode === 'shipped'
    ? [...new Set<string>([...CONFIRMED_DESTINATIONS, ...additional])]
    : [...DELIVERY_COUNTRIES];
  return codes.filter(code => PLACES[code]).map(code => {
    const [name, longitude, latitude] = PLACES[code];
    return { code, name, longitude, latitude };
  });
}
export function projectLocation(longitude: number, latitude: number): [number, number] {
  return [(longitude + 180) * 1000 / 360, (90 - latitude) * 500 / 180];
}
export function mapView(destination: Destination): string {
  return ['US','CA','AU','NZ'].includes(destination.code) ? '30 18 970 400' : '400 45 215 125';
}
export function journeyPath(destination: Destination): string {
  const [x,y] = projectLocation(ORIGIN.longitude, ORIGIN.latitude);
  const [ex,ey] = projectLocation(destination.longitude, destination.latitude);
  const lift = Math.max(4,Math.min(65,Math.hypot(ex-x,ey-y)*.3));
  return `M ${x} ${y} Q ${(x+ex)/2} ${Math.min(y,ey)-lift} ${ex} ${ey}`;
}
