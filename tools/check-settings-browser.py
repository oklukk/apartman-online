"""E stage: real Chromium, local API fixture, no live service or real Auth/MFA claim."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
origin='http://127.0.0.1:5178';base=origin+'/apartman-online/'
out=root/'docs/design/settings';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':390,'height':844},has_touch=True)
 page=context.new_page();errors=[];remote=[]
 context.route('**/*',lambda route:(remote.append(route.request.url),route.abort()) if not route.request.url.startswith(origin+'/') else route.continue_())
 page.on('pageerror',lambda error:errors.append(str(error)))
 def visit(fragment='#/ayarlar/gorunum',scenario='resident',theme=None):
  page.goto(base+'?scenario='+scenario+fragment)
  expect(page.locator('main h1')).to_be_visible()
  if theme:
   page.evaluate('theme=>localStorage.setItem("apartman-theme",theme)',theme);page.reload()
   page.wait_for_function('theme=>document.documentElement.dataset.theme===theme',arg=theme)
  if fragment!='#/sistem' or scenario=='staff-unjoined':expect(page.locator('main h1')).to_be_focused()
 def no_overflow():
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),page.url
  for link in page.locator('.primary-nav a').all():assert link.evaluate('el=>el.scrollWidth<=el.clientWidth'),link.inner_text()
 def capture(name,width,theme):
  if width in [390,1440]:page.screenshot(path=str(out/f'{name}-{theme}-{width}.png'))
 def reset():
  page.get_by_role('button',name='Görünüm tercihlerini sıfırla',exact=True).click()
  expect(page.get_by_label('Tema',exact=True)).to_have_value('system')
  expect(page.get_by_label('Yazı boyutu')).to_have_value('normal')
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':844 if width<900 else 1000})
  for theme in ['light','dark']:
   print(f'CHECK E {width}px {theme}',flush=True)
   visit(theme=theme);no_overflow()
   expect(page.get_by_role('navigation',name='Ana bölümler').get_by_role('link')).to_have_text(['Bugün','Dairem','Apartman','Komşular'])
   expect(page.get_by_role('navigation',name='Ayar bölümleri').get_by_role('link')).to_have_text(['Görünüm','Gizlilik','Güvenlik'])
   capture('appearance',width,theme)
   page.get_by_label('Yazı boyutu').evaluate('el=>el.scrollIntoView({block: "start"})');capture('appearance-controls',width,theme)
   # Immediate, device-local changes; persistence never touches the session key.
   page.evaluate("localStorage.setItem('sb-fixture-auth-token','untouched')")
   page.get_by_label('Yazı boyutu').select_option('large');page.get_by_label('Ekran yoğunluğu').select_option('compact');page.get_by_label('Hareketi azalt',exact=True).check()
   page.wait_for_function("document.documentElement.dataset.textSize==='large' && document.documentElement.dataset.density==='compact' && document.documentElement.dataset.motion==='reduce'")
   assert page.evaluate('parseFloat(getComputedStyle(document.documentElement).fontSize)')==18
   assert page.get_by_role('button',name='Görünüm tercihlerini sıfırla',exact=True).evaluate("el=>getComputedStyle(el).transitionDuration==='0s'")
   page.reload();expect(page.get_by_label('Yazı boyutu')).to_have_value('large');expect(page.get_by_label('Ekran yoğunluğu')).to_have_value('compact');expect(page.get_by_label('Hareketi azalt',exact=True)).to_be_checked()
   page.get_by_label('Yazı boyutu').evaluate('el=>el.scrollIntoView({block: "start"})');no_overflow();capture('large-compact',width,theme)
   # Exercise large text on existing game views, without changing their handlers.
   for fragment in ['#/bugun','#/dairem/isler','#/dairem/cuzdan','#/komsular/sohbet','#/apartman/kesfet']:
    visit(fragment,'manager',theme);no_overflow()
    if fragment.endswith('kesfet'):
     box=page.locator('#daire-01').bounding_box();number=page.locator('#daire-01 .map-number').bounding_box();badges=page.locator('#daire-01 .map-badges').bounding_box()
     assert number['x']+number['width']<=badges['x']+1
     assert badges['x']+badges['width']<=box['x']+box['width']+1
   visit(theme=theme);reset()
   assert page.evaluate("localStorage.getItem('sb-fixture-auth-token')")=='untouched'
   page.get_by_label('Tema',exact=True).select_option(theme)
   # Keyboard: every visible setting control keeps a 44px target and visible focus.
   for control in [page.get_by_label('Tema',exact=True),page.get_by_label('Yazı boyutu'),page.get_by_label('Ekran yoğunluğu'),page.get_by_role('button',name='Görünüm tercihlerini sıfırla',exact=True)]:
    control.focus();page.keyboard.press('Shift+Tab');page.keyboard.press('Tab');expect(control).to_be_focused()
    assert control.evaluate("el=>getComputedStyle(el).outlineStyle!=='none'")
    assert control.bounding_box()['height']>=44
   visit('#/ayarlar/gizlilik','blocked',theme);expect(page.locator('.blocked-neighbors')).to_contain_text('Ece');page.locator('.privacy-card').evaluate('el=>el.scrollIntoView({block:"start"})');no_overflow();capture('privacy',width,theme)
   page.get_by_role('link',name='Profili gör',exact=True).click();expect(page.locator('main h1')).to_have_text('Komşu profili');page.locator('.profile-back').click()
   expect(page).to_have_url(base+'?scenario=blocked#/ayarlar/gizlilik');expect(page.locator('.blocked-neighbors')).to_contain_text('Ece')
   page.get_by_role('button',name='Engeli kaldır',exact=True).click();expect(page.get_by_text('Gizlenmiş mesaj yok',exact=True)).to_be_visible()
   page.get_by_role('link',name='Sakinlere git',exact=True).click();page.get_by_role('navigation',name='Alt bölümler').get_by_role('link',name='Sohbet',exact=True).click();expect(page.locator('.message')).to_have_count(1)
   visit('#/ayarlar/gizlilik','resident',theme);page.locator('.privacy-card').evaluate('el=>el.scrollIntoView({block:"start"})');capture('privacy-empty',width,theme)
   # Existing MFA remains an independent entry, without inferring a verified state.
   page.get_by_role('navigation',name='Ayar bölümleri').get_by_role('link',name='Hesap güvenliği',exact=True).click()
   expect(page.locator('main h1')).to_have_text('Hesap güvenliği');expect(page.get_by_role('button',name='MFA hazırla / doğrula',exact=True)).to_be_visible();page.locator('.security-card').evaluate('el=>el.scrollIntoView({block:"start"})');no_overflow();capture('security',width,theme)
   page.get_by_role('button',name='MFA hazırla / doğrula',exact=True).click();expect(page.get_by_label('Altı haneli kod')).to_be_visible();page.locator('.security-card').evaluate('el=>el.scrollIntoView({block:"start"})');no_overflow();capture('security-code',width,theme)
   page.get_by_label('Altı haneli kod').fill('123456')
   # A display preference storage event must not remount the existing MFA form.
   page.evaluate("localStorage.setItem('apartman-theme','dark');dispatchEvent(new StorageEvent('storage',{key:'apartman-theme'}))")
   expect(page.get_by_label('Altı haneli kod')).to_have_value('123456')
   page.get_by_role('button',name='Oturumu doğrula',exact=True).click();expect(page.get_by_text('MFA doğrulandı.',exact=False)).to_be_visible()
   page.locator('.account-menu summary').click();expect(page.get_by_role('link',name='Sistem Yönetim Merkezi',exact=True)).to_have_count(0);page.keyboard.press('Escape')
   visit('#/profilim','resident',theme);no_overflow();capture('profile',width,theme)
   visit(theme=theme);page.locator('.account-menu summary').click()
   bounds=page.locator('.account-menu nav').bounding_box();assert bounds['x']>=0 and bounds['x']+bounds['width']<=width+1 and bounds['y']+bounds['height']<=page.viewport_size['height']
   capture('account-menu',width,theme)
   page.get_by_role('navigation',name='Hesap menüsü').get_by_role('link',name='Ayarlar',exact=True).click()
   expect(page.locator('.account-menu')).not_to_have_attribute('open','')
   # Clicking the already-current route leaves visible focus on the trigger.
   page.locator('.account-menu summary').click();page.get_by_role('navigation',name='Hesap menüsü').get_by_role('link',name='Ayarlar',exact=True).click();expect(page.locator('.account-menu summary')).to_be_focused()
   page.locator('.account-menu summary').click();page.keyboard.press('Escape');expect(page.locator('.account-menu summary')).to_be_focused()
   page.locator('.account-menu summary').click();page.touchscreen.tap(4,4);expect(page.locator('.account-menu')).not_to_have_attribute('open','')
   page.get_by_role('navigation',name='Ayar bölümleri').get_by_role('link',name='Gizlilik',exact=True).click();expect(page.locator('main h1')).to_be_focused()
   page.go_back();expect(page.get_by_label('Tema',exact=True)).to_be_visible();page.go_forward();expect(page.get_by_text('Gizlenmiş mesaj yok',exact=True)).to_be_visible()
 # Cross-tab storage synchronization affects display only.
 visit();other=context.new_page();other.goto(base+'?scenario=resident#/ayarlar')
 other.evaluate("localStorage.setItem('apartman-theme','dark');localStorage.setItem('apartman-appearance',JSON.stringify({version:1,textSize:'large',density:'compact',reduceMotion:true}))")
 expect(page.get_by_label('Tema',exact=True)).to_have_value('dark');expect(page.get_by_label('Yazı boyutu')).to_have_value('large');other.close();reset()
 # System appearance responds to OS changes without rewriting the theme choice.
 page.emulate_media(color_scheme='dark',reduced_motion='reduce');expect(page.get_by_label('Tema',exact=True)).to_have_value('system')
 assert page.locator('.player-shell').evaluate("el=>getComputedStyle(el).getPropertyValue('--bg').trim()==='#172b28'")
 assert page.get_by_role('button',name='Görünüm tercihlerini sıfırla',exact=True).evaluate("el=>getComputedStyle(el).transitionDuration==='0s'")
 page.emulate_media(color_scheme='light',reduced_motion='no-preference')
 # Former residents' existing blocks can still be removed, without opening a profile.
 visit('#/ayarlar/gizlilik','blocked-former');expect(page.get_by_text('Bilgisine erişilemeyen komşu',exact=True)).to_be_visible();expect(page.get_by_role('link',name='Profili gör',exact=True)).to_have_count(0)
 page.get_by_role('button',name='Engeli kaldır',exact=True).click();expect(page.get_by_text('Gizlenmiş mesaj yok',exact=True)).to_be_visible()
 # Unjoined and staff users retain account security access and role boundaries.
 for scenario in ['unjoined','staff-unjoined']:
  visit('#/ayarlar/gizlilik',scenario);expect(page.get_by_role('navigation',name='Ana bölümler')).to_have_count(0)
  page.get_by_role('navigation',name='Ayar bölümleri').get_by_role('link',name='Hesap güvenliği',exact=True).click();expect(page.get_by_role('button',name='MFA hazırla / doğrula',exact=True)).to_be_visible()
 visit('#/sistem');expect(page.get_by_text('Bu alana erişim yetkin yok.',exact=True)).to_be_visible();assert 'staff_directory' not in page.evaluate('fixtureCalls')
 visit('#/sistem','staff-unjoined');expect(page.get_by_role('heading',name='Yönetim merkezi',exact=True)).to_be_visible()
 visit('#/ayarlar','long-name');page.set_viewport_size({'width':320,'height':844});no_overflow();page.locator('.account-menu summary').click();assert page.locator('.account-menu nav').bounding_box()['x']>=0;page.keyboard.press('Escape')
 # Display changes and sign-out clear no unrelated Auth/storage keys.
 visit();page.locator('.account-menu summary').click();page.get_by_role('button',name='Çıkış yap',exact=True).click();expect(page.get_by_role('button',name='Apartmana giriş yap',exact=True)).to_be_visible()
 expect(page.locator('.account-menu')).to_have_count(0);assert page.evaluate("localStorage.getItem('sb-fixture-auth-token')")=='untouched'
 page.goto(base+'?scenario=visitor#/guvenlik');expect(page.get_by_role('button',name='MFA hazırla / doğrula',exact=True)).to_have_count(0)
 page.goto(base+'?scenario=resident#access_token=fixture-only');expect(page.locator('main h1')).to_be_visible();assert page.url.endswith('#access_token=fixture-only')
 assert not errors,errors;assert not remote,remote
 # Denied browser storage: account and login UI still render; persistence is not falsely claimed.
 denied=browser.new_context(viewport={'width':390,'height':844})
 denied.route('**/*',lambda route:route.continue_() if route.request.url.startswith(origin+'/') else route.abort())
 denied.add_init_script("Storage.prototype.getItem=function(){throw new DOMException('denied','SecurityError')};Storage.prototype.setItem=function(){throw new DOMException('denied','SecurityError')}")
 dp=denied.new_page();dp.on('pageerror',lambda error:errors.append(str(error)));dp.goto(base+'?scenario=resident#/ayarlar');expect(dp.get_by_text('Tarayıcı saklamaya izin vermiyor.',exact=False)).to_be_visible()
 dp.get_by_label('Yazı boyutu').select_option('large');expect(dp.get_by_label('Yazı boyutu')).to_have_value('large');dp.reload();expect(dp.get_by_label('Yazı boyutu')).to_have_value('normal')
 dp.goto(base+'?scenario=visitor#/bugun');expect(dp.get_by_role('button',name='Apartmana giriş yap',exact=True)).to_be_visible();assert not errors,errors
 denied.close();context.close();browser.close()
print('PASS E Chromium: appearance persistence/reset/denied storage/cross-tab/OS; account menu keyboard/touch/focus; existing privacy unblock/former residents/profile context; role-free security and synthetic MFA form continuity; session UI/hash boundaries; 320/390/768/1440 light/dark + large/compact game regression, 36 screenshots. Hosted Auth/MFA/Realtime NOT tested.')
