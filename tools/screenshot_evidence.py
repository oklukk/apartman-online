"""Pixel checks for real Chromium evidence; DOM visibility alone cannot validate a PNG."""
from collections import Counter
from io import BytesIO
import math
from PIL import Image


def assert_image_content(data, *, css_viewport, regions=()):
    """Check viewport pixels and named DOM regions, mapped from CSS to image pixels.

    This is a nonblank/text-region guard, not OCR or a design approval substitute.
    Pillow is already available in the cloud browser test environment; no app dependency.
    """
    image = Image.open(BytesIO(data)).convert('RGB')
    width, height = css_viewport
    assert width > 0 and height > 0, 'Invalid CSS viewport'
    scale = image.width / width
    assert abs(image.height - height * scale) <= 3, 'Screenshot/viewport aspect mismatch'

    def check(crop, name):
        colors = Counter(getattr(crop, 'get_flattened_data', crop.getdata)())
        total = crop.width * crop.height
        assert total > 0, f'{name}: empty image region'
        fraction = 1 - max(colors.values()) / total
        assert len(colors) >= 32 and fraction >= .01, (
            f'{name}: blank or insufficient rendered content '
            f'({len(colors)} colors, non-dominant fraction {fraction:.4f})')
        return {'colors': len(colors), 'non_dominant_fraction': round(fraction, 4)}

    result = {'pixels': [image.width, image.height], 'viewport': check(image, 'viewport')}
    result['regions'] = {}
    for name, box in regions:
        assert box, f'{name}: DOM region missing'
        x, y, w, h = (box[key] for key in ('x', 'y', 'width', 'height'))
        assert w > 0 and h > 0 and x >= -.5 and y >= -.5, f'{name}: outside viewport'
        assert x + w <= width + 1 and y + h <= height + 1, f'{name}: clipped region'
        rect = (max(0, math.floor(x * scale)), max(0, math.floor(y * scale)),
                min(image.width, math.ceil((x + w) * scale)),
                min(image.height, math.ceil((y + h) * scale)))
        result['regions'][name] = check(image.crop(rect), name)
    return result
