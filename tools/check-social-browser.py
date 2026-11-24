"""D-stage real Chromium QA against the existing offline, synthetic API fixture only."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
root=Path(__file__).resolve().parents[1]
origin='http://127.0.0.1:5178'
base=origin+'/apartman-online/'
out=root/'docs/design/social-world';out.mkdir(parents=True,exist_ok=True)
anchors=json.loads((root/'public/art/v2/apartment-anchors.json').read_text())
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},has_touch=True)
 errors=[];remote=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.route('**/*',lambda route:(remote.append(route.request.url),route.abort()) if not route.request.url.startswith(origin+'/') else route.continue_())
 def visit(fragment='#/apartman/kesfet',scenario='resident',theme=None):
  page.goto(base+'?scenario='+scenario+fragment)
  expect(page.locator('main h1')).to_be_visible()
  if theme:
   page.evaluate('(theme)=>localStorage.setItem("apartman-theme",theme)',theme);page.reload()
   page.wait_for_function('theme=>document.documentElement.dataset.theme===theme',arg=theme)
  expect(page.locator('.account-menu summary')).to_contain_text('Deniz')
  expect(page.locator('main h1')).to_be_visible()
  parts=fragment.split('?')[0].split('/')
  if len(parts)==4 and not fragment.startswith('#/komsu/'):expect(page.locator('#'+parts[3])).to_be_focused()
  else:expect(page.locator('main h1')).to_be_focused()
 def sheet():return page.locator('dialog[open]')
 def close():
  page.get_by_role('button',name='Profili kapat',exact=True).click();expect(sheet()).to_have_count(0)
 def no_overflow():assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),page.url
 def target(n):return page.locator('#daire-'+str(n).zfill(2))
 def screenshot(name,width,theme,full=False):
  if width in [390,1440]:page.screenshot(path=str(out/f'{name}-{theme}-{width}.png'),full_page=full)
 # Geometry is measured from the rendered image, including inside the horizontal viewport.
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':844 if width<900 else 1000})
  for theme in ['light','dark']:
   print(f'CHECK {width}px {theme}',flush=True)
   visit(theme=theme)
   expect(page.locator('.facade-door')).to_have_count(12)
   image=page.locator('.facade-map > img');expect(image).to_be_visible()
   page.wait_for_function("document.querySelector('.facade-map>img').complete && document.querySelector('.facade-map>img').naturalWidth>0")
   image_box=image.bounding_box();boxes=[]
   for a in anchors['apartments']:
    button=target(a['number']);box=button.bounding_box();boxes.append(box)
    for key,expected in [('x',image_box['x']+image_box['width']*a['x']/1000),('y',image_box['y']+image_box['height']*a['y']/1100),('width',image_box['width']*a['width']/1000),('height',image_box['height']*a['height']/1100)]:assert abs(box[key]-expected)<1,(width,a,key,box,expected)
    assert box['width']>=44 and box['height']>=44
    assert f"{a['floor']}. kat" in button.get_attribute('aria-label')
   for i,a in enumerate(boxes):
    for b in boxes[i+1:]:assert a['x']+a['width']<=b['x'] or b['x']+b['width']<=a['x'] or a['y']+a['height']<=b['y'] or b['y']+b['height']<=a['y']
   assert page.locator('.facade-entry').bounding_box()['height']>=44
   expect(target(1)).to_contain_text('Sen');expect(target(2)).to_contain_text('Dolu');expect(target(12)).to_contain_text('Boş')
   expect(page.locator('.apartment-alternatives button')).to_have_count(12)
   no_overflow();screenshot('building',width,theme,True)
   target(12).click();expect(sheet()).to_have_count(0);expect(page.locator('.apartment-info')).to_have_text('Daire 12Boş daire')
   expect(page.locator('.apartment-info a,.apartment-info button')).to_have_count(0)
   # Every alternative has a working keyboard target (including vacant dwellings).
   for button in page.locator('.apartment-alternatives button').all():
    button.focus();page.keyboard.press('Enter')
    if sheet().count():page.keyboard.press('Escape');expect(sheet()).to_have_count(0);expect(button).to_be_focused()
   page.locator('.facade-entry').click();expect(page).to_have_url(base+'?scenario=resident#/apartman/kasa-pano')
   visit('#/apartman/kesfet/daire-01','manager',theme)
   expect(target(1)).to_be_focused();expect(target(1)).to_contain_text('Sen');expect(target(1)).to_contain_text('Yön.')
   number_box=target(1).locator('.map-number').bounding_box();badge_box=target(1).locator('.map-badges').bounding_box()
   assert number_box['x']+number_box['width']<=badge_box['x']+1,'Own/manager labels do not overlap'

   screenshot('own-manager',width,theme)
   target(1).click();expect(sheet()).to_be_visible();expect(sheet().get_by_text('Senin dairen',exact=True)).to_be_visible();expect(sheet().get_by_text('Apartman yöneticisi',exact=True)).to_be_visible()
   expect(sheet().get_by_role('link',name='Daireme Git',exact=True)).to_be_visible();expect(sheet().get_by_role('button',name='Mesajları gizle',exact=True)).to_have_count(0)
   screenshot('own-quick-profile',width,theme)
   close();expect(target(1)).to_be_focused()
   target(2).click();expect(sheet()).to_be_visible();expect(page.get_by_role('button',name='Profili kapat')).to_be_focused()
   expect(sheet()).to_contain_text('Ece');expect(sheet()).to_contain_text('Ekim 2026')
   b=sheet().bounding_box()
   assert b['x']>=0 and b['y']>=0 and b['x']+b['width']<=width+1
   if width<900:assert abs(b['y']+b['height']-page.viewport_size['height'])<2 and b['width']==width
   else:assert abs(b['x']+b['width']-width)<2 and b['height']==page.viewport_size['height']
   # Native showModal makes the underlying navigation inert and constrains keyboard focus.
   page.locator('.primary-nav a').first.evaluate('el=>el.focus()')
   assert sheet().evaluate('el=>el.contains(document.activeElement)')
   for _ in range(14):
    page.keyboard.press('Tab');assert sheet().evaluate('el=>el.contains(document.activeElement)')
   screenshot('neighbor-quick-profile',width,theme)
   page.keyboard.press('Escape');expect(sheet()).to_have_count(0);expect(target(2)).to_be_focused()
   target(2).click();page.mouse.click(4,4);expect(sheet()).to_have_count(0);expect(target(2)).to_be_focused()
   target(2).click();page.go_back();expect(sheet()).to_have_count(0);expect(target(2)).to_be_focused();page.go_forward();expect(sheet()).to_be_visible();close()
   target(2).click();neighbor_avatar=sheet().locator('img').get_attribute('src');sheet().get_by_role('link',name='Tam Profili Gör',exact=True).click()
   expect(page.locator('main h1')).to_have_text('Komşu profili');expect(page.locator('main h1')).to_be_focused()
   url=page.url;page.reload();expect(page).to_have_url(url);expect(page.locator('.social-profile')).to_contain_text('Ece')
   assert page.locator('.social-profile img').get_attribute('src')==neighbor_avatar
   screenshot('full-profile',width,theme);no_overflow()
   page.go_back();expect(page.locator('main h1')).to_have_text('Apartman');page.go_forward();expect(page.locator('main h1')).to_have_text('Komşu profili')
   page.locator('.profile-back').click();expect(page.locator('main h1')).to_have_text('Apartman')
   visit('#/komsular/sakinler','manager',theme)
   expect(page.locator('.social-directory .resident-open')).to_have_count(2)
   expect(page.locator('.resident-open').first).to_contain_text('Senin dairen');expect(page.locator('.resident-open').first).to_contain_text('Apartman yöneticisi')
   no_overflow();screenshot('residents',width,theme)
   list_avatar=page.locator('.resident-open').nth(1).locator('img').get_attribute('src')
   page.locator('.resident-open').nth(1).click();expect(sheet()).to_be_visible();assert sheet().locator('img').get_attribute('src')==list_avatar;close()
   visit('#/komsular/sohbet','long-chat',theme)
   page.locator('#message').fill('Profil açıkken korunacak mesaj taslağı')
   chat=page.locator('.chat-history');chat.evaluate('el=>el.scrollTop=35')
   trigger=page.locator('.chat-person').filter(has_text='Ece').first
   trigger.scroll_into_view_if_needed();scroll=chat.evaluate('el=>el.scrollTop')
   chat_avatar=trigger.locator('img').get_attribute('src');assert chat_avatar==list_avatar==neighbor_avatar
   trigger.click();expect(sheet()).to_be_visible()
   assert sheet().locator('img').get_attribute('src')==chat_avatar
   close();expect(trigger).to_be_focused();expect(page.locator('#message')).to_have_value('Profil açıkken korunacak mesaj taslağı')
   assert abs(chat.evaluate('el=>el.scrollTop')-scroll)<1
   trigger.click();sheet().get_by_role('link',name='Tam Profili Gör',exact=True).click()
   expect(page.locator('main h1')).to_have_text('Komşu profili');page.locator('.profile-back').click()
   expect(page.locator('#message')).to_have_value('Profil açıkken korunacak mesaj taslağı')
   assert abs(page.locator('.chat-history').evaluate('el=>el.scrollTop')-scroll)<1
   visit('#/komsular/sohbet','resident',theme);expect(page.locator('.chat-person img')).to_be_visible();no_overflow();screenshot('chat',width,theme)
   visit('#/profilim','manager',theme)
   expect(page.locator('.social-profile')).to_contain_text('Kasım 2026');expect(page.locator('.social-profile')).to_contain_text('Apartman yöneticisi')
   assert page.locator('.social-profile img').get_attribute('src')==page.locator('.account-menu img').get_attribute('src')
   expect(page.get_by_role('link',name='Hesap Güvenliği',exact=True)).to_be_visible();no_overflow();screenshot('my-profile',width,theme)
 # Same-hash shortcuts must still focus their target after closing the sheet.
 visit('#/komsular/sohbet/message');page.locator('.chat-person').click()
 page.evaluate('fixturePublishTarget()');page.wait_for_timeout(400)
 expect(page.get_by_role('button',name='Profili kapat')).to_be_focused()
 sheet().get_by_role('link',name='Sohbete Git',exact=True).click();expect(sheet()).to_have_count(0);expect(page.locator('#message')).to_be_focused()
 visit('#/apartman/kesfet/daire-02');target(2).click();sheet().get_by_role('link',name='Daireyi Gör',exact=True).click()
 expect(sheet()).to_have_count(0);expect(target(2)).to_be_focused()
 # A real touch gesture dismisses the mobile backdrop too.
 page.set_viewport_size({'width':390,'height':844})
 visit('#/komsular/sakinler');touch_trigger=page.locator('.resident-open').nth(1);touch_trigger.click()
 expect(sheet()).to_be_visible();page.touchscreen.tap(4,4);expect(sheet()).to_have_count(0);expect(touch_trigger).to_be_focused()
 # Block/unblock reuses the existing operation, retains profile access and filters messages.
 visit('#/komsular/sohbet')
 page.locator('.chat-person').click();sheet().get_by_role('button',name='Mesajları gizle',exact=True).click()
 expect(sheet().get_by_role('button',name='Engeli kaldır',exact=True)).to_be_visible()
 expect(sheet().get_by_role('link',name='Tam Profili Gör',exact=True)).to_be_visible()
 close();expect(page.locator('.message')).to_have_count(0)
 visit('#/komsular/sakinler','blocked')
 page.locator('.resident-open').nth(1).click();sheet().get_by_role('button',name='Engeli kaldır',exact=True).click()
 expect(sheet().get_by_role('button',name='Mesajları gizle',exact=True)).to_be_visible()
 close();page.get_by_role('navigation',name='Alt bölümler').get_by_role('link',name='Sohbet',exact=True).click();expect(page.locator('.message')).to_have_count(1)
 # Scoped profiles fail closed even when a test API deliberately includes foreign rows.
 for scenario,id in [('social-private','outsider'),('resident','deleted'),('missing-profile','neighbor')]:
  visit('#/komsu/'+id+'?from=https%3A%2F%2Fevil.test',scenario)
  expect(page.locator('.social-profile')).to_contain_text('Bu profile erişilemiyor')
  assert 'FOREIGN_PRIVATE' not in page.locator('.social-profile').inner_text()
  assert 'hidden@example.test' not in page.content()
  assert page.locator('.profile-back').get_attribute('href')=='#/komsular/sakinler'
 visit('#/komsular/sakinler','missing-joined');page.locator('.resident-open').nth(1).click();assert 'tarihinden beri' not in sheet().inner_text();close()
 visit('#/komsular/sohbet');page.locator('.chat-person').click();page.evaluate('fixtureRemoveNeighbor()');expect(sheet()).to_contain_text('Bu komşunun profiline şu anda erişilemiyor');expect(sheet().get_by_role('link')).to_have_count(0);close()
 for scenario in ['expired-manager','future-manager','voided-manager']:
  visit('#/apartman/kesfet',scenario);assert 'Yön.' not in target(1).inner_text()
 visit('#/apartman/kesfet','manager');expect(target(1)).to_contain_text('Yön.');page.evaluate('fixtureExpireTerm()');expect(target(1)).not_to_contain_text('Yön.')
 # Image error uses an accessible initial without breaking access.
 page.route('**/art/v2/avatars/*.svg',lambda route:route.abort())
 visit('#/komsular/sakinler');expect(page.locator('.resident-open .resident-avatar').nth(1)).to_have_text('E');expect(page.locator('.resident-open .resident-avatar').nth(1)).to_have_attribute('aria-label','Ece avatarı')
 page.unroute('**/art/v2/avatars/*.svg')
 page.route('**/art/v2/apartment-facade.svg',lambda route:route.abort())
 visit();expect(page.get_by_text('Bina görseli yüklenemedi.',exact=False)).to_be_visible();expect(page.locator('.apartment-alternatives button')).to_have_count(12)
 assert not errors,errors
 assert not remote,remote
 browser.close()
print('PASS D Chromium: 12 aligned 44px+ targets and entrance, occupancy/own/manager+expiry, keyboard alternatives; 16-portrait integration/fallback; modal/back/Escape/outside/focus/inert; private/foreign/deleted profiles; block/unblock; chat draft+scroll; Pages links/reload/back/forward; 320/390/768/1440 light/dark, 32 screenshots, no overflow/errors/external traffic. Synthetic data only; hosted Auth/MFA/Realtime not tested.')
