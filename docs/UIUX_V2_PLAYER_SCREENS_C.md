# UI/UX v2 — C aşaması: oyuncu ekranları

Ana referans: [UIUX_V2_SPEC.md](UIUX_V2_SPEC.md). Başlangıç main `70a0f5b03ea68f583c76a6d234780815418890d6`. PR #11'in birleştiği, bu commit'in GitHub Actions `database`, `build`, **deploy** işlerinin başarılı olduğu ve mevcut Pages adresinin HTTP 200 döndürdüğü çalışma öncesinde doğrulandı. Bu C dalı henüz yayımlanmamıştır.

Dal: `feat/uiux-v2-player-screens`. Yalnız C aşaması; D etkileşimli bina/avatar/sosyal profil, E ayar ve F personel ekranı tasarımları yoktur. PR taslak ve ayrı inceleme/onay bekler.

## Önce / sonra ve korunan işlevler

| Ekran | B aşamasındaki görünüm | C aşamasındaki görünüm | Korunan işlev |
| --- | --- | --- | --- |
| Bugün | Genel apartman özet kartları ve kısayol şeridi | Küçük karşılama çizimi, kişisel günlük durum, eylem hikâyeleri, yalnız mevcut açık kararlar, gelişmeler/pano | Aidat/ek iş/oylama/seçim/sohbet aynı derin hedefleri açar; otomatik maaş için toplama düğmesi yok |
| Dairem / Daire | Metin profil kartı, kapı numarası | Temel kimlik, daire plakası ve sıcak oda sahnesi | Aynı kendi kullanıcı adı/daire/apartman; eşya/dekor işlemi yok |
| Dairem / İşler | Tek sütunda form kartları | Maaş/meslek ve günlük ek iş yan yana, mobilde sıralı | Aynı meslek, 7 gün kuralı, ek iş süresi/ödülü ve RPC'ler |
| Dairem / Cüzdan | Tek sütunda hareketler ve borç | Büyük güncel bakiye, hareketler ve ödeme alanının dengeli ayrımı | Aynı borç, tutar, bakiye kontrolü, ödeme ve geçmiş |
| Apartman / Binayı Keşfet | Genel metrik kartları | Büyük **statik** cephe, gerçek sakin/daire/doluluk, yönetici ve kasa özeti | Yeni tıklama/hedef/oyuncu ataması yok; karar/kasa bağlantıları gerçek alt bölümlere gider |
| Apartman alt bölümleri | Mevcut seçim/kasa/teklif panelleri | Sıcak yüzey, daha açık boş durum ve pano gruplaması | Adaylık, oy, sonuçlar, tahsilat, giderler, kasa geçmişi ve görevdeki yöneticinin teklifleri |
| Komşular / Sakinler | Satır listesi | Kompakt daire kartları; açık kendi dairesi ve mesaj gizleme işlemi | Aynı engelleme/gizleme ve engel kaldırma; profil açma veya avatar eşleme yok |
| Komşular / Sohbet | Büyük sabit geçmiş ve ayrı gönderim alanı | Esnek iç kaydırma, ayrışan mesaj balonları, yazar/zaman/şikâyet hiyerarşisi, görünür gönderim alanı | Aynı yazar, zaman, 500 karakter, gönderim, sayfalama, blok filtresi ve mesaj şikâyeti |

`Mesajları gizle` etiketi mevcut engellemenin yalnız kendi görünümündeki etkisini daha doğru anlatır; karşılıklı profil erişim yasağı iddia edilmez. Tamamlanmış ek işte aktif tekrar bağlantısı yerine tamamlanma durumu, mesleksiz hesapta Meslek seç bağlantısı, ödenmemiş borç yokken ödeme yerine ödeme geçmişi bağlantısı görünür. Maaş bilgisi yalnız kayıtlı harekete dayanır; ödeme takvimi/uygunluğu istemcide yeniden hesaplanmaz. Bekleyen karar kartları gerçek açık süreçlerden gelir; oy verildiyse inceleme bağlantısı sunulur.

## Varlıklar ve tasarım

`public/art/v2/` dosyaları değiştirilmedi. Tüm yollar `import.meta.env.BASE_URL + 'art/v2/…'` ile GitHub Pages alt dizinine uyumludur.

| Varlık | Gerçek kullanım |
| --- | --- |
| `apartment-interior.svg` | Yalnız Daire alt görünümünün oda sahnesi; iş/cüzdan bilgisinin önüne geçmez |
| `apartment-facade.svg` | Binayı Keşfet'te statik büyük sahne; ad/sakin/kasa HTML alanında |
| `empty-chat.svg` | Küçük Bugün karşılama detayı ve boş sohbet |
| `empty-mail.svg` | Boş duyuru panosu |
| `empty-vote.svg` | Mevcut ortak oylama kaydı olmayan Kararlar alanı |

