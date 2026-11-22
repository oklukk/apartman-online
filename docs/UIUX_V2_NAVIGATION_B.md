# UI/UX v2 — B aşaması: navigasyon mimarisi

Ana referans: [UIUX_V2_SPEC.md](UIUX_V2_SPEC.md). Başlangıç `main`: `468a01b4db03618579f65019b4240b76db3f5f11`. PR #10, 23 Kasım 2026 saat 00.01 Türkiye saatiyle birleştirilmiş olarak doğrulandı. Dal: `feat/uiux-v2-navigation`. Bu çalışma yalnız B aşamasıdır; C/D kapsamlı tasarımları, etkileşimli bina ve sosyal profil panelleri uygulanmaz.

## Merkezi navigasyon

`src/navigation.ts` dört ana sayfayı, hesap sayfalarını, alt bölümleri, işlem hedeflerini, URL üretimini/ayrıştırmasını ve arayüz erişim durumlarını tek yerde tanımlar. `useNavigation` hash değişimlerini izler; yeni router bağımlılığı yoktur.

- Dört ana sekme sırası: **Bugün, Dairem, Apartman, Komşular**.
- Mobilde 900 px ve altında sabit alt menü, safe-area ve içerik için alt boşluk. Masaüstünde sol menü.
- Profilim, Ayarlar, Hesap güvenliği, yetkili personel için Sistem Yönetim Merkezi ve çıkış, üst hesap menüsündedir. Profil yalnız mevcut kendi kimliği/daire bilgisidir; sosyal profil veya kalıcı avatar seçimi eklenmez.
- Ayarlar bu aşamada mevcut sistem/açık/koyu tema kontrolünü taşır. E aşamasının diğer ayarları veya çalışmayan gizlilik/bildirim düğmeleri eklenmez.
- Onaylı `logo-mark.svg` ve favicon kullanılır. Tasarım tokenları iskelette boşluk/köşe/gölge için opt-in kullanılır; mevcut tema değişkenleri oyun yüzeylerinde korunur. Sanat dosyaları değiştirilmez.

## Mevcut işlevlerin yeni konumu

| Önce | Yeni hedef | Korunan işlev |
| --- | --- | --- |
| Apartman genel özet | Bugün; Apartman / Binayı Keşfet | Doluluk, ortak kasa, yönetici ve haftalık özet |
| Apartman gelişmeleri | Bugün; Apartman / Kasa ve Pano | Mevcut veritabanı gelişme kayıtları |
| Apartman duyuruları | Bugün; Apartman / Kasa ve Pano | Mevcut pano/duyuru verileri |
| Dairem profil kartı | Dairem / Daire; Profilim | Kendi kullanıcı adı, daire ve apartman bilgisi |
| Dairem meslek/ek iş | Dairem / İşler | Meslek seçimi/değişikliği, ek işe başlama/bitirme, gelir durumu |
| Dairem cüzdan/aidat | Dairem / Cüzdan | Kişisel hareketler, borç, yetersiz bakiye/ödendi durumu, ödeme |
| Yönetim seçim ve sonuçları | Apartman / Kararlar | Adaylık, adaylar, tek oy, takvim ve kalıcı sonuçlar |
| Yönetim evet/hayır kararları | Apartman / Kararlar | Asansör dahil mevcut açık/sonuçlanmış oylamalar |
| Yönetim haftalık aidat/gider ve kasa geçmişi | Apartman / Kasa ve Pano | Tahsilat özeti, giderler, tutarlı mevcut muhasebe geçmişi |
| Yönetici teklifleri | Apartman / Yönetici Masası | Mevcut görevdeki apartman yöneticisinin aidat/harcama teklifleri |
| Komşular sakinler ve engel kaldırma | Komşular / Sakinler | Mevcut liste ve yalnız kendi görünümünden mesaj gizleme/geri alma |
| Komşu sohbeti | Komşular / Sohbet | Mesaj yazma, geçmiş sayfalama, engel süzmesi, mesaj şikâyeti |
| Tema seçimi | Hesap / Ayarlar (ziyaretçide üst kontrol) | Mevcut localStorage anahtarı ve sistem/açık/koyu davranışı |
| Hesap güvenliği | Hesap / Hesap güvenliği | Üye olmayan dahil bütün oturum açmış kullanıcıların mevcut MFA bileşeni |
| Sistem yönetimi | Hesap / Sistem Yönetim Merkezi | Sunucudan gelen personel kimliği ve panelin tüm mevcut alt izinleri |
| Çıkış | Hesap / Çıkış yap | Mevcut Auth signOut ve işlem hata yönetimi |

