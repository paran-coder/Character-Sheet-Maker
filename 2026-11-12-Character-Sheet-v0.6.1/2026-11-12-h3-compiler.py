import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / '2026-11-12-H3-upstream-reference'))
from h3_character_sheet.reference_v13_compiler import compile_reference_v13_state
from h3_character_sheet.state_13 import DEFAULT_STATE

request = json.load(sys.stdin.buffer)
options = request.get('options') or {}
mode = 'manual' if options.get('mode') == 'manual' else 'auto'
parts = {'face': 'face', 'body': 'lower_body', 'outfit': 'upper_clothing', 'handDetail': 'hands', 'footDetail': 'footwear'}
state = {
    **DEFAULT_STATE,
    'views': request['views'],
    'size': {
        'mode': mode,
        'body_height': int(options.get('bodyHeight') or 1120),
        'manual_width': int(options.get('width') or 2208),
        'manual_height': int(options.get('height') or 1280),
    },
    'part_prompts': {part: options[field][:400] for field, part in parts.items()
                     if isinstance(options.get(field), str) and options[field].strip()},
    'clothing_type': {'pants': 'pants', 'skirt': 'skirt_robe'}.get(options.get('clothing'), 'reference'),
    'hand_state': {'bare': 'bare', 'gloves': 'gloved'}.get(options.get('hands'), 'reference'),
    'footwear_state': {'shoes': 'shod', 'bare': 'unshod'}.get(options.get('feet'), 'reference'),
}
try:
    output = compile_reference_v13_state(json.dumps(state), max_resolution=8192)
    print(json.dumps({'width': output['width'], 'height': output['height'],
                      'panels': output['guide_geometry']['panels'], 'prompt': output['prompt']}))
except ValueError as error:
    print(json.dumps({'error': str(error)}))
