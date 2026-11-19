"""Serve a work's original poster by catalog ID and reuse successful downloads."""
import json
import os
import tempfile
import threading
from http.client import HTTPException
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parent
INDEX = json.loads((ROOT / 'catalog' / 'posters.json').read_text(encoding='utf-8'))
CACHE = Path(os.getenv('FY_ART_CACHE', Path.home() / '.cache' / 'buwan-plan' / 'posters'))
LOCKS = [threading.Lock() for _ in range(64)]
ORIGINS = {'api.bgm.tv', 'lain.bgm.tv', 'cdn.myanimelist.net', 's4.anilist.co', 'media.kitsu.app', 'media.kitsu.io'}
MAX_BYTES = 18 * 1024 * 1024


def trusted(url):
    parts = urlsplit(url)
    if parts.scheme != 'https' or parts.hostname not in ORIGINS or parts.port not in (443, None):
        return False
    # Bangumi redirects unillustrated works to its generic subject icon.
    if parts.hostname == 'lain.bgm.tv':
        return '/pic/cover/' in parts.path
    return True


class ArtworkRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not trusted(newurl):
            raise URLError('Unknown artwork host')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def image_type(data):
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data.startswith((b'GIF87a', b'GIF89a')):
        return 'image/gif'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp'
    return None


def load_poster(subject):
    if subject not in INDEX:
        return None
    path = CACHE / (subject + '.img')
    with LOCKS[int(subject) % len(LOCKS)]:
        try:
            data = path.read_bytes()
        except OSError:
            data = b''
        if image_type(data):
            return data
        urls = [*INDEX[subject], f'https://api.bgm.tv/v0/subjects/{subject}/image?type=large']
        for url in dict.fromkeys(urls):
            if not url or not trusted(url):
                continue
            try:
                request = Request(url, headers={'User-Agent': 'BuwanPlan/1.0 (local anime catalog)', 'Accept': 'image/*'})
                with build_opener(ArtworkRedirect()).open(request, timeout=6) as reply:
                    data = reply.read(MAX_BYTES + 1)
                if len(data) > MAX_BYTES or not image_type(data):
                    continue
            except (OSError, ValueError, HTTPException):
                continue
            # A read-only home directory must not prevent viewing a downloaded image.
            temp_path = None
            try:
                CACHE.mkdir(parents=True, exist_ok=True)
                with tempfile.NamedTemporaryFile(dir=CACHE, delete=False) as temp:
                    temp_path = Path(temp.name)
                    temp.write(data)
                os.replace(temp_path, path)
            except OSError:
                pass
            finally:
                if temp_path is not None:
                    temp_path.unlink(missing_ok=True)
            return data
    return None
