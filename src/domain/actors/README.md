# A1 — saf actor domain doğrulayıcısı

Bu dizin ilk **gerçek kod** dilimidir. Tercih kaynağı: [PR #17](https://github.com/oklukk/apartman-online/pull/17), belge commit'i `30a3df7`. Kod PR'ı inceleme farkını küçük tutmak için PR #17 belge dalını temel alır; iki PR da taslak kalır, otomatik merge/yayın yoktur. Belge PR'ı birleşirse kod PR'ının hedef dalı ayrıca gözden geçirilmelidir.

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

Sonuç `ok:true` olsa bile migration, backfill, seed, gerçek oyuncu/bot/konut oluşturma veya yayın izni çıkmaz. Bu PR'da bunları yapabilen fonksiyon, script, trigger veya komut yoktur. Dairesiz personel/actor'sız oyuncu için mevcut oyun ve güvenlik erişimi değişmez. İleri Düzey Öğreticilik mevcut `advanced_teaching` alanıdır, yeni beşinci skill değildir.

Kimlikler bu saf katmanda boş olmayan, kırpılmamış ve en çok100 karakterlik opaque referanslardır; DB UUID/FK denetimi olduğu iddia edilmez. Gerçek deployment politika sürümü, NPC ad/UUID/konut ataması, XP eğrisi ve öğrenim kapasitesi hâlâ ayrı iş/inceleme gerektirir.

## Test ve yalıtım

`tests/a1-actor-domain.test.mjs` yalnız in-memory fixture üretir; fixture ID ve isimleri gerçek kayıt veya provisioning dosyası değildir. Yeni başlangıç sınırları, kötü veri, kimlik/konut/nüfus tekrarı, eğitmen kapsaması, öğreticilik istisnası, özel ders/profesör sınırları, seviye0 beyanı, çoklu işletme ve sabit snapshot; deep-freeze/determinism ve IO/import yalıtımı kontrol edilir.

```sh
npm test
npm run test:ui
npm run build
```

Strict TypeScript build yeni dosyayı denetler; Vite giriş grafiği onu import etmediği için oyuncuya yeni bundle/ekran gönderilmez. PR #17 belge dalındaki üretim build dosyalarının SHA-256 değerleriyle bu dalın build'i ayrıca karşılaştırılır. Gerçek sonuçlar kod PR'ı açıklamasındadır.

Yeni PostgreSQL/RLS veya Auth/MFA/Realtime kabulü yapılmış değildir. Eski CI dört disposable PostgreSQL paketini regresyon olarak çalıştırır. Sonraki A1 DB dilimi ayrı migration ve gerçek PostgreSQL testleri ister. Geri alma yalnız bu üç yeni dosyayı geri almaktır; eski uygulama veya DB rollback gerekmez.

Yerel teslim doğrulaması: `npm test` **77/77** (55 mevcut + 22 yeni grup), `test:ui` ve strict `build` başarılı. Ek rol/alan matrisi; gerekli yeteneklerin eksik veya yanlış seviyede olması, gerekçesiz ek yetenekler (0/3/4/10), bilinmeyen alanlar, geçersiz önceki snapshot ve çok alanlı öğretim görevlisi regresyonunu kapsar. Belge dalının aynı ortamda alınan build'iyle **30 üretim dosyasının tamamı SHA-256 düzeyinde aynı**; yeni modül oyuncu bundle'ına girmedi. CI sonucu ve kalan sınırlar kod PR'ı açıklamasında raporlanır.
