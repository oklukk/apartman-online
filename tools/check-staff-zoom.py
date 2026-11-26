"""Actual Chromium browser zoom via isolated profile prefs, not CSS/pinch/emulated viewport."""
from pathlib import Path
import tempfile,json,math
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];origin='http://127.0.0.1:5178';out=root/'docs/design/staff-center';out.mkdir(exist_ok=True)
measurements=[]
with sync_playwright() as p:
 for factor in [1,2]:
  with tempfile.TemporaryDirectory(dir=root/'work',prefix='staff-zoom-') as profile:
   folder=Path(profile)/'Default';folder.mkdir()
   # Chromium ChromeZoomLevelPrefs: the default storage partition's key is "x".
   (folder/'Preferences').write_text(json.dumps({'partition':{'default_zoom_level':{'x':math.log(factor)/math.log(1.2)}}}))
   context=p.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,no_viewport=True,args=['--no-sandbox','--window-size=1440,1000'])
   errors=[];remote=[]
   context.route('**/*',lambda route:(remote.append(route.request.url),route.abort()) if not route.request.url.startswith(origin+'/') else route.continue_())
   page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
   for theme in ['light','dark']:
    for view in ['genel','oyuncular','ekonomi','secimler','roller','gecmis']:
     page.goto(origin+'/apartman-online/?scenario=staff-super#/sistem/'+view);page.reload();expect(page.locator('.staff-module-nav')).to_be_visible()
     page.evaluate('(theme)=>localStorage.setItem("apartman-theme",theme)',theme);page.reload();expect(page.locator('.staff-module-nav')).to_be_visible()
     dims=page.evaluate('({width:innerWidth,outer:outerWidth,dpr:devicePixelRatio,scale:visualViewport.scale})')
     assert abs(dims['outer']/dims['width']-factor)<.03,dims
     assert abs(dims['dpr']-factor)<.03 and dims['scale']==1,dims
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
     if view=='ekonomi':
      expect(page.get_by_role('heading',name='Kişisel cüzdan',exact=True)).to_be_visible()
      page.get_by_placeholder('Değişikliğin nedenini yazın').fill('Yakınlaştırma test gerekçesi')
      page.get_by_role('heading',name='Kişisel cüzdan',exact=True).locator('..').get_by_role('combobox',name='Oyuncu',exact=True).select_option('neighbor')
      page.get_by_role('heading',name='Oyuncu bakiyesini düzelt',exact=True).locator('..').get_by_label('Değişim miktarı (OP)',exact=True).fill('25');page.get_by_role('button',name='Bakiyeyi düzelt',exact=True).click()
      dialog=page.locator('dialog[open]');expect(dialog).to_be_visible();expect(dialog.locator('h2')).to_be_focused()
      assert dialog.bounding_box()['x']>=0 and dialog.bounding_box()['width']<=dims['width']
      page.screenshot(path=str(out/f'zoom-{int(factor*100)}-{theme}.png'))
      for _ in range(4):page.keyboard.press('Tab');assert dialog.evaluate('el=>el.contains(document.activeElement)')
      page.keyboard.press('Escape');expect(dialog).to_have_count(0)
   measurements.append({'factor':factor,**dims})
   assert not errors,errors;assert not remote,remote;context.close()
assert measurements[0]['width']==2*measurements[1]['width'],measurements
print('PASS actual browser zoom 100/200%, both themes, all six staff modules, modal focus/scroll and no overflow:',json.dumps(measurements))
