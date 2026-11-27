# A1 — boş PostgreSQL kalıcılığı ve güvenlik katmanı

Başlangıç: birleşmiş PR #17/#18 ve `main/b1750fc37629f16dc968f20c70b8838e9db7717a`.
Bu dilim **yalnız şema, kapalı yazma sınırı, dar okuma API'si ve disposable testtir**.
Canlı migration, actor/skill backfill, NPC/konut seed'i veya oyun entegrasyonu içermez.
[D01/D04](A1_DECISIONS.md) ve [saf domain modülü](../../src/domain/actors/README.md) referansları korunur.

## Dosyalar ve model

CLI `2.75.0` ile `migration new --help` incelendikten sonra
`supabase migration new a1_actor_persistence` çalıştırıldı:
[`20261127191118_a1_actor_persistence.sql`](../../supabase/migrations/20261127191118_a1_actor_persistence.sql).
Önceki yedi migration değişmez. Migration yalnız yeni nesne oluşturur; hiçbir veri INSERT'i,
Auth/join trigger'ı, backfill, worker veya eski fonksiyonun değiştirilmesi yoktur.

| Yeni tablo (`private`) | Anlamı ve bağımsız SQL denetimi |
| --- | --- |
| `actors` | `player/bot` enum; oyuncuda zorunlu ve UNIQUE `profile_id → public.profiles`; botta NULL. Oyuncu eşlemesi oluşturulurken gerçek üyelik bulunmalı. `(id,kind)` birleşik anahtarı alt tür FK'sini korur. |
| `bot_profiles` | Yalnız bot aktörü; tek profil, sabit isim/rol/alan/öğretim alanları; UNIQUE NPC konutu. Bot için Auth, insan profili, üyelik veya cüzdan oluşturulmaz. |
| `npc_population_plans` | Açık `pilot/world` kapsamı, kararlı UNIQUE kod, sonlu nüfus tavanı. Pilot tavanı2 yalnız ilgili plan içindir; world planları2 ile sınırlanmaz. Yeni plan açmak operasyon onayı değildir. |
| `npc_buildings` | Yalnız NPC planına bağlı bina ve pozitif kapasite. İnsan `buildings` tablosuna bağlanmaz. |
| `npc_homes` | Bina/plan eşleşmesi birleşik FK; UNIQUE bina+numara. Bir binada kapasite kadar eksiksiz, 1..kapasite konut zorunludur. |
| `actor_skills` | **Tek kanonik yetenek saklama yeri**: PK `(actor_id,skill)`, seviye0–10, negatif olmayan tamsayı XP. JSON snapshot veya bot profilinde ikinci seviye/XP kaynağı yoktur. |

Aktör UUID'si Auth UUID'si veya giriş yetkisi değildir. Oyuncu kimliği yalnız doğrulanmış Auth
`auth.uid()` → `profile_id` bağıyla çözülür; actor ID'si mevcut oyun RPC'lerine kimlik olarak taşınmaz.
NPC nüfusu insan doluluk, quorum, maaş veya aidat hesabına katılmaz. Mevcut seçim modellerinin
profil/üyelik/seçmen FK'leri ve checked RPC'leri değişmez.

Profil silme bağı `RESTRICT` seçildi; kimlik/geçmişi sessizce silen cascade yoktur. Migration boşken
mevcut hesaplarda yeni bir silme engeli oluşmaz. İleride actor sahibi hesap silme/arşivleme ve
NPC taşıma/retire politikaları ayrı tasarım ve onay gerektirir; bu PR onları etkinleştirmez.

## Yetenekler ve A2 sınırı

Katalog enum'u: Tesisatçılık, İşletmecilik, Temel Öğreticilik, İleri Öğreticilik.
Bir actor transaction sonunda tam ve tutarlı olmalı:

- Oyuncu: dört ayrı satır, her biri **seviye0/XP0**. Eski meslek/aktivitelerden dönüşüm yoktur.
  Mevcut oyunculara bu migration ile satır oluşturulmaz.
- Çalışan: yalnız meslek alanı **3**. İşletmeci: yalnız ilgili alan **4** ve İşletmecilik **4**;
  alan İşletmecilik ise tek satır yeterlidir. Ek yetenekler0 dahi olsa reddedilir.
- Öğretim görevlisi: bildirilen her ders alanı **6**, Temel **5**, İleri **3**.
  Öğretilen alan Temel/İleri ise o alanda6 önceliklidir. Çok alanlı öğretim desteklenir.
  SQL ayrıca yalnız bildirilen ders alanları ve pedagojik alanları saklar; saf validator'ın
  kabul edebildiği ders dışı ek lecturer alanları DB'ye alınmaz. Bu kasıtlı daraltma
  TypeScript doğrulamasının DB yetkisi olmadığını da gösterir.
