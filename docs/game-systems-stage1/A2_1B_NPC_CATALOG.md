# A2-1b — NPC alanlarının genişletilebilir kataloğa geçişi

Başlangıç `main/35a0a3759aeba05c94a3ddb2dd5fd9c1430e8fc4`; PR #22 birleşmiş.
[A2-1](A2_1_SKILL_CATALOG_XP.md), [NPC onay/bütçe](A1_NPC_PROVISIONING.md) ve mevcut güvenlik
sınırları korunur. Bu PR canlıya bağlanmaz, gerçek actor/NPC/dünya/konut oluşturmaz ve XP vermez.

## Tek öğretim alanı kaynağı ve ENUM bağımlılıkları

CLI help + `migration new a2_npc_catalog_migration` ile tek eklemeli dosya üretildi:
[`20261128071343_a2_npc_catalog_migration.sql`](../../supabase/migrations/20261128071343_a2_npc_catalog_migration.sql).
Önceki **onbir** migration dosyası değişmez.

| Alan/sözleşme | Yeni durum |
| --- | --- |
| `bot_profiles.field` | TEXT + `skill_catalog(code)` FK; yeni meslek ENUM DDL'si gerektirmez |
| Eski `bot_profiles.teaching_fields` dizisi | Kaldırılır; ikinci güncellenebilir öğretim kaynağı kalmaz |
| `bot_teaching_fields` | Tek kanonik ilişki: actor/skill PK, actor/position UNIQUE, pozitif ve kesintisiz sıra, bot profili + katalog + kanonik actor_skills FK'leri |
| `npc_teaching_codes(actor_id)` | İlişkiden position sırasıyla türetilen salt okunur TEXT[] projeksiyonu; ayrı durum/bakiye değildir |
| `npc_assert_teaching_coverage_text(uuid,text[])` | Yeni katalog yolundaki kapalı yeterlik denetimi |
| Eski `npc_assert_teaching_coverage(uuid,actor_skill_code[])` | Aynı ACL/imzayla TEXT işlevine delegasyon yapan legacy wrapper |
| `actor_skills` | Bütün aktörlerde tek seviye/XP kaynağı; A2-1 TEXT/katalog FK modeli korunur |

Skill ENUM'un hiçbir public/private tablo sütununda kullanımı kalmaz. Aktif NPC kontrol ve
oluşturma gövdeleri ile oyuncu başlangıç oluşturucusu ENUM cast'inden arındırıldı. Tür, yalnız
eski wrapper imzası/otomatik array türü bağımlılığı için tutulur; eski prepared çağrılar çalışır.
`DROP TYPE CASCADE` yoktur. Wrapper'ı kaldırmak sonraki kontrollü cleanup olabilir; A2-2 için
zorunlu değildir. `actor_kind`/`bot_role` ENUM'ları aktör/rol türleridir, meslek kataloğu değildir;
bu PR onları değiştirmez.

Yedi mevcut private gövde uyarlandı: `a1_assert_actor`, `a1_assert_plan`, `npc_check_spec`, eski
coverage wrapper'ı, `npc_assert_provisioned`, `provision_npc_plan`, `ensure_player_actor`.
İmzalar/ACL ve bütün public RPC'ler korunur. Yeni salt okunur helper/trigger işlevleri de kapalıdır.

## Mevcut ilişkilerin kayıpsız dönüşümü

Migration READ COMMITTED transaction ister. Kaynak `bot_profiles` tablosu **kopyadan önce**
ACCESS EXCLUSIVE kilitlenir; böylece dizi kopyası ile DROP COLUMN arasına yeni NPC commit edemez.
Mevcut öğretim dizileri `WITH ORDINALITY` ile aynı actor/skill/sıra kayıtlarına dönüştürülür.
Kimlik, isim, konut, onay, beceri seviyesi veya XP oluşturulmaz; bu dönüşüm yeni nüfus/skill
backfill'i değildir. Mutation trigger'ları kopyadan sonra kurulduğu için eski guard revision ve
dünya bütçeleri de değişmez. Bu SQL yalnız disposable testte uygulandı; canlı dönüşüm yapılmadı.

