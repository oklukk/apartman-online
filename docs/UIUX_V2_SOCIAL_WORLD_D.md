# UI/UX v2 — D aşaması: yaşayan apartman ve sosyal kimlik

Ana referans: [UIUX_V2_SPEC.md](UIUX_V2_SPEC.md). Dal: `feat/uiux-v2-social-world`. Başlangıç `main`: `f7b44f570d46019c991fa72a195f10706cecc345`. PR #12'nin birleştiği, bu commit'in [build/database/deploy işlerinin başarılı olduğu](https://github.com/oklukk/apartman-online/actions/runs/45491292648) ve mevcut Pages adresinin HTTP 200 döndürdüğü çalışma öncesinde doğrulandı. D dalı yayımlanmadı; yalnız taslak PR ile incelemeye sunulur.

## Etkileşim ve veri sınırları

| Alan | Yeni davranış | Korunan sınır |
| --- | --- | --- |
| Binayı Keşfet | 12 HTML daire düğmesi, ayrı giriş bağlantısı, klavyeyle çalışan 12 dairelik alternatif liste | Onaylı SVG ve JSON aynıdır; 01–03 / 04–06 / 07–09 / 10–12 kat düzeni değişmez |
| Daire bilgisi | Gerçek üyelik/dairenin boş, dolu, kendi dairem ve aktif yönetici durumları | Boş dairede yalnız bilgi; atama, davet, satın alma yok. Eksik kayıtta boş varsaymak yerine erişilemiyor durumu |
| Hızlı profil | Aynı `ResidentQuickProfile` bina, sakin listesi ve sohbetten açılır | Mesaj gizleme yalnız kendi sohbetini filtreler; profil erişimini kaldırmaz |
| Tam profil | `#/komsu/<user_id>?from=<izinli hash>` bağlantısı; bağlamsal geri bağlantısı, geri/ileri/yenileme | Aynı apartmanın erişilebilir sakinleri; bilinmeyen/ayrılan/silinen kullanıcı için güvenli boş durum |
| Profilim | Kendi avatarı, temel kimlik, aktif görev rozeti; daire/ayarlar/güvenlik bağlantıları | Kullanıcı adı düzenleme, avatar seçimi ve E/F kişiselleştirme yok |
| Sakinler / Sohbet | Otomatik avatar ve hızlı profil düğmeleri | Aynı mesaj geçmişi, sayfalama, Realtime, mesaj gizleme ve mesaj bağlamında şikâyet işlemi |

### Bina koordinatları

`public/art/v2/apartment-anchors.json` tek daire koordinatı kaynağıdır. `tools/art-catalog.mjs` bu JSON'u ve avatar manifestini Vite geliştirme/SSR/üretim derlemesinde aynı sanal modüle okur. JSON kopyası tutulmaz, `public` URL'leri JavaScript modülü gibi içe aktarılmaz. İstemciye Node/fs kodu gönderilmez. Ek bağımlılık yoktur.

Sahne oranı 1000:1100; resim aynı oranlı kutuda `object-fit:contain` ve %100 genişlik/yükseklik kullanır. Düğmeler bu kutuya göre yüzde koordinatlıdır; bağımsız bir max-height ile letterbox alanı oluşturulmaz. Görsel ölçeği ile hedef ölçeği aynıdır. Sahne minimum 400 CSS px genişliktedir; 320/390 px'te yalnız sahne bölgesi yatay kaydırılabilir, sayfa taşmaz. En küçük daire hedefi yaklaşık 66×56 px, giriş 60×48 px'tir. Numara ve rozetler metin olarak da sunulur; renk tek işaret değildir. Alternatif liste aynı seçim işleyicisini çağırır.

Mevcut JSON giriş koordinatı içermediğinden, girişin ayrı hitbox'ı mevcut SVG kapısının çevresinden `x425/y860/w150/h120` olarak tanımlanır. Daire geometrisine dokunulmaz. Giriş Kasa ve Pano'ya gider. Pencere ışıkları/dekorları presence değildir; çevrim içi kullanıcı göstergesi yoktur. Bina resmi yüklenmezse açıklama ve bütün liste işlemleri kullanılabilir kalır.

### Avatar ataması

`avatarIdFor` kanonik küçük harfli kullanıcı ID'si üzerinde FNV-1a 32-bit hesabı yapar; sonuç `%16 + 1` ile `portrait-01`…`portrait-16` kimliğine çevrilir. Rastgele sayı, kullanıcı sırası, saat veya cihaz depolaması kullanılmaz. Manifestte kimlik üzerinden dosya aranır; manifest sırası atamayı değiştirmez. Farklı oyuncular aynı portreyi alabilir; benzersiz avatar vaadi yoktur. Kullanıcı adı değişirse portre değişmez.