- Bot XP'si0'dır. Bütün sabit kimlik/profil/konut/skill UPDATE/DELETE'leri kapalıdır.

XP sütunu A2 için ayrılmış değerdir; semantiği/eğri veya seviye türetme formülü seçilmemiştir.
Üst sınır `9007199254740991` tamsayıdır; JS güvenli tamsayı sınırını aşmaz. A2, bu tabloyu
kullanacak; kaynak/idempotency kaydı ve checked ilerleme işlemi ekleyecek, oyuncu guard'ını
yeni migration ile kontrollü değiştirecektir. İkinci XP bakiyesi oluşturmayacak, botların
sabitliğini koruyacak ve skill initialization'ı yeniden ücretsiz grant'e çevirmeyecektir.

Pilot şema kuralı: tek12 konutlu NPC binası; en çok iki ayrı Tesisat/İşletmecilik öğretim görevlisi.
Eksik nüfus otomatik tamamlanmaz. Boş/henüz dolmamış plan kurs açıldığı anlamına gelmez.
Aktif öğretilebilir alan/kurs/öğrenci kapasitesi A3'e aittir; bu şema ders etkinleştirmez.
Gerçek pilot provisioning ayrı incelenirse iki kişinin tam kapsaması ve seviye0 giriş yolu
ayrıca doğrulanmalıdır. NPC isim/UUID/konut manifest'i veya provisioning script'i teslim edilmez.

## Atomiklik ve eşzamanlılık

FK/UNIQUE/CHECK yanında transaction sonundaki deferred constraint trigger'ları actor profil/skill
tamlığını, konut kapasitesini ve nüfus tavanını bağımsız doğrular. Yarım actor veya eksik konutlu
bina COMMIT edilemez. Yetkili gelecekteki kurulum, ilgili bütünü tek transaction'da oluşturmalıdır;
`SET CONSTRAINTS ALL IMMEDIATE` tamamlanan bütünün sonunda erken doğrulama için kullanılabilir.

Yeni actor ve NPC planındaki `guard_revision` yalnız kilitleme/snapshot çitidir; ekonomik bakiye
veya nüfus sayacı değildir. Çocuk INSERT'i üst satırın revizyonunu atomik artırır; aynı actor/plan
yazmaları sıralanır. `REPEATABLE READ` eski snapshot ile ikinci tahsis denediğinde gerçek satır
güncellemesi `40001` üretir; yalnız advisory/row lock ile eski sayımın kullanılmasına güvenilmez.
Kilit sırası bot yazmalarında yeni actor → yeni NPC planıdır; eski bina/cüzdan/cron kilitlerine
girilmez. COMMIT reddinde actor, profil, skill ve revizyon değişimleri birlikte geri alınır.
Gelecekteki provisioning bütün transaction'ı sınırlı retry ile ele almalı, kısmi adımları tekrarlamamalıdır.

## Erişim matrisi

Altı tablonun tamamında RLS açık, okuma/yazma politikası yok: **default deny**.
PUBLIC/anon/authenticated/service_role için açık ALL REVOKE vardır; özel türlerin USAGE'ı ve
internal fonksiyonların EXECUTE yetkileri de kapalıdır. PostgreSQL sahibi ayrı güven sınırıdır;
DB sahibine karşı RLS koruması iddia edilmez. Yeni provisioning/mutasyon RPC'si yoktur.

| Çağıran | Ham tablolar / internal fonksiyonlar | `public.my_actor()` |
| --- | --- | --- |
| Anon | Yasak | EXECUTE yok |
| Normal oyuncu | Yasak | Yalnız kendi oyuncu actor'ü; yoksa NULL |
| Dairesiz veya daireli personel / Süper Yönetici | Yasak; eski staff yetkileri yeni DML izni vermez | Kendi actor'ü veya NULL; başka oyuncu bilgisi yok |
| Aktif banlı hesap | Yasak | Mevcut yaptırım kaynağından ret |
| service_role | Yeni tablolara/fonksiyonlara açık grant yok | EXECUTE yok; istemciye hiçbir secret aktarılmaz |

Public RPC SECURITY INVOKER wrapper'dır; dar `private.my_actor()` SECURITY DEFINER işlevi
boş search_path, zorunlu Auth UID ve mevcut ban denetimiyle çalışır. Hedef ID parametresi yoktur;
yanıt yalnız `id`, `kind`, `skills.{code}.{level,xp}` alanlarını içerir. Personel rolü, e-posta,
MFA, bakiye, borç, yaptırım veya başka kişi/NPC profili döndürmez. Yeni fonksiyon UI'dan çağrılmaz.
Gelecekteki bütün yazma yolları checked sunucu yetkisi, idempotency ve uygun audit gerektirecektir;
client'ın `validateInitialActorPlan(...).ok` sonucuna asla güvenilemez.

