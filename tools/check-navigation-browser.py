"""Run against tools/serve-navigation-fixture.mjs; Chromium + existing Python Playwright only."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parents[1]
origin='http://127.0.0.1:5178'
base=origin+'/apartman-online/'
out=root/'docs/design/navigation'
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},has_touch=True)
 remote=[]; errors=[]
 page.route('**/*',lambda r:(remote.append(r.request.url),r.abort()) if not r.request.url.startswith(origin+'/') else r.continue_())
 page.on('pageerror',lambda e:errors.append(str(e)))
 def visit(scenario='resident',fragment='#/bugun'):
  page.goto(base+'?scenario='+scenario+fragment)
  page.wait_for_function("!document.body.textContent.includes('Oturum kontrol ediliyor') && !document.body.textContent.includes('Apartman bilgileri yükleniyor')")
  expect(page.locator('main h1')).to_be_visible()
 def no_overflow():
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), page.url
 visit()
 expect(page.get_by_role('navigation',name='Ana bölümler').get_by_role('link')).to_have_text(['Bugün','Dairem','Apartman','Komşular'])
 # Names remain textual; four decorative glyphs do not alter link names.
 expect(page.locator('.primary-nav svg[aria-hidden="true"][focusable="false"]')).to_have_count(4)
 for label,path in [('Bugün','bugun'),('Dairem','dairem'),('Apartman','apartman'),('Komşular','komsular')]:
  page.get_by_role('navigation',name='Ana bölümler').get_by_role('link',name=label,exact=True).click()
  assert page.url.endswith('#/'+path)
  for link in page.get_by_role('navigation',name='Alt bölümler').get_by_role('link').all():
   expected=link.get_attribute('href');link.click();assert page.url.endswith(expected)
 visit()
 # Deep shortcut -> correct subview, focus and refresh.
 page.get_by_role('navigation',name='İşlem kısayolları').get_by_role('link',name='Aidat öde').click()
 expect(page.locator('#aidat')).to_be_visible()
 expect(page.locator('#aidat')).to_be_focused()
 page.reload();expect(page.locator('#aidat')).to_be_visible()
 page.go_back();expect(page.locator('main h1')).to_contain_text('Merhaba')
 page.go_forward();expect(page.locator('#aidat')).to_be_visible()
 visit(fragment='#/dairem/isler/ek-is');expect(page.locator('#ek-is')).to_be_visible();expect(page.locator('#aidat')).not_to_be_visible()
 visit(fragment='#/apartman/kararlar/poll-poll1');expect(page.locator('#poll-poll1')).to_be_focused();expect(page.get_by_role('button',name='Onayla',exact=True)).to_be_visible()
 visit(fragment='#/apartman/kararlar/election-election1');expect(page.locator('#election-election1')).to_be_focused()
 visit(fragment='#/apartman/kasa-pano');expect(page.get_by_role('heading',name='Bütün gelir ve giderler')).to_be_visible();expect(page.get_by_role('heading',name='Duyurular')).to_be_visible()
 visit(fragment='#/komsular/sohbet/message');expect(page.locator('#message')).to_be_focused()
 page.locator('#message').fill('Taslak mesaj')
 page.get_by_role('navigation',name='Alt bölümler').get_by_role('link',name='Sakinler').click()
 page.get_by_role('navigation',name='Alt bölümler').get_by_role('link',name='Sohbet').click()
 expect(page.locator('#message')).to_have_value('Taslak mesaj')
 # Account menu is independent; role-free MFA, keyboard Escape, current theme control.
 page.locator('.account-menu summary').click()
 expect(page.get_by_role('link',name='Sistem Yönetim Merkezi',exact=True)).to_have_count(0)
 page.keyboard.press('Escape');expect(page.locator('.account-menu')).not_to_have_attribute('open','')
 expect(page.locator('.account-menu summary')).to_be_focused()
 # Outside mouse/touch closes without trapping focus in hidden content.
 visit(fragment='#/ayarlar')
 for mode in ['mouse','touch']:
  page.locator('.account-menu summary').click()
  page.get_by_role('link',name='Profilim',exact=True).focus()
  if mode=='mouse':page.get_by_text('Görünüm tercihin bu cihazda saklanır.').click(position={'x':5,'y':5})
  else:page.get_by_text('Görünüm tercihin bu cihazda saklanır.').tap(position={'x':5,'y':5})
  expect(page.locator('.account-menu')).not_to_have_attribute('open','')
  assert not page.locator('.account-menu nav').evaluate('el=>el.contains(document.activeElement)')
 page.locator('.account-menu summary').click()
 page.get_by_role('link',name='Profilim',exact=True).focus()
 page.get_by_label('Tema').click(position={'x':10,'y':15});page.keyboard.press('Escape')
 expect(page.get_by_label('Tema')).to_be_focused()
 expect(page.locator('.account-menu')).not_to_have_attribute('open','')
 # Click inside still follows links; outside dismissal must not suppress routing.
 page.locator('.account-menu summary').click();page.get_by_role('link',name='Profilim',exact=True).click()
 expect(page.get_by_role('heading',name='Profilim',exact=True)).to_be_visible()
 visit(fragment='#/guvenlik');expect(page.get_by_role('button',name='MFA hazırla / doğrula')).to_be_visible()
 visit(fragment='#/ayarlar');page.get_by_label('Tema').select_option('dark');page.reload();expect(page.get_by_label('Tema')).to_have_value('dark')
 visit(fragment='#/sistem');expect(page.get_by_text('Bu alana erişim yetkin yok.')).to_be_visible()
 assert 'staff_directory' not in page.evaluate('window.fixtureCalls')
 visit('manager','#/apartman/yonetici');expect(page.get_by_role('heading',name='Ortak karar öner')).to_be_visible()
 page.locator('.account-menu summary').click();expect(page.get_by_role('link',name='Sistem Yönetim Merkezi',exact=True)).to_have_count(0)
 for inactive in ['expired-manager','future-manager','voided-manager']:
  visit(inactive,'#/apartman/yonetici')
  expect(page.get_by_role('heading',name='Ortak karar öner')).to_have_count(0)
  expect(page.get_by_role('navigation',name='Alt bölümler').get_by_role('link',name='Yönetici Masası')).to_have_count(0)
 visit('resident','#/apartman/yonetici');expect(page.get_by_role('heading',name='Ortak karar öner')).to_have_count(0)
 visit('unjoined');expect(page.get_by_role('button',name='Apartmana katıl',exact=True)).to_be_visible();expect(page.get_by_role('navigation',name='Ana bölümler')).to_have_count(0)
 visit('unjoined','#/guvenlik');expect(page.get_by_role('button',name='MFA hazırla / doğrula')).to_be_visible()
 visit('staff-unjoined','#/sistem');expect(page.get_by_role('heading',name='Yönetim merkezi',exact=True)).to_be_visible()
 visit('visitor');expect(page.get_by_role('button',name='Apartmana giriş yap',exact=True)).to_be_visible();expect(page.get_by_role('navigation',name='Ana bölümler')).to_have_count(0)
 visit(fragment='#access_token=fixture-only');assert page.url.endswith('#access_token=fixture-only'), 'Auth fragments must not be rewritten'
 # Initial fetch barrier, then a target arriving in a later data revision.
 page.goto(base+'?scenario=resident&delay=initial#/dairem/cuzdan/aidat')
 expect(page.get_by_text('Apartman bilgileri yükleniyor…')).to_be_visible()
 page.evaluate('window.fixtureReleaseInitial()')
 expect(page.locator('#aidat')).to_be_focused()
 page.goto(base+'?scenario=resident&delay=target#/apartman/kararlar/poll-poll1')
 expect(page.get_by_role('heading',name='Apartman',exact=True)).to_be_visible()
 expect(page.locator('#poll-poll1')).to_have_count(0)
 page.evaluate('window.fixturePublishTarget()')
 expect(page.locator('#poll-poll1')).to_be_focused()
 assert page.locator('#poll-poll1').evaluate('el=>el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().top < innerHeight')
 expect(page.get_by_text('Bu işlem bağlantısı artık geçerli olmayabilir',exact=False)).to_have_count(0)
 page.locator('.account-menu summary').focus()
 page.evaluate('window.fixturePublishTarget()')
 page.wait_for_timeout(400) # waits past the fixture's existing 150ms reload debounce
 expect(page.locator('.account-menu summary')).to_be_focused()
 # Viewport/contrast-theme evidence from real production components with a substituted API.
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':844 if width<900 else 1000})
  for theme in ['light','dark']:
   page.evaluate(f"localStorage.setItem('apartman-theme','{theme}')")
   for scenario,fragment,label in [('resident','#/bugun','today'),('resident','#/apartman/kararlar','decisions'),('staff','#/sistem','staff'),('resident','#/dairem/daire','home'),('resident','#/dairem/isler','work'),('resident','#/dairem/cuzdan','wallet'),('resident','#/komsular/sakinler','residents'),('resident','#/komsular/sohbet','chat'),('resident','#/bugun','account-menu'),('resident','#/ayarlar','settings')]:
    visit(scenario,fragment);no_overflow()
    assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--ink').trim().length > 0"), 'Root design variables must load'
    assert page.locator('.card').first.evaluate("el => getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'"), 'Cards must have their real theme surface'
    if label=='account-menu':
     page.locator('.account-menu summary').click()
     bounds=page.locator('.account-menu nav').bounding_box()
     items=page.locator('.account-menu nav').locator(':scope > *').all()
     for previous,current in zip(items,items[1:]):
      a,b=previous.bounding_box(),current.bounding_box()
      assert b['y']>=a['y']+a['height'], 'Account menu links form one readable column'
     assert bounds and bounds['x']>=0 and bounds['x']+bounds['width']<=width and bounds['y']+bounds['height']<=page.viewport_size['height'], 'Account menu stays inside viewport'
    if scenario=='resident':
     icon=page.locator('.primary-nav a').first.locator('svg').bounding_box()
     text=page.locator('.primary-nav a').first.locator('span').bounding_box()
     if width<900:assert icon['y']+icon['height']<=text['y'], 'Mobile icon above label'
     else:assert icon['x']+icon['width']<=text['x'], 'Desktop icon before label'
    if width<900:
     box=page.locator('.primary-nav').bounding_box() if scenario=='resident' else None
     if box: assert abs(box['y']+box['height']-page.viewport_size['height'])<2
    if width in [390,1440]:page.screenshot(path=str(out/f'{label}-{theme}-{width}.png'))
 assert not remote,remote
 assert not errors,errors
 browser.close()
 print('PASS Chromium: decorative icons and all main/subsection links, outside mouse/touch/focusable dismiss, delayed initial/target data and no focus stealing, expanded 40 screenshots;  deep links/focus/reload/back/forward, retained chat draft, account menu/Escape/theme, role-free MFA, manager/staff distinction, unjoined staff, visitors, untouched Auth fragment, 320/390/768/1440 light/dark, no overflow/external traffic/page errors. Synthetic fixture only; hosted Auth/Realtime NOT tested.')
