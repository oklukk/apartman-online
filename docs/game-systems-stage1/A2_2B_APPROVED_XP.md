# A2-2b — Onaylı sayılar, kapalı XP ve seviye ilerleme temeli

Bu dilim, PR #25 sonrası `97057c0fa7fb706739ec6532a184cf1dc3e41e86` main tabanından gelir. A2-2/B+S araştırması tarihsel kayıttır; aşağıdaki **açık kullanıcı onayı** yalnız belirtilen sayıları kesinleştirir. Diğer simülasyon varsayımları oyun kuralı değildir.

## Onaylanan politika

| Hedef seviye | Ek XP | Birikimli XP |
|---|---:|---:|
|1|20|20|
|2|40|60|
|3|80|140|
|4|120|260|
|5|180|440|
|6|260|700|
|7|380|1080|
|8|560|1640|
|9|800|2440|
|10|1100|3540|

| Faaliyet | XP | Bu PR'daki gerçek erişim |
|---|---:|---|
|İlk yönlendirme|12|Yalnız ayrı sentetik tamamlanma fixture'ı; gerçek içerik yok|
|Başlangıç modülü|32|Her alanda yalnız mevcut üç farklı kararlı modül; gerçek yayın yok|
|Kurs/eğitim modülü|24|Değer kayıtlı; gerçek kurs veya doğrulama adaptörü yok|
|Kitap bölümü|8|Değer kayıtlı; gerçek kitap/okuma mekanizması yok|
|Doğrulanmış uygulama|18|Yalnız farklı sentetik tamamlanmalar; gerçek talep/uygulama yok|

- Oyuncu genel günlük XP110; yetenek başına günlük XP70.
- Yetenek başına günlük uygulama2, Türkiye haftasında7; pazartesi1, salı2, … pazar7 birikimli kullanılabilir hak.
- Seviye1 ve2: doğrulanmış ödüllerle20/60 XP. Seviye3: **140 XP ve aynı alanda üç ayrı başlangıç başarısı**.
- Seviye4–10 eşikleri kayıtlı; başarı koşulları onaylanmadı, ilerleme kapalı. Öğretmen yeterlilikleri değişmedi.
- Ücretli iş, işletme yönetimi, çoklu alan ödülü, bonus veya giriş serisi eklenmedi.

`private.xp_policies` kimlik+sürüm PK'sı, tam onaylı sayıların CHECK kısıtları ve onay referansı taşır. Sürüm değişmez; başka onaylı değerler ileride ayrı incelemeyle, yeni sürüm ve uygun yeni migration üzerinden eklenmelidir. Makbuz eski politikaya FK ile bağlı kalır. Runtime sürümü değiştirmek geçmişi yeniden hesaplamaz.

## Üretim neden kapalı?

Migration yalnız **onaylı sayısal politika ve disabled runtime** satırlarını ekler. Oyuncu, NPC, yetenek, içerik, tamamlanma, claim veya makbuz eklemez. Önceki13 migration değişmez. Frontend, maaş, aidat, seçim, kasa, sohbet, personel/MFA veya cron değiştirilmez.

Yeni altı private tablo RLS açık ve **politikasız**; PUBLIC/anon/authenticated/service_role için bütün tablo/sequence erişimi ve fonksiyon EXECUTE kapalıdır. Fonksiyonlar SECURITY INVOKER, boş search_path ile çalışır; mutasyon yolunda ayrıca `current_user='postgres'` denetimi vardır. Personel rolü, AAL2, OP bakiyesi, kullanıcı metadata'sı veya GUC ödül yetkisi değildir.

`xp_runtime.mode='disabled'` varsayılandır. Bu PR'da **gerçek yayın adaptörü bulunmaz**: yalnız `synthetic_disposable` türü vardır. Test adaptörü hem owner hem `disposable_only` modu hem sabit `apartman_a22b_xp` disposable DB adını ister. DB adı yetkilendirme yerine geçmez; owner/RLS/GRANT kontrollerine ek bir test güvenlik sınırıdır. Normal bir DB'de owner'ın yalnız runtime değerini değiştirmesi bile reddedilir; guard yanlışlıkla kaldırılmış olsa dahi ödül fonksiyonu DB sınırını yeniden denetler.

