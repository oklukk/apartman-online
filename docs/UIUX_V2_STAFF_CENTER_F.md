# UI/UX v2 — F: Sistem Yönetim Merkezi

26 Kasım 2026. Ana referans: [UIUX_V2_SPEC.md](UIUX_V2_SPEC.md). Başlangıç: PR #14 birleşme commit'i `15641c4d8f978d09068db8c94476682b893f2bc4`; main Actions çalışması [45775599846](https://github.com/oklukk/apartman-online/actions/runs/45775599846) başarılı olarak doğrulandı. Dal: `feat/uiux-v2-staff-center`.

Bu teslim mevcut personel arayüzünün düzenlenmesidir. Yeni yönetim işlemi veya sunucu yetkisi eklenmez. Kod ve sentetik regresyonlar incelemeye hazırdır; görsel kabul ve aşağıdaki manuel kabul tamamlanmadan A–F bütünü tamamlanmış sayılmaz. PR taslaktır; birleştirme/yayın yapılmaz.

## İşlev ve veri envanteri

| Modül | Korunan işlevler / RPC | Form durumu |
| --- | --- | --- |
| Genel Bakış | `staff_me`, `staff_game_overview`; gerçek rol/kapsam, API'nin erişime açtığı oyuncu/apartman kayıt sayısı | Yeni bir genel oyun istatistiği yok. Okuma hatası sıfır kayıt sayılmaz; yükleniyor/hata/yenile ayrıdır. |
| Oyuncular ve Denetim | Mevcut oyuncu listesinden arama/seçim; `staff_rename_player`, `staff_sanction`, `staff_sanction_history` | Kullanıcı adı; hedef oyuncu/apartman; uyarı, mute/unmute, ban/unban; bitiş ve gerekçe. Geçici/süresiz yaptırım davranışı aynı. |
| Ekonomi | `staff_adjust_wallet`, `staff_adjust_treasury`, `staff_update_economy`; mevcut `staff_game_overview` verileri | Cüzdan/kasa hedefi ve farkı; mevcut/yeni bakiye önizlemesi; parametre ve yeni değer; gerekçe. Okunamayan bakiye üzerinde hayalî önizleme yok. |
| Seçimler ve Yönetim | `staff_governance_state`, `staff_governance_action` | Seçim/görev/ortak karar, aday, adaylık/oylama/görev bitişi, gerekçe. Yalnız ilgili alanlar görünür; diğer girilen değerler silinmez. |
| Roller ve Yetkiler | `staff_directory`, `staff_grant`, `staff_revoke`, `staff_create_role`, `staff_set_role_permissions`, `staff_rename_building` | Rol kataloğu, atamalar, kullanıcı/rol/kapsam, özel rol/izin grupları ve apartman adı. Yerel açılır işlem gruplarıyla uzun sayfa azaltıldı. |
| İşlem Geçmişi ve Telafi | `staff_directory` içindeki yetkili rol denetimi; `staff_operations_history`, `staff_compensate` | Kapsam, işlem gerekçesi, eski/yeni değerler; desteklenen kaydın ters kaydı. Orijinal audit/ledger satırı silinmez. |

`staff_governance_action` içindeki **mevcut 13 işlem** korunur: `election.start/restart/cancel/schedule/resolve/force`, `manager.appoint/dismiss/term`, `poll.cancel/resolve/force_accept/force_reject`. Aday/oy/görev sonuçları veya süreleri istemcide değiştirilmez. `expected_revision` mevcut önizlemeden gönderilir.

Ekonomi parametreleri mevcut katalogla sınırlıdır: başlangıç parası, maaş, ek iş ödülü, aidat, temizlik ve bakım sabit/kişi başı değerleri. Sunucu sınırları ve sonraki dönem kuralları aynı kalır.

`StaffMfa.tsx` ve mevcut Auth MFA list/enroll/unenroll/challenge/verify akışı değiştirilmedi. Genel Bakış'taki “Oturumu burada doğrula” mevcut bileşeni kullanır; kullanıcı diğer modülün formunu kaybetmeden doğrulama yapabilir. Hesap Güvenliği bağlantısı korunur. Arayüz, AAL2 durumunu varsaymaz.

## İzin matrisi ve durumların ayrılması

Görünürlük rol adına göre tahmin edilmez; `staff_me` global/scoped permission birleşimi kullanılır. Mevcut global `super_admin` istisnası korunur. Her yazmanın asıl yetki kaynağı mevcut sunucu RPC'sidir.

