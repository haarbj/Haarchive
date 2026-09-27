// A single linear-scale helper shared by any article figure that maps a
// real-world value onto an SVG viewBox coordinate -- kept tiny and
// dependency-free on purpose (see CLAUDE.md's "no charting library"
// convention; the Heat Tracker's own hand-built chart is the precedent).
export function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  return (value: number) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}
