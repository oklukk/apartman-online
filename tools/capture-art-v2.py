"""Optional local review tool; requires an existing Playwright Python + Chromium install.
Only an isolated loopback asset server is used; no application bundle or Supabase environment. Not part of CI/workflows.
"""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
class AssetsOnly(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(root),**kwargs)
    def do_GET(self):
        if not (self.path == '/tests/fixtures/art-v2/index.html' or self.path == '/src/styles/tokens.css' or self.path.startswith('/public/art/v2/')) or '..' in self.path:
            self.send_error(403); return
        super().do_GET()
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),AssetsOnly)
Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for width in [390,1440]:
        page=browser.new_page(viewport={'width':width,'height':1000},device_scale_factor=1)
        # Fail closed: local files only; any attempted network request aborts the check.
        remote=[]
        page.route('**/*',lambda route: (remote.append(route.request.url),route.abort()) if not route.request.url.startswith(origin + '/') else route.continue_())
        page.goto(origin+'/tests/fixtures/art-v2/index.html')
        page.wait_for_function('Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'Overflow at {width}'
        assert page.locator('.facade').evaluate('(el) => Math.abs(el.getBoundingClientRect().height / el.getBoundingClientRect().width - 1.1) < .02'), 'Facade must preserve aspect ratio without a tall empty image box'
        assert not remote,remote
        page.screenshot(path=str(root/f'docs/design/previews/gallery-{width}.png'),full_page=True)
        print(f'PASS {width}px: all images loaded, no horizontal overflow, no external network; screenshot saved')
        page.close()
    browser.close()

server.shutdown()