| Test kimliği | Görünür modül sayısı | Sınır / kontrol |
| --- | --- | --- |
| Global Süper Yönetici | 6 | Mevcut bütün işlemler; yeni yetki türetilmez. |
| Global Yönetici | 6 | Mevcut izinlerinin işlemleri; rol atama/düzenleme yok, zorunlu seçim sonucu yok. |
| Moderatör | 3 | Genel, Oyuncular, Seçimler (okuma); ban veya ekonomi yazması yok. |
| Editör | 2 | Genel ve mevcut apartman okuma erişimi; çalışmayan içerik yönetim modülü eklenmez. |
| Apartman kapsamlı Yönetici | 6 | Yalnız yetkili apartman/hedefler; başka apartmanın adı, oyuncusu ve bakiyesi görünmez. |
| Özel ban + yönetici atama rolü | 3 | Gerçekte sunulan ilk seçenek ban / yönetici atama olur; HTML seçeneğiyle gönderilen action birbirine uyar. |
| Özel audit + apartman okuma rolü | 3 | Geçmiş okunur; ekonomi düzeltme izni olmadan telafi düğmesi yok. |
| Yetkisiz kullanıcı | 0 | Yönetim erişim reddi; ayrıcalıklı overview çağrısı yok. |
| Dairesiz yetkili personel | İzinlerine göre | Üyelik koşuluna takılmadan mevcut personel alanına erişir. |

Rol atama/kaldırma/özel rol/izin düzenleme, mevcut sunucunun gerektirdiği **global Süper Yönetici** sınırında kalır. `staff.roles.manage` adına bakarak yeni yazma yetkisi verilmez. Apartman adı değiştirme hedef apartmanın gerçek `world.buildings.rename` izniyle süzülür. Audit okuma tek başına ters kayıt yetkisi oluşturmaz.

Mevcut API sınırı: global yalnız-audit özel rolü için apartman keşif API'si yoksa yeni uç nokta uydurulmaz. Kapsamlı izinlerin gerçek apartman UUID'leri hedef listesine güvenli alternatif olarak eklenebilir; ad okunamıyorsa kısa kapsam kimliği gösterilir. Rol/dizin RPC'sinin açmadığı veriler başka bir kaynaktan toplanmaz.

`App` personel sonucunu Auth kullanıcı kimliğine bağlar. Kimlik veya gerçek rol/izin/kapsam değiştiğinde çalışma alanı anahtarı değişir; eski formlar, sonuçlar ve bekleyen onaylar kaldırılır. Aynı `staff_me` yanıtının farklı sıralanması veya düzenli yenilenmesi formu sıfırlamaz. Birbiriyle çakışan UI yenilemelerinde yalnız en son isteğin sonucu kullanılır; gecikmiş eski yanıt yetki iptalinden sonra eski ekranı geri getiremez. Auth aboneliği ve çağrı sözleşmeleri değişmez. Mevcut 30 saniyelik/odaklanma yenilemesi korunur; anlık yetki iptali bildirimi eklenmedi. İstemci henüz yenilenmemiş olsa da sunucu yazmada güncel yetkiyi denetler.

## İşlem deneyimi ve hata davranışı

- Hedef → gerekçe → önizleme/son onay → mevcut RPC → sunucu sonucu/işlem geçmişi zinciri korunur. Native modal `<dialog>` başlığına odaklanır; Tab/Shift+Tab içeride kalır, Escape/iptal formu korur, arka plan inert olur, kapanınca görünür tetikleyiciye odak döner.
- Rol ve ekonomi işlemlerindeki `window.confirm` yerine ortak, okunabilir hedef/apartman/miktar/değer/gerekçe özeti kullanılır. Gönderimde buton/ref mutex'i ikinci çağrıyı engeller.
- Ekonomi işlemlerinde mevcut payload anahtarı ve `operation_id` korunur. Belirsiz ağ yanıtından sonra aynı bilgilerle tekrar aynı kimlik kullanılır. Yaptırım/seçim/telafide sahnelenmiş kimlik son onay/yeniden denemede aynı kalır.
- **Rol RPC sözleşmelerinde operation_id yoktur.** Bu işlemler için güvenli idempotent tekrar iddia edilmez; belirsiz ağ sonucunda tekrar göndermeden önce güncel audit/dizin kontrolü istenir.
- Sunucu yazmayı onaylayıp sonraki okuma hata verirse “kaydedildi; görünüm yenilenemedi” denir. Ağ kesintisi başarı veya kesin başarısızlık gibi sunulmaz. MFA/yetki/revision reddi sunucu hatası olarak gösterilir.
- Scope/modül değişiminden sonra geç gelen okuma, başka hedefin seçim önizlemesini veya geçmişini dolduramaz. Aynı şekilde farklı oyuncunun yaptırım geçmişi karışmaz.
- Modüller aynı mevcut form bileşenlerini bağlı tutar; görünüm değişiminde girilen bilgiler korunur. Bekleyen onay modül değişiminde iptal olur. Gerçek kimlik/yetki değişimi ise eski ayrıcalıklı durumu temizler.

