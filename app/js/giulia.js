// Giulia v2 - original animated teacher (inline SVG + CSS + a little JS).
// States: idle, asking, thinking, happy, sad, explain, celebrate.
// Lip sync: talkWord(word) plays mouth shapes for the vowels of each spoken word
// (driven by the speech "boundary" events); a gentle rhythm is used if the voice sends none.

const SKIN = "#f2c4a0", SKIN_SH = "#e2a681", HAIR = "#2a1812", HAIR_HI = "#5a3426", JACKET = "#4338ca", JACKET_D = "#3730a3";

const SVG = `
<svg viewBox="0 0 240 260" role="img" aria-label="Giulia, your driving teacher">
  <defs>
    <linearGradient id="gjShine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".15"/></linearGradient>
    <clipPath id="gjEyeL"><ellipse cx="103" cy="108" rx="8.5" ry="9.5"/></clipPath>
    <clipPath id="gjEyeR"><ellipse cx="137" cy="108" rx="8.5" ry="9.5"/></clipPath>
  </defs>

  <g class="gj-fx gj-dots" fill="#a5b4fc"><circle cx="180" cy="58" r="4"/><circle cx="192" cy="44" r="5.5"/><circle cx="206" cy="27" r="7.5"/></g>
  <g class="gj-fx gj-confetti">
    <rect x="28" y="40" width="7" height="12" rx="2" fill="#facc15"/><rect x="200" y="70" width="7" height="12" rx="2" fill="#22c55e"/>
    <circle cx="48" cy="86" r="5" fill="#60a5fa"/><circle cx="196" cy="28" r="5" fill="#f472b6"/>
    <rect x="18" y="120" width="6" height="11" rx="2" fill="#f472b6"/><rect x="214" y="118" width="6" height="11" rx="2" fill="#facc15"/>
    <path d="M60 20 l5 9 l-10 0 z" fill="#22c55e"/><path d="M178 96 l5 9 l-10 0 z" fill="#60a5fa"/>
  </g>

  <g class="gj-fx gj-sparkle">
    <path d="M40 60 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z" fill="#facc15"/>
    <path d="M196 44 l2.4 6 l6 2.4 l-6 2.4 l-2.4 6 l-2.4 -6 l-6 -2.4 l6 -2.4 z" fill="#facc15"/>
    <path d="M206 120 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="#a5b4fc"/>
    <path d="M26 130 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="#f472b6"/>
  </g>
  <g class="gj-rig">
  <g class="gj-body">
    <!-- back hair -->
    <path class="gj-hairback" d="M70 104 C64 60 92 34 122 34 C154 34 178 60 172 106 C170 132 178 150 168 168 C160 176 148 172 146 160 L150 112 L92 112 L94 160 C92 172 80 176 72 168 C62 150 70 132 70 104 Z" fill="${HAIR}"/>
    <!-- torso -->
    <path d="M106 146 L106 174 Q120 184 134 174 L134 146 Z" fill="${SKIN_SH}"/>
    <path d="M50 262 C50 214 70 186 104 176 L120 198 L136 176 C170 186 190 214 190 262 Z" fill="${JACKET}"/>
    <path d="M50 262 C50 214 70 186 104 176 L120 198 L136 176 C170 186 190 214 190 262 Z" fill="url(#gjShine)"/>
    <path d="M104 176 L120 216 L136 176 L130 172 L120 188 L110 172 Z" fill="#ffffff"/>
    <path d="M110 172 L120 188 L130 172 Q120 179 110 172 Z" fill="${SKIN}"/>
    <path d="M104 176 L120 216 L109 226 L95 192 Z" fill="${JACKET_D}"/>
    <path d="M136 176 L120 216 L131 226 L145 192 Z" fill="${JACKET_D}"/>
    <path d="M114 178 L147 214" stroke="#f43f5e" stroke-width="2.5"/>
    <g transform="translate(150 224) rotate(-8)"><rect x="-11" y="-6" width="22" height="28" rx="4" fill="#facc15"/><rect x="-7" y="-2" width="14" height="9" rx="2" fill="#fff"/><text y="17" text-anchor="middle" font-size="9" font-weight="900" fill="#1e1b4b" font-family="system-ui,sans-serif">G</text></g>

    <!-- arms: one group per pose -->
    <g class="gj-arms gj-a-tablet">
      <path d="M60 196 C48 214 52 238 80 248 L92 236 C76 228 72 214 78 200 Z" fill="${JACKET}"/>
      <path d="M180 196 C192 214 188 238 160 248 L148 236 C164 228 168 214 162 200 Z" fill="${JACKET}"/>
      <g transform="rotate(-6 120 246)"><rect x="80" y="226" width="80" height="50" rx="8" fill="#0f172a"/><rect x="85" y="231" width="70" height="40" rx="4" fill="#38bdf8"/>
        <path d="M95 262 L108 246 L118 256 L130 240 L146 262 Z" fill="#0ea5e9"/><circle cx="140" cy="242" r="5" fill="#fef08a"/></g>
      <circle cx="86" cy="242" r="8" fill="${SKIN}"/><circle cx="154" cy="240" r="8" fill="${SKIN}"/>
    </g>
    <g class="gj-arms gj-a-leftdown"><path d="M60 196 C50 220 54 244 62 262 L80 262 C76 242 74 222 78 202 Z" fill="${JACKET}"/></g>
    <g class="gj-arms gj-a-rightdown"><path d="M180 196 C190 220 186 244 178 262 L160 262 C164 242 166 222 162 202 Z" fill="${JACKET}"/></g>
    <g class="gj-arms gj-a-point">
      <path d="M170 192 C190 186 206 170 216 148 L228 154 C218 180 200 200 180 210 Z" fill="${JACKET}"/>
      <path d="M216 150 L236 120" stroke="#7c5a3a" stroke-width="3.5" stroke-linecap="round"/><circle cx="236" cy="119" r="3.5" fill="#facc15"/>
      <circle cx="222" cy="148" r="9" fill="${SKIN}"/>
    </g>
    <g class="gj-arms gj-a-thumb">
      <path d="M170 192 C192 196 206 186 210 166 L196 160 C192 174 186 180 176 182 Z" fill="${JACKET}"/>
      <circle cx="203" cy="156" r="10" fill="${SKIN}"/><path d="M204 147 L204 134" stroke="${SKIN}" stroke-width="7" stroke-linecap="round"/>
    </g>
    <g class="gj-arms gj-a-chin">
      <path d="M62 200 C56 226 66 246 94 242 L104 230 C86 232 78 224 80 206 Z" fill="${JACKET}"/>
      <path d="M96 238 C102 212 106 182 110 166" stroke="${JACKET}" stroke-width="15" stroke-linecap="round" fill="none"/>
      <circle cx="111" cy="160" r="9" fill="${SKIN}"/>
    </g>
    <g class="gj-arms gj-a-up">
      <path d="M64 196 C46 178 38 152 38 126 L52 124 C54 150 62 170 78 184 Z" fill="${JACKET}"/><circle cx="45" cy="118" r="9.5" fill="${SKIN}"/>
      <path d="M176 196 C194 178 202 152 202 126 L188 124 C186 150 178 170 162 184 Z" fill="${JACKET}"/><circle cx="195" cy="118" r="9.5" fill="${SKIN}"/>
    </g>

    <!-- head -->
    <g class="gj-head">
      <ellipse cx="79" cy="110" rx="6" ry="9" fill="${SKIN_SH}"/><ellipse cx="161" cy="110" rx="6" ry="9" fill="${SKIN_SH}"/>
      <circle cx="79" cy="124" r="4" fill="none" stroke="#f5b301" stroke-width="2"/><circle cx="161" cy="124" r="4" fill="none" stroke="#f5b301" stroke-width="2"/>
      <path d="M78 100 C78 66 98 48 120 48 C142 48 162 66 162 100 C162 128 146 152 120 156 C94 152 78 128 78 100 Z" fill="${SKIN}"/>
      <ellipse cx="95" cy="128" rx="8" ry="5" fill="#f49c8b" class="gj-blush"/><ellipse cx="145" cy="128" rx="8" ry="5" fill="#f49c8b" class="gj-blush"/>
      <!-- eyes -->
      <g class="gj-eyes">
        <g class="gj-eye"><ellipse cx="103" cy="108" rx="8.5" ry="9.5" fill="#fff"/>
          <g clip-path="url(#gjEyeL)"><g class="gj-pupil"><circle cx="103" cy="109" r="6.2" fill="#6b4226"/><circle cx="103" cy="109" r="3.1" fill="#1c1310"/><circle cx="105.3" cy="106.3" r="1.9" fill="#fff"/><circle cx="101" cy="111.5" r=".9" fill="#fff"/></g></g>
          <path d="M93.5 103 Q103 95.5 112.5 101.5 L115.5 98.5" stroke="#1c1310" stroke-width="2.8" fill="none" stroke-linecap="round"/></g>
        <g class="gj-eye"><ellipse cx="137" cy="108" rx="8.5" ry="9.5" fill="#fff"/>
          <g clip-path="url(#gjEyeR)"><g class="gj-pupil"><circle cx="137" cy="109" r="6.2" fill="#6b4226"/><circle cx="137" cy="109" r="3.1" fill="#1c1310"/><circle cx="139.3" cy="106.3" r="1.9" fill="#fff"/><circle cx="135" cy="111.5" r=".9" fill="#fff"/></g></g>
          <path d="M146.5 103 Q137 95.5 127.5 101.5 L124.5 98.5" stroke="#1c1310" stroke-width="2.8" fill="none" stroke-linecap="round"/></g>
      </g>
      <g class="gj-eyes-happy" stroke="#1c1310" stroke-width="3.2" fill="none" stroke-linecap="round">
        <path d="M94 111 Q103 100 112 111"/><path d="M128 111 Q137 100 146 111"/>
      </g>
      <path class="gj-brow gj-brow-l" d="M92 91 Q103 84 114 89" stroke="${HAIR}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
      <path class="gj-brow gj-brow-r" d="M126 89 Q137 84 148 91" stroke="${HAIR}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
      <path d="M120 113 Q116.5 123 121 125.5" stroke="#d08b6c" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- mouth -->
      <g class="gj-mouth" transform="translate(120 137)">
        <path class="gj-m gj-m-smile" d="M-11 -1 Q0 8 11 -1" stroke="#8a2f2f" stroke-width="3" fill="none" stroke-linecap="round"/>
        <g class="gj-m gj-m-talk"><g class="gj-m-open">
          <path d="M-10 -2 Q0 -4 10 -2 Q8 11 0 12 Q-8 11 -10 -2 Z" fill="#6f1d1d"/>
          <path d="M-8 -1.6 Q0 -3.2 8 -1.6 L7.2 1.6 Q0 .6 -7.2 1.6 Z" fill="#fff"/>
          <ellipse cy="8" rx="5" ry="3" fill="#e8747c"/></g></g>
        <g class="gj-m gj-m-big"><path d="M-14 -2 Q0 -3 14 -2 Q12 15 0 16 Q-12 15 -14 -2 Z" fill="#6f1d1d"/>
          <path d="M-11.5 -1.6 Q0 -2.6 11.5 -1.6 L10.5 2.6 Q0 1.4 -10.5 2.6 Z" fill="#fff"/><ellipse cy="10.5" rx="6.5" ry="3.6" fill="#e8747c"/></g>
        <path class="gj-m gj-m-hmm" d="M-6 2 Q2 -1.5 9 1" stroke="#8a2f2f" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path class="gj-m gj-m-kind" d="M-8 1.5 Q0 5 8 1.5" stroke="#8a2f2f" stroke-width="3" fill="none" stroke-linecap="round"/>
        <g class="gj-m gj-m-o"><ellipse cy="3" rx="6" ry="7.5" fill="#6f1d1d"/><ellipse cy="7" rx="3.6" ry="2.4" fill="#e8747c"/></g>
      </g>
      <!-- front hair -->
      <g class="gj-fringe">
        <path d="M84 76 C90 52 106 42 120 42 C136 42 152 52 158 76 C148 62 134 56 120 56 C106 56 94 62 84 76 Z" fill="${HAIR}"/>
        <path class="gj-strand-l" d="M78 100 C74 70 94 50 120 50 C108 62 100 76 92 106 C88 104 82 102 78 100 Z" fill="${HAIR}"/>
        <path class="gj-strand-r" d="M162 100 C166 70 146 50 120 50 C132 62 140 76 150 106 C154 104 158 102 162 100 Z" fill="${HAIR}"/>
        <path d="M104 50 Q94 60 89 80" stroke="${HAIR_HI}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M138 52 Q148 62 152 80" stroke="${HAIR_HI}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M146 54 C154 50 160 52 162 58" stroke="#f43f5e" stroke-width="5" stroke-linecap="round" fill="none"/>
      </g>
    </g>
  </g>
  </g>
</svg>`;

