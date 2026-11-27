# A2-1 — katalog, kanonik anahtar dönüşümü ve uygulanmamış XP kaynakları

Başlangıç `main/27ad7f9dff2d18d8b8d5cd0d251bebc9649074d6`; PR #21 birleşmiş.
[A1 kalıcılık](A1_PERSISTENCE.md), [oyuncu](A1_PLAYER_ACTORS.md) ve [NPC](A1_NPC_PROVISIONING.md)
sınırları korunur. Bu PR **XP kazanımı veya eğitim sistemi değildir**; canlı bağlantı/backfill/seed yoktur.

## Gerçek ENUM dönüşümü ve kontrollü aşamalar

CLI help incelenip `migration new a2_skill_catalog_xp_foundation` ile tek eklemeli dosya oluşturuldu:
[`20261127202743_a2_skill_catalog_xp_foundation.sql`](../../supabase/migrations/20261127202743_a2_skill_catalog_xp_foundation.sql).
Önceki on migration değişmez. Yeni migration eski dosyayı değiştirmeden mevcut kanonik sütunu
`actor_skills.skill: ENUM → TEXT USING skill::text` dönüştürür ve katalog FK'si ekler. Seviye/XP,
actor kimliği, PK ve kayıtlar korunur; ikinci skill değeri/XP bakiyesi tablosu açılmaz.

| Bu PR'da tamamlanan | Bilerek kalan uyumluluk sınırı |
| --- | --- |
| `skill_catalog` TEXT PK: kararlı kod, Türkçe ad/açıklama, etkinlik, öğretilebilirlik ve sabit başlangıç etiketi | NPC `field`, `teaching_fields` ve typed A1 imzaları hâlâ dört kodlu ENUM kullanır |
| Kanonik `actor_skills.skill` artık katalog FK'sidir; yeni kod ENUM DDL'siz gerçek skill satırına bağlanabilir | NPC manifest doğrulayıcısı ve TypeScript **başlangıç/pilot** validator'ı yeni NPC alanlarına açılmaz |
| Yeni oyuncu alanı için ayrı açık enrollment kaydı + 0/0 kanonik satır birlikte gerekir | Runtime enrollment API'si veya yeni alan dağıtan trigger/worker yoktur |
| A1 tamlık guard'ı TEXT kodlarını ve açık enrollment'ı denetler; NPC coverage join'i TEXT'e uyarlandı | XP artışı ve seviye hesabı hâlâ kapalıdır; A1 güncelleme/silme korumaları sürer |

Bu, dört ENUM değerinin yalnız metadata kopyası değildir: testte yeni kod tanımlanır ve **ENUM
değişmeden** açık sentetik enrollment ile aynı kanonik tabloda saklanır. Ancak NPC dönüşümünün
tamamlandığı da iddia edilmez. Tüm bot alanlarını/array'leri, manifest cast'lerini, imzaları ve
kapsama denetimini tek PR'da değiştirmek A1 onay sözleşmesini gereksiz büyütürdü.

Önerilen sonraki küçük dilim: bot alanı için TEXT katalog FK, öğretim alanları için FK'li ilişki;
yeni TEXT kapsama imzası ve gerekirse eski ENUM wrapper'ı; eski NPC onay snapshot'larıyla çift
doğrulama; bağımlılık taramasından sonra enum köprüsünün kaldırılması. Bu bir gelecek planıdır,
yeni bot alanı/kurs veya bu geçişi uygulama onayı değildir. `DROP TYPE ... CASCADE` kullanılmaz.

ALTER TYPE tablo/PK index yeniden yazımı ve ACCESS EXCLUSIVE kilidi gerektirebilir. Migration
`lock_timeout=5s` ile beklemeyi sınırlar; staging/disposable test gerçek büyük tablo süresini
kanıtlamaz. Onaylı rollout öncesi hedef/history, satır hacmi, bağımlılıklar, bilinmeyen kodlar,
katalog FK uygunluğu ve bakım aralığı kontrol edilmelidir. Beklenmeyen eski kod FK doğrulamasında
hata verir; transaction geri alınır, kayıt sessizce düşürülmez. Bu görev canlıya uygulanmadı.

## Katalog ve açık enrollment

Migration yalnız mevcut dört kodun statik Türkçe metadata'sını ekler; actor/skill backfill yapmaz.
Kodlar: `plumbing`, `business`, `basic_teaching`, `advanced_teaching`. `is_initial` yalnız bu dört
koda ait olabilir ve değişmez. Başlangıç oluşturucu **daima dört0/XP0** yazar; aktif katalog sayısı
ve enum sırasından başlangıç alanı türetmez.

`private.define_skill` owner-only ve idempotent tanımdır. Yeni kodlar varsayılan pasif/öğretilemezdir.
Bayraklar katalog metadata'sıdır; aktif+öğretilebilir bile olsa karaktere alan, kursa koltuk veya
işe XP hakkı üretmez. Kod silinemez/yeniden adlandırılamaz; descriptive metadata ve durum owner'ın
ayrı incelenmiş SQL işlemiyle değişebilir. Staff UI/katalog yönetimi veya yeni rol izni açılmaz.