`record_test_xp_completion` özel ve açıkça **sentetik** bir test kayıtçısıdır; `award_verified_xp` de oyuncu RPC'si değildir. Bunları canlı hesaplar için çağırmak desteklenmez. Kodu birleştirmek, migration'ı ileride uygulamak veya role EXECUTE grant etmek üretim öğrenmesini açmaz. Güvenilir gerçek adaptör için ayrıca kod incelemesi, kullanıcı onayı ve sonraki PR gerekir.

A2-2a `learning_evidence_drafts` olduğu gibi draft-only kalır. Cevap anahtarları, doğru statik yanıt veya istemcinin `completed=true` iddiası gerçek başarı sayılmaz. Bu PR draft verilerini dönüştüren fonksiyon içermez. Gerçek insan öğrenmesi, bot/otomasyon tespiti ve pedagojik başarı bu SQL testleriyle kanıtlanmış değildir.

## Gerçekten kodlanan ilişkiler

| Veri | Görevi |
|---|---|
|`xp_policies`|Onaylı değişmez politika sürümü; sayı ve sınırlar|
|`xp_runtime`|Tek serileştirme/kapalı mod ve seçili sürüm kaydı|
|`xp_completion_definitions`|Boş, değişmez içerik kimliği/kind/alan kataloğu; kaynak veya bakiye değildir|
|`xp_verified_completions`|Mevcut claim'e PK/FK ile bağlı, immutable sentetik doğrulama çocuğu|
|`xp_completion_revocations`|Başarı kaydını silmeden geçersiz kılan immutable kayıt|
|`xp_award_receipts`|Claim başına tek immutable ödül ve hak/limit tüketimi olgusu|

**Tek kaynak defteri `xp_source_claims`, tek kanonik seviye/XP `actor_skills`.** Tamamlanma ve makbuz tabloları claim'in çocuklarıdır; ikinci kaynak kimliği defteri veya ikinci güncel XP bakiyesi değildir. Günlük/haftalık tüketim, makbuzların kazanım dönemine göre SUM/COUNT'udur; ayrı ve sapabilen mutable sayaç tutulmaz.

Sentetik doğrulama referansı benzersizdir. Kaynak UUID'si aktör+kararlı içerikten SHA256 ile türetilir; sürüm/gün/cihaz/oturum içermez. Yönlendirme kimliği aktör başına **global** türetilir; başka alana geçerek ikinci yönlendirme alınamaz. Başlangıç tanımı mevcut `learning_modules` koduna/alanına bağlanır; üçlük sınır, sıra ve önceki gerçek başarı kontrol edilir. İçerik kimliği yeniden adlandırılarak aynı gerçek faaliyetten ödül üretmemek, gelecekteki gerçek adaptörün de yükümlülüğüdür. Sentetik testin birçok ayrı bölüm/olay kimliği oluşturması gerçek içerik arzı değildir.

Eski `starter_learning` taslak claim'leri ve genel UNAPPLIED rezervasyonlar yeni bir gerçek tamamlanmaya sessizce bağlanamaz. Yeni yol `verified_learning` türü, canonical kaynak UUID'si, aktör, alan, gerekçe ve doğrulama referansını bağımsız denetler. İlk pasif politika oluşturulmadan önceki rezervasyonlar, ilerideki namespace ve gerekçe önceden tahmin edilmiş olsa bile yeni kanıta bağlanamaz. Eski rezervasyon tarihi kazanım dönemi değildir.

## Atomik işlem ve A1 dönüşümü

1. Owner, kapalı runtime ve READ COMMITTED sınırı denetlenir. Stale RR/serializable snapshot reddedilir.
2. Gerçek player aktörü, Auth/profil, güncel üyelik ve ban durumu kontrol edilir. Aktör oluşturulmaz.
3. Tek claim'e bağlı bağımsız tamamlanma aranır. Taslak/UUID/istemci miktarı yetmez.
4. Aktif katalog, değişmez içerik/kanıt ve iptal durumu kontrol edilir.
5. Başarılı eski makbuz varsa aynı makbuz döner; yeni gün veya politika ikinci XP vermez. Ban/üyelik kontrolü replay'de de atlanmaz.
6. Runtime'ın kilit altında seçtiği immutable politika okunur.
7. **Bütün beklenen kilitlerden sonra** sunucu zamanı alınır. Türkiye günü/haftası ve o günün birikimli haftalık hakkı hesaplanır.
8. Politika sürümleri arasında ortak SUM/COUNT ile110/70 XP,2/7 uygulama ve günlere açılan hak denetlenir.
9. BEFORE INSERT makbuzun aktörünü, alanını, miktarını, önce/sonra değerlerini, kanıt/politika referansını, başarı sayısını ve zamanını sunucuda türetir. Owner test INSERT'inde verilen sahte miktar/tarih bile kullanılmaz.
10. AFTER INSERT kanonik `actor_skills` değerini günceller. Fixed-row guard yeni değerleri immutable makbuz zinciriyle uzlaştırır. Deferred constraint son tutarlılığı yeniden denetler.