const CSS = `
.giulia svg{display:block;width:100%;height:auto;overflow:visible}
.giulia .gj-body{transform-origin:120px 260px;animation:gjBreathe 4.2s ease-in-out infinite}
.giulia .gj-head{transform-origin:120px 160px;transition:transform .5s cubic-bezier(.34,1.5,.5,1);animation:gjSway 7s ease-in-out infinite}
.giulia .gj-strand-l{transform-origin:100px 54px;animation:gjHairL 5s ease-in-out infinite}
.giulia .gj-strand-r{transform-origin:140px 54px;animation:gjHairR 5.6s ease-in-out infinite}
.giulia .gj-hairback{transform-origin:120px 40px;animation:gjHairB 6s ease-in-out infinite}
.giulia .gj-eyes{transform-origin:120px 108px;transition:transform .08s}
.giulia.blink .gj-eyes{transform:scaleY(.08)}
.giulia .gj-pupil{transition:transform .35s cubic-bezier(.3,1.4,.5,1)}
.giulia .gj-eyes-happy{opacity:0;transition:opacity .2s}
.giulia .gj-brow{transition:transform .35s ease}
.giulia .gj-brow-l{transform-origin:103px 88px}.giulia .gj-brow-r{transform-origin:137px 88px}
.giulia .gj-m{opacity:0;transition:opacity .12s}
.giulia .gj-m-open{transform:scale(1,.15);transition:transform .07s ease-out}
.giulia .gj-arms{opacity:0;transform:scale(.92);transition:opacity .25s, transform .45s cubic-bezier(.34,1.6,.5,1)}
.giulia .gj-a-point,.giulia .gj-a-thumb{transform-origin:176px 196px;transform:rotate(25deg) scale(.9)}
.giulia .gj-a-up{transform-origin:120px 200px}
.giulia .gj-a-chin{transform-origin:70px 210px;transform:rotate(-15deg)}
.giulia .gj-fx{opacity:0;transition:opacity .3s}
.giulia .gj-blush{opacity:.35;transition:opacity .3s}

/* default/idle + asking: holding the tablet */
.giulia.s-idle .gj-a-tablet,.giulia.s-asking .gj-a-tablet,.giulia.s-sad .gj-a-tablet{opacity:1;transform:none}
.giulia.s-idle .gj-m-smile,.giulia.s-asking .gj-m-smile{opacity:1}
.giulia.talking .gj-m{opacity:0!important}.giulia.talking .gj-m-talk{opacity:1!important}
/* thinking */
.giulia.s-thinking .gj-a-chin,.giulia.s-thinking .gj-a-rightdown{opacity:1;transform:none}
.giulia.s-thinking .gj-head{transform:rotate(-7deg)}
.giulia.s-thinking .gj-m-hmm{opacity:1}
.giulia.s-thinking .gj-dots{opacity:1}
.giulia.s-thinking .gj-dots circle{animation:gjDot 1.4s infinite}
.giulia.s-thinking .gj-dots circle:nth-child(2){animation-delay:.2s}.giulia.s-thinking .gj-dots circle:nth-child(3){animation-delay:.4s}
.giulia.s-thinking .gj-brow-r{transform:translateY(-3px) rotate(-6deg)}
/* happy */
.giulia.s-happy .gj-a-thumb,.giulia.s-happy .gj-a-leftdown{opacity:1;transform:none}
.giulia.s-happy .gj-m-big{opacity:1}
.giulia.s-happy .gj-eyes,.giulia.s-celebrate .gj-eyes{opacity:0}
.giulia.s-happy .gj-eyes-happy,.giulia.s-celebrate .gj-eyes-happy{opacity:1}
.giulia.s-happy .gj-blush,.giulia.s-celebrate .gj-blush{opacity:.8}
.giulia.s-happy .gj-body{animation:gjHop .5s cubic-bezier(.3,1.6,.5,1) 2, gjBreathe 4.2s ease-in-out 1s infinite}
.giulia.s-happy .gj-a-thumb{animation:gjWiggle .5s ease-in-out .3s 2}
/* sad but kind */
.giulia.s-sad .gj-m-kind{opacity:1}
.giulia.s-sad .gj-head{transform:rotate(6deg) translateY(2px)}
.giulia.s-sad .gj-brow-l{transform:rotate(14deg) translateY(-1px)}
.giulia.s-sad .gj-brow-r{transform:rotate(-14deg) translateY(-1px)}
/* explaining */
.giulia.s-explain .gj-a-point,.giulia.s-explain .gj-a-leftdown{opacity:1;transform:none}
.giulia.s-explain .gj-a-point{animation:gjPoint 1.6s ease-in-out infinite}
.giulia.s-explain .gj-m-smile{opacity:1}
.giulia.s-explain .gj-head{transform:rotate(4deg)}
.giulia.s-explain .gj-brow-l,.giulia.s-explain .gj-brow-r{transform:translateY(-2px)}
/* celebrating */
.giulia.s-celebrate .gj-a-up{opacity:1;transform:none}
.giulia.s-celebrate .gj-m-big{opacity:1}
.giulia.s-celebrate .gj-confetti{opacity:1}
.giulia.s-celebrate .gj-confetti *{animation:gjPop 1.3s ease-out infinite}
.giulia.s-celebrate .gj-confetti *:nth-child(2n){animation-delay:.35s}.giulia.s-celebrate .gj-confetti *:nth-child(3n){animation-delay:.7s}
.giulia.s-celebrate .gj-body{animation:gjJump .55s cubic-bezier(.3,1.5,.5,1) infinite alternate}

/* rig: leaning towards a button, poke reactions, entrance (motion design: anticipation, squash & stretch, overshoot) */
.giulia .gj-rig{transform-origin:120px 262px;transition:transform .5s cubic-bezier(.34,1.56,.64,1)}
.giulia.lean-l .gj-rig{transform:rotate(-6deg) translateX(-6px)}
.giulia.lean-r .gj-rig{transform:rotate(6deg) translateX(6px)}
.giulia.poked .gj-rig{animation:gjPoke .75s cubic-bezier(.3,1.5,.5,1)}
.giulia.poked .gj-m{opacity:0!important}.giulia.poked .gj-m-big{opacity:1!important}
.giulia.poked .gj-eyes{opacity:0}.giulia.poked .gj-eyes-happy{opacity:1}
.giulia.enter .gj-rig{animation:gjEnter .8s cubic-bezier(.3,1.5,.5,1) both}
.giulia .gj-sparkle path{transform-box:fill-box;transform-origin:center}
.giulia.s-happy .gj-sparkle,.giulia.s-celebrate .gj-sparkle,.giulia.poked .gj-sparkle{opacity:1}
.giulia.s-happy .gj-sparkle path,.giulia.s-celebrate .gj-sparkle path,.giulia.poked .gj-sparkle path{animation:gjTwinkle .9s ease-in-out infinite}
.giulia .gj-sparkle path:nth-child(2){animation-delay:.2s!important}.giulia .gj-sparkle path:nth-child(3){animation-delay:.45s!important}.giulia .gj-sparkle path:nth-child(4){animation-delay:.65s!important}
/* surprised "oh!" */
.giulia.s-oh .gj-a-leftdown,.giulia.s-oh .gj-a-rightdown{opacity:1;transform:none}
.giulia.s-oh .gj-m-o{opacity:1}
.giulia.s-oh .gj-eyes{transform:scale(1.12)}
.giulia.s-oh .gj-brow-l,.giulia.s-oh .gj-brow-r{transform:translateY(-6px)}
.giulia.s-oh .gj-rig{animation:gjStartle .5s cubic-bezier(.3,1.6,.5,1)}
/* happy gets anticipation (a small squash) before the hop */
.giulia.s-happy .gj-rig{animation:gjAnticipate .7s cubic-bezier(.3,1.5,.5,1)}
@keyframes gjPoke{0%{transform:none}18%{transform:scale(1.06,.9)}45%{transform:scale(.95,1.08) translateY(-10px) rotate(-3deg)}70%{transform:scale(1.02,.98) rotate(2deg)}100%{transform:none}}
@keyframes gjEnter{0%{transform:translateY(60px) scale(.7);opacity:0}60%{transform:translateY(-8px) scale(1.04);opacity:1}100%{transform:none}}
@keyframes gjTwinkle{0%,100%{transform:scale(.4) rotate(0);opacity:.3}50%{transform:scale(1.15) rotate(45deg);opacity:1}}
@keyframes gjStartle{0%{transform:none}30%{transform:scale(1.05,.94)}60%{transform:translateY(-6px) scale(.97,1.05)}100%{transform:none}}
@keyframes gjAnticipate{0%{transform:none}20%{transform:scale(1.05,.92)}55%{transform:translateY(-14px) scale(.96,1.06)}80%{transform:translateY(2px) scale(1.02,.98)}100%{transform:none}}
@keyframes gjBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.012,1.018)}}
@keyframes gjSway{0%,100%{rotate:0deg}50%{rotate:1.6deg}}
@keyframes gjHairL{0%,100%{transform:rotate(0)}50%{transform:rotate(-2.5deg)}}
@keyframes gjHairR{0%,100%{transform:rotate(0)}50%{transform:rotate(2.5deg)}}
@keyframes gjHairB{0%,100%{transform:skewX(0)}50%{transform:skewX(1.5deg)}}
@keyframes gjDot{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes gjHop{0%{transform:translateY(0)}40%{transform:translateY(-10px) scale(1.02,.98)}100%{transform:translateY(0)}}
@keyframes gjJump{from{transform:translateY(0)}to{transform:translateY(-12px)}}
@keyframes gjWiggle{50%{transform:rotate(-12deg)}}
@keyframes gjPoint{0%,100%{transform:none}50%{transform:rotate(-5deg) translate(2px,-3px)}}
@keyframes gjPop{0%{transform:translateY(8px);opacity:0}30%{opacity:1}100%{transform:translateY(-18px) rotate(40deg);opacity:0}}
@media (prefers-reduced-motion: reduce){.giulia *{animation:none!important}}
:root[data-motion="reduce"] .giulia *{animation:none!important}
`;

