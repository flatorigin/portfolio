from pathlib import Path
from tempfile import TemporaryDirectory
from django.test import SimpleTestCase, override_settings


class VideoSharePageTests(SimpleTestCase):
    def test_anonymous_video_page_has_server_rendered_preview(self):
        with TemporaryDirectory() as folder:
            Path(folder, "index.html").write_text('<html><head><title>FlatOrigin</title></head><body><div id="root"></div></body></html>')
            with override_settings(FRONTEND_DIR=folder, FRONTEND_URL="https://www.flatorigin.com"):
                for path in ["/watch", "/watch/"]:
                    response = self.client.get(path)
                    self.assertEqual(response.status_code, 200)
                    self.assertContains(response, 'property="og:url" content="https://www.flatorigin.com/watch"')
                    self.assertContains(response, 'https://www.flatorigin.com/static/video/flatorigin-intro-poster.jpg')
                    self.assertContains(response, 'name="twitter:card" content="summary_large_image"')
                    self.assertContains(response, '<div id="root"></div>')