## Tasarım ve entegrasyon

Altı modül hash üzerinden doğrudan açılır; sayfa yenileme/GitHub Pages alt yolu mevcut merkezi navigasyonla çalışır. Personel çalışma alanı dört oyuncu sekmesinden ayrıdır; “Oyuna dön” ve hesap menüsü korunur. Dairesiz personele apartman varmış veya canlı oyuncu bağlantısı kurulmuş gibi bilgi verilmez.

Onaylı krem/petrol/adaçayı paleti, kart tokenları, odak göstergeleri ve mevcut fontlar kullanılır. Mobilde iki sütunlu modül bağlantıları; formlarda 44 px kontroller; uzun audit içeriklerinde satır kırma/kaydırma vardır. Açık/koyu, normal/büyük yazı, standart/kompakt ve hareket azaltma mevcut tercih altyapısından gelir. Yeni animasyon, kütüphane veya onaylı sanat değişikliği yoktur.

## Otomatik doğrulama

| Kontrol | Sonuç |
| --- | --- |
| `npm test` | 54 başarılı, 0 başarısız; 47 mevcut + 7 F test grubu |
| `npm run test:ui` | Başarılı; mevcut SSR ve yeni modal/modül görünürlük kontrolleri |
| `npm run build` | Başarılı; TypeScript + Vite |
| `npm run test:sql` | 11 PostgreSQL kontrolü başarılı |
| `npm run test:v02` | 24 grup başarılı |
| `npm run test:rbac` | 14 grup başarılı |
| `npm run test:advanced` | 15 grup başarılı |
| B/C Chromium `--player-screens --verify-only` | Başarılı; gezinme, kısayollar, klavye, Auth fragment, menü, görünürlük |
| D Chromium `--verify-only` | Başarılı; bina/koordinatlar, avatar, profil, engel, sohbet taslağı/kaydırması |
| E Chromium `--verify-only` | Başarılı; görünüm, storage/cross-tab, hesap/güvenlik, gizlilik, oturum arayüzü |
| F Chromium | Rol/kapsam, oturum değişimi/iptal, MFA reddi/yerinde doğrulama, önizleme/iptal/odak, çift gönderim, idempotent ağ tekrarı, yazma sonrası okuma hatası, eski revision ve geç gelen okuma, rol/telafi |
| F responsive | 320/360/390/430/768/1280/1440 px × açık/koyu; büyük yazı + kompakt + hareket azaltma; yatay taşma yok |
| Gerçek Chromium tarayıcı zoom | %100 ve %200, açık/koyu, altı modül ve modal: başarılı |

PostgreSQL testleri yalnız **localhost:55432 disposable** altyapısında çalıştırıldı. Canlı proje sorgulanmadı/değiştirilmedi. Ayrı gerçek yerel Supabase yığını gerektiren `test:db` çalıştırılmadı; yeni veritabanı değişikliği yoktur.

%200 kontrolü CSS `zoom`, pinch veya dar viewport taklidi değildir: izole Chromium profilinde gerçek tarayıcı yakınlaştırması kullanılır. Aynı 1440 px pencere %100'de 1440 CSS px / DPR 1, %200'de 720 CSS px / DPR 2 döndürür; iki durumda `visualViewport.scale = 1`. Böylece form/modal reflow ve klavye odağı gerçek zoom altında denetlenir.

## Gerçek Chromium görüntüleri

**44 yeni PNG**, yalnız sentetik fixture verisi. 40 normal görüntü 390×844 ve 1440×1000 gerçek viewport'tur; kaydırılmış modüllerde üst başlık/test şeridi viewport dışında kalabilir. Sabit menünün kontrolleri örtebildiği uzun birleştirilmiş sayfa çekimleri kullanılmaz. Ek 4 görüntü gerçek %100/%200 tarayıcı zoom'udur. Eski aşamaların görüntüleri değiştirilmedi.

