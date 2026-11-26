"""Real Chromium browser zoom, native viewport capture and independent pixel evidence.

No CSS zoom, pinch, viewport emulation or production API. The un-clipped CDP
capture avoids Playwright's scrolled viewport clip/zoom coordinate mismatch.
"""
from pathlib import Path
import base64
import hashlib
import importlib.metadata
import json
import math
import tempfile
from playwright.sync_api import sync_playwright, expect
from screenshot_evidence import assert_image_content

root = Path(__file__).resolve().parents[1]
origin = 'http://127.0.0.1:5178'
out = root / 'docs/design/staff-center'
out.mkdir(exist_ok=True)
measurements, evidence, legacy = [], [], []
modules = [('genel', 'Yetkilerim'), ('oyuncular', 'Oyuncu işlemleri'),
           ('ekonomi', 'Kişisel cüzdan'), ('secimler', 'Seçimler, görevler ve ortak kararlar'),
           ('roller', 'Rol kataloğu'), ('gecmis', 'İşlem geçmişi ve telafi')]

with sync_playwright() as p:
    for factor in [1, 2]:
        with tempfile.TemporaryDirectory(dir=root / 'work', prefix='staff-zoom-') as profile:
            folder = Path(profile) / 'Default'
            folder.mkdir()
            # Chromium ChromeZoomLevelPrefs: the default storage partition's key is "x".
            (folder / 'Preferences').write_text(json.dumps({'partition': {
                'default_zoom_level': {'x': math.log(factor) / math.log(1.2)}}}))
            context = p.chromium.launch_persistent_context(profile, executable_path='/usr/bin/chromium',
                headless=True, no_viewport=True, args=['--no-sandbox', '--window-size=1440,1000'])
            errors, remote = [], []
            context.route('**/*', lambda route: (remote.append(route.request.url), route.abort())
                if not route.request.url.startswith(origin + '/') else route.continue_())
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            cdp = context.new_cdp_session(page)

            def capture(name, target, save=True):
                expect(target).to_be_in_viewport(ratio=1)
                page.evaluate('document.fonts.ready')
                # No clip / device-metrics override: capture Chromium's actual composed viewport.
                data = base64.b64decode(cdp.send('Page.captureScreenshot', {
                    'format': 'png', 'fromSurface': True, 'captureBeyondViewport': False})['data'])
                pixels = assert_image_content(data, css_viewport=(dims['width'], dims['height']),
                    regions=[('visible target', target.bounding_box())])
                evidence.append({'name': name, 'zoom': factor, 'theme': theme,
                    'target': target.inner_text(), 'metrics': dims, **pixels,
                    'sha256': hashlib.sha256(data).hexdigest(), 'saved': save})
                # Never replace valid evidence with an unvalidated frame.
                if save:
                    (out / (name + '.png')).write_bytes(data)
                return data

            for theme in ['light', 'dark']:
                for view, title in modules:
                    page.goto(origin + '/apartman-online/?scenario=staff-super#/sistem/' + view)
                    page.reload()
                    expect(page.locator('.staff-module-nav')).to_be_visible()
                    page.evaluate('(t)=>localStorage.setItem("apartman-theme",t)', theme)
                    page.reload()
                    expect(page.locator('.staff-operations')).to_have_count(1)
                    expect(page.get_by_text('Yönetim bilgileri yükleniyor…', exact=True)).to_have_count(0)
                    expect(page.get_by_text('Yetki dizini yükleniyor…', exact=True)).to_have_count(0)
                    dims = page.evaluate('({width:innerWidth,height:innerHeight,outer:outerWidth,'
                        'dpr:devicePixelRatio,scale:visualViewport.scale})')
                    assert abs(dims['outer'] / dims['width'] - factor) < .03, dims
                    assert abs(dims['dpr'] - factor) < .03 and dims['scale'] == 1, dims
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                    if view in ['secimler', 'gecmis']:
                        control = page.get_by_role('region', name='Oyuncu denetimi ve seçim müdahaleleri')
                        control.get_by_role('combobox', name='Apartman', exact=True).select_option('fixture-building')
                        control.get_by_role('button', name='Güncel durumu yükle' if view == 'secimler' else 'İşlem geçmişini yükle', exact=True).click()
                    heading = page.get_by_role('heading', name=title, exact=True)
                    expect(heading).to_be_visible()
                    heading.evaluate('el=>el.scrollIntoView({block:"start"})')
                    capture(f'zoom-{int(factor*100)}-{theme}-{view}', heading, save=factor == 2)

                    if view != 'ekonomi':
                        continue
                    page.get_by_placeholder('Değişikliğin nedenini yazın').fill('Yakınlaştırma test gerekçesi')
                    heading.locator('..').get_by_role('combobox', name='Oyuncu', exact=True).select_option('neighbor')
                    page.get_by_role('heading', name='Oyuncu bakiyesini düzelt', exact=True).locator('..').get_by_label('Değişim miktarı (OP)', exact=True).fill('25')
                    page.get_by_role('button', name='Bakiyeyi düzelt', exact=True).click()
                    dialog = page.locator('dialog[open]')
                    expect(dialog).to_be_visible()
                    expect(dialog.locator('h2')).to_be_focused()
                    box = dialog.bounding_box()
                    assert box['x'] >= 0 and box['y'] >= 0 and box['width'] <= dims['width'] and box['y'] + box['height'] <= dims['height'] + 1
                    capture(f'zoom-{int(factor*100)}-{theme}', dialog.locator('h2'))
                    # Diagnostic only: standard Playwright clip can produce an empty PNG at browser zoom.
                    if factor == 2:
                        try:
                            assert_image_content(page.screenshot(), css_viewport=(dims['width'], dims['height']))
                            legacy.append({'theme': theme, 'playwright_capture': 'nonblank on this version'})
                        except AssertionError as error:
                            legacy.append({'theme': theme, 'playwright_capture': str(error)})
                        confirm = dialog.get_by_role('button', name='Onayla ve uygula', exact=True)
                        confirm.scroll_into_view_if_needed()
                        capture(f'zoom-200-{theme}-actions', confirm)
                    for _ in range(4):
                        page.keyboard.press('Tab')
                        assert dialog.evaluate('el=>el.contains(document.activeElement)')
                    page.keyboard.press('Escape')
                    expect(dialog).to_have_count(0)
                    expect(page.get_by_role('button', name='Bakiyeyi düzelt', exact=True)).to_be_focused()
                measurements.append({'factor': factor, 'theme': theme, **dims})
            assert not errors, errors
            assert not remote, remote
            chromium_version = context.browser.version
            context.close()

assert measurements[0]['width'] == 2 * measurements[2]['width'], measurements
(out / 'zoom-validation.json').write_text(json.dumps({
    'chromium': chromium_version, 'playwright': importlib.metadata.version('playwright'),
    'capture': 'CDP Page.captureScreenshot fromSurface=true captureBeyondViewport=false without clip',
    'measurements': measurements, 'legacy_capture_diagnosis': legacy, 'evidence': evidence
}, ensure_ascii=False, indent=2) + '\n')
print('PASS real browser zoom 100/200%, six modules and modal in both themes; viewport + target pixels nonblank; modal scroll/buttons/keyboard/focus; no overflow/errors/remote traffic.')
print(json.dumps({'measurements': measurements, 'legacy': legacy, 'validated_frames': len(evidence)}, ensure_ascii=False))