let cssDone = false;
function injectCss() {
  if (cssDone) return;
  const s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); cssDone = true;
}

const STATES = ["idle", "asking", "thinking", "happy", "sad", "explain", "celebrate", "oh"];
// where the eyes look in each state (pupil offset in px)
const GAZE = { idle: [0, 0], asking: [0, .5], thinking: [-3, -3.5], happy: [0, 0], sad: [0, 2], explain: [3.5, 2.5], celebrate: [0, 0], oh: [0, 0] };
// states in which the eyes follow your finger / mouse
const FOLLOW = new Set(["idle", "asking", "thinking", "sad"]);

// mouth shape per vowel: [width, open]
const VISEME = { a: [1.12, 1], e: [1.15, .6], i: [1.2, .42], o: [.78, .85], u: [.7, .62], "": [1, .35] };

export function createGiulia(container) {
  injectCss();
  const wrap = document.createElement("div");
  wrap.className = "giulia s-idle";
  wrap.innerHTML = SVG;
  container.appendChild(wrap);
  const mouth = wrap.querySelector(".gj-m-open");
  const pupils = wrap.querySelectorAll(".gj-pupil");
  let state = "idle", alive = true, lastFollow = 0;
  let timers = [], fallback = 0, sawBoundary = false, talking = false;

  function setOpen(w, o) { mouth.style.transform = `scale(${w.toFixed(2)},${Math.max(.12, o).toFixed(2)})`; }
  function look(x, y) { pupils.forEach(p => { p.style.transform = `translate(${x}px,${y}px)`; }); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // natural random blinking (sometimes a double blink)
  (function blinkLoop() {
    if (!alive) return;
    const wait = 2200 + Math.random() * 3800;
    setTimeout(() => {
      if (!alive || !wrap.isConnected) { alive = wrap.isConnected; if (!alive) return; }
      wrap.classList.add("blink");
      setTimeout(() => wrap.classList.remove("blink"), 120);
      if (Math.random() < .25) setTimeout(() => { wrap.classList.add("blink"); setTimeout(() => wrap.classList.remove("blink"), 110); }, 260);
      blinkLoop();
    }, wait);
  })();
  // little glances while idle / thinking
  (function glanceLoop() {
    setTimeout(() => {
      if (!wrap.isConnected) return;
      if ((state === "idle" || state === "thinking") && Date.now() - lastFollow > 2500) {
        const g = GAZE[state];
        look(g[0] + (Math.random() * 4 - 2), g[1] + (Math.random() * 2 - 1));
        setTimeout(() => { const g2 = GAZE[state] || [0, 0]; look(g2[0], g2[1]); }, 900);
      }
      glanceLoop();
    }, 3500 + Math.random() * 3000);
  })();

  const api = {
    el: wrap,
    get state() { return state; },
    set(s) {
      if (!STATES.includes(s)) s = "idle";
      STATES.forEach(x => wrap.classList.remove("s-" + x));
      // restart one-shot animations (hop, wiggle)
      void wrap.offsetWidth;
      wrap.classList.add("s-" + s);
      state = s;
      const g = GAZE[s]; look(g[0], g[1]);
      if (s !== "asking" && s !== "explain") api.talkStop();
    },
    look,
    /** Eyes follow a point on the screen (finger or mouse). */
    lookAt(cx, cy) {
      if (!FOLLOW.has(state) || !wrap.isConnected) return;
      const r = wrap.getBoundingClientRect();
      if (!r.width) return;
      const ex = r.left + r.width * .5, ey = r.top + r.height * (108 / 260);
      const dx = cx - ex, dy = cy - ey, d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 220);
      look((dx / d) * 4 * k, (dy / d) * 3.4 * k);
      lastFollow = Date.now();
    },
    /** Tapped: squash, stretch, giggle. */
    poke() {
      wrap.classList.remove("poked"); void wrap.offsetWidth; wrap.classList.add("poked");
      setTimeout(() => wrap.classList.remove("poked"), 800);
    },
    /** Lean towards the left or right button ("L" | "R" | null). */
    lean(dir) {
      wrap.classList.toggle("lean-l", dir === "L");
      wrap.classList.toggle("lean-r", dir === "R");
      if (dir) look(dir === "L" ? -4 : 4, 3);
    },
    enter() { wrap.classList.remove("enter"); void wrap.offsetWidth; wrap.classList.add("enter"); },
    talkStart() {
      talking = true; sawBoundary = false;
      wrap.classList.add("talking");
      setOpen(1, .4);
      clearInterval(fallback);
      fallback = setTimeout(() => {
        if (!talking || sawBoundary) return;
        fallback = setInterval(() => {
          if (!talking || sawBoundary) return;
          const v = "aeiou"[Math.floor(Math.random() * 5)];
          const [w, o] = VISEME[v]; setOpen(w, o * (.6 + Math.random() * .4));
          timers.push(setTimeout(() => setOpen(1, .18), 90));
        }, 175);
      }, 450);
    },
    /** Mouth shapes for one spoken word (from a speech boundary event). */
    talkWord(word, rate = 1) {
      sawBoundary = true;
      clearTimers();
      const vowels = (String(word || "").toLowerCase().normalize("NFD").replace(/[^a-z]/g, "").match(/[aeiou]/g) || [""]).slice(0, 6);
      const per = Math.max(70, 125 / rate);
      vowels.forEach((v, i) => {
        timers.push(setTimeout(() => { const [w, o] = VISEME[v] || VISEME[""]; setOpen(w, o); }, i * per));
        timers.push(setTimeout(() => setOpen(1, .22), i * per + per * .65));
      });
    },
    talkBoundary() { api.talkWord("a"); },
    talkStop() {
      talking = false;
      wrap.classList.remove("talking");
      clearTimers(); clearTimeout(fallback); clearInterval(fallback);
      setOpen(1, .12);
    },
  };
  api.set("idle");
  return api;
}