`Avatar` hesap menüsü, Profilim, daireden açılan kart, sakin listesi, sohbet, hızlı ve tam profilde aynıdır. Boyutlar bildirilir; aynı yerel SVG URL'si tarayıcı önbelleğini paylaşır. Eksik/geçersiz kimlik veya yükleme hatasında erişilebilir harf/simge bulunur. Onaylı SVG'ler değiştirilmedi; `avatar_id`, fotoğraf yükleme veya seçim eklenmedi.

### Profil gizliliği ve RLS incelemesi

Mevcut `profiles` tablosu id/kullanıcı adı/oluşturulma zamanını, `memberships` daire ve `joined_at` alanını içerir. App'in mevcut `select('*')` sorguları bu alanları zaten getirir. `src/api.ts` değişikliği yalnız `Member.joined_at` ve `Apartment.building_id` tipleridir; yeni sorgu veya RPC yoktur.

Kaynak migration'lardaki `profile_read`, `membership_read` ve `resident_read` kuralları kendi profil/üyelik veya `private.my_building()` üzerinden aynı apartmana erişim sağlar. `manager_terms` da aynı apartman kapsamlı `resident_v02` politikasındadır. v032'deki mevcut yaptırım kontrolü bu kapsamı korur. Bu kurallar değiştirilmedi; canlı sorgu veya migration yapılmadı. Derlenmiş `api.ts` çalışma zamanı ve App içindeki mevcut Auth/RPC çağrıları argümanları dahil main ile eşit doğrulandı.

`publicApartments` önce ziyaretçinin seçili apartmanda üyeliğini doğrular; daire, üyelik ve görev kayıtlarını o apartmanla eşleştirir. Yalnız şu açık alanları oluşturur:

`userId`, `username`, `buildingId`, `buildingName`, `apartmentNumber`, `floor`, `joinedMonth`, `isManager`.

`ResidentPublicInfo` profil bileşenlerinin tek kimlik modelidir. Profil bileşenlerine `Data`, cüzdan, Auth/Session, e-posta, meslek, borç/ödeme, personel rolü veya yaptırım objesi aktarılmaz. Katılım alanı yalnız mevcut `joined_at` üzerinden Türkiye saatine göre ay/yıla dönüştürülür; eksikse yazılmaz. Tam tarih/saat veya son aktivite aktarılmaz. Ek alanlar gelecekte ayrı, açıkça izinli bir paylaşım modeliyle eklenebilir; bu PR gizlilik tercih sistemi geliştirmez.

Görev rozeti yalnız aynı apartmandaki başlamış, bitmemiş ve iptal edilmemiş `manager_terms` kaydından türetilir. Sonraki başlangıç/bitiş anında yerel sunum zamanlayıcısı rozeti günceller; DB zamanı, seçim veya görev kaydı değiştirilmez. Kendi daire ve yönetici rozetleri birbirinden bağımsızdır. Sistem personeli bu rozeti otomatik almaz, seçilmiş yönetici de personel yetkisi kazanmaz.

### Panel, odak ve sohbet sürekliliği

Hızlı profil native `<dialog>.showModal()` kullanır: arka plan inerttir. 900 px altında bottom sheet, masaüstünde sağ paneldir; içerik gerektiğinde panel içinde kayar. İlk odak kapatma düğmesindedir; Tab/Shift+Tab döngüsü, Escape, kapatma düğmesi ve gerçek backdrop tıklaması desteklenir. Kapanınca mevcut açıcıya `preventScroll` ile dönülür; açıcı veri yenilemesiyle silindiyse görünür sayfa başlığı kullanılır.

`useQuickProfile`, aynı URL'de geçici history kaydı açar; Back paneli kapatır, Forward yeniden açabilir. Kimlik ve erişim tekrar görünüm modelinden kontrol edilir. Geçersiz/boş history state güvenli karşılanır. Panelden sayfa bağlantısı seçilirse geçici kayıt temizlenir ve normal hash navigasyonu sürer. Aynı hash'teki bir işlem hedefi yeniden seçilirse panel temizliğinden sonra o hedefe odak/kaydırma uygulanır. `from` yalnız merkezi modelin üretebildiği oyun/profil hash'lerini kabul eder; harici adres, personel ekranı veya keyfî URL geri bağlantısı olarak kullanılmaz.