| Görünüm | Mobil açık | Mobil koyu | Masaüstü açık | Masaüstü koyu |
| --- | --- | --- | --- | --- |
| Genel Bakış | [light 390](design/staff-center/genel-light-390.png) | [dark 390](design/staff-center/genel-dark-390.png) | [light 1440](design/staff-center/genel-light-1440.png) | [dark 1440](design/staff-center/genel-dark-1440.png) |
| Oyuncular | [light 390](design/staff-center/oyuncular-light-390.png) | [dark 390](design/staff-center/oyuncular-dark-390.png) | [light 1440](design/staff-center/oyuncular-light-1440.png) | [dark 1440](design/staff-center/oyuncular-dark-1440.png) |
| Ekonomi | [light 390](design/staff-center/ekonomi-light-390.png) | [dark 390](design/staff-center/ekonomi-dark-390.png) | [light 1440](design/staff-center/ekonomi-light-1440.png) | [dark 1440](design/staff-center/ekonomi-dark-1440.png) |
| Seçimler | [light 390](design/staff-center/secimler-light-390.png) | [dark 390](design/staff-center/secimler-dark-390.png) | [light 1440](design/staff-center/secimler-light-1440.png) | [dark 1440](design/staff-center/secimler-dark-1440.png) |
| Roller | [light 390](design/staff-center/roller-light-390.png) | [dark 390](design/staff-center/roller-dark-390.png) | [light 1440](design/staff-center/roller-light-1440.png) | [dark 1440](design/staff-center/roller-dark-1440.png) |
| Geçmiş | [light 390](design/staff-center/gecmis-light-390.png) | [dark 390](design/staff-center/gecmis-dark-390.png) | [light 1440](design/staff-center/gecmis-light-1440.png) | [dark 1440](design/staff-center/gecmis-dark-1440.png) |
| Son onay | [light 390](design/staff-center/confirmation-light-390.png) | [dark 390](design/staff-center/confirmation-dark-390.png) | [light 1440](design/staff-center/confirmation-light-1440.png) | [dark 1440](design/staff-center/confirmation-dark-1440.png) |
| Boş kayıt | [light 390](design/staff-center/empty-light-390.png) | [dark 390](design/staff-center/empty-dark-390.png) | [light 1440](design/staff-center/empty-light-1440.png) | [dark 1440](design/staff-center/empty-dark-1440.png) |
| Kısıtlı yetki | [light 390](design/staff-center/limited-light-390.png) | [dark 390](design/staff-center/limited-dark-390.png) | [light 1440](design/staff-center/limited-light-1440.png) | [dark 1440](design/staff-center/limited-dark-1440.png) |
| Okuma hatası | [light 390](design/staff-center/error-light-390.png) | [dark 390](design/staff-center/error-dark-390.png) | [light 1440](design/staff-center/error-light-1440.png) | [dark 1440](design/staff-center/error-dark-1440.png) |

Gerçek zoom: [%100 açık](design/staff-center/zoom-100-light.png), [%100 koyu](design/staff-center/zoom-100-dark.png), [%200 açık](design/staff-center/zoom-200-light.png), [%200 koyu](design/staff-center/zoom-200-dark.png).

Tekrar üretim (mevcut bulut ortamında, kullanıcının bilgisayarına kurulum gerekmez):

```sh
node tools/serve-navigation-fixture.mjs
# Ayrı terminalde:
python tools/check-staff-browser.py
python tools/check-staff-zoom.py
python tools/check-navigation-browser.py --player-screens --verify-only
python tools/check-social-browser.py --verify-only
python tools/check-settings-browser.py --verify-only
```

Test sunucusu gerçek React uygulamasını ayrı sentetik API adaptörüyle derler; üretim Supabase modülü yüklenmez, Chromium'da localhost dışı trafik engellenir. Sahte rolleri/MFA yanıtlarını yalnız test adaptörü üretir. CI'ın mevcut kaynak/SSR/build ve dört PostgreSQL paketi değişmeden çalışır; Chromium araçları bu bulut ortamında ayrıca çalıştırılır, Actions'ın tarayıcı testi çalıştırdığı iddia edilmez.

## Değişen dosyalar ve performans

