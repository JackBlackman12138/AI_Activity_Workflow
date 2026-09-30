// R03–R08、R12：纯装饰 SVG。形状键与品质色来自配置；表现阶段不改变业务状态。
const SHAPES = {
  frog: `<circle cx='34' cy='31' r='10'/><circle cx='66' cy='31' r='10'/><ellipse cx='50' cy='57' rx='29' ry='23'/><circle class='light' cx='34' cy='31' r='3'/><circle class='light' cx='66' cy='31' r='3'/><path class='line' d='M41 64q9 8 18 0M24 77l-9 8m61-8 9 8'/><circle class='metal' cx='50' cy='89' r='5'/>`,
  leaf_car: `<path d='M17 60q20-38 59-20l9 23-12 12H25Z'/><path class='light' d='M27 58q15-21 38-17-8 16-38 17Z'/><path class='line' d='M23 62h59M48 54l15-10'/><circle class='metal' cx='32' cy='76' r='9'/><circle class='metal' cx='70' cy='76' r='9'/>`,
  mushroom_top: `<path d='M16 48q6-39 35-39t34 39Z'/><path class='light' d='M32 30l6-5m20-8 5 7m6 15 7-2'/><path d='M42 48h17l-4 25H46Z'/><path class='metal' d='M28 78q22-11 45 0L51 91Z'/><path class='line' d='M50 78v9'/>`,
  pine_robot: `<path d='M50 10 71 35 62 38 77 59 64 62 70 80H30l6-18-13-3 15-21-9-3Z'/><rect class='metal' x='37' y='49' width='26' height='18' rx='5'/><path class='line' d='M50 10v-7M30 82l-5 6m45-6 5 6'/><circle class='light' cx='44' cy='56' r='2'/><circle class='light' cx='56' cy='56' r='2'/>`,
  moss_elephant: `<ellipse cx='48' cy='59' rx='30' ry='24'/><circle cx='69' cy='47' r='18'/><ellipse class='light' cx='62' cy='50' rx='12' ry='16'/><path d='M80 50q13 0 7 23-3 11-13 6'/><path class='line' d='M29 76v12m23-11v11m-26-37-9-8'/><circle class='dark' cx='75' cy='41' r='2'/>`,
  diver_duck: `<ellipse cx='46' cy='66' rx='30' ry='20'/><circle cx='67' cy='43' r='17'/><path class='metal' d='M79 47 94 53 78 59Z'/><path class='light' d='M30 53q4-13 20-18l16 2'/><rect class='metal' x='57' y='34' width='19' height='12' rx='5'/><path class='line' d='M25 78 15 85m37-4 8 7M26 61q14-2 19 10'/><circle class='dark' cx='72' cy='39' r='2'/>`,
  star_ship: `<path d='M50 8 61 32 88 34 68 54 74 80 50 67 26 80 32 54 12 34 39 32Z'/><ellipse class='metal' cx='50' cy='56' rx='29' ry='12'/><path class='light' d='M40 35q10-15 20 0l7 15H33Z'/><circle class='dark' cx='50' cy='47' r='5'/>`,
  bubble_jelly: `<path d='M17 56q0-37 33-42 33 5 33 42Z'/><path class='light' d='M26 49q4-22 22-26'/><path class='line' d='M29 57q-10 18 0 28m14-28q-5 16 1 32m13-32q7 16 0 32m14-32q10 19 0 28'/><circle class='metal' cx='41' cy='48' r='3'/><circle class='metal' cx='60' cy='48' r='3'/><circle class='light' cx='82' cy='20' r='6'/>`,
  lighthouse_whale: `<path d='M12 60q16-27 52-21 19 2 23 21-7 25-34 25-34 0-41-25Z'/><path d='M75 48q10-4 16-18v25l-9 6'/><path class='metal' d='M36 39 41 15h17l5 25Z'/><path class='light' d='M39 25h22'/><path class='line' d='M29 68q8 7 17 0m2-54V8'/><circle class='dark' cx='68' cy='58' r='3'/>`,
  shell_sub: `<path d='M15 58q7-31 35-35 30 3 36 35-7 25-36 28-28-3-35-28Z'/><path class='light' d='M31 32q3 24 19 37 16-13 19-37M50 27v42'/><circle class='metal' cx='50' cy='60' r='12'/><circle class='dark' cx='50' cy='60' r='6'/><path class='line' d='M20 73 9 80m71-7 11 7'/>`,
  astral_cat: `<path d='M21 29 28 9 42 22q8-3 16 0L72 9l7 20v35Q78 87 50 87T21 64Z'/><path class='light' d='m30 27-3-10 12 11m31-1 3-10-12 11'/><path class='line' d='M34 52h9m14 0h9M50 60v7m-5 2q5 5 10 0M24 64 10 59m66 5 14-5'/><circle class='metal' cx='50' cy='10' r='4'/>`,
  moon_gramophone: `<path class='metal' d='M18 22q30 7 49-15-1 27-27 34l12 18-8 9-19-22Z'/><path d='M37 59h41v25H24V71Z'/><circle class='light' cx='55' cy='70' r='10'/><circle class='dark' cx='55' cy='70' r='4'/><path class='line' d='M78 72h8v-8'/>`,
  crystal_owl: `<path d='m21 27 16-15 13 12 13-12 16 15v37Q75 85 50 88 25 85 21 64Z'/><path class='light' d='m50 27-9 18 9 15 9-15Z'/><circle class='metal' cx='36' cy='46' r='10'/><circle class='metal' cx='64' cy='46' r='10'/><circle class='dark' cx='37' cy='47' r='3'/><circle class='dark' cx='63' cy='47' r='3'/><path class='line' d='M39 85v6m22-6v6'/>`,
  galaxy_pony: `<path d='M25 83V51l14-19 18-3 15 16-5 16-13 2-4 20Z'/><path class='light' d='M34 43q-15-22 3-34l14 18m10 4q-4-22 11-22l-7 27'/><path class='line' d='M30 75 14 86m47-25 13 24M28 52q-11-8-14 8'/><circle class='metal' cx='59' cy='46' r='3'/>`,
  comet_teapot: `<ellipse cx='49' cy='62' rx='27' ry='24'/><path d='M27 55 11 45l8-11 13 12m41 7q19-17 19 7-3 15-19 14'/><path class='metal' d='M28 40q22-12 43 0l-5 9H33Z'/><circle class='light' cx='49' cy='30' r='6'/><path class='line' d='M28 83h45m-28-22 8-9'/>`,
  rocket_bear: `<path d='M50 9q23 16 22 49L50 77 28 58Q27 25 50 9Z'/><circle class='metal' cx='50' cy='43' r='12'/><path class='light' d='M40 33q10-8 20 0'/><path d='m29 55-15 11 14 3m43-14 15 11-14 3'/><path class='metal' d='M43 75 50 93 57 75Z'/><circle class='dark' cx='45' cy='43' r='2'/><circle class='dark' cx='55' cy='43' r='2'/>`,
  gear_lion: `<path class='metal' d='m50 7 9 9 13-2 4 13 12 7-5 13 5 13-12 7-4 13-13-2-9 9-9-9-13 2-4-13-12-7 5-13-5-13 12-7 4-13 13 2Z'/><circle cx='50' cy='48' r='24'/><path class='light' d='M37 54q13 17 26 0'/><circle class='dark' cx='43' cy='44' r='3'/><circle class='dark' cx='57' cy='44' r='3'/><path class='line' d='M49 52v6'/>`,
  lantern_fox: `<path d='m20 34 15-24 15 14 15-14 15 24-9 31-21 18-21-18Z'/><path class='light' d='M31 53q11 14 19 7 8 7 19-7L50 75Z'/><path class='metal' d='M40 11h20l-3-7H43Z'/><path class='line' d='M42 48h5m6 0h5m-8 12v8M28 70 17 85m55-15 11 15'/>`,
  parade_train: `<rect x='25' y='30' width='56' height='43' rx='8'/><path class='metal' d='M12 51h17v20H12Zm30-36h22v17H42Z'/><path class='light' d='M53 31v25m-17-17h38'/><circle class='dark' cx='38' cy='78' r='9'/><circle class='dark' cx='70' cy='78' r='9'/><path class='line' d='M21 51V39m25-24V7m14 8V7'/>`,
  lava_unicorn: `<path d='M24 79V43l13-16 22-2 20 21-9 15-15 1-5 17Z'/><path class='metal' d='M48 27 55 5l8 22Z'/><path class='light' d='M37 37q-15-24-20-8l10 22m31-23q12-21 21-11l-5 26'/><path class='line' d='M28 73 17 86m43-25 13 24'/><circle class='dark' cx='62' cy='46' r='3'/>`,
  crown_egg: `<ellipse cx='50' cy='58' rx='29' ry='33'/><path class='metal' d='M24 30 18 10l17 8 15-13 15 13 17-8-6 20Z'/><path class='light' d='M34 51q6-16 16-19m0 19 9 10-9 11-9-11Z'/><circle class='dark' cx='50' cy='20' r='4'/><path class='line' d='M30 77q20 12 40 0'/>`,
  sun_peacock: `<path class='metal' d='M50 13 33 5l1 23-19-8 7 25-16 5 22 14 8 17h28l8-17 22-14-16-5 7-25-19 8 1-23Z'/><path d='M37 76q-3-35 13-45 16 10 13 45Z'/><circle class='light' cx='50' cy='39' r='7'/><path class='line' d='M44 79v11m12-11v11M32 39l8 8m28-8-8 8'/>`,
  gem_castle: `<path d='M17 40h16V20h15v20h4V20h15v20h16v43H17Z'/><path class='metal' d='M15 19h21v12H15Zm34 0h21v12H49Zm14 0h21v12H63Z'/><path class='light' d='m50 43 11 12-11 13-11-13Z'/><path class='dark' d='M45 83V69q5-9 10 0v14Z'/><path class='line' d='M22 46h10m36 0h10'/>`,
  gold_pegasus: `<path d='M23 80V48l16-17 19-5 19 18-8 17-15 1-5 18Z'/><path class='metal' d='M38 40Q8 21 17 10q30 1 40 27m-15-1Q7 37 10 52l32-5'/><path class='light' d='M61 27q1-18 14-18l-6 26'/><path class='line' d='M29 74 17 86m40-24 15 24'/><circle class='dark' cx='62' cy='44' r='3'/>`,
  star_phoenix: `<path d='M50 19q-8-17-22-12l8 21Q13 13 10 31l24 22-17 2 16 12-9 19 26-13 26 13-9-19 16-12-17-2 24-22Q87 13 64 28l8-21Q58 2 50 19Z'/><path class='metal' d='m50 7 5 8 9 1-7 7 2 9-9-4-9 4 2-9-7-7 9-1Z'/><path class='light' d='M38 50q12 13 24 0L50 73Z'/><circle class='dark' cx='44' cy='41' r='2'/><circle class='dark' cx='56' cy='41' r='2'/>`
};

