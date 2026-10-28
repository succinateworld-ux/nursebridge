import React from "react";

type Point3 = [number, number, number];
type IceBlock = { center: Point3; size: Point3; angle?: number; id: string };
const yaw = -0.53;
const pitch = 0.19;

function project([x, y, z]: Point3) {
  const rx = x * Math.cos(yaw) - z * Math.sin(yaw);
  const rz = x * Math.sin(yaw) + z * Math.cos(yaw);
  const ry = y * Math.cos(pitch) - rz * Math.sin(pitch);
  return { x: 950 + rx * 105, y: 620 - ry * 105, depth: rz + y * .08 };
}

function faces(block: IceBlock) {
  const [cx, cy, cz] = block.center;
  const [sx, sy, sz] = block.size;
  const a = block.angle ?? 0;
  const corners: Point3[] = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
  ].map(([u, v, w]) => [cx + u * sx / 2 * Math.cos(a) - v * sy / 2 * Math.sin(a), cy + u * sx / 2 * Math.sin(a) + v * sy / 2 * Math.cos(a), cz + w * sz / 2] as Point3);
  return [
    { vertices: [0, 1, 2, 3], tone: "back" }, { vertices: [4, 5, 6, 7], tone: "front" },
    { vertices: [0, 4, 7, 3], tone: "side" }, { vertices: [1, 5, 6, 2], tone: "side" },
    { vertices: [3, 2, 6, 7], tone: "top" }, { vertices: [0, 1, 5, 4], tone: "back" }
  ].map(face => {
    const projected = face.vertices.map(index => project(corners[index]));
    return { ...face, depth: projected.reduce((sum, p) => sum + p.depth, 0) / 4, points: projected.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") };
  }).sort((a, b) => b.depth - a.depth);
}

const blocks: IceBlock[] = [
  { id: "island-left", center: [-3.45, -.17, .05] as Point3, size: [2.2, .38, 2.5] as Point3, angle: -.025 },
  { id: "island-right", center: [3.45, -.17, .05] as Point3, size: [2.2, .38, 2.5] as Point3, angle: .035 },
  ...Array.from({ length: 13 }, (_, i) => ({ id: `deck-${i}`, center: [-2.65 + i * .44, .1, 0] as Point3, size: [.41, .22, 1.75] as Point3 })),
  ...[-.69, .69].flatMap((z, layer) => Array.from({ length: 13 }, (_, i) => {
    const angle = Math.PI * i / 12;
    return { id: `arch-${layer}-${i}`, center: [2.52 * Math.cos(angle), .43 + 2.52 * Math.sin(angle), z] as Point3, size: [.58, .59, .6] as Point3, angle: angle + Math.PI / 2 };
  }))
].sort((a, b) => project(b.center).depth - project(a.center).depth);

