"""PR #12 CSS-only before/after evidence; run the existing isolated fixture server first."""
from pathlib import Path
from subprocess import check_output
import json
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parents[1]
baseline='14227cfc3864dbd2d78425a443e20ea1e53c842e'
origin='http://127.0.0.1:5178'
out=root/'docs/design/player-review'
out.mkdir(parents=True,exist_ok=True)
css={name:check_output(['git','show',baseline+':src/styles/'+name],cwd=root,text=True) for name in ['navigation.css','player-screens.css']}
geometry={}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for version in ['before','after']:
  page=browser.new_page(viewport={'width':390,'height':844})
  errors=[];remote=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/*',lambda route:(remote.append(route.request.url),route.abort()) if not route.request.url.startswith(origin+'/') else route.continue_())
  if version=='before':
   # These two modules are imported solely for CSS side effects. Replay exact Git
   # baseline styles instead of the current styles; JSX, SVG and fixture data match.
   def replay_css(source):
    return lambda route:route.fulfill(content_type='application/javascript',body='const s=document.createElement("style");s.textContent='+json.dumps(source)+';document.head.append(s);')
   for name,source in css.items():
    page.route('**/src/styles/'+name+'*',replay_css(source))
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':844 if width<900 else 1000})
   for theme in ['light','dark']:
    page.goto(origin+'/apartman-online/?scenario=resident#/dairem/daire')
    page.evaluate(f"localStorage.setItem('apartman-theme','{theme}')")
    page.reload()
    expect(page.locator('.home-scene img')).to_be_visible()
    expect(page.locator('main h1')).to_be_focused()
    page.wait_for_function("theme=>document.documentElement.dataset.theme===theme",arg=theme)
    page.wait_for_function("document.querySelector('.home-scene img')?.complete && document.querySelector('.home-scene img')?.naturalWidth>0")
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    img=page.locator('.home-scene img').bounding_box();identity=page.locator('.home-identity').bounding_box()
    geometry[(version,width,theme)]={'img':img,'identity':identity}
    if version=='after':
     if width<=900:
      assert img['y']+img['height']<=identity['y']+1, 'Room is before identity'
      nav=page.locator('.primary-nav').bounding_box()
      visible=max(0,min(img['y']+img['height'],nav['y'])-max(img['y'],0))
      assert visible/img['height']>=.7, 'At least 70% of room is in first viewport'
      if width<=390: assert identity['height']<210,'Compact mobile identity'
     else:
      assert identity['x']<img['x'] and abs(identity['y']-img['y'])<140, 'Desktop remains two columns'
     assert page.locator('main h1').evaluate("el=>getComputedStyle(el).outlineStyle==='none' && getComputedStyle(el).textDecorationLine.includes('underline')")
     # Keyboard-driven focus still has a real outline on links and buttons.
     page.locator('.primary-nav a').first.focus();page.keyboard.press('Tab')
     assert page.evaluate("getComputedStyle(document.activeElement).outlineStyle!=='none' && parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=2")
     page.locator('.account-menu summary').click()
     page.get_by_role('button',name='Çıkış yap',exact=True).focus();page.keyboard.press('Shift+Tab');page.keyboard.press('Tab')
     expect(page.get_by_role('button',name='Çıkış yap',exact=True)).to_be_focused()
     assert page.get_by_role('button',name='Çıkış yap',exact=True).evaluate("el=>getComputedStyle(el).outlineStyle!=='none' && parseFloat(getComputedStyle(el).outlineWidth)>=2")
     page.keyboard.press('Escape')
     page.locator('main h1').focus()
    if width in [390,1440]:page.screenshot(path=str(out/f'{version}-home-{theme}-{width}.png'))
  assert not errors,errors
  assert not remote,remote
  page.close()
 for theme in ['light','dark']:
  for element in ['img','identity']:
   a=geometry[('before',1440,theme)][element];b=geometry[('after',1440,theme)][element]
   for key in ['x','y','width','height']:assert abs(a[key]-b[key])<1, f'Desktop {element}/{key} unchanged'
 browser.close()
print('PASS review: true CSS baseline/current Chromium captures, 320/390/768/1440 light/dark, room visibility and compact identity, unchanged desktop geometry, focused heading underline, keyboard link/button outlines, no overflow or external traffic.')