Görseller boyut bildirir; küçük boş durum çizimleri lazy yüklenir. Oda/cephe anlamlı alt metin taşır, dekoratifler boş alt metinlidir. Yerel SVG bozulur/yüklenmezse oda/cephe açıklayıcı metin yüzeyine düşer; ekonomik işlemler ve menüler kullanılabilir kalır. Dekoratif çizim başarısızsa gürültülü hata alanı eklenmez.

Oyuncu görünümleri `.player-shell` / `.player-screens` kapsamında krem/adaçayı/mercan/petrol paletini kullanır. Personel, hesap ve güvenlik sayfalarının mevcut teması korunur. Açık/koyu/sistem paletleri, metin/eylem için 4,5:1 ve form sınırı için 3:1 kontrolleriyle doğrulanır. Onaylı tasarım tokenlarının köşe/boşluk/gölge ilkeleri korunur; yeni bağımlılık, font veya animasyon yoktur.

Sohbet mobil başlığı sadeleşir; içerik yüksekliği viewport'a göre sınırlandırılır, geçmiş kendi içinde kayar ve textarea/gönderim alanı altta kalır. Bildirim zili, kalıcı avatar seçimi, biyografi veya başarı sistemi eklenmez. Pencere süsleri çevrim içi durum değildir; cephede tıklama alanı yoktur.

## Dosya özeti ve veri akışı

- `components/PlayerScenes.tsx`: Bugün, Daire ve bina sahneleri; ortak pano, boş durum ve hata fallback'i. Tümü mevcut veriyle sunum yapar; mutasyon/API çağrısı içermez.
- `gameData.ts`: App içindeki mevcut Data tipinin paylaşılan tanımı; yeni sorgu/veri alanı yoktur.
- `App.tsx`: eski genel özet tekrarları yeni ekran bileşenlerine taşındı. Mesajların mevcut deduplikasyon/blok filtresi/sıralaması bir sunum listesinde toplandı; işlem handler'ları aynıdır.
- `AppShell.tsx`: yalnız dört oyuncu ekranında tema kapsamı sınıfı. Hesap/personel erişim kapıları aynı.
- `styles/player-screens.css`: oyuncuya özel responsive sahne/kart/form/sohbet düzeni.
- `TodayActions.tsx`: kullanılmayan eski şerit kaldırıldı; aynı hedefler yeni günlük eylem alanındadır.
- `tests/ui-render.mjs`, `tests/player-contrast.test.mjs`: günlük durum, tamamlama, meslek seçimi, görseller, statik bina ve yeni tema kontrast kontrolleri.
- İzole API fixture'ı: tamamlanmış iş/ödenmiş borç/oy verilmiş karar, mesleksiz, yetersiz bakiye, boş/gizlenmiş/uzun sohbet senaryoları.
- `tools/check-navigation-browser.py --player-screens`: B regresyonlarını korur, C senaryolarını ve ayrı C görüntü setini çalıştırır. B'nin kayıtlı görüntüleri değiştirilmez.

`src/api.ts`, RPC ve tablo çağrıları, Auth seçenekleri, RLS/migration, ekonomi hesapları, MFA/RBAC/personel bileşenleri, hash modeli ve B odak/erişim hook'ları değişmez. App içindeki mevcut client RPC/Auth/tablo çağrıları başlangıç sürümüyle argümanları dahil AST üzerinden eşleştirildi. Üretim bileşenleri örnek oyuncu veya finansal veri içermez; sayısal bilgiler mevcut veri objesinden gelir. Canlı Supabase kullanılmadı.

## Test sonuçları

| Komut / kontrol | Sonuç |
| --- | --- |
| `npm test` | 36 başarılı (33 mevcut + 3 oyuncu kontrast/sistem paleti testi) |
| `npm run test:ui` | Başarılı; yeni durum/sahne SSR kontrolleri dahil |
| `npm run build` | TypeScript + Vite başarılı |
| `npm run test:sql` | 11 başarılı |
| `npm run test:v02` | 24 grup başarılı |
| `npm run test:rbac` | 14 grup başarılı |
| `npm run test:advanced` | 15 grup başarılı |
| Chromium | 320/390/768/1440 açık/koyu; sistem teması geçişi; tüm B navigasyon/erişim regresyonları ve C durum senaryoları başarılı |

PostgreSQL yalnız mevcut disposable localhost:55432 altyapısında çalıştı. Browser fixture gerçek App bileşenlerini kullanır, Supabase API modülünü test sunucusunda değiştirir ve dış ağ isteklerini reddeder. Ekranlar sentetik veri etiketlidir; üretim çıktısına fixture kimlikleri/işaretleri eklenmez. Önceden var olan Google Fonts import'u yalnız offline test sunucusunda kaldırılır; üretim font davranışı değişmez.

