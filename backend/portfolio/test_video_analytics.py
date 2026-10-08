import uuid
from django.test import TestCase
from .models import IntroVideoSession


class VideoAnalyticsTests(TestCase):
    def setUp(self):
        self.payload = dict(session_id=str(uuid.uuid4()), viewer_id=str(uuid.uuid4()), source="homepage", watch_seconds=3.2, completed=False, replays=0, share_actions=0, copy_actions=0, email_actions=0)

    def send(self, **changes):
        return self.client.post('/api/video-analytics/', {**self.payload, **changes}, content_type='application/json')

    def test_duplicate_and_out_of_order_updates_do_not_inflate_counts(self):
        self.assertEqual(self.send(watch_seconds=15, copy_actions=1).status_code, 204)
        self.send(watch_seconds=15, copy_actions=1)
        self.send()
        self.assertEqual(IntroVideoSession.objects.count(), 1)
        row = IntroVideoSession.objects.get()
        self.assertEqual(row.watch_seconds, 15)
        self.assertEqual(row.copy_actions, 1)

    def test_completion_requires_sufficient_playback(self):
        self.send(completed=True)
        self.assertFalse(IntroVideoSession.objects.get().completed)
        self.send(watch_seconds=51, completed=True, replays=1)
        self.send()
        row = IntroVideoSession.objects.get()
        self.assertTrue(row.completed)
        self.assertEqual(row.replays, 1)

    def test_invalid_metrics_rejected(self):
        self.assertEqual(self.send(watch_seconds=-1).status_code, 400)
        self.assertEqual(self.send(source="arbitrary").status_code, 400)
        self.assertEqual(self.send(replays=1001).status_code, 400)
        self.assertFalse(IntroVideoSession.objects.exists())

    def test_session_cannot_change_viewer(self):
        self.send()
        self.assertEqual(self.send(viewer_id=str(uuid.uuid4())).status_code, 400)
