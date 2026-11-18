# APARTMAN v0.3 — Yönetim Merkezi ve rol sistemi

## Hedef

Mevcut APARTMAN v0.2 oyuncularını, mesajlarını, seçimlerini ve ekonomisini bozmadan, bir Süper Yönetici tarafından yönetilebilen ve gelecekte yeni yetkilerle genişletilebilen rol tabanlı yönetim sistemi.

**Canlı durum (19 Kasım 2026):** v0.3 RBAC sistemi canlıdadır. İncelenen SQL içeriği değiştirilmeden migration dosyasının zaman damgası, Supabase'de daha önce uygulanmış olan `20261116134945_v03_admin_rbac_foundation.sql` kaydıyla eşleştirilmiştir. Önceki `20261116131716` adı yalnız geliştirme geçmişindedir. Canlı geçmişe müdahale edilmemiştir.

## Mimari

- private.staff_permissions: Modül ve eylem bazında dinamik izin kataloğu. Gelecekteki mekanikler buraya yeni izin kodları ekler.
- private.staff_roles: Başlangıçta super_admin, admin, moderator, editor. Yeni özel roller oluşturulabilir.
- private.staff_role_permissions: Rollere birden fazla izin atanır. Süper Yönetici rolü tüm kayıtlı ve gelecekteki izinlerde wildcard olarak değerlendirilir.
- private.staff_assignments: Bir kullanıcıya birden fazla rol verilebilir. Kapsam: global veya belirli building. Aynı rol/kapsam çifti mükerrer atanmaz; isteğe bağlı süre sonu desteklenir.
- private.staff_can: Sunucu tarafında yetkiyi her işlemde yeniden doğrular. Yalnızca React'teki butonların gizlenmesine güvenilmez.
- private.staff_audit: İşlemi, yapanı, hedefi, eski ve yeni değeri, gerekçeyi ve zamanı kaydeder.
- StaffPanel.tsx: Rol verme/kaldırma, rol oluşturma, izin düzenleme, apartman adını değiştirme ve işlem geçmişi arayüzü.

Süper Yönetici diğer onaylı Auth kullanıcılarına Yönetici, Moderatör, Editör veya özel rol atayabilir. Bir hesaba birden çok rol verilebilir. Yönetici/moderatör/editör rolünün izinleri Süper Yönetici tarafından düzenlenebilir. Başlangıç rollerinin dışına çıkmak için yeni tablo veya kod değişikliği gerekmeyecek; yalnızca yeni, gerçek bir oyun mekanizması eklendiğinde o mekanizmaya ait sunucu RPC'si geliştirilmelidir.

## Bu kod diliminin GERÇEKTEN uyguladığı işlemler

- Kendi yönetici rollerini görüntüleme ve yönetim sekmesini rolü olan hesaplara açma.
- Süper Yönetici tarafından diğer kullanıcılara rol verme ve rol kaldırma.
- Yeni özel rol oluşturma; Süper Yönetici dışında mevcut rollerin izinlerini değiştirme.
- Global veya apartman kapsamlı rol atama.
- Yetkili hesap tarafından apartman adını değiştirme.
- İşlem gerekçelerini ve son 50 yönetici eylemini denetleme.

Katalogda kayıtlı fakat henüz RPC'si yazılmamış ekonomi düzeltme, banlama, seçim müdahalesi, acil müdahale ve toplu işlem hakları **şimdilik planlı yetkilerdir**. Bu kod dilimi bunları çalıştırabiliyormuş gibi sunulmamalıdır.

## İlk sahip hesabının MFA kurulumu

İlk Süper Yönetici ataması için doğrulanmış TOTP/MFA faktörü gerekiyor. İlk atama yapılmadan önce sistem yönetimi ekranı görünmediğinden tüm giriş yapmış hesaplarda ayrı `Hesap güvenliği` sekmesi bulunur; burada MFA kurulup doğrulanabilir. Bu ekrana erişim herhangi bir yönetici yetkisi kazandırmaz. Kullanıcı oyuna giriş yapar, Hesap güvenliği sekmesinden MFA'yı etkinleştirir; operatör daha sonra sahipliği doğrulanmış Auth UUID üzerinde ayrı bootstrap işlemi yapar. Sistem yönetimi sekmesi yalnızca server rolü bulunan hesaplara açılır.

## Güvenlik ilkeleri