Chromium kontrolleri: kısayol hedefi/odak, geri/ileri/yenileme, geç veri sonrası odak, hesap menüsü, MFA ekranı ve görev/personel ayrımı; ek iş tamamlanınca kısayolun kalkması, oy verilmiş kararda onay düğmesinin yokluğu, düşük bakiyede ödeme reddi görünümü, mesleksiz ve boş pano/sohbet, tüm mesajları gizleme açıklaması, 500 karaktere kadar kesintisiz metin ve uzun iç kaydırma, şikâyet formunun açılması, mobil textarea'nın alt menünün üstünde kalması, oda/cephe yüklenmesi ve bozuk oda görseli fallback'i.

Her temalı çekimde belge yenilenir ve gerçek `data-theme` değeri beklenir; hash navigasyonunun önceki React tema durumunu taşıması görüntü etiketini yanıltamaz. Ana şartnamedeki dört ekran ve alt bölümler için **40 gerçek Chromium PNG** üretilir; bunlar canlı Supabase veya canlı Pages ekranı değildir.

### Görüntü tablosu

| Görünüm | 390 px açık / koyu | 1440 px açık / koyu |
| --- | --- | --- |
| Bugün | [Açık](design/player-screens/today-light-390.png) / [Koyu](design/player-screens/today-dark-390.png) | [Açık](design/player-screens/today-light-1440.png) / [Koyu](design/player-screens/today-dark-1440.png) |
| Dairem / Daire | [Açık](design/player-screens/home-light-390.png) / [Koyu](design/player-screens/home-dark-390.png) | [Açık](design/player-screens/home-light-1440.png) / [Koyu](design/player-screens/home-dark-1440.png) |
| Dairem / İşler | [Açık](design/player-screens/work-light-390.png) / [Koyu](design/player-screens/work-dark-390.png) | [Açık](design/player-screens/work-light-1440.png) / [Koyu](design/player-screens/work-dark-1440.png) |
| Dairem / Cüzdan | [Açık](design/player-screens/wallet-light-390.png) / [Koyu](design/player-screens/wallet-dark-390.png) | [Açık](design/player-screens/wallet-light-1440.png) / [Koyu](design/player-screens/wallet-dark-1440.png) |
| Apartman / Binayı Keşfet | [Açık](design/player-screens/building-light-390.png) / [Koyu](design/player-screens/building-dark-390.png) | [Açık](design/player-screens/building-light-1440.png) / [Koyu](design/player-screens/building-dark-1440.png) |
| Apartman / Kararlar | [Açık](design/player-screens/decisions-light-390.png) / [Koyu](design/player-screens/decisions-dark-390.png) | [Açık](design/player-screens/decisions-light-1440.png) / [Koyu](design/player-screens/decisions-dark-1440.png) |
| Apartman / Kasa ve Pano | [Açık](design/player-screens/treasury-light-390.png) / [Koyu](design/player-screens/treasury-dark-390.png) | [Açık](design/player-screens/treasury-light-1440.png) / [Koyu](design/player-screens/treasury-dark-1440.png) |
| Apartman / Yönetici Masası | [Açık](design/player-screens/manager-light-390.png) / [Koyu](design/player-screens/manager-dark-390.png) | [Açık](design/player-screens/manager-light-1440.png) / [Koyu](design/player-screens/manager-dark-1440.png) |
| Komşular / Sakinler | [Açık](design/player-screens/residents-light-390.png) / [Koyu](design/player-screens/residents-dark-390.png) | [Açık](design/player-screens/residents-light-1440.png) / [Koyu](design/player-screens/residents-dark-1440.png) |
| Komşular / Sohbet | [Açık](design/player-screens/chat-light-390.png) / [Koyu](design/player-screens/chat-dark-390.png) | [Açık](design/player-screens/chat-light-1440.png) / [Koyu](design/player-screens/chat-dark-1440.png) |

Tekrar üretim: mevcut bulut ortamında `node tools/serve-navigation-fixture.mjs`, ardından `python tools/check-navigation-browser.py --player-screens`. Yeni yerel kullanıcı kurulumu veya yeni proje/servis gerekmez. Üretim Supabase'e yönlendirilmez.

## Sınırlar / geri alma

Gerçek Auth kaydı/girişi, MFA töreni, WebSocket/Realtime ve gerçek Supabase üzerinden ekonomi/oy mutasyonları bu çalışmada tarayıcıdan yeniden doğrulanmadı. SQL işlemlerinin PostgreSQL regresyonları ve UI/handler karşılaştırması, gerçek hizmet uçtan uca kabulü olarak sunulmaz. Ekran okuyucu, %200 zoom ve fiziksel iOS/Android klavye/safe-area kabulü manuel kontrol bekler. Viewport görüntüleri sayfanın ilk görünür alanıdır; uzun ekonomi/pano listeleri sayfa kaydırmasıyla, mesajlar iç kaydırmayla erişilir.