Panel açılması sohbet DOM'unu kaldırmaz. Taslak ve iç kaydırma ayrıca App'te saklanır; tam profile gidip bağlamsal geri dönüşte de geri yüklenir. Hesap değişiminde temizlenir. Gönderim RPC'si ve başarıda taslağın temizlenmesi aynıdır. Veri yenilenmesi açık panelden odağı çalmaz. Mesaj şikâyeti mevcut mesaj içindeki gerçek formda kalır; özel mesaj, arkadaşlık veya genel profil şikâyeti yoktur.

## Testler ve görsel kanıt

| Kontrol | Sonuç |
| --- | --- |
| `npm test` | 42 başarılı; 36 mevcut + 6 D aşaması davranış grubu |
| `npm run test:ui` | Başarılı; mevcut SSR senaryoları, katalog eşitliği, sosyal profil alan sınırı ve fallback dahil |
| `npm run build` | TypeScript/Vite başarılı |
| `npm run test:sql` | 11 PostgreSQL kontrolü başarılı |
| `npm run test:v02` | 24 grup başarılı |
| `npm run test:rbac` | 14 grup başarılı |
| `npm run test:advanced` | 15 grup başarılı |
| B/C Chromium regresyonu | `python tools/check-navigation-browser.py --player-screens --verify-only`; eski galeriler değiştirilmeden navigasyon, erişim, ekonomi görünümü, Auth fragment ve odak kontrolleri |
| D Chromium | `python tools/check-social-browser.py`; 320/390/768/1440 px, açık/koyu, aşağıdaki davranış ve görsel kontrolleri |

PostgreSQL testleri yalnız mevcut disposable localhost:55432 ortamında çalışır. Fixture sunucusu gerçek App bileşenlerini sentetik API ile render eder; dış ağ kapalıdır, canlı Supabase modülü yüklenmez. Mevcut uzak font import'u yalnız bu test sunucusunda kaldırılır; üretim davranışı aynı kalır. Görüntüler **gerçek Chromium çıktısıdır, canlı oyuncu veya Pages kabul testi değildir**. Bazı sahneler hedefe kaydırılmıştır; üstteki test etiketi ilk viewport dışında kalabilir.

D testleri: bütün 12 hedefin render edilmiş SVG'ye göre x/y/genişlik/yüksekliğinin 1 px altı toleransla eşleşmesi, 44 px üstü hedefler ve çakışmama; alternatif listenin Enter ile çalışması; dolu/boş/benim/yönetici/iptal/gelecek/süre bitişi; aynı dairede iki rozet; numara/rozet iç yerleşimi; boş dairede profil/yerleşme işleminin bulunmaması; girişten pano; mobil sheet/masaüstü panel ölçüleri; arka plan odağının engellenmesi; Tab döngüsü, Escape/fare veya dokunmayla dışarı/kapatma/Back/Forward ve açıcıya dönüş; tam profil derin linki/yenileme/geri/ileri/bağlamsal dönüş; tüm yerlerde aynı avatar; bozuk görsel; eksik katılım tarihi; yabancı/eksik/silinen profil; açık panelde veri yenilemesi; aynı-hash hedefleri; mesaj gizleme/geri alma; hızlı ve tam profilden sonra sohbet taslağı/kaydırması. Taşma, dış ağ isteği ve sayfa hatası olmaması da kontrol edilir.

### Görüntü envanteri — 32 PNG

| Görünüm | 390 px açık / koyu | 1440 px açık / koyu |
| --- | --- | --- |
| Etkileşimli bina ve bütün daire listesi | [Açık](design/social-world/building-light-390.png) / [Koyu](design/social-world/building-dark-390.png) | [Açık](design/social-world/building-light-1440.png) / [Koyu](design/social-world/building-dark-1440.png) |
| Kendi dairesi + yönetici rozeti | [Açık](design/social-world/own-manager-light-390.png) / [Koyu](design/social-world/own-manager-dark-390.png) | [Açık](design/social-world/own-manager-light-1440.png) / [Koyu](design/social-world/own-manager-dark-1440.png) |
| Başka komşunun hızlı profili | [Açık](design/social-world/neighbor-quick-profile-light-390.png) / [Koyu](design/social-world/neighbor-quick-profile-dark-390.png) | [Açık](design/social-world/neighbor-quick-profile-light-1440.png) / [Koyu](design/social-world/neighbor-quick-profile-dark-1440.png) |
| Kendi hızlı profili | [Açık](design/social-world/own-quick-profile-light-390.png) / [Koyu](design/social-world/own-quick-profile-dark-390.png) | [Açık](design/social-world/own-quick-profile-light-1440.png) / [Koyu](design/social-world/own-quick-profile-dark-1440.png) |
| Tam sosyal profil | [Açık](design/social-world/full-profile-light-390.png) / [Koyu](design/social-world/full-profile-dark-390.png) | [Açık](design/social-world/full-profile-light-1440.png) / [Koyu](design/social-world/full-profile-dark-1440.png) |
| Avatar içeren Sakinler | [Açık](design/social-world/residents-light-390.png) / [Koyu](design/social-world/residents-dark-390.png) | [Açık](design/social-world/residents-light-1440.png) / [Koyu](design/social-world/residents-dark-1440.png) |
| Avatar içeren Sohbet | [Açık](design/social-world/chat-light-390.png) / [Koyu](design/social-world/chat-dark-390.png) | [Açık](design/social-world/chat-light-1440.png) / [Koyu](design/social-world/chat-dark-1440.png) |
| Profilim | [Açık](design/social-world/my-profile-light-390.png) / [Koyu](design/social-world/my-profile-dark-390.png) | [Açık](design/social-world/my-profile-light-1440.png) / [Koyu](design/social-world/my-profile-dark-1440.png) |