Rol bilgileri kullanıcıların değiştirebildiği auth.user_metadata içinden okunmaz. Private tablolara anon/authenticated için doğrudan erişim kapalıdır. Her yönetim işlemi sunucudaki kontrollü fonksiyondan geçer. Servis anahtarı JavaScript içine konulmaz. Yönetici işlemlerinde 5–500 karakter gerekçe şartı vardır.

Bütün yönetim yazma işlemlerinde (rol atama/iptal, özel rol oluşturma, izin değişikliği ve apartman adı) MFA/AAL2 aranır. Böylece özel rol üzerinden MFA sınırı dolanılamaz. Panelde TOTP kurulumu/doğrulaması vardır; gerçek Auth MFA seremonisi ayrıca kabul testidir. Son aktif Süper Yönetici kaldırılamaz. İlk Süper Yönetici ataması yalnızca oyun sahibinin doğrulanmış Auth UUID'siyle SQL Editor'da ayrı adım olarak yapılır; hiçbir kullanıcı otomatik olarak yükseltilmez.

Mevcut desteklenen kapsamlar global ve building'dir. Şehir ve mahalle verileri oluşunca hiyerarşik kapsam çözümleyicisi genişletilecek; henüz bulunmayan dünyaya sahte izinler verilmeyecektir. Apartmana özgü yetkiler sunucuda denetlenir; kapsamlı arayüz ekranları sonraki dilimde genişletilir.

## Geliştirme / dağıtım prosedürü

1. Ayrı PR üzerinden devam et. main ve canlı Supabase projesi bu aşamada değişmemeli.
2. Supabase CLI sürümünü ve migration new komutunun --help çıktısını incele. CLI ile v03_admin_rbac_foundation isimli yeni migration dosyası oluştur. Staging SQL'i teknik inceleme sonrası bu gerçek migration'a taşı; staging SQL'ini doğrudan canlı SQL Editor'da çalıştırma.
3. Önceki iki migration ve v0.2 migration'ından sonraki yapıya disposable PostgreSQL/Supabase ortamında yeni migration'ı uygula. Yetkisiz erişim, rol atama, farklı kapsamlar, tekrar atama, rol izin değişimi, AAL2 ve audit testleri yaz.
4. GitHub Actions, TypeScript derleme ve SQL entegrasyon testlerini çalıştır. Statik testler tek başına veritabanı doğrulaması değildir.
5. Canlı uygulama öncesinde tek hedef projenin rmoytuncahutqurttknt olduğunu, mevcut kullanıcı, mesaj, seçim ve kasa verilerinin korunduğunu doğrula.
6. İlk Süper Yönetici için kullanıcıdan açıkça hangi Auth UUID'nin kendisine ait olduğunu doğrulamasını iste. Oyun sahibi hesabının e-postası doğrulanmış ve bir MFA faktörü verified olmalıdır. Bunlar kontrol edilmeden işlem reddedilir. Sadece SQL Editor postgres operatörü `select private.staff_bootstrap('<DOĞRULANMIŞ_AUTH_UUID>'::uuid, 'Sahiplik doğrulama gerekçesi');` çağırır. Fonksiyon public RPC değildir; anon/authenticated/service_role çalıştıramaz. Bu dokümandaki placeholder çalıştırılmamalıdır. Henüz UUID seçilmedi/istenmedi ve ilk atama yapılmadı.
7. Güvenlik kontrolleri tamamlandıktan sonra ayrı migration'ı canlıya uygula; sonra PR birleştirme ve Pages yayını yap. Yetkili ve yetkisiz iki hesapla kabul testi yap.

Mevcut seçimlerin süreleri, yöneticilerin durumları ve cüzdanlar bu geliştirmede değiştirilmez.

## Geliştirme yol haritası

- v0.3.1: Oyuncu susturma/banlama; aktif JWT oturumunda da anlık oyun RPC engeli, hesap durumlarının yönetimi; ekonomi bakiye ve aidat düzeltmeleri ile muhasebe defteri.
- v0.3.2: Yönetici atama, seçim erken sonlandırma, seçim iptali ve olağanüstü seçim; eski oyları ve görev kayıtlarını bozmadan kontrollü müdahale.
- v0.3.3: Toplu işlem, tarihli işlem planlaması, işlem önizleme/geri alma, bakım modu, duyuru/olay editörü.
- Gelecek: Şehir, mahalle, ticaret, mağaza, eşya, görsel daire ve yeni dünya unsurlarının aynı yetki altyapısına bağlanması.

