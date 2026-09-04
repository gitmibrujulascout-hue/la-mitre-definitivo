import { useId } from 'react';

const schemes = {
  light: {
    backLight: '#3a7d61',
    backDark: '#14392c',
    northLight: '#c9692f',
    northDark: '#9c4d24',
    line: '#14392c'
  },
  dark: {
    backLight: '#f3ece1',
    backDark: '#c4b49a',
    northLight: '#d98a4e',
    northDark: '#bf6a34',
    line: '#f3ece1'
  },
  mono: {
    backLight: 'currentColor',
    backDark: 'currentColor',
    northLight: 'currentColor',
    northDark: 'currentColor',
    line: 'currentColor'
  }
};

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

function point(angle, radius) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: Number((100 + radius * Math.sin(radians)).toFixed(2)),
    y: Number((100 - radius * Math.cos(radians)).toFixed(2))
  };
}

function CompassNeedle({ colors, length, width }) {
  const top = 100 - length;
  const bottom = 100 + length;

  return (
    <g transform="rotate(14 100 100)">
      <polygon points={`100,${top} ${100 + width},100 100,100`} fill={colors.northDark} />
      <polygon points={`100,${top} ${100 - width},100 100,100`} fill={colors.northLight} />
      <polygon points={`100,${bottom} ${100 + width},100 100,100`} fill={colors.backDark} />
      <polygon points={`100,${bottom} ${100 - width},100 100,100`} fill={colors.backLight} />
      <circle cx="100" cy="100" r={Math.max(5, width * 0.85)} fill="none" stroke={colors.line} strokeWidth="2" />
      <circle cx="100" cy="100" r="2.6" fill={colors.line} />
    </g>
  );
}

export function CompassMark({ className, scheme = 'light' }) {
  const colors = schemes[scheme];

  return (
    <svg viewBox="0 0 200 200" className={joinClasses('h-7 w-7 shrink-0', className)} aria-hidden="true">
      <circle cx="100" cy="100" r="90" fill="none" stroke={colors.line} strokeWidth="6" />
      {[0, 90, 180, 270].map((angle) => {
        const start = point(angle, 68);
        const end = point(angle, 88);
        return (
          <line
            key={angle}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={colors.line}
            strokeWidth="6"
            strokeLinecap="round"
          />
        );
      })}
      <CompassNeedle colors={colors} length={58} width={10} />
    </svg>
  );
}

export function BrandLogo({ className, markClassName, wordClassName, scheme = 'light' }) {
  return (
    <span className={joinClasses('inline-flex items-center gap-2.5', className)}>
      <CompassMark className={markClassName} scheme={scheme} />
      <span className={joinClasses('brujula-brand-word text-xl font-bold leading-none', wordClassName)}>
        Br<span className="brujula-brand-accent">ú</span>jula
      </span>
    </span>
  );
}

export function CompassSeal({ className, scheme = 'dark' }) {
  const colors = schemes[scheme];
  const pathId = `brujula-seal-${useId().replace(/:/g, '')}`;

  return (
    <svg viewBox="0 0 200 200" className={joinClasses('aspect-square w-full', className)} aria-hidden="true">
      <defs>
        <path id={pathId} d="M100,100 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0" />
      </defs>
      <circle cx="100" cy="100" r="96" fill="none" stroke={colors.line} strokeWidth="2" />
      <circle cx="100" cy="100" r="80" fill="none" stroke={colors.line} strokeWidth="1" opacity=".7" />
      <text fill={colors.line} fontFamily="Inter, system-ui, sans-serif" fontSize="9.6" fontWeight="600" letterSpacing="2.6">
        <textPath href={`#${pathId}`}>BRÚJULA · GRUPOS SCOUTS · ARGENTINA · </textPath>
      </text>
      {Array.from({ length: 48 }, (_, index) => {
        const angle = index * 7.5;
        const strong = index % 6 === 0;
        const start = point(angle, strong ? 71 : 74);
        const end = point(angle, 79);
        return (
          <line
            key={angle}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={colors.line}
            strokeWidth={strong ? 1.125 : 0.54}
            strokeLinecap="round"
          />
        );
      })}
      {['N', 'E', 'S', 'O'].map((label, index) => {
        const position = point(index * 90, 60);
        return (
          <text
            key={label}
            x={position.x}
            y={position.y + 2.88}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize="8"
            fontWeight="600"
            fill={colors.line}
          >
            {label}
          </text>
        );
      })}
      <CompassNeedle colors={colors} length={48} width={6} />
    </svg>
  );
}

export function CompassWatermark({ className }) {
  return (
    <div className={joinClasses('pointer-events-none absolute text-current', className)} aria-hidden="true">
      <CompassSeal className="h-full w-full" scheme="mono" />
    </div>
  );
}