Tekrar üretim: mevcut bulut ortamında `node tools/serve-navigation-fixture.mjs`, ardından yukarıdaki iki Python komutu. Bina genel görüntüsü tam sayfa, diğerleri viewport çekimidir. 320/768 px'te aynı gerçek etkileşim ve yerleşim kontrolleri yapılır; PNG'ler 390/1440 px'tir.

## Dosyalar, performans ve geri alma

- `social.ts`: saf avatar ataması, üyelik/daire kapsamlı açık kimlik projeksiyonu, gerçek katılım ayı.
- `Avatar.tsx`, `BuildingWorld.tsx`, `ResidentProfiles.tsx`: ortak avatar, etkileşimli bina/alternatif liste/sakin listesi, hızlı/tam kimlik bileşenleri.
- `useQuickProfile.ts`, `navigation.ts`: geçici panel history'si ve merkezi tam profil URL'si.
- `App.tsx`: sınırlı görünüm modelinin oluşturulması, mevcut engellemenin ortak handler'ı, sohbet sürekliliği, görev rozeti sunum zamanlayıcısı.
- `AppShell.tsx`, `AccountScreens.tsx`, `PlayerScenes.tsx`: mevcut ekranlarla sunum entegrasyonu; `styles/social-world.css`: sınırlı D düzeni.
- `api.ts`: yalnız gerekli tip alanları; `vite-env.d.ts`, `vite.config.ts`, `tools/art-catalog.mjs` ve tip bildirimi: değişmeyen JSON kaynaklarının ortak derleme erişimi.
- `tests/social-world.test.mjs`, `tests/ui-render.mjs`, mevcut izole fixture ve Chromium araçları: yukarıdaki otomatik kontroller.

Yeni paket, SVG, migration, sunucu çağrısı, sorgu, yayın workflow'u veya kalıcı avatar alanı yoktur. Profil açma salt sunumdur; yalnız mevcut mesaj gizleme/geri alma işlemi yazma yapar. Ana JS çıktısı yaklaşık 244 kB (gzip 77,5 kB), CSS 40,8 kB (gzip 9,1 kB); C tabanına göre ana JS gzip artışı yaklaşık 3 kB'dir. Portre SVG'leri bundle'a gömülmez, yerel dosya ve tarayıcı önbelleği kullanılır. PNG kanıtları uygulama derlemesine girmez.

RLS/RPC/Auth/MFA, ekonomi/seçim işlemleri, personel panelleri, onaylı sanat dosyaları ve yayın workflow'u değişmez. Gerçek Supabase üzerinden Auth/MFA/Realtime uçtan uca testi yapılmadı. Sentetik blok mutasyonları gerçek hizmet testi değildir; gerçek sunucu kuralları disposable PostgreSQL regresyonlarıyla ayrı kontrol edilir. Ekran okuyucu, fiziksel iOS/Android klavye/safe-area, %200 zoom ve bütün küçük portrelerin fiziksel cihazda sanat kabulü manuel inceleme bekler. Mobil SVG alt katlarına erişim dikey sayfa kaydırması, 320 px'te gerektiğinde yatay sahne kaydırması gerektirir.

Geri alma bu dalın istemci/test commit'lerini geri almaktır; canlı veri ve migration telafisi yoktur. PR taslak kalır; kullanıcı incelemesi/onayı olmadan merge veya yayın yapılmaz. E/F ve v2.1 özellikleri bu çalışmanın dışındadır.