Yeni bir özellik eklerken önce izin kodu, sonra sunucu doğrulama ve etkili RPC, en son admin UI oluşturulmalıdır. Yalnızca bir rolün panelde görüntülenmesi ona otomatik olarak sunucu yetkisi kazandırmaz.

## Bu incelemede tamamlanan güvenlik düzeltmeleri

- RBAC yazmaları ve assignment trigger'ı aynı transaction advisory lock ile sıralanır. Yetki kontrolü kilitten sonra ve VOLATILE çözümleyiciyle güncel snapshot'tan yapılır. Kilit beklerken iptal edilmiş yetki işlem gerçekleştiremez.
- Son Süper Yönetici silme/değiştirme, süreli veya apartman kapsamlı Süper Yönetici atama ve Auth silme cascade'i trigger ile korunur. İki Süper Yönetici eşzamanlı birbirini kaldırdığında biri kalır.
- Audit okumak ayrı staff.audit.read ister. Kapsamlı dizin sadece izinli apartmanları döndürür; global kullanıcı/rol atamaları ve audit verisini sızdırmaz. Ekonomi bakiyeleri rol dizinine dahil edilmez.
- Panel global ve scoped_permissions değerlerini kullanır. Rol kaybı girişte/focus'ta ve 30 saniyelik yenilemede UI'dan temizlenir; sunucu iptali hemen uygular. Mevcut oyuncularda eksik RPC/migration boş yetki olarak ele alınır ve dört oyun bölümü korunur.

## Test kanıtı ve sınırlar

`npm run test:rbac`: gerçek PostgreSQL 17 üzerinde ilk üç migration (v0.2) ve yeni migration ile 14 entegrasyon grubu. Otomatik yükseltme olmaması/eski veri snapshot'ı, bütün hazır roller ve çoklu rol, özel rol, canlı izin değişimi/iptal, apartman ayrımı, audit yetkisi, yetkisiz/metadata sahteciliği, bootstrap e-posta/faktör koşulları, tüm yazmalarda AAL1 reddi/AAL2 izni, son Süper Yönetici, eşzamanlı iptal ve kilit bekleyen yetkinin iptali doğrulanır. Yalnız sabit localhost 55432'deki disposable `apartman_rbac` veritabanını oluşturur/siler. Katalog genişlemesi, başarısız değişikliklerin atomikliği ve anon RPC engeli de sınanır. Gerçek kullanıcılar yerine fixture Auth/JWT/AAL bağlamları kullanır. Test canlı Supabase'e yönlendirilemez.

Eski 11 PostgreSQL, v0.2'nin 24 PostgreSQL grubu ve mevcut statik React testleri korunur. GitHub CI'a RBAC grubu eklendi. `npm test` yalnız kaynak/konfigürasyon kontratıdır; entegrasyon yerine sayılmaz.

Mobil/masaüstü CSS ve form/checkbox/MFA QR boyutları kodda incelendi ve responsive stiller eklendi. Bu oturumda desteklenen tarayıcı kontrol aracı bulunmadığından interaktif tarayıcı, gerçek MFA QR tarama, gerçek oturum/Reatime ve görsel viewport kabulü tamamlandı diye raporlanmıyor. Canlı öncesi telefon/masaüstünde QR kurulumu, AAL2 doğrulama, scoped rename ve rol iptali ayrıca denenmeli.

Canlıya geçiş için ayrı onay: hedef proje/üç eski migration ve veri sayıları doğrulanır, yalnız yeni migration uygulanır; sonra sahiplik doğrulanan UUID için operatör bootstrap'ı ayrı olarak onaylanır. PR #2 bu aşamada taslak kalır, main'e birleştirilmez ve Pages yayımlanmaz. Seçim/kasa/cüzdan/cron değişikliği yoktur.

İlk sahipte MFA henüz kurulmadıysa, sahip kendi doğrulanmış Auth oturumuyla Supabase'in resmi `auth.mfa.enroll` ve `challengeAndVerify` akışını tamamlamalıdır; oturum tokenı veya QR/secret kimseyle paylaşılmamalıdır. Ardından sadece doğrulanacak Auth UUID'si operatöre iletilir. UUID ve faktör doğrulanmadan bootstrap yapılmaz. Sonraki yetkili kullanıcılar panelin MFA kartını kullanabilir.

Tam yerel Auth/Realtime süiti `npm run test:db`, bu ortamda `work/local-status.json` bulunmadığından ENOENT ile çalıştırılamadı. Canlı erişim anahtarıyla bu testi çalıştırarak kısıt aşılmadı.
