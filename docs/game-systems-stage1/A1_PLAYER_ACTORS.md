# A1 — kapalı oyuncu aktörü oluşturma altyapısı

Başlangıç: PR #19'un birleştiği `main/8ed8d47318f07f53c567b53978437642d07d4e08`.
[A1 kalıcılığı](A1_PERSISTENCE.md), [D01/D04](A1_DECISIONS.md) ve mevcut saf domain sözleşmesi korunur.
Bu PR gerçek oyuncuları kaydetmez: yalnız fonksiyon tanımı ve disposable testlerdir.

## Sözleşme ve güven sınırı

CLI help incelenip `supabase migration new a1_player_actor_provisioning` ile oluşturulan tek yeni dosya:
[`20261127193345_a1_player_actor_provisioning.sql`](../../supabase/migrations/20261127193345_a1_player_actor_provisioning.sql).
Önceki **sekiz** migration değişmez. Yeni migration veri yazmaz; çağrı, cron, Auth/join trigger'ı,
public RPC wrapper veya frontend entegrasyonu eklemez.

`private.ensure_player_actor(target_profile uuid) → uuid`, yalnız `postgres` için EXECUTE açık,
**SECURITY INVOKER**, boş search_path, VOLATILE bir iç işlemdir. PUBLIC/anon/authenticated/service_role
EXECUTE kapalıdır. Ayrıca `current_user='postgres'` bağımsız kontrol edilir: yanlışlıkla EXECUTE
grant verilmesi dahi oyuncuya owner ayrıcalığı ödünç vermez. Mevcut staff/Süper Yönetici ataması
bu işleme yetki vermez. İstemcide service/secret anahtarı yoktur; yeni sunucu kaynağı kurulmaz.

Hedef UUID güvenilir DB operatörünün parametresidir; istemciden alınan bir yetki iddiası değildir.
Fonksiyon Auth UID'yi hedef kullanıcı gibi ayarlamaz veya JWT metadata'sına güvenmez. Bu bir
oyuncu/staff mutasyon RPC'si olmadığından `assert_player_allowed()` içinde çağıranın UID'sini
hedefle değiştirmek kullanılmaz. Bunun yerine aynı bina ve kullanıcı yaptırım kilitleri altında
hedefin gerçek üyeliği ve mevcut `private.player_blocked(target,false)` kaynağı kontrol edilir.
Banlı hedef reddedilir; susturma tek başına karakter kaydını engellemez. Yeni bir yaptırım kuralı
veya yaptırım kaydı oluşturulmaz.

İleride bunu kullanan oyuncu/personel API'si istenirse **ayrı** inceleme gerekir: checked Auth UID,
gerçek RBAC/kapsam, gerekiyorsa AAL2/gerekçe/audit ve izin iptali yarışları denetlenmeden wrapper
açılamaz. Bu fonksiyona API EXECUTE grant vermek entegrasyon yöntemi değildir. DB sahibi zaten
ham SQL yetkilidir; owner'a karşı güvenlik koruması iddia edilmez. Bu adım yeni bir staff audit
akışı veya gerçek backfill aracı içermez.

## Algoritma, atomiklik ve tekrar

1. NULL hedef reddedilir. `memberships → profiles → auth.users` mevcut FK zinciri gerçek oyuncuyu
   doğrular; bot actor ID'si bir profil/üyelik yerine geçmez. Dairesiz personel de uygun hedef değildir.
2. Önce insan bina satırı, sonra hedef üyelik satırı kilitlenir; üyelik bina eşlemesi yeniden okunur.
   Beklerken değişmişse `40001` ile bütün transaction yeniden denemeye bırakılır. Eski oyun
   satırlarına UPDATE yapılmaz. Sonra mevcut oyuncu yaptırımıyla aynı kullanıcı advisory kilidi alınır.
3. Önceden actor varsa mevcut kimlik ve kanonik tamlığı doğrulanıp **aynı ID** döndürülür.
   Eksik/kötü kaydı onarmaya, eski skill'i sıfırlamaya veya ödül vermeye çalışmaz.
4. İlk çağrıda UNIQUE `profile_id` ile bir player actor ve `actor_skills` tablosunda açık dört
   kod için seviye0/XP0 oluşturulur. Sabit kodlar eski meslek veya enum sırasından türetilmez.
