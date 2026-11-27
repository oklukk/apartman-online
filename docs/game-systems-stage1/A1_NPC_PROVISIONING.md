# A1 — kontrollü NPC oluşturma altyapısı

Başlangıç `main/22286a302efdc54a42bdc2e3e8d8fde2711ccfd9` (PR #20 birleşmiş).
Önceki [kalıcılık](A1_PERSISTENCE.md), [oyuncu oluşturma](A1_PLAYER_ACTORS.md) ve
[D01/D04](A1_DECISIONS.md) sözleşmeleri korunur. Bu PR **altyapı ve disposable testtir**;
canlıya bağlanmaz, gerçek dünya/plan/NPC/konut veya operasyon manifest'i üretmez.

## Kayıt ve onay zinciri

CLI help incelenerek `migration new a1_controlled_npc_provisioning` ile tek eklemeli
[`20261127194945_a1_controlled_npc_provisioning.sql`](../../supabase/migrations/20261127194945_a1_controlled_npc_provisioning.sql)
oluşturuldu. Önceki dokuz SQL dosyası değişmez. Migration yalnız beş boş tablo, kapalı işlevler
ve NPC bütünlük trigger'ları tanımlar; veri INSERT'i çalıştırmaz, cron/Auth/join veya frontend'e bağlanmaz.

| Yeni `private` tablo | Amaç |
| --- | --- |
| `npc_worlds` | Kararlı UNIQUE dünya kodu, açık pilot/world modu, ortak nüfus tavanı, onay referansı/gerekçesi ve DB oturumu/zamanı |
| `npc_plan_approvals` | Dünya+koda bağlı değişmez JSONB plan snapshot'ı, onay referansı/gerekçesi; kapsam FK ile dünya moduna bağlı |
| `npc_plan_bindings` | Bir onayın tek kalıcı nüfus planına ve dünyaya bağı; plan FK'si transaction sonunda denetlenir |
| `npc_building_keys` | Dünya+kalıcı bina anahtarı → tek NPC binası; plan/bina composite FK |
| `npc_actor_keys` | Dünya+kalıcı NPC anahtarı → tek bot profili; farklı planda aynı anahtar veya actor yeniden kullanılamaz |

Kanonik isim/rol/konut `bot_profiles`, skill değerleri yalnız `actor_skills` içinde kalır.
Onay JSON'u bir **değişmez tasarım snapshot'ıdır**, ikinci bir güncellenebilir yetenek bakiyesi değildir.
Normalleştirilmiş DB değerlerinin snapshot ile aynı olması ayrıca SQL'de denetlenir.

Üç owner-only adım: `register_npc_world` → `approve_npc_plan` → `provision_npc_plan`.
İlk ikisi NPC oluşturmaz. Sonuncusu yalnız kalıcı onay UUID'sini alır; çağrı sırasında farklı
isim/skill/konut gönderilemez. Yanıt plan/dünya/onay ID'leri ile bina+konut ve bot anahtar→ID
eşlemeleridir. Tamamlanmış plan tekrarlanırsa aynı kayıtlar döner, veri/hash değişmez.

Plan girdisi yalnız `code`, `scope`, `population_limit`, `required_teaching_fields`, `buildings`,
`bots` alanlarını taşır. Bina anahtar/ad/kapasite; bot anahtar/ad/bina anahtarı/konut numarası/rol/
alan/öğretim alanları/sabit seviyeler içerir. UUID, Auth/profile ID, XP, işletme veya ödül alanı
kabul edilmez. İsim, anahtar, konut ve içerik değişikliği eski onay anahtarıyla tekrar kullanılamaz.
JSON nesne anahtar sırası önemsizdir; dizi sırası da snapshot'ın parçasıdır, sessizce normalize edilmez.

`approval_ref`/gerekçe ve `session_user`/zamanı teknik operasyon izidir; bunlar insanın dışarıda
verdiği canlı onayı kendiliğinden doğrulamaz. Repository'deki örnek/test değeri canlı yetki değildir.
Gerçek dünya kodu, isimler, kalıcı anahtarlar ve konut eşlemesi henüz seçilmemiştir. Gerçek ID'ler
ancak ayrıca onaylanan oluşturma transaction'ında üretilir; bu PR'da canlı manifest dosyası yoktur.

## Dünya bütçesi ve tek pilot

Pilot dünyası `mode=pilot`, bütçe2; aynı dünyada hem onayda hem plan bağında **tek pilot** UNIQUE
partial index ile korunur. Aktif/pasif değiştirerek pilot yuvası veya bütçe sıfırlama yolu yoktur.
Yeni onay başka dünya oluşturamaz; önceden ayrı onayla kayıtlı bir dünya ID'sine bağlanır.
Farklı kod vererek aynı dünyada ikinci pilot açmak mümkün değildir.

Gelecek `mode=world` dünyası ayrı açık bütçe taşıyabilir ve birden çok dünya planı barındırabilir.
O dünyadaki **bütün bağlı planların toplam bot sayısı** ortak tavanla karşılaştırılır. Yeni plan
bütçeyi yenilemez. Onay aşaması nüfus rezervasyonu yapmaz; iki onay tek kalan hakkı istiyorsa
oluşturma aşamasında yalnız biri tamamlanır. Tavan2 bütün oyun/dünyalar için kalıcı sınır değildir.
Yeni gerçek şehir/dünya kaydı ayrıca onay gerektirir; mevcut dünyanın bütçesini aşmak için
başka kodla sahte dünya açmak izinli bir operasyon sayılmaz.

Her NPC çocuk INSERT'i, eski actor/plan kilitlerinden **önce** ortak dünya satırının
`guard_revision` alanını atomik artırır. Bu yalnız snapshot/kilitleme çitidir, nüfus veya para
bakiyesi değildir. Sıra dünya → actor → NPC planıdır; insan bina/cüzdan kilitlerine girilmez.
Kasıtlı eski REPEATABLE READ snapshot'ında `40001` alınır: bütün transaction sınırlı retry ile
yeniden başlatılmalıdır. Çok dünyalı gelecekteki batch'ler dünya kilitlerini kararlı sırada almalıdır.

Yeni NPC tablo yazmaları da onay bağı ister; yalnız oluşturucu fonksiyonun sayımına güvenilmez.
Deferred constraint'ler onay snapshot'ı, tam konut planı, tek konut/profil, sabit skill, anahtar
eşleşmesi ve dünya toplamını COMMIT'te denetler. Fonksiyonun ön denetimleri bu bağımsız SQL
kontrolünü kaldırmaz. Kısmi skill/bina/bağ, geç COMMIT hatası veya rollback her şeyi geri alır.

Önceden oluşturulmuş dünya/onay bağı olmayan NPC planları migration tarafından taşınmaz veya
silinmez. Varsa yeni kayıt/onay/oluşturma **fail closed** olur; bunları görmezden gelerek yeni
dünya bütçesi başlatılamaz. Ayrı envanter ve onaylı adoption/geçiş tasarımı gerekir.

## Pilot ve eğitmen kapsaması

Pilot onayı tam olarak tek12 konutlu bina, iki ayrı konutta Tesisatçılık6 ve İşletmecilik6
öğretim görevlisi ister; ikisinde Temel5/İleri3. Çalışan yalnız alan3, işletmeci yalnız ilgili4
ve İşletmecilik4 standardını korur. Çok alanlı öğretim görevlisi desteklenir; Temel/İleri alanını
öğretiyorsa ilgili alan6 önceliği korunur. Gerekçesiz ek skill ve bot XP'si kabul edilmez.

`required_teaching_fields` planın **kapsama gereksinimidir**, kursları etkinleştirmez. Onayda
manifest kapsaması, oluşturmada gerçek kanonik DB seviyeleri denetlenir.
`npc_assert_teaching_coverage(plan_id, alanlar)` gelecekte eğitim etkinleştirmesi için tekrar
çağrılabilecek kapalı bir denetimdir: her alanda tanımlı öğretim görevlisi, alan≥6/Temel≥5/İleri≥3
ister. Eksik alan otomatik NPC üretmez. Ders/öğrenci kapasitesi, üniversite, kurs, XP veya ücret yoktur.

İşletme ataması bu PR'da oluşturulmaz. Gelecekte aynı NPC'nin farklı işletmelerde çalışması
mevcut `npc_actor_keys.actor_id` referansını kullanmalı; yeni plan/actor/konut üretmemelidir.

## Yetki ve veri koruma

Yeni tablolar RLS/default-deny; PUBLIC/anon/authenticated/service_role için SELECT/DML/TRUNCATE
ve internal EXECUTE kapalıdır. Bütün yeni fonksiyonlar SECURITY INVOKER ve boş search_path
kullanır; dışa açılabilecek kapalı operasyon girişlerinde ayrıca `current_user=postgres` kontrolü
vardır. Public RPC wrapper yoktur. Oyuncu, Moderatör, Yönetici veya Süper Yönetici bu PR ile
NPC yetkisi kazanmaz. DB sahibi ayrı güven sınırıdır; kötü niyetli superuser'a karşı koruma iddiası yoktur.

Eski insan Auth/profil/üyelik/daire/cüzdan, maaş/aidat/seçim/oy/görev, RBAC, sohbet ve player skill
değerleri değiştirilmez. Migration öncesi/sonrası bütün eski satır sayısı/hash'leri, mevcut RPC/ACL/
RLS, eski trigger tanımları ve cron/publication aynı kaldı. NPC tablolarına yeni bütünlük
trigger'ları eklendi. Testte gerçek oyuncu alanlarıyla botların karışmadığı ve insan seçimlerine
erişim kazanamadığı ayrıca doğrulandı. Eski plan/bot kayıtlarının değişmezliği korunur; otomatik
retire, budget release, onay iptali veya silme yolu eklenmez.

## Test, riskler ve onay kapıları

`tests/a1-npc-provisioning.mjs` yalnız sabit localhost55432 üzerinde kendi disposable DB'sini
oluşturup kaldırır. Bellekteki Fixture isim/anahtarları ve DB'nin test sırasında ürettiği ID'ler
canlı manifest değildir. Yeni paket15 gerçek PostgreSQL grubu içerir: onay/replay, hatalı plan,
doğrudan DML, ortak bütçe/tek pilot/kalıcı anahtar, çok alanlı öğretim, RC/RR ve farklı plan
yarışları, INSERT/COMMIT/rollback hataları, yetki/RLS ve eski veri koruması. Doğrudan INSERT'ler
tamamlandıktan sonra COMMIT'te onay ve ortak bütçe reddi özellikle kanıtlandı. SQL pilot sonucu
mevcut saf `validatePreferredPilot` ile de kontrol edildi; bu DB güvenlik sınırının yerine geçmez.

Yerel sonuç: `npm test`77/77; UI SSR/build başarılı; PostgreSQL `test:sql`11, `test:v02`24,
`test:rbac`14, `test:advanced`15, `test:a1`15, `test:a1-player`11, `test:a1-npc`15 grup başarılı.
`test:db`, tam yerel Supabase stack / `work/local-status.json` bulunmadığından ENOENT verdi.
Gerçek Auth HTTP/MFA/Realtime ve gerçek pg_cron yürütmesi **test edilmedi**; Auth/JWT/MFA tabloları
ile cron kayıt stub'ı kullanıldı. Yeni Chromium testi yok; frontend değişmez. CI kanıtı PR'dadır.

Kalan sınırlar: dünya büyütme/mode geçişi, legacy plan adoption'ı ve NPC emekliliği ayrı tasarım
ister. Büyük manifestlerde deferred tamlık taramaları ek maliyet getirir; büyük ölçekli rollout
öncesi batch büyüklüğü, maliyet ve lock süresi ayrıca ölçülmelidir. Aynı anda farklı NPC planı
onaylamak bütçe rezervasyonu garantisi vermez. Onay revizyonu/silme yerine ileri sürümlü kontrollü
geçiş seçilmelidir; tek pilot kuralı geçici pasifleştirmeyle aşılamaz.

İleride sırasıyla: PR/code onayı → hedef/history/veri özetiyle **boş migration onayı** → gerçek
dünya kodu/bütçesi ve plan içeriği (isim/anahtar/konut/alan kapsaması) için **ayrı onay** → owner
işlemi ve aynı kimliklerle replay/veri özeti doğrulaması. Eğitim/API/işletme entegrasyonu, oyuncu
backfill'i, merge ve yayın ayrı görev/onaydır. Bu adımların hiçbiri burada uygulanmaz.

Canlıya uygulanmadığından geri alma commit revert'idir. Sonradan veri oluşursa yazmaları kapatıp
kimlik/konut/skill ve onay geçmişini koruyan ileri düzeltme yapılmalı; kayıt silerek bütçeyi
yenileme, otomatik down/TRUNCATE/DROP CASCADE kullanılmamalıdır.