Makbuz claim PK'sı, doğrulama referansı UNIQUE, `(actor_id,skill_code,previous_xp)` UNIQUE ve zincirde LAG kontrolleri aynı XP'nin iki kez yazılmasını engeller. Makbuz, hak tüketimi ve kanonik değişiklik aynı transaction'dadır. Hata/rollback; yeni claim, tamamlanma ve ödül aynı transaction'da başlatılmışsa hepsini geri alır. Daha önce kaydedilmiş doğrulanmış bir claim'e ödül reddedilirse o rezervasyon korunur, makbuz ve hak tüketimi oluşmaz.

`a1_assert_actor` oyuncu kolu artık kanonik her değerin makbuzların toplamına, son değerine ve önce/sonra zincirine tam eşit olmasını ister. Makbuzsuz oyuncu **0/0** kalır. `a1_fixed_row_guard` yalnız owner, aynı oyuncu/alan, pozitif artış ve aynı immutable makbuzla uzlaştırma durumunda güncelleme kabul eder; serbest UPDATE kapısı açmaz. Yeni INSERT guard oyuncunun ilk yeteneğini0/0 zorlar. NPC kolu önceki fonksiyondan byte bazında korunur; XP0 ve sabit rol seviyeleri devam eder. Kimlik/plan revision davranışı korunur. `ensure_player_actor` değiştirilmez; mevcut ilerlemeyi doğrular ve aynı aktörü döndürür, sıfırlamaz.

Bağımsız tutarlılık testleri, yalnız disposable transaction'da guard devre dışı bırakılarak enjekte edilmiş hatalı oyuncu ve NPC değerlerinin `a1_assert_actor` tarafından yine reddedildiğini de gösterir. Bu fault injection kodu migration'da yoktur.

## Kilit sırası ve eşzamanlılık

XP akışı: **runtime FOR UPDATE → building FOR UPDATE → membership KEY SHARE → mevcut yaptırım advisory key741032 → actor FOR UPDATE → Auth hesabı KEY SHARE → katalog SHARE → kanonik alan FOR UPDATE → makbuz**. Tamamlanma kayıtçısı runtime ve aynı oyuncu sırasından sonra claim kilidi alır. Değişmez tanımlar/kanıtlar yeni kilitli mutable durum üretmez. Kaynak iptali runtime kilidini paylaşır. Politika kapatma/sürüm değişimi aynı runtime satırını UPDATE eder; bekleyen ödül güncel sürüm/durumu görür.

Bu ilk dilimde runtime tek dünya/genel serileştirme noktasıdır. Basitliği küçük pilotta tercih edildi; farklı oyuncuların XP yazmaları da sıraya girer. Ölçüm yapılmadan yüksek ölçek iddiası yoktur. Gelecekte politika SHARE + aktör bazlı çitlere bölmek ayrı yarış/regresyon testleri gerektirir. Eski oyuncu/personel işlemleri runtime kilidini almaz; onların building→yaptırım sırası korunur. Üyelik ve ban ödül INSERT'i bitmeden yeniden denetlenir.

## Henüz onaylanmamış seçenekler

Aşağıdaki davranışlar **üretim politikası değildir**. Sentetik adaptör, herhangi bir kısmi kazanım veya geleceğe taşıma varsaymamak için güvenli ödülsüz reddetme uygular.