function color(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

function palette(theme) {
  const quality = theme?.qualityColors || {};
  return {
    background: color(theme?.background, '#201B45'),
    machine: color(theme?.machine, '#D94F61'),
    glass: color(theme?.glass, '#82D9E9'),
    gold: color(theme?.gold, '#F5C96D'),
    surface: color(theme?.surface, '#FFF4DF'),
    quality: Object.fromEntries(['GREEN', 'BLUE', 'PURPLE', 'RED', 'GOLD'].map(id =>
      [id, color(quality[id], color(theme?.gold, '#F5C96D'))]))
  };
}

/** R04、R06：锁定态保持各玩具的真实轮廓；NEW 标记由收藏视图绘制。 */
export function toyArt(shapeKey, qualityId, state, theme) {
  const key = Object.prototype.hasOwnProperty.call(SHAPES, shapeKey) ? shapeKey : 'frog';
  const p = palette(theme);
  const locked = /^(locked|unowned|unknown)$/i.test(String(state ?? ''));
  const ink = locked ? '#8B899F' : (p.quality[qualityId] || p.gold);
  return `<svg class='toy-art${locked ? ' toy-art--locked' : ''}' data-shape='${key}' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' focusable='false' style='--toy:${ink}'>
    <ellipse cx='50' cy='91' rx='32' ry='5' fill='#252047' opacity='.18'/>
    <g fill='var(--toy)' stroke='#373252' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'>
      ${SHAPES[key]}
    </g>
    <style>.toy-art .light{fill:#fff4df;opacity:.8}.toy-art .metal{fill:#f5c96d}.toy-art .dark{fill:#373252}.toy-art .line{fill:none}.toy-art--locked .light,.toy-art--locked .metal{fill:#bdb9c4;opacity:.7}.toy-art--locked .dark{fill:#66657a}</style>
  </svg>`;
}

/** R03、R07：所有外发奖励仅绘制图标，不暗示已进入主棋盘。 */
export function rewardArt(iconKey, theme) {
  const p = palette(theme);
  const shapes = {
    coin_stack: `<ellipse cx='49' cy='72' rx='30' ry='12'/><path d='M19 57v15q0 13 30 13t30-13V57'/><ellipse cx='49' cy='57' rx='30' ry='12'/><path class='light' d='M25 65v9m7-6v9m34-9v9'/><path class='line' d='M42 48h14m-7-6v17'/>`,
    coin_chest: `<path d='M15 47q0-24 35-27 35 3 35 27v37H15Z'/><path class='light' d='M20 48q25 13 60 0v11Q50 72 20 59Z'/><rect class='dark' x='43' y='52' width='14' height='18' rx='3'/><path class='line' d='M28 33q21-9 44 0'/>`,
    energy_bolt: `<path d='M55 8 23 53h22l-5 39 37-52H54Z'/><path class='light' d='m55 20-18 29h17l-5 28 19-31H50Z'/>`,
    energy_flask: `<path d='M40 9h20M44 10v28L23 76q-3 12 12 13h30q15-1 12-13L56 38V10'/><path class='light' d='M31 67q21 8 38 0l8 15H23Z'/><path class='line' d='M34 76h11m10-27h7'/>`,
    star_crate: `<path d='m17 34 33-16 33 16v47L50 95 17 81Z'/><path class='light' d='m17 34 33 14 33-14M50 48v47'/><path class='dark' d='m50 52 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z'/>`
  };
  const key = Object.prototype.hasOwnProperty.call(shapes, iconKey) ? iconKey : 'star_crate';
  const fill = key.startsWith('energy') ? p.glass : p.gold;
  return `<svg class='reward-art' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' focusable='false' style='--reward:${fill}'>
    <ellipse cx='50' cy='94' rx='32' ry='4' fill='#252047' opacity='.2'/>
    <g fill='var(--reward)' stroke='#554061' stroke-width='3' stroke-linejoin='round' stroke-linecap='round'>${shapes[key]}</g>
    <style>.reward-art .light{fill:#fff4df;opacity:.75}.reward-art .dark{fill:#66517a}.reward-art .line{fill:none}</style>
  </svg>`;
}

let machineSerial = 0;

/** R03、R04：一次批量抽取共用一次机台表现；phase 仅切换已确认结果的装饰动画。 */
export function machineArt(theme, phase) {
  const p = palette(theme);
  const id = `gacha-machine-${++machineSerial}`;
  const moving = /^(rolling|spinning|drawing|dispensing|dispense)$/i.test(String(phase ?? ''));
  const capsules = [
    [101, 227, 'GREEN', -22], [144, 234, 'BLUE', 19], [189, 225, 'PURPLE', -16],
    [237, 232, 'RED', 22], [272, 213, 'GOLD', -13], [81, 197, 'GOLD', 12],
    [123, 194, 'RED', -21], [169, 191, 'GREEN', 14], [215, 192, 'BLUE', -17],
    [257, 176, 'PURPLE', 22], [105, 161, 'BLUE', -9], [151, 158, 'GOLD', 17],
    [198, 157, 'RED', -20], [238, 145, 'GREEN', 11]
  ].map(([x, y, q, turn], i) => `<g class='gm-capsule gm-capsule-${i % 3}' transform='translate(${x} ${y}) rotate(${turn})'>
    <circle r='20' fill='${p.quality[q]}' stroke='#49355d' stroke-width='3'/>
    <path d='M-19 2Q0 10 19 2V8Q0 27-19 8Z' fill='${p.surface}' opacity='.91'/>
    <path d='M-14-7Q-9-16 1-16' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' opacity='.78'/>
    <circle r='3' cy='3' fill='${p.gold}'/>
  </g>`).join('');
  return `<svg class='machine-art${moving ? ' machine-art--active' : ''}' viewBox='0 0 360 480' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' focusable='false' style='--gm-body:${p.machine};--gm-glass:${p.glass};--gm-gold:${p.gold};--gm-cream:${p.surface};--gm-night:${p.background}'>
    <defs>
      <linearGradient id='${id}-glass' x1='0' x2='1' y1='0' y2='1'><stop stop-color='#e4ffff' stop-opacity='.63'/><stop offset='.35' stop-color='${p.glass}' stop-opacity='.15'/><stop offset='1' stop-color='#2b678d' stop-opacity='.38'/></linearGradient>
      <linearGradient id='${id}-body' x1='0' x2='1'><stop stop-color='#943c61'/><stop offset='.22' stop-color='${p.machine}'/><stop offset='.75' stop-color='${p.machine}'/><stop offset='1' stop-color='#842e50'/></linearGradient>
    </defs>
    <ellipse cx='180' cy='464' rx='150' ry='13' fill='#0b0e33' opacity='.48'/>
    <path d='M36 267 47 440Q49 457 68 457H292q19 0 21-17l11-173Z' fill='#60335e' stroke='${p.gold}' stroke-width='5'/>
    <path d='M43 273h274l-12 167q-1 10-14 10H69q-13 0-14-10Z' fill='url(#${id}-body)' stroke='#63324d' stroke-width='5'/>
    <path d='M57 269Q48 40 180 27q132 13 123 242Z' fill='#295d79' stroke='${p.gold}' stroke-width='8'/>
    <path d='M69 269Q61 55 180 41q119 14 111 228Z' fill='#183d63'/>
    <g class='gm-capsules'>${capsules}</g>
    <path d='M69 269Q61 55 180 41q119 14 111 228Z' fill='url(#${id}-glass)' stroke='#d2f7f1' stroke-width='3'/>
    <path d='M89 155Q103 66 171 55' fill='none' stroke='#fff' stroke-width='12' stroke-linecap='round' opacity='.34'/>
    <path d='M260 77q25 32 28 69' fill='none' stroke='#fff' stroke-width='5' stroke-linecap='round' opacity='.25'/>
    <path d='M61 263h238l13 22H48Z' fill='${p.gold}' stroke='#714365' stroke-width='5'/>
    <path d='M67 287h226l-10 14H77Z' fill='${p.surface}' opacity='.55'/>
    <circle cx='69' cy='312' r='5' fill='${p.gold}' stroke='#7a3d53' stroke-width='2'/>
    <circle cx='291' cy='312' r='5' fill='${p.gold}' stroke='#7a3d53' stroke-width='2'/>
    <g class='gm-wheel'>
      <circle cx='113' cy='361' r='40' fill='#65385d' stroke='${p.gold}' stroke-width='6'/>
      <circle cx='113' cy='361' r='29' fill='${p.gold}' stroke='#fff2bc' stroke-width='3'/>
      <path d='M113 335v52m-26-26h52' stroke='#825467' stroke-width='9' stroke-linecap='round'/>
      <circle cx='113' cy='361' r='10' fill='${p.surface}' stroke='#825467' stroke-width='3'/>
    </g>
    <path d='M200 333q0-12 13-12h64q13 0 13 12v64q0 13-13 13h-64q-13 0-13-13Z' fill='#6b3958' stroke='${p.gold}' stroke-width='5'/>
    <path d='M209 344h72v38q-36 16-72 0Z' fill='#292643' stroke='#e9aa75' stroke-width='3'/>
    <path d='M216 400h58' stroke='#ffe8b2' stroke-width='5' stroke-linecap='round'/>
    <g class='gm-dispensed' opacity='0'><circle cx='245' cy='369' r='18' fill='${p.quality.GOLD}' stroke='#49355d' stroke-width='3'/><path d='M227 370q18 9 36 0v7q-18 18-36 0Z' fill='${p.surface}'/><path d='M234 359q5-8 13-8' fill='none' stroke='#fff' stroke-width='3' stroke-linecap='round'/></g>
    <path d='M67 440h226' stroke='#ffe7aa' stroke-width='5' stroke-linecap='round' opacity='.7'/>
    <style>
      .machine-art .gm-wheel,.machine-art .gm-capsules{transform-box:fill-box;transform-origin:center}
      .machine-art--active{transform-origin:50% 80%;animation:gm-shake var(--motion-duration,.85s) ease-in-out 1}
      .machine-art--active .gm-wheel{animation:gm-turn var(--motion-duration,.85s) ease-in-out 1}
      .machine-art--active .gm-capsules{animation:gm-roll var(--motion-duration,.85s) ease-in-out 1}
      .machine-art--active .gm-dispensed{animation:gm-dispense var(--motion-duration,.85s) ease-out 1}
      @keyframes gm-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-1.3deg)}48%{transform:rotate(1.3deg)}70%{transform:rotate(-.6deg)}}
      @keyframes gm-dispense{0%,53%{opacity:0;transform:translateY(-13px) scale(.72)}65%{opacity:1}88%{opacity:1;transform:translateY(18px) scale(1)}100%{opacity:0;transform:translateY(22px) scale(1)}}
      @keyframes gm-turn{40%{transform:rotate(65deg)}100%{transform:rotate(100deg)}}
      @keyframes gm-roll{30%{transform:translate(3px,-5px) rotate(3deg)}65%{transform:translate(-4px,2px) rotate(-3deg)}}
      @media(prefers-reduced-motion:reduce){.machine-art--active,.machine-art--active .gm-wheel,.machine-art--active .gm-capsules,.machine-art--active .gm-dispensed{animation:none}}
    </style>
  </svg>`;
}
