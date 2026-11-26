"""F: isolated real Chromium staff flows and responsive evidence. Never live Supabase."""
from pathlib import Path
import argparse
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser();parser.add_argument('--flows-only',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parents[1];origin='http://127.0.0.1:5178';base=origin+'/apartman-online/'
out=root/'docs/design/staff-center';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':390,'height':844},has_touch=True)
 page=context.new_page();errors=[];remote=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 context.route('**/*',lambda route:(remote.append(route.request.url),route.abort()) if not route.request.url.startswith(origin+'/') else route.continue_())
 def visit(view='genel',scenario='staff-super',theme=None):
  page.goto(base+'?scenario='+scenario+'#/sistem/'+view)
  page.reload() # Each fixture scenario starts with a fresh document, even for a same-hash URL.
  expect(page.get_by_role('heading',name='Yönetim merkezi',exact=True)).to_be_visible()
  if theme:
   page.evaluate('theme=>localStorage.setItem("apartman-theme",theme)',theme);page.reload()
   page.wait_for_function('theme=>document.documentElement.dataset.theme===theme',arg=theme)
  expect(page.locator('main h1')).to_be_focused()
  expect(page.get_by_text('Yönetim işlemleri yükleniyor…',exact=True)).to_have_count(0)
  if scenario!='staff-editor':
   expect(page.locator('.staff-operations')).to_have_count(1)
   if scenario!='staff-loading':expect(page.get_by_text('Yönetim bilgileri yükleniyor…',exact=True)).to_have_count(0)
 def module(key):
  page.locator(f'.staff-module-nav a[href="#/sistem/{key}"]').click();expect(page.locator('main h1')).to_be_focused()
 def no_overflow():assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),page.url
 def dialog():return page.locator('dialog[open]')
 def reason_ops():return page.locator('.staff-operations > div').nth(1).get_by_role('textbox',name='İşlem gerekçesi',exact=True)
 def control():return page.get_by_role('region',name='Oyuncu denetimi ve seçim müdahaleleri')
 def capture(name,width,theme):
  if width in [390,1440]:page.screenshot(path=str(out/f'{name}-{theme}-{width}.png'))
 def wallet():
  reason_ops().fill('Test düzeltmesi gerekçesi')
  page.get_by_role('heading',name='Kişisel cüzdan',exact=True).locator('..').get_by_role('combobox',name='Oyuncu',exact=True).select_option('neighbor')
  page.get_by_role('heading',name='Oyuncu bakiyesini düzelt',exact=True).locator('..').get_by_label('Değişim miktarı (OP)',exact=True).fill('25')
  page.get_by_role('button',name='Bakiyeyi düzelt',exact=True).click();expect(dialog()).to_be_visible()
 def apply():dialog().get_by_role('button',name='Onayla ve uygula',exact=True).click()
 def cancel():dialog().get_by_role('button',name='Vazgeç',exact=True).click();expect(dialog()).to_have_count(0)
 # Real permission data, including scope and custom roles.
 for scenario,expected in [('staff-super',6),('staff-admin',6),('staff-moderator',3),('staff-editor',2),('staff-scoped',6),('staff-ban-only',3),('staff-audit-only',3)]:
  visit(scenario=scenario);expect(page.locator('.staff-module-nav a')).to_have_count(expected)
  expect(page.get_by_role('navigation',name='Ana bölümler')).to_have_count(0)
  if scenario=='staff-moderator':
   module('oyuncular');control().get_by_role('combobox',name='Apartman',exact=True).select_option('fixture-building');control().get_by_role('combobox',name='Oyuncu',exact=True).select_option('neighbor');assert 'ban' not in control().get_by_role('combobox',name='Yaptırım',exact=True).locator('option').evaluate_all('(nodes)=>nodes.map(n=>n.value)')
  if scenario=='staff-editor':
   module('roller');expect(page.get_by_role('heading',name='Erişilebilir apartmanlar',exact=True)).to_be_visible();expect(page.get_by_role('button',name='Rol ata',exact=True)).to_have_count(0)
  if scenario=='staff-scoped':
   module('ekonomi');assert 'Pelin' not in page.locator('.staff-operations').inner_text();assert 'Defne' not in page.locator('.staff-operations').inner_text()
  if scenario=='staff-ban-only':
   module('oyuncular');control().get_by_role('combobox',name='Apartman',exact=True).select_option('fixture-building');control().get_by_role('combobox',name='Oyuncu',exact=True).select_option('neighbor');expect(control().get_by_role('combobox',name='Yaptırım',exact=True)).to_have_value('ban');control().get_by_role('textbox',name='İşlem gerekçesi',exact=True).fill('Yaptırım test gerekçesi');control().get_by_role('button',name='Yaptırımı önizle',exact=True).click();expect(dialog()).to_contain_text('Ece');apply();expect(dialog()).to_have_count(0);assert page.evaluate('fixtureStaff.applied[0].args.action')=='ban'
   module('secimler');control().get_by_role('button',name='Güncel durumu yükle',exact=True).click();expect(control().get_by_role('combobox',name='İşlem',exact=True)).to_have_value('manager.appoint');control().get_by_role('combobox',name='Aday / atanacak sakin',exact=True).select_option('fixture-player');control().get_by_role('button',name='İşlemi önizle',exact=True).click();expect(dialog()).to_contain_text('Deniz');apply();expect(dialog()).to_have_count(0);assert page.evaluate('fixtureStaff.applied[1].args.action')=='manager.appoint'
  if scenario=='staff-audit-only':
   module('gecmis');control().get_by_role('combobox',name='Apartman',exact=True).select_option('fixture-building');control().get_by_role('button',name='İşlem geçmişini yükle',exact=True).click();expect(control().get_by_text('Test düzeltme gerekçesi',exact=True)).to_be_visible();expect(control().get_by_role('button',name='Ters kayıtla telafi et',exact=True)).to_have_count(0)
 page.goto(base+'?scenario=resident#/sistem/ekonomi');expect(page.get_by_text('Bu alana erişim yetkin yok.',exact=True)).to_be_visible();assert 'staff_game_overview' not in page.evaluate('fixtureCalls')
 visit(scenario='staff-super-unjoined');expect(page.locator('.staff-module-nav a')).to_have_count(6)
 # Confirmation cancel/retention, keyboard/inert, double submit and stable economic request ID.
 visit('ekonomi');wallet();expect(dialog()).to_contain_text('Ece');expect(dialog()).to_contain_text('325 → 350 OP');expect(dialog()).to_contain_text('Test düzeltmesi gerekçesi')
 for _ in range(7):page.keyboard.press('Tab');assert dialog().evaluate('el=>el.contains(document.activeElement)')
 page.keyboard.press('Escape');expect(dialog()).to_have_count(0)
 expect(page.get_by_role('button',name='Bakiyeyi düzelt',exact=True)).to_be_focused()
 wallet();page.evaluate('fixtureStaff.delayWrites(250)');dialog().get_by_role('button',name='Onayla ve uygula',exact=True).evaluate('el=>{el.click();el.click()}');expect(dialog()).to_have_count(0)
 expect(page.get_by_text('Yönetim işlemi kaydedildi.',exact=False)).to_be_visible();assert len(page.evaluate("fixtureStaff.applied.filter(c=>c.rpc==='staff_adjust_wallet')"))==1
 # The unchanged authority refresh and module navigation must not lose fields.
 reason_ops().fill('Korunacak gerekçe');page.get_by_role('heading',name='Oyuncu bakiyesini düzelt',exact=True).locator('..').get_by_label('Değişim miktarı (OP)',exact=True).fill('25')
 page.evaluate("dispatchEvent(new Event('focus'))");page.wait_for_timeout(300);expect(reason_ops()).to_have_value('Korunacak gerekçe');module('genel');module('ekonomi');expect(reason_ops()).to_have_value('Korunacak gerekçe')
 visit('ekonomi');page.evaluate("fixtureStaff.setFailure('network-after-apply')");wallet();apply();expect(page.get_by_text('Sonuç doğrulanamadı.',exact=False)).to_be_visible();wallet();apply();expect(page.get_by_text('Yönetim işlemi kaydedildi.',exact=False)).to_be_visible()
 requests=page.evaluate("fixtureStaff.calls.filter(c=>c.rpc==='staff_adjust_wallet')");assert requests[0]['args']['operation_id']==requests[1]['args']['operation_id'];assert len(page.evaluate('fixtureStaff.applied'))==1
 visit('ekonomi');page.evaluate("fixtureStaff.setFailure('refresh')");wallet();apply();expect(page.get_by_text('İşlem sunucuda kaydedildi; görünüm yenilenemedi.',exact=False)).to_be_visible();assert len(page.evaluate('fixtureStaff.applied'))==1
 # MFA denial; verify in-place, preserving the exact request and form fields.
 visit('ekonomi','staff-super-aal1');wallet();apply();expect(page.get_by_text('çok faktörlü doğrulama gerekli.',exact=False)).to_be_visible();module('genel');page.get_by_text('Oturumu burada doğrula',exact=True).click();page.get_by_role('button',name='MFA hazırla / doğrula',exact=True).click();page.get_by_label('Altı haneli kod').fill('123456');page.get_by_role('button',name='Oturumu doğrula',exact=True).click();module('ekonomi');expect(reason_ops()).to_have_value('Test düzeltmesi gerekçesi');wallet();apply();expect(page.get_by_text('Yönetim işlemi kaydedildi.',exact=False)).to_be_visible()
 # Revision remains the preview's value; stale final confirmation never reports success.
 visit('secimler');control().get_by_role('combobox',name='Apartman',exact=True).select_option('fixture-building');control().get_by_role('button',name='Güncel durumu yükle',exact=True).click();control().get_by_role('textbox',name='İşlem gerekçesi',exact=True).fill('Seçim inceleme gerekçesi');control().get_by_role('combobox',name='İşlem',exact=True).select_option('election.resolve');control().get_by_role('combobox',name='Seçim',exact=True).select_option('election1');control().get_by_role('button',name='İşlemi önizle',exact=True).click();page.evaluate("fixtureStaff.setFailure('stale')");apply();expect(dialog()).to_contain_text('Önizleme değişmiş');assert not page.evaluate('fixtureStaff.applied');assert page.evaluate("fixtureStaff.calls.find(c=>c.rpc==='staff_governance_action').args.expected_revision")=='revision-1';cancel()
 # Late governance reads cannot repopulate a different building's preview.
 visit('secimler');control().get_by_role('combobox',name='Apartman',exact=True).select_option('fixture-building');page.evaluate('fixtureStaff.holdGovernance()');control().get_by_role('button',name='Güncel durumu yükle',exact=True).click();control().get_by_role('combobox',name='Apartman',exact=True).select_option('fixture-other');page.evaluate('fixtureStaff.releaseGovernance()');page.wait_for_timeout(250);expect(control().get_by_role('combobox',name='İşlem',exact=True)).to_have_count(0)
 # Pending actions cannot survive revocation or an authenticated subject change.
 visit('ekonomi');wallet();page.evaluate('fixtureStaff.revoke()');expect(dialog()).to_have_count(0);expect(page.get_by_text('Bu alana erişim yetkin yok.',exact=True)).to_be_visible();assert not page.evaluate('fixtureStaff.applied')
 visit('ekonomi');page.evaluate('fixtureStaff.holdIdentity();dispatchEvent(new Event("focus"))');page.evaluate('fixtureStaff.revoke()');expect(page.get_by_text('Bu alana erişim yetkin yok.',exact=True)).to_be_visible();page.evaluate('fixtureStaff.releaseIdentity()');page.wait_for_timeout(300);expect(page.get_by_text('Bu alana erişim yetkin yok.',exact=True)).to_be_visible();expect(page.locator('.staff-module-nav')).to_have_count(0)
 visit('ekonomi');wallet();page.evaluate("fixtureSwitchSession('neighbor')");expect(dialog()).to_have_count(0);assert not page.evaluate('fixtureStaff.applied')
 # Scope change invalidates pending governance preview; existing audit compensation appends.
 visit('gecmis');control().get_by_role('combobox',name='Apartman',exact=True).select_option('fixture-building');control().get_by_role('button',name='İşlem geçmişini yükle',exact=True).click();control().get_by_role('textbox',name='İşlem gerekçesi',exact=True).fill('Telafi inceleme gerekçesi');control().get_by_role('button',name='Ters kayıtla telafi et',exact=True).first.click();expect(dialog()).to_contain_text('Eski kayıt silinmez');apply();expect(dialog()).to_have_count(0);assert page.evaluate('fixtureStaff.applied[0].rpc')=='staff_compensate'
 # All role writes require a real review; cancel keeps form values.
 visit('roller');page.get_by_placeholder('İşlemin nedeni').fill('Rol atama incelemesi');page.get_by_role('combobox',name='Kullanıcı',exact=True).select_option('neighbor');page.get_by_role('button',name='Rol ata',exact=True).click();expect(dialog()).to_contain_text('Ece');cancel();expect(page.get_by_role('combobox',name='Kullanıcı',exact=True)).to_have_value('neighbor');page.get_by_role('button',name='Rol ata',exact=True).click();apply();expect(page.get_by_text('İşlem sunucuda kaydedildi.',exact=True)).to_be_visible();assert page.evaluate('fixtureStaff.applied[0].rpc')=='staff_grant'
 page.get_by_role('combobox',name='Kapsam',exact=True).select_option('building');page.get_by_role('combobox',name='Apartman',exact=True).select_option('fixture-building');page.get_by_role('button',name='Rol ata',exact=True).click();expect(dialog()).to_contain_text('Çınar Apartmanı');cancel();expect(page.get_by_role('combobox',name='Kapsam',exact=True)).to_have_value('building')
 # Loading/error/empty states and responsive captures of every module.
 visit(scenario='staff-loading');expect(page.locator('.staff-overview-data').get_by_text('Yönetim bilgileri yükleniyor…',exact=True)).to_be_visible();page.evaluate('fixtureStaff.releaseReads()');expect(page.get_by_text('Oyuncu kaydı',exact=True)).to_be_visible()
 for width in ([] if args.flows_only else [320,360,390,430,768,1280,1440]):
  page.set_viewport_size({'width':width,'height':844 if width<900 else 1000})
  for theme in ['light','dark']:
   print(f'CHECK F {width}px {theme}',flush=True)
   for view in ['genel','oyuncular','ekonomi','secimler','roller','gecmis']:
    visit(view,theme=theme);no_overflow()
    if view=='secimler':control().get_by_role('combobox',name='Apartman',exact=True).select_option('fixture-building');control().get_by_role('button',name='Güncel durumu yükle',exact=True).click();expect(control().get_by_role('combobox',name='İşlem',exact=True)).to_be_visible()
    if view=='gecmis':control().get_by_role('combobox',name='Apartman',exact=True).select_option('fixture-building');control().get_by_role('button',name='İşlem geçmişini yükle',exact=True).click();expect(control().get_by_text('Test düzeltme gerekçesi',exact=True)).to_be_visible()
    if view=='ekonomi':
     page.get_by_role('heading',name='Kişisel cüzdan',exact=True).locator('..').get_by_role('combobox',name='Oyuncu',exact=True).select_option('neighbor')
     page.get_by_role('heading',name='Kişisel cüzdan',exact=True).locator('..').evaluate('el=>el.scrollIntoView({block:"start"})')
    elif view!='genel':page.locator('.staff-operations' if view in ['oyuncular','ekonomi','secimler','gecmis'] else '.staff-role-content').evaluate('el=>el.scrollIntoView({block:"start"})')
    capture(view,width,theme)
   visit('ekonomi',theme=theme);wallet();no_overflow();capture('confirmation',width,theme);cancel()
   visit('oyuncular','staff-empty',theme);empty=page.get_by_text('Bu oturum için erişilebilir oyuncu kaydı yok.',exact=True);expect(empty).to_be_visible();empty.evaluate('el=>el.scrollIntoView({block:"center"})');capture('empty',width,theme)
   visit('roller','staff-editor',theme);capture('limited',width,theme)
   visit('ekonomi','staff-read-error',theme);error=page.get_by_text('Bilgiler yüklenemedi:',exact=False);expect(error).to_be_visible();error.evaluate('el=>el.scrollIntoView({block:"center"})');capture('error',width,theme)
   # Existing E display preferences apply to staff without shrinking controls.
   page.evaluate("localStorage.setItem('apartman-appearance',JSON.stringify({version:1,textSize:'large',density:'compact',reduceMotion:true}))")
   visit('ekonomi',theme=theme);no_overflow();wallet();assert dialog().bounding_box()['width']<=width;cancel()
   page.evaluate("localStorage.removeItem('apartman-appearance')")
 assert not errors,errors;assert not remote,remote
 context.close();browser.close()
print('PASS F Chromium: permissions/roles/scopes/session/revocation; modal/focus/cancel/retention/idempotency/uncertain network/write-ack-read-error/MFA fixture/revision/compensation; '+('flows only, screenshots unchanged' if args.flows_only else '320/360/390/430/768/1280/1440 light/dark and large/compact/reduced motion; 40 screenshots')+'. Synthetic RPC only; real Auth/MFA/Realtime not tested.')