| Karar | Seçenekler ve sonuçları | Bu PR'daki test sınırı |
|---|---|---|
|Günlük tavanın altında kalan miktar|Kısmi XP: makbuz/source tamamlandı semantiği ve bakiye hak kararı gerekir. Tam ret: ödül yok, kaynak tüketilmez. Erteleme: kuyruk/ödül günü ve yeniden doğrulama gerekir.|110/70'i aşan **tam ödül reddi**; ne kısmi XP ne otomatik ertesi gün kuyruğu|
|Üst aşama açılmadan XP|Birikim: geleceğe XP yığılması politikasını gerektirir. Kırpma: kayıp XP ve source tüketimi kararı. Durdurma: fırsat/kanıt korunmalı.|**140'ı aşan ödülü bütünüyle reddeder**;140'da eksik üç başarı varsa seviye2.144'ü140'a kırpmaz, bedava XP vermez. Bu CHECK dahil sınır sentetik adaptöre aittir; nihai seçim yeni PR ister.|
|Kullanılmayan haftalık hak|Yeni haftada sıfırlama veya sınırlı devir; tüketim döneminin nasıl tutulacağı gerekir.|Sayaçlar hafta anahtarlı; testte **devir hesaplanmaz**. Canlı karar açık.|
|Başarısız uygulama hakkı|Hiç tüketmeme, deneme kotası veya başarıdan ayrı sınırlama.|Yalnız doğrulanmış başarılı ödül makbuzu sayılır. Canlı başarısızlık denemesi mekanizması yok.|
|Faaliyetler arası aktarım|Aktarım yok veya açık dönüşüm bütçesi.|Aktarım uygulanmadı; yalnız aynı alanın gerçek practice makbuzları sayılır.|
|İptal edilen eski başarı|Geçmiş XP/başarı korunması veya açık telafi mekanizması.|Yeni ödül reddedilir; geçmiş makbuz değişmez. Otomatik XP geri alma/seviye düşürme yok.|

Özellikle12+3×32=108 XP'dir. Testte140'a **ayrı sentetik** course24+book8 ile ulaşılır; bu gerçek kurs/kitap erişimi iddiası değildir. Gerçek yönlendirme de henüz yoktur: yalnız üç başlangıç modülü ileride yayımlansa bile toplam96 XP sağlar, seviye3 sağlamaz. Seviye3'ü açmak için ek32 XP varsayılarak verilmez. Geçerli farklı faaliyetlerin gerçek içerik ve güvenilir doğrulaması ayrıca geliştirilmelidir.

Yönlendirmenin hangi yeteneğe XP vereceği gerçek içerikle ayrıca tanımlanmalıdır; testte alan seçimi sentetiktir ve tek global ödül şartını değiştirmez. Test kayıtçısında ödülsüz bir claim'in daha sonra owner tarafından yeniden denenebilmesi otomatik erteleme/kuyruk veya canlı ödül süresi kararı değildir.

Açık diğer işler: seviye4–6 modül/uygulama başarı sayıları,7–10 uzmanlık ve erişilebilir alternatifler, ileri eğitmen kapasitesi, kurs ön kayıt/iptal politikası. B+S araştırmasının diğer takvim ve arz sayıları etkinleştirilmedi.

## Testler ve sınırları

```sh
npm test
npm run test:ui
npm run build
npm run test:sql
npm run test:v02
npm run test:rbac
npm run test:advanced
npm run test:a1
npm run test:a1-player
npm run test:a1-npc
npm run test:a2
npm run test:a2-npc
npm run test:learning
npm run test:xp
python3 -m unittest discover -s analysis/xp-balance -p 'test_*.py' -v
npm run test:db
```

`test:xp` yalnız sabit `127.0.0.1:55432` üzerinde kendi `apartman_a22b_xp` DB'sini oluşturur/siler; environment/hosted URL okuyamaz. İkinci ince güvenlik fixture DB'si `apartman_a22b_closed` da finally ile silinir. Sentetik12 sakin, NPC pilotu ve tüm içerikler yalnız bu disposable testtendir. Yeni politika ancak bu DB'de owner tarafından test moduna alınır. Zaman sınırı testleri owner'ın özel `xp_server_now()` fonksiyonunu yalnız disposable DB'de değiştirmesiyle yürür; migration'daki saat `clock_timestamp()`dır, GUC/istemci tarihi kabul etmez. Test sonu gerçek fonksiyon geri konur ve DB silinir. SQL DATE anahtarları Node host saat dilimine çevrilmez.

28 PostgreSQL kontrol grubu: tüm sayılar, boş/kapalı varsayılanlar, eski13 migration sonrası veri/hash ve şema koruması, commit/rollback,0–3 başarı,140 XP ile eksik başarı,110/70 tam sınır ve paralel yarışlar,2/7/güne açılan haklar, yönlendirme tekilliği, kaynak aktarımı/iptali, gece yarısı/hafta/gecikmiş kilit, sürüm değişimi/kapatma, duplicate oturum, hata sonrası tam rollback, ban/mute, hesap/üyelik, doğrudan XP/NPC yazmaları, eski aktör tekrar oluşturma ve koruma tutarlılığı.