Bugün mevcut genel özet sunumunu korur; kapsamlı eylem kartı/ekran tasarımı C aşamasına bırakılır. B aşaması için gerçek veriden türeyen navigasyon kısayolları eklenir; maaş alma, sahte zil, okunmamış sayacı veya avatar düzenleme kontrolü yoktur. Tamamlanmış ek iş için kısayol üretilmez; otomatik maaş için eylem eklenmez.

## Doğrudan hedefler ve Pages

| Kısayol | Hash yolu | Açılan hedef |
| --- | --- | --- |
| Aidat öde | `#/dairem/cuzdan/aidat` | Borç/ödeme kartı |
| Ek iş | `#/dairem/isler/ek-is` | Günlük ek iş kartı |
| Ortak kararı aç | `#/apartman/kararlar/poll-<id>` | İlgili PollCard |
| Seçimi aç | `#/apartman/kararlar/election-<id>` | İlgili mevcut seçim |
| Sohbete katıl | `#/komsular/sohbet/message` | Mesaj yazma alanı |

Yollar `https://oklukk.github.io/apartman-online/#/...` biçimindedir. Fragment değişimi sunucudan yeni path istemez; yenileme GitHub Pages kök dokümanını ister. Geri/ileri tarayıcı geçmişini kullanır. Hedef bölümü açıldıktan sonra kaydırma/odak yapılır; normal sayfa geçişi başa döner. Geçersiz hedefte erişim hakkında ayrıntı sızdırmayan mevcut durum mesajı gösterilir. Bilinmeyen/kötü biçimli rotalar güvenli genel sayfaya düşer; URL otomatik yeniden yazılmaz.

Supabase'in `#access_token=...`, hata vb. callback fragment'ları navigasyon rotası sayılmaz ve router tarafından değiştirilmez. Auth yapılandırması, kayıt redirect URL'si ve `src/api.ts` aynı kalır. Var olan hesap URL callback'leri için gerçek Auth kabul testi yine ayrıca gerekir.

## Erişim ve bileşen sınırları

- Ziyaretçi kayıt/girişte; yerleşmemiş hesap davetiyeyle katılımda kalır. Yerleşmemiş hesap Profilim/Ayarlar/Güvenlik erişimini korur.
- Personel sunucunun `staff_me` sonucundaki mevcut rol kapısıyla ayrı alana girer; daire sahibi olması gerekmez. Panelin kendi permission/scope/AAL2/gerekçe/onay/audit/telafi kontrolleri aynıdır. URL rol kazandırmaz.
- Seçilmiş apartman yöneticisi mevcut `currentTerm` ile belirlenir; otomatik personel değildir. Yönetici Masası sadece geçerli görevde gösterilir. Yetkisiz doğrudan yönetici URL'sinde teklif formu açılmaz.
- Ekonomi ve sohbet alt bölümleri `hidden` ile görünürlük değiştirir; aynı sayfa içinde alt bölüm değişimi girilmiş form/mesaj taslağını kaldırmaz. Farklı ana sayfaya geçerken mevcut bileşen ömrü davranışı korunur; taslakların kalıcı saklandığı iddia edilmez.
- `main.tsx` yalnız bootstrap; önceki App ve tüm veri/Auth/Realtime akışı `App.tsx`'e taşındı. `AppShell`, `SectionNav`, `AccountScreens` ve `TodayActions` sunum/navigasyon bileşenleridir. Mevcut EconomyPanel/GovernancePanel yalnız görünüm seçimi ve odak hedefleriyle genişletildi; RPC argümanları ve ekonomik hesaplar değiştirilmedi.

## Test ve gerçek Chromium kanıtı

| Kontrol | Sonuç |
| --- | --- |
| `npm test` | 33 başarılı; rota round-trip, geçersiz fragment, üyelik/hesap erişimi ve personel-yönetici ayrımı dahil |
| `npm run test:ui` | Başarılı; mevcut React SSR ve ek menü/hesap/rol görünümü kontrolleri |
| `npm run build` | Başarılı |
| `npm run test:sql` | 11 başarılı |
| `npm run test:v02` | 24 grup başarılı |
| `npm run test:rbac` | 14 grup başarılı |
| `npm run test:advanced` | 15 grup başarılı |

