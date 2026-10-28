export default function BridgeArtwork() {
  return <svg className="nb-bridge-art" viewBox="0 0 600 490" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="nb-arch" x1="140" y1="140" x2="460" y2="330" gradientUnits="userSpaceOnUse"><stop stopColor="#E1FFF1"/><stop offset=".28" stopColor="#6FFFD3"/><stop offset=".6" stopColor="#23A892"/><stop offset="1" stopColor="#B7FFDE"/></linearGradient>
      <linearGradient id="nb-deck" x1="100" y1="280" x2="475" y2="385" gradientUnits="userSpaceOnUse"><stop stopColor="#1C4948"/><stop offset=".5" stopColor="#80E4C9"/><stop offset="1" stopColor="#225A55"/></linearGradient>
      <radialGradient id="nb-halo"><stop stopColor="#45DDB0" stopOpacity=".19"/><stop offset="1" stopColor="#45DDB0" stopOpacity="0"/></radialGradient>
      <linearGradient id="nb-glass" x1="118" y1="310" x2="460" y2="453" gradientUnits="userSpaceOnUse"><stop stopColor="#3E536B" stopOpacity=".4"/><stop offset="1" stopColor="#111B2C" stopOpacity=".1"/></linearGradient>
    </defs>
    <ellipse cx="300" cy="260" rx="270" ry="225" fill="url(#nb-halo)"/>
    <g stroke="#537082" strokeOpacity=".2"><path d="M38 355 300 205l262 150-262 150Z"/><path d="m88 383 262-150M140 413l262-150M193 443l262-150M88 326l262 150M140 296l262 150M193 266l262 150"/></g>
    <ellipse cx="304" cy="376" rx="146" ry="38" fill="#020914" opacity=".7"/>
    <g className="nb-floating-bridge">
      <path d="m108 326 196-112 196 112-196 113Z" fill="url(#nb-glass)" stroke="#8AE4D0" strokeOpacity=".23"/>
      <path d="m127 315 174-99 174 99-174 100Z" stroke="#7ACAB7" strokeOpacity=".15"/>
      <path d="m157 302 177-102 112 64-178 103Z" fill="#112B32" stroke="#3F766D"/>
      <path d="m157 302 111 65v20l-111-64Z" fill="#163E3E"/>
      <path d="m268 367 178-103v20L268 387Z" fill="url(#nb-deck)"/>
      <path d="M192 305V210c0-82 64-142 128-104l31 18c-64-38-128 22-128 104v95Z" fill="#12594F" stroke="#6FFFD3" strokeOpacity=".5"/>
      <path d="M223 323V228c0-82 64-142 128-104 47 27 66 80 66 145v18l-33 19v-40c0-49-15-83-48-102-41-24-80 17-80 78v100Z" fill="url(#nb-arch)"/>
      <path d="M223 323V228c0-82 64-142 128-104 47 27 66 80 66 145" stroke="#D8FFF0" strokeWidth="2"/>
      <path d="M256 342V242c0-61 39-102 80-78 33 19 48 53 48 102v40" stroke="#0B4B46" strokeWidth="2"/>
      <path d="m165 307 105 60 167-97" stroke="#BBFFE5" strokeOpacity=".7" strokeWidth="2"/>
      <path d="m177 323 91 52 163-94" stroke="#63E7C3" strokeOpacity=".4"/>
      <circle cx="302" cy="239" r="29" fill="#10283A" stroke="#85F2D4" strokeOpacity=".35"/>
      <path d="M302 226v26m-13-13h26" stroke="#B6FFE5" strokeWidth="6" strokeLinecap="round"/>
    </g>
    <g className="nb-art-orbit" stroke="#9AB4D0" strokeOpacity=".3"><ellipse cx="300" cy="242" rx="227" ry="67" transform="rotate(-25 300 242)" strokeDasharray="3 8"/><circle cx="100" cy="328" r="5" fill="#B4A2FF" stroke="none"/><circle cx="490" cy="152" r="4" fill="#82F3CD" stroke="none"/></g>
    <g fill="#9EB3C8" fontFamily="ui-monospace, monospace" fontSize="10" letterSpacing="2"><text x="58" y="130">LEARN</text><text x="431" y="383">BECOME</text></g>
    <path d="M88 147v20m-10-10h20M489 331v14m-7-7h14" stroke="#B6A2FF" strokeOpacity=".7"/>
  </svg>;
}