Kaynak testleri, bu dilimin istemciye aktarılmadığını, aktif içerik seed'i olmadığını ve NPC doğrulama kolunun aynılığını da korur. Tarihsel `test:learning` hâlâ ilk13 migration'da durur; yalnız toplam dosya sayısı kontrolü `>=13` oldu. Yeni test bütün14 migration'ı ve dönüşümü uygular. CI database job'una yalnız `test:xp` eklendi; Pages yayın koşulları değişmedi.

Yerel sonuç: **90/90 kaynak testi** (önceki87 korunur), statik UI ve build başarılı; yeni28 kontrol dahil **11 PostgreSQL paketi başarılı**. Önceki70 Python araştırma testi de geçti. Mevcut frontend derleme asset hash'leri aynı kaldı. `test:db`, `work/local-status.json` bulunmadığı için başlatılamadı. Güncel commit'in Actions sonucu PR açıklamasında ayrıca kaydedilir.

**Kabul sınırı:** PostgreSQL'de Auth/JWT/MFA ve cron kayıtçısı stub'dır. Gerçek Auth HTTP oturumu, MFA töreni, Realtime, gerçek cron çalışma ve tarayıcı öğrenme deneyimi bu paketin kanıtı değildir. `test:db` tam disposable Supabase yapılandırması yoksa engelli olarak raporlanır; canlıya yönlendirilmez. UI testi statik React'tir; bu PR'da frontend değişmedi.

## Sonraki dilim ve canlı rollout ön koşulları

1. Açık tavan/üst aşama/hak kararlarını kesinleştirin; hata mesajlarını gerçek oyuncu akışına göre tasarlayın.
2. Onaylı içerik yayını ve gerçek server doğrulama adaptörünü geliştirin: sunucu oturumu/aktör bağlama, sonuç kuralları, gerçek kaynak tekilliği, tekrar/iptal, gerekirse otomasyon/istismar denetimi. Fixture cevaplarını aktararak aktivasyon yapmayın.
3. Gerçek yönlendirme ayrı içerik+tamamlanma kimliği gerektirir. Eksik32 XP için gerçek ek faaliyet tasarlayın; kurs/practice altyapısı kendiliğinden oluşmaz.
4. Yayın adaptörü ve kapalı runtime geçişi ayrı güvenlik incelemesi ve kullanıcı onayı ister. İlk0–3 pilotunu, actor oluşturma/backfill ve içerik seed'ini ayrı onaylayın.
5. Yeni disposable paket ve bütün regresyonlar, ardından ayrı gerçek Auth/MFA/Realtime kabulü gerekir. Canlı uygulama sırasında hedef/migration geçmişi ve eşleşen13 dosya doğrulanmalı; körlemesine `db push` yapılmamalı.
6. Canlı migration **bu görevin parçası değildir**. Öncesinde oyuncu/üyelik/skill/claim, cüzdan/kasa/aidat, seçim/oy/görev, sohbet ve personel count+deterministik içerik hash'i; RLS/ACL/fonksiyon/cron/publication özetleri alınmalı, sonrasında karşılaştırılmalı. Bu değişiklikte eski iki guard fonksiyonu ve yeni skill trigger'ları beklenen farktır.

DDL: yeni tablolar/indeksler ve iki guardın CREATE OR REPLACE'i; eski büyük tabloda veri dönüşümü/backfill veya tablo rewrite yok. Yeni skill INSERT/TRUNCATE trigger'ları kısa relation kilitleri alır; `lock_timeout=5s` uzun canlı beklemeyi keser. Operatör transaction içinde uygular; hata tüm DDL/politika satırlarını geri alır. Testte bu rollback sınandı. Mevcut aktörlerde makbuzsuz beklenmedik nonzero değer varsa otomatik onarım yapılmamalı; önce kaynak araştırılmalı.

Migration hiç uygulanmadıysa PR commit'leri geri alınabilir. Uygulandıysa runtime kapalı kalsın, otomatik DROP veya eski0/0 guardına kör dönüş yapılmasın. Sıfır-ilerleme doğrulanmadan eski guardı geri yüklemek nonzero kanonik kayıtları geçersiz yapar. Makbuz varsa silmeden koruyan yeni forward migration gerekir. Gerçek ödül telafisi bu PR'da yoktur; geçmiş XP'yi silerek düzeltme yapılmaz.
