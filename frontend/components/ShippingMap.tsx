import type { CSSProperties } from 'react';
import styles from './ShippingMap.module.css';

const destinations = [
  'Ireland', 'United Kingdom', 'France', 'Germany', 'Austria', 'Italy',
  'Denmark', 'Finland', 'United States', 'Canada', 'Australia',
] as const;

const routes = [
  { country: 'Ireland', path: 'M478 98 Q481 96 483 102', x: 483, y: 102 },
  { country: 'United Kingdom', path: 'M478 98 Q487 91 494 100', x: 494, y: 100 },
  { country: 'France', path: 'M478 98 Q496 98 506 122', x: 506, y: 122 },
  { country: 'Germany', path: 'M478 98 Q507 82 529 108', x: 529, y: 108 },
  { country: 'Austria', path: 'M478 98 Q514 85 539 118', x: 539, y: 118 },
  { country: 'Italy', path: 'M478 98 Q523 94 535 132', x: 535, y: 132 },
  { country: 'Denmark', path: 'M478 98 Q505 72 528 94', x: 528, y: 94 },
  { country: 'Finland', path: 'M478 98 Q526 48 572 72', x: 572, y: 72 },
  { country: 'United States', path: 'M478 98 Q350 22 228 142', x: 228, y: 142 },
  { country: 'Canada', path: 'M478 98 Q340 8 206 94', x: 206, y: 94 },
  { country: 'Australia', path: 'M478 98 Q790 70 872 319', x: 872, y: 319 },
] as const;

export default function ShippingMap() {
  return (
    <section className={styles.section} aria-labelledby="shipping-map-title">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>From Donegal, outward</p>
        <h2 id="shipping-map-title">Where our pieces have travelled</h2>
        <p className={styles.intro}>
          SILKILINEN has shipped to customers across Europe and further afield.
          Every highlighted country below is a genuine shipment destination.
        </p>
        <div className={styles.legend} aria-label="Map key">
          <span><i className={styles.actualDot} aria-hidden="true" /> Actual shipment destination</span>
          <span><i className={styles.routeLine} aria-hidden="true" /> Illustrative route</span>
        </div>
      </div>

      <div className={styles.mapWrap}>
        <svg className={styles.map} viewBox="0 0 1000 440" role="img"
          aria-labelledby="shipping-map-svg-title shipping-map-svg-description">
          <title id="shipping-map-svg-title">Countries SILKILINEN has shipped to</title>
          <desc id="shipping-map-svg-description">
            A decorative world map with confirmed shipment destinations marked in Ireland,
            the United Kingdom, France, Germany, Austria, Italy, Denmark, Finland,
            the United States, Canada and Australia. Curved lines are illustrative only.
          </desc>
          <g className={styles.graticule} aria-hidden="true">
            <path d="M40 110H960M40 220H960M40 330H960" />
            <path d="M250 35V400M500 35V400M750 35V400" />
          </g>
          <g className={styles.land} aria-hidden="true">
            <path d="M84 86 139 47 226 51 278 78 294 119 258 145 232 190 190 197 166 160 112 143 76 113Z" />
            <path d="M250 202 282 219 302 273 286 352 260 389 244 337 220 288 225 233Z" />
            <path d="M431 75 472 52 538 59 566 85 622 77 695 101 735 131 701 165 650 166 617 199 575 183 552 148 515 144 490 124 450 132 420 108Z" />
            <path d="M487 151 540 158 581 204 568 286 531 340 496 309 476 241 455 198Z" />
            <path d="M820 280 875 260 930 286 943 333 903 362 845 354 807 322Z" />
            <path d="M905 376 926 373 937 387 916 396Z" />
          </g>
          <g aria-hidden="true">
            {routes.map((route, index) => (
              <path key={route.country} d={route.path} className={styles.route}
                style={{ '--route-delay': `${index * 110}ms` } as CSSProperties} />
            ))}
          </g>
          <g className={styles.origin} aria-label="Ships from Donegal, Ireland">
            <circle cx="478" cy="98" r="10" /><circle cx="478" cy="98" r="4" />
          </g>
          <text className={styles.originLabel} x="462" y="80">DONEGAL</text>
          <g aria-label="Confirmed shipment destinations">
            {routes.map((route) => (
              <g key={route.country} className={styles.destination} aria-label={route.country}>
                <circle cx={route.x} cy={route.y} r="7" />
                <circle cx={route.x} cy={route.y} r="2.5" />
              </g>
            ))}
          </g>
        </svg>
      </div>

      <ul className={styles.countries} aria-label="Confirmed destination countries">
        {destinations.map((country) => <li key={country}>{country}</li>)}
      </ul>
      <p className={styles.disclosure}>
        Countries reflect completed shipments. Routes are illustrative and do not show
        individual orders, customer addresses or exact delivery paths.
      </p>
    </section>
  );
}