5. DB constraint'lerine ek olarak A1 tamlık denetimi dönüşten önce çalışır. Deferred constraint'ler
   COMMIT'te de bağımsız korur. Fonksiyon içindeki bütün yazmalar aynı transaction'dadır.

`ON CONFLICT DO NOTHING` yalnız başka güvenilir yazıcının yarışını karşılar; UPDATE/upsert ile
skill yenileme yoktur. READ COMMITTED iki istek aynı ID'yi alır. Eski RR snapshot'ı `40001` alırsa
**bütün transaction** geri alınıp sınırlı retry yapılmalıdır; aynı transaction içinde döngüyle
yeniden deneme yapılmaz. Yeni transaction aynı kaydı bulur. Yanıt kaybolduktan sonra tekrar çağrı
kimlik/XP/ödül çoğaltmaz; timeout veya belirsiz ağ sonucu başarı kabul edilmemelidir.

Her profilin tek aktörü olması initialization'ın tekrar anahtarıdır. Ayrı `operation_id`, bir
ödül ledger'ı veya ikinci skill/XP kaynağı eklenmez. Eski cüzdan/maaş/aidat defterleriyle bağlantı
yoktur. A2 ilerleme geldiğinde mevcut A1 tamlık denetimi ayrıca genişletilmelidir; bu işlem
başlangıç değerlerini mevcut actor üzerine hiçbir zaman yeniden yazmamalıdır.

## Apartmandan ayrılma ve hesap silme

- Üyelik kaldırılması aktör/skill'i silmez. Ayrılmış hedef için oluşturucu reddeder; yeniden
  yerleşirse eski actor ID'si döner. Başlangıç yetenekleri veya ekonomik ödüller yenilenmez.
- Eski `public.my_actor()` kendi actor'ünü üyelik olmasa da okuyabilir; bu yeni bir apartman,
  sohbet, oy veya ekonomi yetkisi vermez. Başka kişinin actor'ü açılmaz.
- `actors.profile_id → profiles` bağı **ON DELETE RESTRICT** olduğundan actor sahibi Auth
  hesabını/profilini cascade ile silme girişimi reddedilir. Eski membership/finans FK'leri de
  ayrıca engelleyebilir. Bu PR otomatik silme, arşivleme, anonymization veya FK değişikliği yapmaz.
- Hesap kapatma gerektiğinde hukuki/ürün gereksinimleri, finans geçmişi, kimlik bağı ve yeniden
  kayıt politikası için ayrı veri koruma tasarımı gerekir. Üyeliği kaldırmak actor'ü yeniden
  oluşturma hakkı sağlamaz; güvenilir geçmişi silerek RESTRICT'i aşmak çözüm değildir.

## ENUM ve A2 yetenek kataloğu değerlendirmesi

Mevcut dört kodlu ENUM, kapalı A1 prototipi için tip güvenliği sağlar. Ancak yeni meslek/alan
ekleme **DDL gerektirir**; enum değerine ek olarak TS `SKILLS`, başlangıç listesi, A1 dört-satır
guard'ı, bot alanları/öğretim alanları ve testlerin birlikte sürümlenmesi gerekir. PostgreSQL'de
aynı transaction'da eklenen enum değerini hemen kullanmaya güvenilmemeli; ekleme/kullanım uygun
ayrı migration/commit adımlarıyla planlanmalıdır. Silme/birleştirme enum'da daha da zordur.

**Öneri:** A2 yalnız mevcut dört skill'de XP ilerlemesi yapacaksa enum dönüşümü önkoşul değildir.
Yeni alanların içerik olarak sık eklenmesi, ad/açıklama, öğretilebilirlik, etkinlik ve kaynak
politikası gerekecekse genişlemeden **önce** sürümlü `skill_catalog` ve stable code FK modeli
tasarlanmalıdır. `actor_skills` yine tek değer kaynağı kalmalı; katalog XP bakiyesi tutmamalıdır.
Bot alan/öğretim ilişkileri, başlangıç politika sürümü ve eski kodların korunması da aynı planda
ele alınmalıdır. Bu PR enum'u, skill sayısını veya öğrenim sistemini değiştirmez; katalog şeması
ve seviye/XP formülleri kendiliğinden kesinleştirilmiş değildir.

