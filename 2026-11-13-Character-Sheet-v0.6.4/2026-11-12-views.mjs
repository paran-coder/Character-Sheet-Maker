export const groups = [
  ['얼굴', [['정면','front-facing head portrait'],['좌측 옆면','left profile head portrait'],['우측 옆면','right profile head portrait'],['좌측 45°','left three-quarter head portrait'],['우측 45°','right three-quarter head portrait'],['후면','back of the head']]],
  ['전신', [['정면','front full-body standing view'],['측면','side full-body standing view'],['후면','back full-body standing view']]],
  ['디테일', [['의상 앞','front garment flat lay'],['의상 뒤','back garment flat lay'],['손','paired hand details'],['발·신발','paired feet or footwear details']]],
];

export const views = groups.flatMap(([group, entries]) =>
  entries.map(([label, description]) => ({ group, label, description }))
);

export function buildPrompt(ids, options = {}) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length ||
      ids.some(id => !Number.isInteger(id) || !views[id])) {
    throw new Error('시트에 넣을 뷰를 선택하세요.');
  }
  const ordered = [...ids].sort((a, b) => a - b);
  const panels = ordered.map((id, index) => `${index + 1}. ${views[id].description}`).join('\n');
  const { columns, seven } = layoutFor(ids);
  const layout = seven ? "Stack the two head portraits on the left. Place the three full-body views side by side in the center, each spanning both rows. Stack hands over footwear on the right." : `Use ${columns} columns in reading order.`;
  return `Create a single clean character reference sheet based on the attached image.
Preserve the same identity, style, hairstyle, outfit, colors and proportions in all applicable panels.
Use a neutral light background, even lighting and generous gutters. ${layout}
Show exactly ${ordered.length} separate panels in this order, with generous gutters and no decorative text.
Keep full-body views uncropped from head to toe. Keep garment detail panels focused on the clothes.
${panels}
${panelInstructions(ordered, options)}`;
}

export const sevenViews = [0, 1, 6, 7, 8, 11, 12];

export function layoutFor(ids) {
  const ordered = [...ids].sort((a, b) => a - b);
  const seven = ordered.join(',') === sevenViews.join(',');
  const columns = seven ? 5 : Math.max(1, Math.min(ordered.length, ordered.length > 6 ? 4 : 3));
  return { ordered, seven, columns };
}



export function generationRatio(ids, ratio) {
  return ['1:1', '3:2', '2:3', '16:9', '9:16'].includes(ratio) ? ratio : ids.length === 1 ? '1:1' : '3:2';
}

function panelInstructions(ids, options) {
  const settings = options ?? {};
  const instructions = [];
  const parts = [
    ['face', 'Head portraits', [0, 1, 2, 3, 4, 5]],
    ['body', 'Full-body panels', [6, 7, 8]],
    ['outfit', 'Garment panels', [9, 10], 'clothing', { pants: 'Use a pants silhouette.', skirt: 'Use a skirt or robe silhouette.' }],
    ['handDetail', 'Hand panel', [11], 'hands', { bare: 'Show bare hands.', gloves: 'Show gloved hands.' }],
    ['footDetail', 'Footwear panel', [12], 'feet', { shoes: 'Show footwear worn.', bare: 'Show bare feet.' }],
  ];
  for (const [key, label, scope, optionKey, values] of parts) {
    if (!scope.some(id => ids.includes(id))) continue;
    const detail = typeof settings[key] === 'string' ? settings[key].trim().slice(0, 400) : '';
    const choice = values && Object.hasOwn(values, settings[optionKey]) ? values[settings[optionKey]] : '';
    if (choice || detail) instructions.push(`${label} only: ${[choice, detail].filter(Boolean).join(' ')}`);
  }
  return instructions.join('\n');
}


export const viewIds = ['face_front','face_left','face_right','face_3q_left','face_3q_right','face_back','body_front','body_left','body_back','clothing_front','clothing_back','hands','feet','body_front_headless'];
export const defaultPreset = "standardThree";
export const presets = {
  standardThree: ['표준 3뷰', [0,8,13]],
  five: ['표준 5뷰', [0,1,6,7,8]],
  basic: ['기본 4뷰', [0,6,7,8]],
  turnaround: ['전신 3뷰', [6,7,8]],
  single: ['전신 1뷰', [6]],
  seven: ['7뷰 · 손과 발', sevenViews],
  head: ['얼굴 6뷰', [0,1,2,3,4,5]],
  clothing: ['의상 앞·뒤', [9,10]],
  detail: ['전체 13뷰', viewIds.slice(0, 13).map((_, i) => i)],
};

views.push({group:'전신', label:'정면2', description:'front body from neckline to shoes, head omitted'});
export const cardRows = [[0,1,2,3,4,5,11],[6,13,7,8,9,10,12]];