C dalı birleştirilmedi veya yayımlanmadı. Geri alma yalnız istemci commit'lerini geri almakla yapılır; veritabanı/migration telafisi yoktur. D/E/F kapsamına ancak ayrı kullanıcı talimatıyla geçilir.

## PR #12 inceleme düzeltmeleri — 25 Kasım 2026

Uygulama değişiklikleri yalnız `src/styles/player-screens.css` ve `src/styles/navigation.css` içindedir. 900 px ve altında oda görseli kimlik panelinden önce gelir; oyuncu adı, apartman ve daire numarası kompakt bir grid içinde gösterilir. İşler/Cüzdan alt bölümleri ve veri akışı değişmez. 1440 px'te önceki ve sonraki oda/kimlik alanlarının konum ve boyutları Chromium ölçümüyle aynı doğrulandı (1 px altı tolerans).

Sayfa başlığının programatik odağı artık dikdörtgen çerçeve yerine ince alt çizgiyle gösterilir. `useRouteFocus` ve hedefe kaydırma kodu değiştirilmedi. Bağlantı/düğme klavye odak halkaları ve doğrudan işlem hedeflerinin çerçeveleri korunur.

### Gerçek önce / sonra karşılaştırması

Karşılaştırma tabanı önceki PR teslim commit'i `14227cfc3864dbd2d78425a443e20ea1e53c842e` içindeki iki CSS dosyasıdır. İzole fixture sunucusunda aynı gerçek uygulama, aynı SVG'ler ve aynı sentetik veriler önce bu dosyalarla, sonra güncel CSS ile Chromium'da ayrı ayrı render edildi. Görüntüler montaj değildir; önceki CSS, test tarayıcısında modül yanıtı olarak sunulur. Her temada sayfa yenilenir ve aktif tema doğrulanır.

| Görünüm | Önce | Sonra |
| --- | --- | --- |
| 390 px açık | [Önce](design/player-review/before-home-light-390.png) | [Sonra](design/player-review/after-home-light-390.png) |
| 390 px koyu | [Önce](design/player-review/before-home-dark-390.png) | [Sonra](design/player-review/after-home-dark-390.png) |
| 1440 px açık | [Önce](design/player-review/before-home-light-1440.png) | [Sonra](design/player-review/after-home-light-1440.png) |
| 1440 px koyu | [Önce](design/player-review/before-home-dark-1440.png) | [Sonra](design/player-review/after-home-dark-1440.png) |

Yukarıdaki 40 ekranlık C galerisi de yeniden üretildi. Görüntüler gerçek Chromium çıktısıdır; üstte sentetik veri etiketi bulunur, canlı Supabase/Pages ekranları değildir.

### Yeniden çalıştırılan kontroller

- `npm test`: 36 başarılı, sıfır başarısız; `npm run test:ui` ve `npm run build` başarılı.
- PostgreSQL: `test:sql` 11, `test:v02` 24, `test:rbac` 14, `test:advanced` 15 başarılı kontrol/grup; yalnız mevcut disposable localhost:55432 altyapısı kullanıldı.
- `python tools/check-navigation-browser.py --player-screens`: ana/alt bağlantılar, aidat/ek iş/oylama/sohbet kısayolları, geç gelen veride hedefe odak/kaydırma, odağın veri yenilemesinde çalınmaması, hesap menüsü, Auth fragment ve MFA/rol erişim regresyonları başarılı.
- Yeni `python tools/check-player-review.py`: 320/390/768/1440 px açık/koyu temada yatay taşma yok; mobil/tablette odanın kimlikten önce gelmesi ve ilk görünür alanda en az %70'inin görünmesi, 320/390 px'te kompakt kimlik yüksekliği, 1440 px'te değişmeyen iki sütun geometrisi başarılı. Başlık alt çizgisi, Tab/Shift+Tab ile bağlantı/düğme odak halkaları ve Escape sonrası davranış kontrol edildi; sayfa hatası veya dış ağ isteği yok.

Tekrar üretmek için mevcut fixture sunucusunu çalıştırıp iki Python komutunu yürütün. Önce/sonra aracı, yukarıdaki taban commit'in yerel Git geçmişinde bulunmasını gerektirir. Sanat varlıkları, uygulama işlem kodları, ekonomi, yetkilendirme ve bütün Supabase dosyaları korunur. Gerçek hizmet üzerinden Auth/Realtime ve fiziksel cihaz/ekran okuyucu sınırları yukarıda belirtildiği gibi devam eder. PR #12 inceleme için açık/taslak tutulur; birleştirme ve canlı yayın yapılmaz.