`player_skill_enrollments` yalnız mevcut player actor için ek alanın açık onay referansı/gerekçesini
tutar. Bu kayıt XP/seviye saklamaz. Composite FK'ler ve deferred tamlık denetimi, enrollment ile
0/0 `actor_skills` satırının atomik beraberliğini sağlar. Başlangıç kodu için ikinci enrollment
oluşturulamaz; bot enrollment alamaz. Enrollment veya skill değerini silip yeniden başlangıç hakkı
üretmek kapalıdır. Bu PR enrollment çağıran fonksiyon, UI veya otomasyon **içermez**; test yalnız
disposable DB'de iki satırı açıkça yazar. Gerçek oyuncuya alan ataması ayrı onay/checked işlem ister.

Aktiflik/öğretilebilirlik bayrağını kapatmak mevcut değerleri silmez. Mevcut A1 NPC yeterliği aynı
kalır; gelecekte eğitim açılması ayrıca katalog durumu, onaylı müfredat, kapsama ve kapasiteyi
kontrol etmelidir. Bu metadata dersin aktif olduğu anlamına gelmez.

## Kanonik XP ve kaynak kimliği

**Tek güncel seviye/XP kaynağı `actor_skills`'tir.** Oyuncu değerleri bu aşamada0/0; bot profilleri
sabit ve XP0'dır. 0–10 CHECK korunur. UPDATE/DELETE guard'ı veya XP ödül fonksiyonu açılmadı.

`xp_source_claims` değişmez bir **uygulanmamış kaynak rezervasyonu** defteridir. `source_type`,
global UNIQUE `source_id` UUID, player actor/skill FK'si, gerekçe ve sunucu rezervasyon zamanı tutar.
Aynı UUID'yi başka kaynak türü, kişi veya yeteneğe bağlamak da reddedilir. Bir kaynak bu ilk
sözleşmede tek hedefe aittir; ileride çoklu alan ödülü istenirse açık onaylı türetme modeli gerekir.
Bot, var olmayan actor veya kanonik skill'e kayıt açılamaz. Geçmiş UPDATE/DELETE ile silinemez;
FK'lerde RESTRICT olduğundan hedefi silerek dedup kimliğini serbest bırakmak da mümkün değildir.

Kapalı `private.reserve_xp_source` aynı içerikte aynı kayıt ID'sini döndürür; farklı içerik reddedilir.
UNIQUE kısıtı doğrudan SQL ve yarışlarda da korur. READ COMMITTED tekrarları tek ID'ye ulaşır;
eski REPEATABLE READ snapshot'ı `40001` alırsa **bütün transaction** sınırlı retry ile yeniden
başlatılmalıdır. Başarısız/kısmi transaction kaynak kimliğini tüketmez; committed kayıt ise kaybolan
yanıttan sonra retry'da aynen bulunur.

**Bu defter gerçek faaliyetin tamamlandığını kanıtlamaz ve XP ödülü değildir.** Amount, credited
durumu, kazanılmış XP toplamı veya seviye hesabı yoktur; satır sayısı XP gibi yorumlanamaz. Kaynak
UUID'sini istemciden almak veya bu kaydın bulunması, gelecekte ödül yetkisi sayılmamalıdır.
Sonraki dilim; güvenilir tamamlanma FK/çözücüsü, onaylı miktar/politika sürümü, source-claim'e UNIQUE
bağlı silinmeyen ödül/ters kayıt makbuzu ve kanonik değer güncellemesini aynı transaction'da kurmalıdır.
Kaynağı yanlış kaydederek zehirlemeyi önlemek için tamamlanma doğrulaması rezervasyondan önce gelir.

`reserved_at` INSERT'te sunucudan yazılır; `reserved_on` Türkiye saatinden generated date'dir.
Actor/gün index'i ilerideki denetimlere hazırdır; **günlük XP sınırı uygulanmış değildir**.
Rezervasyon günü ödül günü değildir. Gelecekte günlük miktar sınırı, gerçek ödül zamanı/periodu ve
actor/gün kilidiyle atomik denetlenmeli; gecikmiş iş veya retry gün değiştirerek ek ödül vermemelidir.

## Yetki ve A1 uyumluluğu

Yeni üç tabloda RLS/default-deny; PUBLIC/anon/authenticated/service_role için açık SELECT/DML/
TRUNCATE ve internal EXECUTE kapalıdır. Yeni giriş fonksiyonları SECURITY INVOKER, boş search_path
ve `current_user=postgres` denetimi kullanır. Yanlışlıkla EXECUTE grant verilmesi owner yetkisi
ödünç vermez. Personel/Süper Yönetici rolü bu kaynak veya katalog işlemlerine otomatik yetki kazanmaz.

Mevcut Auth/MFA/RBAC ve public RPC imzaları değişmez. Yalnız iki private işlevin gövdesi uyarlandı:
`a1_assert_actor` ve aynı ENUM imzalı `npc_assert_teaching_coverage`. ACL'leri korunur. Oyuncu
oluşturucu ek enrollment'ı sıfırlamaz; aktörsüz hesap eski oyunu kullanır. Saf TypeScript validator
**başlangıç** planında dört0/XP0 sözleşmesini korur; sonradan açık enrollment yapılmış ilerleme
snapshot'ı başlangıç validator'ına verilmez. Bu client kontrolü DB yetki sınırı değildir.

