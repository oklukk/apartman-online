# UI/UX v2 — E aşaması: ayarlar, gizlilik ve görünüm

Ana referans: [UIUX_V2_SPEC.md](UIUX_V2_SPEC.md). Dal: `feat/uiux-v2-settings`. Başlangıç main: `749a03be6038980d1e84f2bc911fab76404d4d37`. PR #13'ün birleştiği ve [main build/database/deploy işlerinin başarılı olduğu](https://github.com/oklukk/apartman-online/actions/runs/45500859348) doğrulandı. Kullanıcının bildirdiği D canlı kabulü bu çalışmada yeniden yapılmadı. Bu E dalı yalnız taslak PR ile incelemeye sunulur; birleştirme ve yayın yapılmaz.

## İnceleme ve kapsam

| Alan | Main'de mevcut durum | E aşamasındaki değişiklik |
| --- | --- | --- |
| Hesap menüsü | Avatar, çalışan hesap bağlantıları, Escape ve dışarı tıklama | Aynı erişim kapıları; tutarlı dekoratif ikonlar/ok, okunabilir hesap adı, menü yüksekliği sınırı; aynı bağlantıya tekrar basılınca görünür odağa dönüş |
| Görünüm | Yalnız sistem/açık/koyu tema, `apartman-theme` | Eski tema korunur; normal/büyük yazı, standart/kompakt boşluk, hareket azaltma, yalnız görünümü sıfırlama |
| Gizlilik | D profillerinde ve Sakinler'de çalışan mesaj gizleme/engel kaldırma | Mevcut `blocks` listesinin Ayarlar'dan görüntülenmesi, aynı handler ile kaldırma, gerçek sosyal profil alanlarının sade açıklaması |
| Güvenlik | Her oturum açmış kullanıcıya açık mevcut MFA ekranı | Aynı `#/guvenlik` ve aynı `StaffMfa`; ortak ayar navigasyonu, oyuncu sanat paleti ve açıklayıcı çevre düzeni |
| Gezinti | Profilim, Ayarlar ve güvenlik dört ana sekmeden ayrı | `#/ayarlar/gorunum`, `#/ayarlar/gizlilik`; Profilim ve mevcut güvenlik bağlantıları korunur; gizlilikten sosyal profile gidip bağlama dönülür |

Kalıcı avatar seçimi, biyografi, profil özelleştirmesi, gelişmiş paylaşım tercihleri, gerçek bildirim merkezi/tercihleri, başarılar veya sosyal istatistikler eklenmedi. Bunlar için çalışmayan düğme, anahtar ya da sahte veri yoktur. Yeni bina atmosferi/sanat oluşturulmadı. F personel tasarımına başlanmadı.

## Tercihler nasıl çalışır?

- Tema eski **`apartman-theme`** anahtarında sistem/açık/koyu olarak kalır. Sistem seçeneği cihazın açık/koyu tercihini CSS üzerinden izler.
- Yeni **`apartman-appearance`** yalnız `{version:1,textSize,density,reduceMotion}` içerir. Varsayılanlar `normal`, `standard`, `false` değerleridir. Yalnız izinli enum/boolean değerler kabul edilir; geçersiz JSON/sürüm güvenli varsayılanlara döner.
- Büyük yazı kök metin ölçüsünü %112,5 yapar (normal koşulda 16 → 18 px). Tarayıcı yakınlaştırması değildir. 320 px alt menü metni çakışmayı önleyecek ölçüde uyarlanır; dokunma alanları küçültülmez.
- Kompakt görünüm oyuncu/ayar kartları ve listelerde boşluğu azaltır. Form işlemleri, görünür kayıtlar ve minimum dokunma boyutları korunur. Personel modüllerine özel yoğunluk düzenlemesi yapılmaz; yazı/tema erişilebilirlik tercihleri genel olarak uygulanır.
- Hareket azaltma geçiş/animasyonları kısar ve kaydırmayı doğrudan yapar. İşaretli olmasa da işletim sisteminin `prefers-reduced-motion` tercihi korunur.
- Tercihler bu tarayıcı/cihaz içindir; hesapla veya başka cihazlarla sunucu üzerinden eşitlenmez. Aynı origin'deki tarayıcı sekmeleri storage olayıyla görünümü eşitler.
- Görünüm sıfırlaması yalnız bu iki anahtara yazar. `localStorage.clear`, çıkış, Auth anahtarı temizleme veya avatar/rol yazımı yapmaz.
- Depolama engelliyse ekran çalışır ve tercihler oturum içinde uygulanır; arayüz saklanamadığını açıkça bildirir. Yenilemede korunacağı iddia edilmez.