- `src/components/StaffPanel.tsx`, `StaffOperations.tsx`, `StaffControlCenter.tsx`: mevcut işlemlerin altı modüle yerleşimi; güvenilir durum, izinli hedef/form ve önizleme.
- Yeni `StaffConfirmation.tsx`, `StaffFeedback.tsx`, `src/staffAccess.ts`, `src/styles/staff-center.css`: ortak onay, sonuç bildirimi, sunum izinleri/kimlik imzası ve personel stilleri.
- `src/App.tsx`, `components/AppShell.tsx`, `src/navigation.ts`: yalnız personel çalışma alanı, kimliğe bağlı UI temizliği ve hash modülleri entegrasyonu.
- `tests/staff-ui.test.mjs`, mevcut `admin-operations.test.mjs`/`admin-rbac.test.mjs`/`ui-render.mjs`: davranış/sözleşme/SSR regresyonları.
- `tests/fixtures/navigation/staff.ts`, fixture `api.ts`, iki yeni Chromium aracı: sadece izole test girdileri/kanıtları. E aracına `--verify-only` eklenerek tarihsel görüntülerin değişmeden denetlenmesi sağlandı.
- Bu rapor ve `docs/design/staff-center/*.png`: yeni F kanıtları.

Production build: ana JS yaklaşık **247.84 kB / gzip 78.59 kB**, lazy personel işlemleri **25.66 kB / gzip 7.89 kB**, toplam CSS **50.39 kB / gzip 10.67 kB**. Bunlar çıktı boyutlarıdır; ağ/CPU hız ölçümü değildir. Yeni runtime bağımlılığı yoktur; mevcut lazy personel modülü korunur. Test adaptörü ve PNG'ler üretim bundle'ına dahil edilmez.

Diff kontrolünde `supabase/`, `src/api.ts`, `StaffMfa.tsx`, ekonomi/oylama bileşenleri, sosyal model, onaylı `public/art/v2`, iş akışları, paket/kilit dosyaları, AGENTS, ana şartname ve A–E görüntüleri değişmemiştir. Mevcut 18 ayrı personel RPC adı korunur; Auth/MFA ve oyun RPC sözleşmeleri değiştirilmez.

## Manuel kabul / kalan riskler

1. Gerçek Supabase Auth/MFA/Realtime uçtan uca kabulü bu PR'da yeniden yapılmadı. Sentetik MFA/oturum testleri gerçek TOTP veya hesap doğrulaması değildir. Canlıda yönetim test işlemi yapılmadı; gerçek hesapla salt okunur modül görünürlüğü ve MFA erişimi kullanıcı incelemesinde kontrol edilmeli.
2. **E aşamasından kalan fiziksel iOS/Android hareket azaltma kabulü** sürer. Tarayıcı emülasyonu; gerçek dokunmatik klavye, safe area veya fiziksel cihaz testi yerine geçmez. Fiziksel cihazda büyük yazı/kompakt/odak ve ekran okuyucu kabulü önerilir.
3. Çok uzun gerçek audit verileri ve rol/izin kataloglarıyla operatör kullanılabilirliği manuel kabul ister. Mevcut API'nin sayfalama/kapsam sınırları bu arayüz PR'ında genişletilmez.
4. Rol yazmalarının ağ belirsizliğinde otomatik idempotency garantisi yoktur; sunucu sözleşmesi aynıdır. Audit kontrolü uyarısı özellikle korunur. İptal veya sayfadan ayrılma, sunucuya zaten gönderilmiş işlemi geri almış sayılmaz.
5. Yetki değişimi mevcut yenileme mekanizmasıyla algılanır; anlık push iptal sistemi eklenmez. Her gerçek RPC'nin sunucu yetki/MFA denetimi belirleyicidir. Chromium görünürlük testleri güvenlik kanıtının tamamı değildir; gerçek PostgreSQL RBAC/advanced testleri ayrıca başarılıdır.
6. Kod, test ve görseller taslak PR ile sunulur. Görsel/tasarım ve gerçek hesap kabulü kullanıcı onayını bekler; UI/UX v2'nin tamamlandığı veya canlı yayımlandığı iddia edilmez.

## Geri alma

Bu dalın istemci/test/belge commit'lerini geri almak veya taslak PR'ı kapatmak yeterlidir. Veritabanı, veri, migration, RPC veya worker değişikliği olmadığından DB rollback/telafi gerekmez. UI'dan yürütülen gerçek işlemler için ancak mevcut yetkili ters kayıt mekanizması kullanılabilir; arayüz kodunu geri almak geçmiş işlemleri silmez. Bu çalışma sırasında canlıda böyle bir işlem yürütülmedi.