export default function GlacierScene() {
  return <div className="gl-scene" aria-hidden="true" onPointerMove={event => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--scene-dx", `${((event.clientX - rect.left) / rect.width - .5) * 13}px`);
    event.currentTarget.style.setProperty("--scene-dy", `${((event.clientY - rect.top) / rect.height - .5) * 7}px`);
  }} onPointerLeave={event => { event.currentTarget.style.setProperty("--scene-dx", "0px"); event.currentTarget.style.setProperty("--scene-dy", "0px"); }}>
    <svg viewBox="0 0 1440 940" preserveAspectRatio="xMidYMid slice" role="presentation">
      <defs>
        <linearGradient id="gl-sky" x2="0" y2="1"><stop stopColor="#b5bfcc"/><stop offset=".58" stopColor="#dfe6ed"/><stop offset="1" stopColor="#f2f5f7"/></linearGradient>
        <linearGradient id="gl-ridge" x2=".2" y2="1"><stop stopColor="#c2ccd6"/><stop offset="1" stopColor="#f0f4f7"/></linearGradient>
        <linearGradient id="gl-ice-top" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".98"/><stop offset=".55" stopColor="#ecfaff" stopOpacity=".92"/><stop offset="1" stopColor="#bdcedd" stopOpacity=".85"/></linearGradient>
        <linearGradient id="gl-ice-front" x1=".1" y1="0" x2=".8" y2="1"><stop stopColor="#f9ffff" stopOpacity=".94"/><stop offset=".45" stopColor="#c2d6e0" stopOpacity=".92"/><stop offset="1" stopColor="#819baa" stopOpacity=".85"/></linearGradient>
        <linearGradient id="gl-ice-side" x2=".7" y2="1"><stop stopColor="#dcecf3"/><stop offset=".6" stopColor="#91a8bb"/><stop offset="1" stopColor="#c1d4df"/></linearGradient>
        <linearGradient id="gl-ice-back" x2="0" y2="1"><stop stopColor="#b0c7d6"/><stop offset="1" stopColor="#e8f5fb"/></linearGradient>
        <radialGradient id="gl-halo"><stop stopColor="#fff" stopOpacity=".9"/><stop offset=".42" stopColor="#e1ffff" stopOpacity=".55"/><stop offset="1" stopColor="#e1ffff" stopOpacity="0"/></radialGradient>
        <filter id="gl-soft"><feGaussianBlur stdDeviation="24"/></filter>
        <filter id="gl-shadow"><feGaussianBlur stdDeviation="13"/></filter>
        <filter id="gl-block-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#455d71" floodOpacity=".2"/></filter>
      </defs>
      <rect width="1440" height="940" fill="url(#gl-sky)"/>
      <path d="M0 480 170 455 300 360 435 422 540 385 695 440 820 340 970 418 1110 367 1275 435 1440 389V940H0Z" fill="#c4cdd7" opacity=".42" filter="url(#gl-soft)"/>
      <path d="M0 606Q200 414 462 547T902 522T1440 515V940H0Z" fill="url(#gl-ridge)"/>
      <path d="M0 762Q215 570 455 650T940 620T1440 666V940H0Z" fill="#e7edf2"/>
      <ellipse cx="809" cy="672" rx="422" ry="58" fill="#667b8e" opacity=".2" filter="url(#gl-shadow)"/>
      <ellipse cx="783" cy="434" rx="400" ry="350" fill="url(#gl-halo)"/>
      <g className="gl-scene-object" filter="url(#gl-block-shadow)">
        {blocks.map((block, index) => <g key={block.id} className={`gl-ice-block ${block.id.startsWith("arch") ? "gl-arch-block" : ""}`} style={{ "--block-i": index } as React.CSSProperties}>
          {faces(block).map((face, i) => <polygon key={i} points={face.points} fill={`url(#gl-ice-${face.tone})`} stroke="#f5ffff" strokeOpacity=".77" strokeWidth="1.2" strokeLinejoin="round"/>)}
        </g>)}
        <path d="M500 632 1037 480" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.5"/>
        <path d="M554 658 1092 507" fill="none" stroke="#e3fcff" strokeOpacity=".8" strokeWidth="1.5"/>
      </g>
      <path d="M0 854Q280 737 512 801T930 804T1440 719V940H0Z" fill="#f0f4f7" opacity=".9"/>
      <g className="gl-snow">{Array.from({ length: 92 }, (_, i) => <circle key={i} cx={(i * 177.3) % 1440} cy={(i * 89.7) % 940} r={i % 7 === 0 ? 1.6 : .8} fill="#fff" opacity={.15 + i % 4 * .14}/>)}</g>
      <g className="gl-object-label" fill="none" stroke="#536b7e" strokeOpacity=".5" strokeWidth=".8"><path d="M1000 300h96l48-42h97"/><circle cx="1000" cy="300" r="3"/><path d="M501 615H404l-43 42h-63"/><circle cx="501" cy="615" r="3"/></g>
      <g className="gl-object-label" fontFamily="ui-monospace,monospace" fontSize="10" fill="#4c6377" letterSpacing="1.4"><text x="1151" y="247">01 / BUILD YOUR FUTURE</text><text x="224" y="678">ONE STEP AT A TIME</text></g>
    </svg>
  </div>;
}