`appearance.ts` saf doğrulama/okuma/yazma işlevleri, `useAppearance` ise mevcut React durumuna ve kök tema/ölçü/yoğunluk/hareket işaretlerine adaptördür. Yeni sunucu çağrısı, veri alanı veya bağımlılık yoktur.

Büyük metin ile SVG üzerindeki numara/iki rozetin sıkışmaması için sahnenin minimum genişliği 450 px olur; normal ölçekte D aşamasının 400 px değeri kalır. Mevcut yatay sahne kaydırması, JSON yüzde koordinatları, alternatif daire listesi ve hitbox mantığı aynıdır. Onaylı SVG/JSON dosyaları değişmez.

## Gizlilik ve güvenlik sınırları

Gizlilik ekranı yalnız mevcut `data.blocks` ve D aşamasının sınırlı `ResidentPublicInfo` modelini alır. Yeni sorgu/RPC/abonelik yoktur. Mesaj gizleme yine **yalnız benim sohbet görünümümü filtreler**; karşılıklı profil erişim yasağı veya uzaklaştırma değildir.

Erişilebilen sakin için avatar/ad/daire ve mevcut tam profil bağlantısı sunulur. Artık aynı apartmanda bulunmayan veya bilgisi okunamayan mevcut bir engel, kimliği tahmin edilmeden genel metinle gösterilir; profil bağlantısı üretilmez. Kendi mevcut engel satırını kaldırmak mevcut `blocks.delete()` işlemi ve RLS ile yapılır. Ortak handler yalnız engel **eklerken** aynı apartman sakin modelini ister; mevcut kendi engelini kaldırırken eski komşunun hâlâ sakin olmasını şart koşmaz. Başka kullanıcı adına yazma, yeni yetki veya profil bilgisi edinme yoktur.

Güvenlik ekranının görünümü ortak `AccountLayout` ile bütünleşir. `StaffMfa.tsx`, Auth/MFA işlevleri ve argümanları **değişmedi**. Ekran açılışında uydurma kurulu/kapalı/doğrulandı rozeti yoktur; gerçek durum mevcut işlem başlatıldığında Auth üzerinden kontrol edilir. Normal sakin ve yerleşmemiş hesaplar güvenliğe ulaşabilir. Apartman yöneticiliği personel yetkisi değildir; Sistem Yönetim Merkezi'nin mevcut görünürlük ve sunucu erişim kapıları korunur.

Auth/RPC çağrıları argümanları dahil main ile AST üzerinden eşit doğrulandı. `api.ts`, ekonomi/seçim/sosyal veri modeli, personel/MFA bileşenleri, migration/RLS/RPC, sanat varlıkları, AGENTS, paket/lock ve yayın workflow'u değişmez. Canlı Supabase'e bağlanılmadı veya veri yazılmadı.

## Gezinti ve erişilebilirlik

`#/ayarlar` geriye uyumlu şekilde Görünüm'ü açar; yeni alt yollar merkezi `navigation.ts` modelindedir. Gizlilikten tam profile dönüş yalnız güvenli, modelin üretebildiği yerel hash'e gider; harici/personel geri dönüş URL'si kabul edilmez. Auth callback fragment'ları değiştirilmez. GitHub Pages alt dizini, geri/ileri ve yenileme korunur.

Hesap menüsünde avatar ve gerçek hesap adı kalır. İkonlar dekoratif `aria-hidden/focusable=false` SVG'lerdir. Escape, dışarı fare/dokunma, görünür odağa dönüş, aktif bağlantı ve route değişiminde kapanma çalışır. Aynı aktif sayfa tekrar seçilirse odak kapalı menünün içinde kalmaz. Mobil alt ana menü dört sekmeli, masaüstü ana menü solda kalır.

Ayar bölümündeki kısa görsel **Güvenlik** bağlantısının erişilebilir adı **Hesap güvenliği** olarak korunur. Alanlar native label/select/checkbox/fieldset/legend kullanır; durum metni `role=status` taşır. Kompakt görünüm kontrolleri 44 px altında küçültmez. Uzun formlar doğal sayfa kaydırmasıyla kullanılır; mobil odak/kaydırma payı sabit alt menüyü hesaba katar.

## Test sonuçları

