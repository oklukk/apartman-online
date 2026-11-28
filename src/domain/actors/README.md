# A1 — saf actor domain doğrulayıcısı

Bu dizin ilk **gerçek kod** diliminden gelen saf doğrulayıcıdır. Tercih kaynağı [PR #17](https://github.com/oklukk/apartman-online/pull/17); PR #18'de başlayan kod ve A1 kalıcılık dilimleri artık birleşmiştir. [A2-1b](../../../docs/game-systems-stage1/A2_1B_NPC_CATALOG.md) katalog uyarlaması bu modülün uygulamadan yalıtımını korur; canlı işlem veya otomatik yayın izni vermez.

Fonksiyonların son isteğe bağlı `catalogCodes` parametresi, dört başlangıç alanını içeren tekil/geçerli kod snapshot'ıdır. Varsayılan `SKILLS` ilk dört alan olarak kalır; `InitialSkill` oyuncunun dört0/XP0 başlangıcını ayırır. Açık katalog verilirse yeni NPC alanları aynı sabit seviye kurallarıyla doğrulanır. Snapshot, DB'de varlık/etkinlik/öğretilebilirlik veya caller yetkisi kanıtı değildir. Manifest sıra/eşitlik denetimi PostgreSQL onay kaydında kalır; saf karşılaştırma girdiyi sıralayıp değiştirmez.

## Ne yapar?

`index.ts` hiçbir modül import etmez. Yalnız JSON benzeri candidate veriyi inceler, `{ok, issues}` döndürür. Aktör/ID üretmez, planı normalize edip kopya aktör listesi döndürmez, girdiyi değiştirmez. Ağ, Supabase, Auth, DB, storage, cron, saat veya rastgele sayı kullanmaz. Mevcut oyun hiçbir yerde bu modülü çağırmaz.

- `validateInitialActorPlan`: genel **başlangıç** planı. Player actor bir mevcut sakin profil referansına bire bir bağlanır; dört skill tam olarak seviye0/XP0'dır. Eski meslek veya aktivite veri kaynağı değildir. Oyuncu ilerlemesini bu fonksiyona verip sıfırlamak yasaktır; A2 ilerleme ayrı konudur.
- NPC binası/konutu insan kayıtlarından ayrıdır. Tam ve benzersiz konut planı, tek bot/konut, nüfus≤tavan ve nüfus≤konut, actor kimliği tekilliği kontrol edilir. Bilinmeyen Auth/üyelik/XP/rol alanları bot tanımına alınmaz.
- Bot alan öğretim görevlisi Temel5/İleri3/alan6; Temel veya İleri Öğreticilik'i öğretirken alan6 önceliği vardır. Çok alanlı öğretim görevlisinin bildirdiği her ders alanı6 olabilir. Çalışan yalnız tek `field` meslek yeteneği3; işletmeci yalnız `field`4 ve İşletmecilik4 taşır (alan İşletmecilik ise tek kayıt). Bu iki rolde başka yetenek alanları, seviye0 bildirimi dâhil, reddedilir; bilinmeyen alanlar da kabul edilmez. Yeni ihtiyaçlar açık model/politika değişikliği gerektirir. Pilot yalnız iki ayrı alan öğretim görevlisini kabul eder.
- Her aktif alanın yeterli NPC eğitmen kapsaması ve seviye0 giriş yolu **beyanı** gerekir. Bu beyan gerçek bir kursu/öğrenci erişimini kanıtlamaz veya açmaz. Dört başlangıç skill'i ile ilk aktif iki alan farklıdır; pasif öğreticilik alanları gelecekte açılırken de seviye0 yolu gerekir.
- Atama, var olan sabit bot kimliğine ve uygun alana referans verir. Aynı bot farklı işletmelerde kullanılabilir; yeni NPC/konut oluşmaz. Bot/işletme/meslek-alan tekrarları reddedilir. Bu inceleme gerçek business FK/yetkisi, insan-bot çalışma süresi, bordro veya istihdam sistemi değildir; C aşaması gerekir.
- `validatePreferredPilot`: genel kurallara ek olarak tercih edilen **tek NPC binası/12 konut, N=P=2, ayrı Tesisat6 ve İşletmecilik6 öğretim görevlileri**. Tavan2 kalıcı dünya sınırı değildir; genel validator farklı açık tavanlı gelecekteki planları kabul edebilir. `PREFERRED_PILOT` yalnız donmuş politika değerleridir; bot ad/UUID/ev eşlemesi veya seed manifest'i içermez.
- `validateFixedBotProfileChange`: önceki/sonraki sabit profilin aynı olduğunu kontrol eder; isim/konut/meslek/alan ve ek yetenekler dâhil. Eksik yetenek0 sayılmaz. Veri sırası değişebilir, değerler değişemez. Bu, gelecekteki kontrollü NPC düzenleme/versiyonlama politikasının yerine geçmez.
- `meetsTeachingRequirements`: özel öğretmen **Temel≥5/alan≥5**, genel İleri şartı yok; üniversite öğretim görevlisi **Temel≥5/İleri≥3/alan≥6**; profesör **Temel10/İleri≥5/alan≥6**. Öğretilen alan İleri ise özel öğretmenin alan≥5 şartı o alana uygulanır. Verimlilik, XP ve ders/öğrenci kapasite formülü yoktur.

## Önemli güven ve onay sınırı

Saf doğrulayıcı **güvenlik veya canlı kurulum otoritesi değildir**. Girdi sakin/profile/business referansları çağıranın aday snapshot'ıdır; veritabanında varlık/üyelik/sahiplik/rol/ban doğrulaması yapmaz. İstemcinin kendi gönderdiği snapshot'ı doğrulaması yetki oluşturamaz. Gelecekte server, gerçek veriyi okuyup RLS/GRANT/constraint ve checked işlemlerle tekrar denetlemelidir. Önceki bot profili de güvenilir store'dan alınmalıdır; client'ın verdiği `previous` güncelleme yetkisi değildir.

Sonuç `ok:true` olsa bile migration, backfill, seed, gerçek oyuncu/bot/konut oluşturma veya yayın izni çıkmaz. Bu saf modül bu işlemleri yapan fonksiyon/script içermez; SQL katmanındaki kapalı oluşturma işlemleri ayrı teknik belgelerde açıklanır. Dairesiz personel/actor'sız oyuncu için mevcut oyun ve güvenlik erişimi değişmez. İleri Düzey Öğreticilik mevcut `advanced_teaching` alanıdır, ayrı bir yeni skill değildir.

Kimlikler bu saf katmanda boş olmayan, kırpılmamış ve en çok100 karakterlik opaque referanslardır; DB UUID/FK denetimi olduğu iddia edilmez. Gerçek deployment politika sürümü, NPC ad/UUID/konut ataması, XP eğrisi ve öğrenim kapasitesi hâlâ ayrı iş/inceleme gerektirir.

## Test ve yalıtım

`tests/a1-actor-domain.test.mjs` yalnız in-memory fixture üretir; fixture ID ve isimleri gerçek kayıt veya provisioning dosyası değildir. Yeni başlangıç sınırları, kötü veri, kimlik/konut/nüfus tekrarı, eğitmen kapsaması, öğreticilik istisnası, özel ders/profesör sınırları, seviye0 beyanı, çoklu işletme ve sabit snapshot; deep-freeze/determinism ve IO/import yalıtımı kontrol edilir.

```sh
npm test
npm run test:ui
npm run build
```

Strict TypeScript build yeni dosyayı denetler; Vite giriş grafiği onu import etmediği için oyuncuya yeni bundle/ekran gönderilmez. PR #17 belge dalındaki üretim build dosyalarının SHA-256 değerleriyle bu dalın build'i ayrıca karşılaştırılır. Gerçek sonuçlar kod PR'ı açıklamasındadır.

Saf testler PostgreSQL/RLS veya Auth/MFA/Realtime kabulü değildir. Güncel CI ayrı disposable PostgreSQL paketlerini de çalıştırır; [kalıcılık](../../../docs/game-systems-stage1/A1_PERSISTENCE.md) ve [NPC katalog geçişi](../../../docs/game-systems-stage1/A2_1B_NPC_CATALOG.md) ilgili SQL kanıtlarını ve geri alma sınırını açıklar. Bu modül kendi başına uygulama/DB'ye bağlanmaz.

Yerel teslim doğrulaması: `npm test` **81/81** (55 önceki + 22 A1 + 4 katalog grubu), `test:ui` ve strict `build` başarılı. Rol/alan matrisi; gerekli/ilgili sabitler, gerekçesiz ek yetenekler, geçersiz snapshot, çok alanlı öğreticilik ve beşinci katalog alanını kapsar. **30 üretim dosyası SHA-256 düzeyinde önceki baseline ile aynı**; modül oyuncu bundle'ına girmedi. CI sonucu ve kalan sınırlar kod PR'ı açıklamasındadır.
