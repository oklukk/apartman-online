# PR #15 — inceleme düzeltmesi: zoom kanıtı ve hata metni

26 Kasım 2026. Mevcut `feat/uiux-v2-staff-center` dalı ve PR #15 üzerinde; tasarım, RPC, yetkilendirme, oyun kuralları veya canlı veri değişikliği yoktur. Ana [F raporu](UIUX_V2_STAFF_CENTER_F.md) ve ana [v2 şartnamesi](UIUX_V2_SPEC.md) geçerlidir.

## Teşhis: DOM neden geçti, PNG neden boştu?

Önceki %200 görüntü kanıtı geçerli değildi ([önceki açık PNG](https://github.com/oklukk/apartman-online/blob/3065717/docs/design/staff-center/zoom-200-light.png)). `zoom-200-light.png` ve `zoom-200-dark.png` gerçekten **720×456 px ve tek renkliydi**. Betik DOM görünürlüğünü, odak ve taşmayı denetlemiş; PNG piksellerini denetlememişti. DOM kutusunun görünür olması ayrı ekran yakalama yolunun doğru alanı resmettiğini kanıtlamaz.

Aynı gerçek %200 zoom oturumunda, aynı açık modal ve aynı kaydırma konumunda karşılaştırma yapıldı. Ortam: **Chromium 156.0.8078.79**, **Playwright 1.62.0**.

| Yakalama | Sonuç |
| --- | --- |
| `page.screenshot()` | 720×456, 1 renk; boş |
| `page.screenshot(scale='css')` | 360×228, 1 renk; boş |
| CDP, açık viewport `clip` parametresi | 720×456, 1 renk; boş |
| CDP `Page.captureScreenshot`, clip olmadan | 1440×913, 1224 renk; modal ve içerik görünür |
| Aynı CDP yakalama, `fromSurface: false` | 1440×913, 1224 renk; modal ve içerik görünür |

Protokol kaydında Playwright'ın `{x:0,y:1221.5,width:720,height:456,scale:1}` clip'i gönderdiği görüldü. Aynı anda `Page.getLayoutMetrics` içindeki eski `layoutViewport.pageY=2443`, `cssLayoutViewport.pageY≈1222`; `cssVisualViewport` genişliği 720, yüksekliği 456.5 ve zoom'u 2 idi. Bu sürüm birleşiminde **gerçek browser zoom + kaydırılmış sayfa + clip koordinatları** ekranın yanlış bölgesini yakalıyor. Clip'siz gerçek composed viewport hem surface hem native yakalamada doğruydu; DOM veya uygulama CSS/render hatası saptanmadı. Uygulama tasarımına render yaması yapılmadı.

## Düzeltme ve otomatik koruma

`tools/check-staff-zoom.py` gerçek Chromium profil zoom'unu korur. Dar viewport emülasyonu, CSS zoom veya pinch kullanılmaz. 1440 px dış pencere %100'de 1440 CSS px / DPR 1; %200'de 720 CSS px / DPR 2 döndürür; `visualViewport.scale=1` kalır.

Yakalama artık `Page.captureScreenshot` ile `fromSurface:true`, `captureBeyondViewport:false` ve **clip olmadan** yapılır. Device metrics override veya resmi sonradan ölçekleme yoktur. Doğru native PNG, fiziksel **1440×913 px** viewport'u içerir.

Her modülün gerçek içeriği yüklenir; ilgili başlık görünür viewport'a kaydırılır. Hem tam görüntüde hem CSS koordinatlarından PNG koordinatlarına çevrilen **başlık/düğme bölgesinde** en az 32 renk ve en az %1 baskın renk dışı piksel gerekir. Boş, tek pikselle değiştirilmiş, yalnız dışı dolu ama hedefi boş veya kırpılmış bölge geçemez. Piksel kontrolü geçmeden PNG dosyası yazılmaz.

Bu bir boş-görüntü korumasıdır; OCR veya tasarım onayı yerine geçmez. `tools/screenshot_evidence.py` bulut ortamında zaten bulunan Pillow'u kullanır; yeni npm paketi veya servis kurulmadı. Altı Python negatif/pozitif testi düz arka planı (iki tema), tek farklı pikseli, boş/kırpılmış hedefi, yanlış oranı ve gerçek ölçekli dolu hedefi sınar.

Toplam **30 frame** otomatik piksel kontrolünden geçer: %100/%200 × iki tema × altı modül, dört modal başlangıcı ve iki %200 modal düğme görünümü. %100 modül frame'leri test edilir ancak ayrıca kaydedilmez; **18 zoom PNG** kaydedilir. [zoom-validation.json](design/staff-center/zoom-validation.json), ölçümleri, bölge piksel sonuçlarını ve kaydedilen görüntülerin SHA-256 değerlerini içerir. Standart Playwright yakalamasının bu ortamda boş kaldığı da tanı alanında kayıtlıdır.

Modalın dış kutusu viewport içinde kalır. %200'de bütün uzun içerik aynı anda sığmadığı için mevcut modal iç kaydırması kullanılır; başlangıç ve son onay düğmelerinin iki ayrı görüntüsü vardır. Tab döngüsü, Escape, düğmelerin görünürlüğü ve kapanınca tetikleyiciye odak dönüşü yeniden denetlenir. Yanlışlıkla gerçek yönetim işlemi gönderilmez.

## Yenilenen görüntüler

| %200 modül | Açık | Koyu |
| --- | --- | --- |
| Genel Bakış | [Görsel](design/staff-center/zoom-200-light-genel.png) | [Görsel](design/staff-center/zoom-200-dark-genel.png) |
| Oyuncular | [Görsel](design/staff-center/zoom-200-light-oyuncular.png) | [Görsel](design/staff-center/zoom-200-dark-oyuncular.png) |
| Ekonomi | [Görsel](design/staff-center/zoom-200-light-ekonomi.png) | [Görsel](design/staff-center/zoom-200-dark-ekonomi.png) |
| Seçimler | [Görsel](design/staff-center/zoom-200-light-secimler.png) | [Görsel](design/staff-center/zoom-200-dark-secimler.png) |
| Roller | [Görsel](design/staff-center/zoom-200-light-roller.png) | [Görsel](design/staff-center/zoom-200-dark-roller.png) |
| Geçmiş | [Görsel](design/staff-center/zoom-200-light-gecmis.png) | [Görsel](design/staff-center/zoom-200-dark-gecmis.png) |
| Modal başlangıcı | [Düzeltilen açık](design/staff-center/zoom-200-light.png) | [Düzeltilen koyu](design/staff-center/zoom-200-dark.png) |
| Modal son onay düğmeleri | [Açık](design/staff-center/zoom-200-light-actions.png) | [Koyu](design/staff-center/zoom-200-dark-actions.png) |

%100 modal karşılaştırması da [açık](design/staff-center/zoom-100-light.png) / [koyu](design/staff-center/zoom-100-dark.png) yeniden üretildi.

## Tek hata mesajı

Önceki genel okuma hatasıyla aynı ön ekin tekrar eklenmesi önlendi. Artık:

> Yönetim bilgileri yüklenemedi. Bilgileri yenile düğmesiyle tekrar deneyin.

Anlamlı sunucu ayrıntıları (ör. yetki reddi, bağlantı zaman aşımı) korunur; genel hata ön eki yinelenmez. İlk okuma ve “Bilgileri yenile” aynı formatlayıcıyı kullanır. Chromium testi ilk hatada ve yenilemeden sonra **tek alert ve tam mesaj metnini** doğrular.

Yenilenen hata görüntüleri: [390 açık](design/staff-center/error-light-390.png), [390 koyu](design/staff-center/error-dark-390.png), [1440 açık](design/staff-center/error-light-1440.png), [1440 koyu](design/staff-center/error-dark-1440.png).

## Test ve sınırlar

- `npm test`: **55 başarılı / 0 başarısız**, hata metni için yeni grup dahil.
- `npm run test:ui` ve `npm run build`: başarılı.
- `python -m unittest discover -s tests -p test_screenshot_evidence.py`: **6 başarılı**.
- `python tools/check-staff-zoom.py`: gerçek %100/%200; altı modül, modal, iki tema; **30 piksel kontrollü frame** başarılı.
- `python tools/check-staff-browser.py`: rol/kapsam/oturum/yetki iptali, MFA fixture, onay/iptal, form koruma, idempotency, revision, telafi ve hata/yenileme; 320/360/390/430/768/1280/1440 px açık/koyu + büyük yazı/kompakt/hareket azaltma regresyonu.

Önceki F PostgreSQL/A–E test sonuçları ana raporda tarihsel doğrulama olarak korunur. Bu inceleme düzeltmesinde sunucu/DB değişmedi; yerel PostgreSQL ve A–E paketleri gereksiz yere yeniden çalıştırılmadı. Mevcut CI iş akışı PR commit'inde kaynak/SSR/build ve dört PostgreSQL paketini tekrar çalıştırır; son CI sonucu PR açıklamasında belirtilir.

Gerçek Supabase Auth/MFA/Realtime veya fiziksel cihaz kabulü yapılmadı. Bütün yeni tarayıcı kontrolleri gerçek Chromium ile **izole sentetik API** üzerinde, uzak ağ engellenerek gerçekleştirildi. Canlı Supabase'e dokunulmadı. Önceki fiziksel cihaz/ekran okuyucu kabul maddeleri sürer.

Değişen üretim kodu yalnız `StaffOperations.tsx`'in okuma hata metni ve `staffAccess.ts`'deki saf mesaj formatlayıcıdır. Diğer değişiklikler test/kanıt/belgedir; `.gitignore` Python test önbelleğini dışlar. Onaylı sanat, CSS, App/Auth, staff izin denetimleri, RPC çağrı/argümanları, migration, RLS, ekonomi ve seçim işleyişi değişmez. Geri alma bu inceleme commit'ini geri almaktır; veritabanı geri alma işlemi yoktur.

PR #15 taslak kalır. Birleştirme ve canlı yayın yapılmaz; görsel ve manuel kabul kullanıcı onayını bekler.