| Kontrol | Sonuç |
| --- | --- |
| `npm test` | **47 başarılı**, sıfır başarısız; 42 mevcut + 5 tercih/saklama/navigasyon davranış grubu |
| `npm run test:ui` | Başarılı; mevcut SSR, E alanları, gizlilik/eksik komşu, saklama uyarısı/yükleme durumu ve dekoratif ikonlar |
| `npm run build` | TypeScript + Vite başarılı |
| `npm run test:sql` | 11 PostgreSQL kontrolü başarılı |
| `npm run test:v02` | 24 grup başarılı |
| `npm run test:rbac` | 14 grup başarılı |
| `npm run test:advanced` | 15 grup başarılı |
| B/C Chromium | `--player-screens --verify-only` başarılı; eski galeriler değiştirilmedi |
| D Chromium | `--verify-only` başarılı; mevcut profil/bina/sohbet/engel/odak testleri, eski galeri değiştirilmedi |
| E Chromium | 320/390/768/1440 açık/koyu; normal ve büyük/kompakt oyun ekranları, aşağıdaki davranışlar başarılı |

PostgreSQL yalnız mevcut disposable **localhost:55432** altyapısında çalıştı. `test:db` için ayrı gerçek yerel Supabase yığını kurulmadı; kaynak/şema değişikliği yoktur ve yukarıdaki dört mevcut PostgreSQL paketi çalıştırıldı. Canlıda test verisi oluşturulmadı.

`tools/check-settings-browser.py` şunları doğrular: tema ve ek tercihlerin anında uygulanması/yenileme/sıfırlama; ilgisiz Auth saklama anahtarına dokunmama; bozuk veya engelli storage; gerçek sekmeler arası storage olayı; OS açık/koyu ve hareket azaltma; menü sınırları, Tab odağı, Escape/dışarı dokunma/aynı sayfa/geri-ileri; bütün dört ana sekmenin korunması; eski engelin kaldırılması ve mesajın tekrar görünmesi; erişilemeyen eski komşu için güvenli kaldırma; sosyal profil bağlamına dönüş; hesap/yerleşme/personel erişim ayrımı; Auth callback hash'i; büyük yazı/kompakt görünümde mevcut iş/cüzdan/sohbet/bina kontrolleri ve daire numara/rozet yerleşimi.

Güvenlik doğrulama formunun görüntüsü ve bir görünüm güncellemesinde girilen kodun korunması **sentetik mevcut faktör yanıtıyla** test edilir; bu gerçek Auth/MFA doğrulaması değildir. Çıkış/girişe dönüş ve yenileme kontrolleri de sentetik oturum kullanır. Gerçek oturum kalıcılığı, e-posta/giriş, TOTP/QR ve Supabase Realtime uçtan uca kabulü yeniden yapılmadı.

## Görsel kanıt — 36 gerçek Chromium PNG

İzole fixture sunucusu gerçek App bileşenlerini test API'siyle render eder; prod Supabase modülü yüklenmez, dış ağ engellenir. Önceden var olan uzak font import'u yalnız offline test sunucusunda çıkarılır; üretim font davranışı aynıdır. Veriler, MFA faktörü ve isimler sentetiktir. Bunlar canlı Pages veya oyuncu hesabı ekran görüntüsü değildir.

PNG'ler gerçek 390×844 ve 1440×1000 viewport çekimleridir; tam sayfa birleştirme yoktur. Form/engeller/güvenlik için gerçek kaydırma konumları kullanılır; sabit menüyle uzun tam sayfa çekimlerinin kontrolleri örtmesi önlenir. Kaydırılmış görünümlerde test etiketi ve sayfa başlığı viewport dışında olabilir. 320/768 px'te de gerçek kontroller yapılır, PNG'ler 390/1440 px'tir.