## Gerçek test kapsamı ve koruma kanıtı

[`tests/a1-persistence.mjs`](../../tests/a1-persistence.mjs), yalnız sabit
`127.0.0.1:55432` üzerinde kendi `apartman_a1` DB'sini CREATE eder; var olan DB'yi silip
yeniden kullanmaz. Test bitiminde yalnız oluşturduğu DB'yi kaldırır. Çevre değişkeni/uzak URL
override yoktur. Test içinde üretilen sentetik actor/NPC/konutlar gerçek seed değildir.

Yedi eski migration uygulanır ve Auth/profil, üyelik, mesaj, meslek/cüzdan/defter, aidat,
anket/oy, seçim/seçmen/aday/oy, görev ve MFA/personel yetkisi içeren eski fixture oluşturulur.
A1 uygulanmadan önce **bütün eski public/private/auth/cron tablolarının satır sayısı ve sıralı
satır hash'i**, eski fonksiyon gövdeleri/ACL/search_path, RLS politikaları, tablo yetkileri,
trigger'lar ve Realtime publication üyelikleri alınır. A1 sonrasında aynı kaldıkları doğrulanır;
altı yeni tablo sıfır satırdır. NPC test yazmaları için ayrı bir koruma aralığı da karşılaştırılır.

15 A1 test grubu; çift oyuncu actor'ü, eksik profil/skill, türler arası FK, çift konut,
nüfus/kapasite sınırı, pilot/world ayrımı, sabit botlar, çok alanlı öğretim, DML/RLS/EXECUTE
matrisi, kendi dar okuması, ban ve insan seçimine bot erişimini kapsar. Nüfus/konut yarışlarında
iki transaction ve kasıtlı eski RR snapshot kullanılır. Yanlışlıkla SELECT grant verilse bile
RLS'nin bütün ham satırları kapalı tuttuğu ayrıca sınanır. Yeni kayıt/taşınmanın actor yaratmadan
çalıştığı ve cüzdan–defter mutabakatı da doğrulanır.

| Komut | Yerel sonuç |
| --- | --- |
| `npm test` | 77/77 başarılı (mevcut saf domain ve kaynak testleri) |
| `npm run test:ui` | Mevcut React SSR testi başarılı |
| `npm run build` | Strict TypeScript + Vite başarılı |
| `npm run test:sql` | 11 PostgreSQL grubu başarılı |
| `npm run test:v02` | 24 PostgreSQL grubu başarılı |
| `npm run test:rbac` | 14 PostgreSQL grubu başarılı |
| `npm run test:advanced` | 15 PostgreSQL grubu başarılı; yeni migration da yüklenir |
| `npm run test:a1` | 15 yeni PostgreSQL grubu başarılı; CI database işine eklendi |
| `npm run test:db` | **Çalıştırılamadı:** `work/local-status.json` / tam disposable Supabase stack bulunmuyor |

PostgreSQL17 ve Auth UID/JWT/MFA tablo fixture'ı kullanıldı. `cron.schedule` test stub'ı yalnız
iki eski görev kaydını tutar; gerçek pg_cron scheduler çalıştırılmaz. Gerçek HTTP kayıt/oturum,
MFA töreni, Realtime teslimatı veya Supabase API/advisor kabulü yapıldığı iddia edilmez.
Frontend değişmediğinden yeni Chromium/screenshot teslimi yoktur. CI ve commit kanıtları PR'dadır.

## Onay kapıları ve geri alma

Bu PR **taslak**; otomatik merge veya yayın yok. Testlerin geçmesi aşağıdakileri yetkilendirmez:

1. Canlı boş migration: hedef proje/history, yeni SQL ve mevcut veri özeti için ayrı onay.
2. Gerçek oyuncu actor/skill initialization/backfill: kapsam, tekrar güvenliği ve kaynak kaydı için ayrı onay.
3. NPC plan/bina/konut/iki öğretim görevlisi provisioning'i: isim/UUID/eşleme ve tam kapsama için ayrı seed onayı.
4. Eğitim, XP veya başka oyun aktivasyonu: ayrı geliştirme/inceleme/onay.

Henüz canlıya uygulanmadığı için geri alma PR commit'ini geri almaktır. Gelecekte boş şema
uygulanırsa önce erişimi kapatıp veri olup olmadığını ve yeni bağımlılıkları incele; otomatik
down migration/TRUNCATE/DROP CASCADE yoktur. Veri oluşmuşsa kimlik/geçmişi silerek geri dönmek
yerine yazmaları durdurup ileri düzeltme yapılmalıdır. Eski maaş/aidat/seçim/kasa worker'ları
hiçbir rollout veya geri alma adımında yeniden çalıştırılmaz ya da zamanları değiştirilmez.