PostgreSQL yalnız mevcut disposable localhost:55432 altyapısında çalıştırılır. Üretim Supabase'e bağlanılmaz. Şema/migration, API, ekonomi yardımcıları, personel/MFA kodları, workflow'lar, ana şartname ve onaylı sanat dosyaları değiştirilmez. Kaynak kodunu yeni dosyaya taşıyan eski source-contract testi App.tsx'i okumaya güncellendi; mevcut güvenlik iddiaları korunur.

Tekrar üretim (bulut geliştirme ortamında, mevcut Playwright Python/Chromium ile):

1. `node tools/serve-navigation-fixture.mjs`
2. `python tools/check-navigation-browser.py`

Yerel Vite test sunucusu, gerçek App bileşenini kullanır; API modülünü yalnız bu sunucuda `tests/fixtures/navigation/api.ts` ile değiştirir. Üretim entry point bu fixture'ı import etmez. Yerel sayfa aynı `/apartman-online/` taban yolunda test edilir. Sentetik hesaplar/veriler ekranın üstünde açıkça etiketlidir. Mutasyon RPC'leri reddedilir; mevcut heartbeat/settle çağrıları yalnız fixture'da veri değiştirmeyen no-op'tur. Auth/Realtime sonuçları simüledir. Önceden mevcut Google Fonts import'u yalnız bu fixture sunucusunda kaldırılır; görüntüler sistem fontu fallback'i ile alınır. Dış ağ istekleri reddedilir ve test hata verir. Üretim font davranışı değişmez.

Chromium'da doğrulananlar: doğrudan alt hedef/focus, yenileme/geri/ileri, sohbet alt sekmesinde taslak koruma, hesap menüsünde Escape ve odağın dönüşü, tema saklama, rol gerektirmeyen MFA ekranı, normal oyuncunun korunan personel RPC'sini çağırmaması, apartman yöneticisinin personel menüsü görmemesi, yerleşmemiş personel erişimi, ziyaretçi/yerleşmemiş oyuncu ve callback fragment'ının korunması. 320/390/768/1440 px açık/koyu örneklerde taşma yok; mobil menü ekran tabanında; gerçek tema değişkenleri/yüzeyleri yüklü. Görseller test fixture'ı çıktılarıdır; canlı oyun kanıtı değildir.

### Ekran görüntüleri

| Ekran | 390 px açık / koyu | 1440 px açık / koyu |
| --- | --- | --- |
| Bugün | [Açık](design/navigation/today-light-390.png) / [Koyu](design/navigation/today-dark-390.png) | [Açık](design/navigation/today-light-1440.png) / [Koyu](design/navigation/today-dark-1440.png) |
| Apartman / Kararlar | [Açık](design/navigation/decisions-light-390.png) / [Koyu](design/navigation/decisions-dark-390.png) | [Açık](design/navigation/decisions-light-1440.png) / [Koyu](design/navigation/decisions-dark-1440.png) |
| Sistem Yönetim Merkezi | [Açık](design/navigation/staff-light-390.png) / [Koyu](design/navigation/staff-dark-390.png) | [Açık](design/navigation/staff-light-1440.png) / [Koyu](design/navigation/staff-dark-1440.png) |

## Sınırlar ve geri alma

Gerçek e-posta/giriş, MFA töreni, WebSocket/Realtime, gerçek sunucuda ödeme/oy verme ve canlı GitHub Pages yayını bu PR'da tarayıcıdan yeniden sınanmadı. Yalnız görünüm testleri yapılmışken bunlar canlı kabul edilmiş sayılmaz. %200 zoom, ekran okuyucu ve fiziksel iOS/Android safe-area kabulü manuel kontrol bekler. V2.1 sosyal veri, bildirim ve avatar seçimi yoktur; C/D/E/F aşamalarının kapsamlı ekran/ayar/profil tasarımları eklenmez.

Geri alma yalnız bu PR'ın istemci değişikliklerini geri almakla yapılır; migration veya veri telafisi gerekmez. Taslak PR inceleme/onay bekler; otomatik merge/yayın yapılmaz. C aşamasına ancak bu PR'ın ayrı incelemesi ve birleştirilmesinden sonra geçilir.