| Görünüm | 390 px açık / koyu | 1440 px açık / koyu |
| --- | --- | --- |
| Görünüm — üst alan | [Açık](design/settings/appearance-light-390.png) / [Koyu](design/settings/appearance-dark-390.png) | [Açık](design/settings/appearance-light-1440.png) / [Koyu](design/settings/appearance-dark-1440.png) |
| Görünüm — kontroller ve sıfırlama | [Açık](design/settings/appearance-controls-light-390.png) / [Koyu](design/settings/appearance-controls-dark-390.png) | [Açık](design/settings/appearance-controls-light-1440.png) / [Koyu](design/settings/appearance-controls-dark-1440.png) |
| Büyük yazı / kompakt | [Açık](design/settings/large-compact-light-390.png) / [Koyu](design/settings/large-compact-dark-390.png) | [Açık](design/settings/large-compact-light-1440.png) / [Koyu](design/settings/large-compact-dark-1440.png) |
| Gizlenen komşular | [Açık](design/settings/privacy-light-390.png) / [Koyu](design/settings/privacy-dark-390.png) | [Açık](design/settings/privacy-light-1440.png) / [Koyu](design/settings/privacy-dark-1440.png) |
| Gizlilik — boş durum | [Açık](design/settings/privacy-empty-light-390.png) / [Koyu](design/settings/privacy-empty-dark-390.png) | [Açık](design/settings/privacy-empty-light-1440.png) / [Koyu](design/settings/privacy-empty-dark-1440.png) |
| Hesap güvenliği — başlangıç | [Açık](design/settings/security-light-390.png) / [Koyu](design/settings/security-dark-390.png) | [Açık](design/settings/security-light-1440.png) / [Koyu](design/settings/security-dark-1440.png) |
| Güvenlik — sentetik mevcut faktör formu | [Açık](design/settings/security-code-light-390.png) / [Koyu](design/settings/security-code-dark-390.png) | [Açık](design/settings/security-code-light-1440.png) / [Koyu](design/settings/security-code-dark-1440.png) |
| Hesap menüsü | [Açık](design/settings/account-menu-light-390.png) / [Koyu](design/settings/account-menu-dark-390.png) | [Açık](design/settings/account-menu-light-1440.png) / [Koyu](design/settings/account-menu-dark-1440.png) |
| Profilim ile bütünlük | [Açık](design/settings/profile-light-390.png) / [Koyu](design/settings/profile-dark-390.png) | [Açık](design/settings/profile-light-1440.png) / [Koyu](design/settings/profile-dark-1440.png) |

Tekrar üretim: mevcut bulut ortamında `node tools/serve-navigation-fixture.mjs`; ardından `python tools/check-settings-browser.py`, `python tools/check-navigation-browser.py --player-screens --verify-only`, `python tools/check-social-browser.py --verify-only`. Kullanıcının bilgisayarında kurulum veya yeni hizmet gerekmez. MFA fixture yanıtı yalnız test API'sindedir; üretim bundle'ına girmez.

## Dosya özeti, kalan kontroller ve geri alma

- `appearance.ts`, `useAppearance.ts`: sınırlı cihaz tercihleri, saklama doğrulaması ve React/kök görünüm adaptörü.
- `AccountLayout.tsx`, `AccountIcon.tsx`: ortak hesap başlığı/alt navigasyon ve mevcut ikon dili.
- `AccountScreens.tsx`, `AppShell.tsx`, `App.tsx`: mevcut hesap/tema/MFA ve mesaj gizleme işlemleriyle sunum entegrasyonu; `navigation.ts`: ayar alt yolları ve güvenli profil geri bağlamı.
- `styles/account-settings.css`: yeni hesap yüzeyleri, büyük yazı/boşluk/hareket ve dar ekranda kontrol yerleşimi. Art dosyaları değişmez.
- `tests/appearance.test.mjs`, `tests/ui-render.mjs`, mevcut izole fixture, `tools/check-settings-browser.py`: tercih/gizlilik/erişim/görsel kontrolleri. D aracına yalnız tarihsel PNG'leri değiştirmeden kontrol için `--verify-only` eklendi.

Yeni paket, API, migration veya ücretli kaynak yoktur. Ana JS yaklaşık 247 kB / gzip 78,3 kB; CSS yaklaşık 45,6 kB / gzip 9,9 kB. Görüntü kanıtları uygulama bundle'ına girmez. Tema/yazı/yoğunluk durumları ekonomi ve yetkilendirme girdisi olarak kullanılmaz.

Manuel inceleme: fiziksel iOS/Android klavye/safe-area, ekran okuyucu, gerçek tarayıcı %200 zoom ve personel modüllerinin yoğun gerçek veride büyük yazı görünümü. Sistem Yönetim Merkezi F tasarımı bu PR'da değiştirilmedi. Yeni görünüm tercihleri gerçek bir Auth oturumu ve farklı cihaz üzerinde kullanıcı tarafından ayrıca denenebilir; cihazlar arası eşitleme beklenmemelidir.

Geri alma yalnız bu dalın istemci/test commit'lerini geri almaktır; DB/migration telafisi yoktur. Eski istemci `apartman-theme` değerini kullanmayı sürdürür, yeni tercih anahtarını dikkate almaz. PR taslak olarak kullanıcı incelemesi/onayı bekler; otomatik birleştirme ve canlı yayın yapılmaz.
