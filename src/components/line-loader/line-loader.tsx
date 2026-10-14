'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/* Loader de linhas: círculo → A → dado D20 → A → …
 * As mesmas 18 linhas mudam de posição para formar cada desenho. */

type Seg = [number, number, number, number];
const N = 18;
const C = 50;

const MORPH_MS = 720; // tempo da transformação
const HOLD_MS = 520; // tempo parado em cada desenho
const STAGGER_MS = 14; // atraso entre linhas

const angle = (x: number, y: number) => Math.atan2(y - C, x - C);

function normalize(segs: Seg[]): Seg[] {
  return segs
    .map(([x1, y1, x2, y2]) => (angle(x1, y1) <= angle(x2, y2) ? [x1, y1, x2, y2] : [x2, y2, x1, y1]) as Seg)
    .sort((a, b) => angle((a[0] + a[2]) / 2, (a[1] + a[3]) / 2) - angle((b[0] + b[2]) / 2, (b[1] + b[3]) / 2));
}

function split(x1: number, y1: number, x2: number, y2: number, n: number): Seg[] {
  return Array.from({ length: n }, (_, i) => [
    x1 + ((x2 - x1) * i) / n,
    y1 + ((y2 - y1) * i) / n,
    x1 + ((x2 - x1) * (i + 1)) / n,
    y1 + ((y2 - y1) * (i + 1)) / n,
  ]);
}

const CIRCLE = normalize(
  Array.from({ length: N }, (_, i) => {
    const a0 = (i / N) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / N) * Math.PI * 2 - Math.PI / 2;
    return [C + 38 * Math.cos(a0), C + 38 * Math.sin(a0), C + 38 * Math.cos(a1), C + 38 * Math.sin(a1)] as Seg;
  })
);

const LETTER_A = normalize([...split(50, 8, 17, 92, 7), ...split(50, 8, 83, 92, 7), ...split(29, 62, 71, 62, 4)]);

const H = { t: [50, 6], ur: [88, 28], lr: [88, 72], b: [50, 94], ll: [12, 72], ul: [12, 28] } as const;
const T = { a: [50, 30], r: [76, 70], l: [24, 70] } as const;
const ln = (p: readonly number[], q: readonly number[]): Seg => [p[0], p[1], q[0], q[1]];
const D20 = normalize([
  ln(H.t, H.ur), ln(H.ur, H.lr), ln(H.lr, H.b), ln(H.b, H.ll), ln(H.ll, H.ul), ln(H.ul, H.t),
  ln(T.a, T.r), ln(T.r, T.l), ln(T.l, T.a),
  ln(T.a, H.t), ln(T.a, H.ul), ln(T.a, H.ur),
  ln(T.r, H.ur), ln(T.r, H.lr), ln(T.r, H.b),
  ln(T.l, H.ul), ln(T.l, H.ll), ln(T.l, H.b),
]);

const SEQUENCE: Seg[][] = [CIRCLE, LETTER_A, D20, LETTER_A];
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export interface LineLoaderProps {
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
  color?: string;
}

export interface PageLoaderProps {
  label?: string;
  fullScreen?: boolean;
  className?: string;
  size?: number;
  stroke?: number;
  color?: string;
}

export function LineLoader({ size = 40, stroke = 1.6, label, className, color }: LineLoaderProps) {
  const linesRef = useRef<(SVGLineElement | null)[]>([]);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const draw = (segs: Seg[]) =>
      segs.forEach((s, i) => {
        const el = linesRef.current[i];
        if (!el) return;
        el.setAttribute('x1', s[0].toFixed(2));
        el.setAttribute('y1', s[1].toFixed(2));
        el.setAttribute('x2', s[2].toFixed(2));
        el.setAttribute('y2', s[3].toFixed(2));
      });

    if (reduce) {
      draw(LETTER_A);
      return;
    }

    const step = MORPH_MS + HOLD_MS + STAGGER_MS * N;
    const start = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const el = Math.max(0, now - start);
      const k = Math.floor(el / step);
      const local = el - k * step;
      const from = SEQUENCE[k % SEQUENCE.length];
      const to = SEQUENCE[(k + 1) % SEQUENCE.length];
      draw(
        from.map((f, i) => {
          const t = ease(Math.min(1, Math.max(0, (local - i * STAGGER_MS) / MORPH_MS)));
          const g = to[i];
          return [f[0] + (g[0] - f[0]) * t, f[1] + (g[1] - f[1]) * t, f[2] + (g[2] - f[2]) * t, f[3] + (g[3] - f[3]) * t] as Seg;
        })
      );
      raf = requestAnimationFrame(frame);
    };

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      style={color ? { color } : undefined}
      className={cn('inline-flex flex-col items-center text-[var(--text)]', label ? 'gap-3' : 'gap-0', className)}
    >
      <svg width={size} height={size} viewBox="-4 -4 108 108" fill="none" aria-hidden="true">
        {CIRCLE.map((s, i) => (
          <line
            key={i}
            ref={(el: SVGLineElement | null) => {
              linesRef.current[i] = el;
            }}
            x1={s[0]}
            y1={s[1]}
            x2={s[2]}
            y2={s[3]}
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {label ? <span className="text-[12.5px] text-[var(--text-3)] select-none">{label}</span> : <span className="sr-only">Carregando</span>}
    </div>
  );
}

export function PageLoader({
  label = 'Carregando…',
  fullScreen = false,
  className,
  size = 56,
  stroke = 1.6,
  color,
}: PageLoaderProps) {
  if (fullScreen) {
    return (
      <div className={cn('min-h-screen w-full flex items-center justify-center bg-[var(--bg)]', className)}>
        <LineLoader size={size} stroke={stroke} label={label} color={color} />
      </div>
    );
  }

  return (
    <div className={cn('py-20 grid place-items-center w-full', className)}>
      <LineLoader size={size} stroke={stroke} label={label} color={color} />
    </div>
  );
}

export default LineLoader;