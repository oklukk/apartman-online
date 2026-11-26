"""Run with python -m unittest discover -s tests -p test_screenshot_evidence.py."""
import unittest
from io import BytesIO
from PIL import Image, ImageDraw
from tools.screenshot_evidence import assert_image_content


def png(image):
    stream = BytesIO(); image.save(stream, format='PNG'); return stream.getvalue()


class ScreenshotEvidenceTests(unittest.TestCase):
    def test_solid_background_rejected_in_both_themes(self):
        for color in [(243, 245, 241), (24, 34, 30)]:
            with self.subTest(color=color), self.assertRaisesRegex(AssertionError, 'blank'):
                assert_image_content(png(Image.new('RGB', (720, 456), color)), css_viewport=(720, 456))

    def test_one_different_pixel_does_not_make_evidence_valid(self):
        image = Image.new('RGB', (720, 456), 'white'); image.putpixel((0, 0), (0, 0, 0))
        with self.assertRaisesRegex(AssertionError, 'blank'):
            assert_image_content(png(image), css_viewport=(720, 456))

    def rendered(self):
        image = Image.new('RGB', (400, 200), 'white')
        for x in range(80):
            ImageDraw.Draw(image).line((x + 20, 20, x + 20, 60), fill=(x * 3, 90, 50))
        return image

    def test_nonblank_frame_and_scaled_target_pass(self):
        result = assert_image_content(png(self.rendered()), css_viewport=(200, 100), regions=[('heading', {'x':10,'y':10,'width':50,'height':25})])
        self.assertGreaterEqual(result['regions']['heading']['colors'], 32)

    def test_busy_frame_with_empty_target_is_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'heading: blank'):
            assert_image_content(png(self.rendered()), css_viewport=(200, 100), regions=[('heading', {'x':100,'y':10,'width':50,'height':25})])

    def test_cropped_target_is_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'clipped'):
            assert_image_content(png(self.rendered()), css_viewport=(200, 100), regions=[('heading', {'x':150,'y':10,'width':60,'height':25})])

    def test_wrong_aspect_is_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'aspect'):
            assert_image_content(png(self.rendered()), css_viewport=(200, 200))


if __name__ == '__main__':
    unittest.main()
