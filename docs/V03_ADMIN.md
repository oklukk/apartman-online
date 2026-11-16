# APARTMAN v0.3 — Yönetim Merkezi ve rol sistemi

## Hedef

Mevcut APARTMAN v0.2 oyuncularını, mesajlarını, seçimlerini ve ekonomisini bozmadan, bir Süper Yönetici tarafından yönetilebilen ve gelecekte yeni yetkilerle genişletilebilen rol tabanlı yönetim sistemi.

**Mevcut durum:** Kod yalnızca feat/v03-admin-rbac-foundation geliştirme dalında hazırlanmıştır. SQL dosyası staging taslağıdır, canlı veritabanına uygulanmamıştır.

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

## Güvenlik ilkeleri

Rol bilgileri kullanıcıların değiştirebildiği auth.user_metadata içinden okunmaz. Private tablolara anon/authenticated için doğrudan erişim kapalıdır. Her yönetim işlemi sunucudaki kontrollü fonksiyondan geçer. Servis anahtarı JavaScript içine konulmaz. Yönetici işlemlerinde 5–500 karakter gerekçe şartı vardır.

Yeni bir Süper Yönetici atamak ve mevcut Süper Yönetici atamasını kaldırmak için MFA/AAL2 aranır. Son aktif Süper Yönetici kaldırılamaz. İlk Süper Yönetici ataması yalnızca oyun sahibinin doğrulanmış Auth UUID'siyle SQL Editor'da ayrı adım olarak yapılır; hiçbir kullanıcı otomatik olarak yükseltilmez.

Mevcut desteklenen kapsamlar global ve building'dir. Şehir ve mahalle verileri oluşunca hiyerarşik kapsam çözümleyicisi genişletilecek; henüz bulunmayan dünyaya sahte izinler verilmeyecektir. Apartmana özgü yetkiler sunucuda denetlenir; kapsamlı arayüz ekranları sonraki dilimde genişletilir.

## Geliştirme / dağıtım prosedürü

1. Ayrı PR üzerinden devam et. main ve canlı Supabase projesi bu aşamada değişmemeli.
2. Supabase CLI sürümünü ve migration new komutunun --help çıktısını incele. CLI ile v03_admin_rbac_foundation isimli yeni migration dosyası oluştur. Staging SQL'i teknik inceleme sonrası bu gerçek migration'a taşı; staging SQL'ini doğrudan canlı SQL Editor'da çalıştırma.
3. Önceki iki migration ve v0.2 migration'ından sonraki yapıya disposable PostgreSQL/Supabase ortamında yeni migration'ı uygula. Yetkisiz erişim, rol atama, farklı kapsamlar, tekrar atama, rol izin değişimi, AAL2 ve audit testleri yaz.
4. GitHub Actions, TypeScript derleme ve SQL entegrasyon testlerini çalıştır. Statik testler tek başına veritabanı doğrulaması değildir.
5. Canlı uygulama öncesinde tek hedef projenin rmoytuncahutqurttknt olduğunu, mevcut kullanıcı, mesaj, seçim ve kasa verilerinin korunduğunu doğrula.
6. İlk Süper Yönetici için kullanıcıdan açıkça hangi Auth UUID'nin kendisine ait olduğunu doğrulamasını iste. SQL dosyasının sonundaki örnek bootstrap sorgusunda placeholder'ı doğrulanmış UUID ile değiştir. Tahmin etme.
7. Güvenlik kontrolleri tamamlandıktan sonra ayrı migration'ı canlıya uygula; sonra PR birleştirme ve Pages yayını yap. Yetkili ve yetkisiz iki hesapla kabul testi yap.

Mevcut seçimlerin süreleri, yöneticilerin durumları ve cüzdanlar bu geliştirmede değiştirilmez.

## Geliştirme yol haritası

- v0.3.1: Oyuncu susturma/banlama; aktif JWT oturumunda da anlık oyun RPC engeli, hesap durumlarının yönetimi; ekonomi bakiye ve aidat düzeltmeleri ile muhasebe defteri.
- v0.3.2: Yönetici atama, seçim erken sonlandırma, seçim iptali ve olağanüstü seçim; eski oyları ve görev kayıtlarını bozmadan kontrollü müdahale.
- v0.3.3: Toplu işlem, tarihli işlem planlaması, işlem önizleme/geri alma, bakım modu, duyuru/olay editörü.
- Gelecek: Şehir, mahalle, ticaret, mağaza, eşya, görsel daire ve yeni dünya unsurlarının aynı yetki altyapısına bağlanması.

Yeni bir özellik eklerken önce izin kodu, sonra sunucu doğrulama ve etkili RPC, en son admin UI oluşturulmalıdır. Yalnızca bir rolün panelde görüntülenmesi ona otomatik olarak sunucu yetkisi kazandırmaz.