## Onay bekleyen denge kararları — hiçbir seçenek uygulanmadı

| Konu | Alternatifler ve gerekçeleri |
| --- | --- |
| Seviye XP eğrisi | Doğrusal: kolay anlaşılır, uzmanlık hızlı bitebilir. Artan/kademeli: üst seviye emeğini ayırır, aşırı tekrar riski taşır. Karma eğri: başlangıcı erişilebilir tutabilir, daha çok denge testi ister. |
| Faaliyet XP'si | Tamamlanma başına sabit değer: denetlenebilir, kısa faaliyet spam'i riski. Doğrulanmış emek/süreye sınırlı değer: adil ölçek, süre şişirme koruması ister. Katkı/sonuç bazlı: mesleki uygulamaya anlam katar, sunucu kanıtı daha karmaşıktır. |
| Günlük sınırlar | Tek toplam tavan: sade, tek alanı çalışmak diğerlerini bloke edebilir. Alan bazlı + toplam tavan: çeşitliliği destekler, çift kilit/sayaç denetimi ister. Faaliyet başına sınır ayrıca spam'i azaltır. Sayılar seçilmedi. |
| Seviye0 başlangıcı | Ücretsiz kısa rehberli eğitim: erişilebilir. Kontenjanlı başlangıç dersi: sosyal yapı kurar, kilitlenme riski vardır. Hangisi seçilirse seçilsin seviye0 kabul eden gerçek yol zorunludur; hız belirlenmedi. |
| Seviye7–10 | Yalnız XP: basit fakat tekrar öğütmeye açık. XP + yeterlik/proje: uzmanlığı kanıtlar, erişim/eşitlik ve doğrulanmış başarı tasarımı ister. |
| Öğretmenlik | Sabit rol verimi: anlaşılır; nitelikleri az kullanır. Yetenek tabanlı sınırlı verim: karakter farkı yaratır, bot/oyuncu dengesi ve kapasite kanıtı ister. Özel öğretmen profesörü aşamaz; katsayılar, ders/öğrenci sayıları seçilmedi. |

Özel öğretmen Temel≥5/alan≥5 (genel İleri şartı yok), öğretim görevlisi Temel≥5/İleri≥3/alan≥6 ve
profesör Temel10/İleri≥5/alan≥6 eşikleri korunur. Yukarıdakiler XP ödülü veya yeni öğretmen kapasite
formülü değildir. Kullanıcı onayı olmadan miktar, eğri, hız, tavan veya uzmanlık kapısı kodlanmaz.

## Test ve teslim sınırı

`tests/a2-skills-xp.mjs` yalnız sabit localhost disposable DB'sinde ilk10 migration'ı ve dolu eski
insan/NPC fixture'ını kurar. Onbirinci migration öncesi/sonrası **bütün eski satır sayıları/hash'leri**
(skill değerleri dahil), eski RPC/ACL/RLS/trigger ve cron/publication korunur; yalnız yukarıdaki
iki private gövdeye değişiklik allowlist'i vardır. Yeni metadata4 satırdır; enrollment/claim boştur.
Yeni NPC oluşturma, replay ve deferred kontroller dönüştürülmüş sütunda da test edildi.

11 A2 grubu: gerçek TEXT/FK dönüşümü ve yeni kod, açık enrollment, A1/pure-validator uyumu, bot
sabitleri, kalıcı kaynak kimliği/retarget reddi, RC/RR yarışları, atomik rollback, RLS/GRANT/owner,
eski oyun/NPC verisi ve defter mutabakatını kapsar. Test alan/onay/kaynak değerleri bellek içi
sentetik fixture'dır; gerçek backfill veya ödül değildir. CI'a `npm run test:a2` eklendi.

Yerel sonuçlar: `npm test`77/77, UI SSR/build başarılı. PostgreSQL sql11, v02 24, rbac14, advanced15,
a1 15, a1-player11, a1-npc15, a2 11 grup başarılı. `test:db` tam Supabase stack ve
`work/local-status.json` olmadığından ENOENT verdi. Gerçek HTTP Auth/MFA/Realtime veya pg_cron
yürütmesi kabulü yapılmadı. Yeni browser/görsel test yok; frontend değişmez. CI sonucu PR'dadır.

Taslak PR otomatik birleşmez/yayımlanmaz. Canlı migration, gerçek enrollment/backfill, NPC seed'i,
XP kaynak kaydı veya dağıtımı ayrı onay gerektirir. Rollout öncesi hedef/history/bağımlılık ve eski
veri özeti karşılaştırılmalıdır. Geri alma henüz canlı uygulanmadığından commit revert'idir.
Yeni TEXT kodları veri aldıktan sonra körlemesine ENUM'a geri cast, DROP CASCADE veya kayıt silme
yapılmaz; yazmaları kapatıp değer/kimlik/defter geçmişini koruyan ileri geçiş tercih edilir.