Eski dizinin kendi CHECK'leri sütunla kaldırılır; tür/kapsama/sıra ve tamlık kuralları FK ve
deferred denetimlerde yeniden korunur. Bot field TEXT dönüşümü bilinmeyen katalog kodunu FK ile
reddeder. Hata halinde bütün DDL/kopya geri alınır; veri sessizce atılmaz veya sıralanmaz.

Karşılaştırma, `bot_profiles` için ilişkiyi eski array görünümüne **aynı sırayla** yansıtan mantıksal
JSON/hash kullanır. Fiziksel satır şeması değişir; eski array'in ham byte'larının aynı kaldığı iddia
edilmez. Diğer eski tabloların sayıları/içerik hash'leri aynı kaldı. Onay JSON snapshot'ları hiç
UPDATE edilmez; alan dizisinin sırası plan kimliğinin parçası olmaya devam eder.
Onay JSON'undaki dizi değişmez tasarım snapshot'ıdır; güncel ilişki tablosuyla eşitliği denetlenir.
Ayrı güncellenebilir bir dizi veya ikinci öğretim ilişkisi kaynağı bırakılmaz.

## Katalog, sabit profiller ve onay

Çalışan yalnız ilgili3, işletmeci yalnız ilgili4 ve İşletmecilik4; öğretim görevlisi bildirilen
alanlarda6 ve Temel5/İleri3 taşır. Öğreticilik alanı doğrudan öğretiliyorsa6 önceliği korunur.
Çok alanlı öğretim desteklenir. İlgisiz ek skill, eksik/sırasız ilişki, oyuncuya öğretim bağı ve
NPC XP'si reddedilir. Profil/ilişki UPDATE/DELETE kapalıdır; yeni alan eklemek eski NPC'yi değiştirmez.

`npc_check_spec` ve depolama, kod varlığını katalog üzerinden doğrular. **Yeni onay** INSERT'inde
meslek alanı etkin, bildirilen öğretim alanları etkin+öğretilebilir olmalıdır. Metadata sonradan
değişirse mevcut onay snapshot'ı ve replay bütünlük denetimi aynı kalır. Bu ayrım, eski onayları
bayrak değişimiyle geçersizleştirmeden yeni planın katalog durumunu denetler. Onay iptali veya
emeklilik yine ayrı tasarım gerektirir.

TEXT coverage helper'ı gerçek kanonik seviyeler/rol/ilişkiler üzerinden **yeterlik** doğrular.
Bir ders açma işlemi değildir. Gelecekte eğitim etkinleştirmesi ayrıca güncel katalog durumunu,
onaylı müfredat/oturum/kapasiteyi kontrol etmelidir. Katalog tanımı, öğretilebilir bayrağı veya
nitelikli öğretmen bulunması otomatik NPC, üniversite, kurs, işletme veya XP üretmez.

## Atomiklik, yetki ve domain uyumu

İlişki INSERT'i dünya → actor → NPC planı kilit sırasını izler. FK ve deferred denetimler tam
kanonik skill'leri, onay snapshot'ını ve dünya toplamını transaction sonunda doğrular. Aynı
NPC anahtarı ikinci planla yeni actor/konut üretemez. Pilot iki ayrı öğretim görevlisi/tek12 konut,
tek pilot ve paylaşılan dünya bütçesi kuralları korunur. RC aynı onayda tek sonuca ulaşır;
eski RR snapshot'ı40001 alırsa bütün transaction sınırlı retry ister.

Yeni ilişkide RLS/default deny; PUBLIC/anon/authenticated/service_role SELECT/DML/TRUNCATE ve
helper EXECUTE kapalıdır. Coverage TEXT girişi owner kontrolü yapar; Süper Yönetici dahil staff
rolü NPC yetkisi kazanmaz. Yeni fonksiyonlar SECURITY INVOKER/boş search_path kullanır.
Auth/MFA/RBAC ve mevcut XP kaynak defteri değiştirilmez; doğrudan kaynak transferi/silme kapalı kalır.

Saf TypeScript modülü, son isteğe bağlı `catalogCodes` parametresiyle yeni kayıtlı kodları
doğrular. Kodlar tekil/geçerli olmalı ve dört başlangıç alanını içermelidir. Parametre verilmezse
eski dört alanlı sözleşme çalışır; oyuncu başlangıcı yine dört0/XP0'dır. `InitialSkill` bunu
statik olarak da ayırır. NPC lecture profilleri SQL gibi gerekçesiz ek alanı reddeder. Caller'ın
katalog snapshot'ı Auth/RLS veya katalog etkinliği kanıtı değildir; server denetimi zorunludur.
Fonksiyonlar ağ/DB okumaz, girdiyi değiştirmez; mevcut uygulama hâlâ bu modülü import etmez.