## NPC pilot tavanının planlar arası riski

Mevcut `population_limit=2` **her pilot planına** aittir. UNIQUE plan kodu farklı kodlarla birden
fazla pilot plan açmayı engellemez; N planı teorik olarak toplam2N NPC'ye izin verebilir. Şu anda
API rollerinin ham yazmaları ve provisioning çağrıları kapalıdır: bu bir oyuncu exploit'i değil,
ilerideki güvenilir provisioning/operasyon sınırı riskidir. Yeni oyuncu oluşturucu NPC planına
dokunmaz; bu riski çözmüş gibi raporlamaz.

Gelecek NPC provisioning PR'ında açık dünya/dağıtım/pilot-batch kimliği, aynı kapsamda tek etkin
pilot kuralı ve bütün planları kapsayan ortak bütçe/tavan seçilmelidir. Toplam tahsis aynı sınır
satırı/lock altında atomik denetlenmeli, yeni plan açmak bütçeyi yenilememelidir. Dünyanın kalıcı
tavanını2'ye sabitlemek doğru değildir. Bu görevde yeni plan, bot, NPC konutu veya seed yoktur.

## Test ve teslim sınırı

[`tests/a1-player-actors.mjs`](../../tests/a1-player-actors.mjs), yalnız sabit localhost55432
üzerinde kendi `apartman_a1_player` DB'sini kurup kaldırır. Uzak URL/env override yoktur. İlk
sekiz migration ve dolu eski fixture'dan sonra yeni migration uygulanır: bütün eski tablo
satır/hash'leri (önceden var olan actor dahil), RPC/GRANT/RLS/trigger ve cron/publication aynı kalır.
Çağrı testlerinde yalnız beklenen player actor/skill satırları eklenir; öteki bütün tabloların
hash'i sabit kalır. Kanonik SQL sonucu gerçek saf TypeScript validator'ıyla da kontrol edilir;
bu eşleşme DB yetki kontrollerinin yerine geçmez.

11 yeni grup: replay/kayıp-yanıt simülasyonu, iki eşzamanlı istek ve eski RR snapshot, yetkisiz
roller/yanlışlıkla EXECUTE grant, ban, skill INSERT sırasında hata, eksik snapshot, COMMIT hatası,
caller rollback, ayrılma/yeniden katılma/hesap silme ve beklerken üyelik silinmesi yarışını kapsar.
Eski A1 testi ilk8 migration'daki tarihsel sınırını korur; yalnız dosya sayısı kontrolü eklemeli
gelecek migration'lara izin verecek şekilde güncellendi. Yeni test CI database işine eklendi;
yayın davranışı değişmedi. Son test/CI sonuçları PR açıklamasındadır.

Yerel sonuçlar: `npm test` **77/77**, `test:ui` ve `build` başarılı; PostgreSQL paketlerinde
`test:sql` **11**, `test:v02` **24**, `test:rbac` **14**, `test:advanced` **15**, `test:a1` **15**,
`test:a1-player` **11** grup başarılı. Sekiz eski migration ve 30 üretim dosyası önceki
baseline ile byte-identical. `test:db` çalıştırıldı ancak `work/local-status.json` bulunmadığı
için ENOENT verdi; gerçek Supabase stack kabulü başarılı sayılmaz.

Gerçek Auth HTTP/MFA/Realtime ve pg_cron yürütmesi test edilmez; UID/JWT/MFA ve cron kayıtları
sentetik fixture/stub'dır. `test:db` için tam yerel Supabase stack gerekir; bulunmazsa engel ayrıca
raporlanır. Gerçek ağ kopması testi yoktur; yalnız COMMIT/rollback ve yanıtı kullanmadan retry
senaryosu simüle edilir. Frontend değişmediği için yeni tarayıcı/görsel kabul iddiası yoktur.

Bu PR ayrı taslakta kalır. Canlı migration, gerçek oyuncu backfill'i, NPC seed'i, entegrasyon,
merge ve yayın **ayrı onay** gerektirir. Henüz canlı uygulanmadığından geri alma PR commit'ini
geri almaktır. İleride actor verisi oluştuysa fonksiyona erişimi kapatıp geçmişi koruyan ileri
düzeltme seçilmeli; actor/skill silerek veya cascade açarak geri dönülmemelidir.