## Test kanıtı ve sınırlar

Yeni `tests/a2-npc-catalog.mjs` ilk11 migration ve dolu oyuncu/NPC/onay/kasa/seçim/XP-kaynak
fixture'ıyla çalışır. Pilotun yanında sıralanmamış çok alanlı eski snapshot da dönüşümden geçirilir.
11 yeni PostgreSQL grubu; migration lock timeout ve rollback/retry, mantıksal hash/sıra koruması,
legacy/prepared çağrı, ENUM bağımlılık taraması, beşinci alan worker/operator/lecturer, flag/yeterlik
ayrımı, duplicate anahtar/dolu konut, bozulan snapshot sırası/eksik ilişki/geç COMMIT hatası,
RC/RR ve farklı plan yarışları, RLS/yetki ve kaynak tekrar güvenliğini kapsar.

Örnek `fixture_carpentry` yalnız test belleği/disposable DB'dedir. Katalog tanımı tek başına NPC
oluşturmaz; öğretilemezken worker/operator mümkündür, öğretim görevlisi onayı reddedilir. Açık
metadata/onay adımından sonra TEXT yoluyla öğretim görevlisi ve kapsama doğrulanır. ENUM etiketi
eklenmez. Eski oyuncu/NPC/konut/seviye, onay/bütçe ve kaynak kayıtları test sonunda korunur.

Yerel sonuçlar: kaynak81/81 (4 yeni domain grubu), UI SSR ve build başarılı. PostgreSQL paketleri
sql11, v02 24, rbac14, advanced15, a1 15, a1-player11, a1-npc15, a2 11, a2-npc11 grup başarılı.
`test:db` tam yerel Supabase stack ve `work/local-status.json` olmadığı için ENOENT verdi. Gerçek
HTTP Auth/MFA/Realtime ve pg_cron yürütmesi test edilmedi; UID/JWT/MFA/cron registry sentetik
fixture/stub'dır. Yeni Chromium testi yok; frontend değişmez. Son CI kanıtı PR'dadır.

## Kilit, geri alma ve A2-2

ACCESS EXCLUSIVE lock yeni NPC okuma/yazmasını bakım süresince bekletebilir. `lock_timeout=5s`
kilit bekleyişini sınırlar; tablo dönüşümü/index/FK doğrulama toplam süresini sınırlamaz. Büyük
veride bağlantı/lock bekleyeni, tablo hacmi, I/O ve bakım aralığı ayrıca ölçülmelidir. READ COMMITTED
zorunluluğu kopyanın kilit alındıktan sonraki güncel cohort'u görmesi içindir. Test gerçek büyük
tablo performansı veya canlı rollout kabulü sayılmaz.

Geri alma henüz canlıya uygulanmadığı için commit revert'idir. Yeni meslek verisi oluştuğunda
ENUM'a körlemesine geri cast veya ilişkiyi sırasını kaybeden diziye dönüştürme veri kaybettirir.
Yazmaları kapatıp kimlik/konut/skill/onay geçmişini koruyan ileri düzeltme gerekir; CASCADE/drop
veya kayıt silerek düzeltme yoktur.

A2-2'nin NPC beceri-kodu için teknik ENUM engeli kalktı. Kalan işler: onaylı XP eğrisi/miktar/
günlük sınırlar; gerçek server completion kanıtı; source claim'e UNIQUE ödül/ters kayıt makbuzu;
actor/gün atomik limit; yalnız oyuncuya checked kanonik delta; mevcut oyuncu0/0 guard'ının kontrollü
genişletilmesi. NPC sabitliği korunmalı; mevcut kaynak kaydı XP veya tamamlanma yetkisi sayılmamalı.
Legacy wrapper cleanup'ı bu işler için önkoşul değildir. Bu PR bu mekanikleri açmaz.

Canlı hedef/history/veri özeti, boş migration ve gerçek provisioning/enrollment/backfill/XP
işlemleri ayrıca kullanıcı onayı gerektirir. Taslak PR merge edilmez, oyun yayımlanmaz.
