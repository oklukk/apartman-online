# A1 — küçük ve yalıtılmış ilk geliştirme planı

**Hazırlık taslağı; bu PR'da kod, migration, backfill veya seed yoktur.** Başlangıç `main/94ff023` ve birleşmiş PR #16. [D01/D04 kararları](A1_DECISIONS.md) seçilmeden politika/kişi/konut üretmeyen inceleme sınırı korunur. Mevcut [envanter](CURRENT_SYSTEM_INVENTORY.md) değişmez.

## 1. İlk A1 kod diliminin sınırı

Önerilen ilk kod PR'ı, kararlar onaylandıktan sonra **saf domain sözleşmeleri ve plan doğrulama** ile sınırlansın:

- Player actor ile sabit bot actor ayrımı; player için mevcut profile referansı; bot için Auth/üyelik referansı yok.
- Kalıcı actor/konut/meslek ve sabit skill snapshot'ı için tip/sözleşmeler; onaylı plan sürümü, nüfus/konut tavanı, alan/eğitmen kapsama modeli.
- Girdi doğrulama: 0–10, unique kimlik/konut, N/P/H, sabit bot standartları, aynı actor'ın tekrar atamasında kimlik/konut çoğalmaması; henüz seçilmemiş planın uygulanabilir sayılmaması.
- Küçük in-memory sentetik testler; gerçek isim, UUID, onaylı population manifest'i veya üretim seed dosyası yok.
- App/API/Auth/oyun verisi/cron'a import ve çağrı yok. Yeni ana menü, bot listesi, sahte seviye, feature düğmesi veya staff yetkisi eklenmez.

Bu ilk parça veri saklamaz, bot yaratmaz, para/XP vermez; uygulamaya entegre olmayan doğrulayıcıdır. Doğrulayıcının sonucu personel yetkisi veya canlı seed izni değildir. Client tarafında çalışan saf kontrol, sonraki PostgreSQL constraint/RPC kontrolünün yerine geçmez.

**A1'den çıkarılanlar:** XP eğrisi/ilerleme (A2), kurs/koltuk/ücret/üniversite (A3–A4), işletme/stock/iş/maaş/istihdam (B–C), NPC müşteri bütçesi/ihale (D), bütün yeni canlı kayıtlar. D01 başlangıç değerleri henüz onaylı değilken default0 veya legacy işten beceri türetmek de kapsam dışıdır.

## 2. Sonraki A1 kalıcılık dilimi — aynı anda yapılmamalı

Saf model ve karar incelemesinden sonra ayrı küçük kod/şema PR'ı önerilir:

1. İlgili actor, ayrı bot profil/nüfus planı ve NPC konut ilişkileri için **boş ve ek** şema; eski migration dosyaları değişmez. CLI yardımı + yeni migration akışı kullanılır.
2. İlk migration hiçbir mevcut oyuncuyu dönüştürmez; NPC/ev/kurum veya skill seed'i ve Auth/join trigger'ı eklemez. Henüz veri yokken read modeli boş/erişimsiz durumu doğru döndürür; eski oyun actor'a bağlı olmaz.
3. RLS, açık GRANT ve yalnız gerekli checked salt okunur köprü; yeni erişim modelleri Auth UID ve dar allowlist alanlar üzerinden. Internal provisioning/ledger fonksiyonu authenticated'a açılmaz. Staff rolü/seçilmiş yönetici/işletme sahibi karıştırılmaz.
4. Mevcut profillerle bire bir actor FK'si, silme/arşivleme davranışı ve özel profile erişim testleri gözden geçirilir. A2 skills ile bot sabitlerinin kanonik saklama yeri tek olmalıdır; paralel iki skill bakiyesi oluşturulmaz.
5. Disposable PostgreSQL testleri dolu eski oyun fixture'ında çalışır. Yeni tablo içine geçici sentetik test satırı eklemek yalnız test DB'sinde olur; bu, gerçek dünya seed'i olarak paketlenmez.

Bu belge şema/SQL dosyası üretmez ve bu dilimi başlatma onayı değildir. Canlıya boş şema uygulama, gerçek actor eşleme ve NPC provisioning ayrı operasyonlardır; biri diğerini gizlice çağırmamalıdır.

## 3. Korunacak eski davranışlar

| Korunan alan | A1 yalıtım koşulu |
| --- | --- |
| Auth/profiles | Yeni Auth kullanıcı yok; UUID/username/oturum/MFA değişmez. `profiles` trigger'ı bot için kullanılmaz. Dairesiz staff actor'sız çalışabilir. |
| Üyelik/daire | `memberships`, `apartments`, insan `buildings` değişmez; bot konutu bunlara yazılmaz. İnsan apartmanında 12 daire/doluluk kuralları aynıdır. |
| Cüzdan/gelir/aidat | Wallet/300 OP/legacy job/100 OP maaş/25 OP ek iş veya aidat dönemi etkilenmez; actor oluşturma bunları tetiklemez. |
| Seçim/oy/görev/kasa | Bot seçmen olmaz; population insan quorum/aktif sakin hesabını değiştirmez. Süre/sonuç/ledger aynı kalır. |
| Sosyal/RBAC | Gerçek profil RLS'si genişlemez; bot için ayrı projection. Actor veya meslek staff rolü vermez; yetki iptali/ban guard'ları atlanmaz. |
| Cron/Realtime/UI | Eski iki cron ve publication korunur. Yeni actor tablosu `Data`/genel `select('*')` listesine eklenmez; mevcut dört sekme veya cache alanları değiştirilmez. |

Bu hazırlıkta canlı salt okunur oyuncu/bakiye listesi bile alınmaz. Gelecek onaylı rollout öncesinde ise yetkili salt okunur snapshot/hash ile mevcut hesap, profil, üyelik, daire, mesaj, cüzdan/hareket, aidat, oy, görev ve kasa korunması karşılaştırılmalıdır. Beklenen değişiklik sadece onaylı yeni nesnelerin whitelist'idir.

## 4. Test şartnamesi — yeni A1 için henüz çalıştırılmış değildir

### İlk saf kod dilimi

| Test | Beklenen |
| --- | --- |
| Eksik/kararsız D01/D04 veya onaysız plan | Apply/provisioning sonucu yok; açık hata/eksik karar listesi |
| Level -1/11, kesir veya tanımsız gereken skill | Reddedilir; eksik değer sessizce0 yapılmaz |
| Aynı bot ID iki profil/konut; konutu iki NPC paylaşması | Reddedilir |
| N>P, N>H, eksik konut veya insan konutuna bot | Reddedilir |
| Yeni alan için eğitmen yok/yetersiz alan/Temel/İleri | Alan etkinleştirmeye hazır sayılmaz; otomatik bot klonlama yok |
| Bot alan öğretim görevlisi | Temel5/İleri3/alan6 sabiti; öğreticilik alanında6 önceliği; profesör diye yükseltilmez |
| Aynı sabit actor'ın iki işletmeye atanması | Kimlik/konut sayısı değişmez; farklı işletme kapasite kapsamı korunabilir |
| Aynı NPC'ye çelişen sabit skill/meslek profili | Reddedilir; atamaya göre skill değişmez |
| Nitelikli öğretmenin iki alanı kapsaması | Konut/NPC çoğalmaz; ayrıca ders kapasitesi onayı olmadan sınırsız servis hazır sayılmaz |
| Girdi veya doğrulama sonucu | Saf fonksiyon girdi verisini değiştirmez; DB/ağ/zamanlayıcı/yan etki yok |

### Sonraki boş şema/disposable dilimi

- Anon/outsider/aynı bina/player/staff erişim matrisi; doğrudan DML ve internal EXECUTE reddi; checked read yalnız izinli alanları verir.
- Eşzamanlı actor eşleme/seed replay için unique sınırlar; aynı planı iki bağlantı uygulayınca kimlik veya konut çoğalmaz. Actor/profile ve bot/player tür uyumsuzluğu reddedilir.
- Kapasite/konut ve plan revizyonu yarışları; sabit bot skill mutasyonu, gerçek üyelik/oy yetkisi elde etme girişimi reddedilir.
- Önceki yedi migration'la dolu disposable fixture'da migration öncesi/sonrası eski satır sayıları/hash ve defter-bakiye mutabakatı aynı; NPC fixtures eski Auth trigger'ını veya ekonomi worker'ını etkilemez.
- Saf modül testleri SQL/RLS kanıtı değildir; iki katman ayrı çalıştırılır. A1 DB diliminde mevcut sql/v02/rbac/advanced paketleri ve gereken yeni A1 entegrasyon testleri tamamlanmadan canlı migration onayı istenmez.

## 5. Bu hazırlık PR'ının doğrulaması

Yalnız doküman değişikliği kontrolü, yerel Markdown bağlantıları, D01/D04 alt karar kimlikleri ve onay kapıları gözden geçirilir. `npm test`, `npm run test:ui`, `npm run build` mevcut oyun için temel regresyon olarak çalıştırılır; CI mevcut dört disposable PostgreSQL paketini de çalıştırır. Son gerçek sonuç PR açıklamasındadır.

Yeni A1 domain veya SQL testleri bu PR'da yazılmış/çalıştırılmış **sayılmaz**. Gerçek Auth/MFA/Realtime veya bot provisioning testi yapılmaz. Test geçmesi, açık D01/D04 sayılarını veya canlı uygulamayı otomatik onaylamaz.

## 6. Bot müşteriler çalışanlı işletmeden önce gelebilir mi?

**Evet, koşullu olarak.** B5b'de kendi çalışan sahibin tesisat işletmesi, gerçek onay/stock/kapasite/escrow/iş sonlandırma ve owner gelir köprüsü tamamlanmışsa, NPC alıcı bu zincirin müşterisidir; çalışan, sözleşme, ilan, bordro veya fesih gerektirmez.

| D1 için gerekli | C1–C4'ten bağımsızlık / koşul |
| --- | --- |
| A1 onaylı kalıcı NPC/konut + B5b çalışan hizmet döngüsü | Yeni müşteri için ek NPC/işçi üretmek gerekmez; mevcut planlı actor kullanılabilir. Bu hazırlıkta kimse oluşturulmaz. |
| D11/D18/D20 onaylı ihtiyaç, kaynak, bütçe, sıklık, fiyat-performans/refund | **Merkezî sınırlı NPC talep bütçesi** seçilirse bordro beklenmez. Kaynak bot ücretlerinden kapalı havuz olacaksa, bu havuzu fonlayan mekanizma henüz yokken D1 açılmaz; C veya ayrıca onaylı fon yolu bağımlılığı doğabilir. |
| Kendi çalışan gerçek owner'ın hizmeti ve ücret/serbest gelir muhasebesi | Satış hasılatı maaş değildir; var olan legacy maaşı ikinci kez üretmez. NPC kaynak tahsisi ve satış ayrı izlenir, refund veya çoklu iş ilişkisi yeni OP yaratmaz. |
| Bütçe/OP tavanı, tüketici-bina/işletme limitleri ve audit | Bunlar C2 bordro limiter'ı beklenmeden D1'in kendi kaynak sınırları olarak uygulanmalıdır. Çalışan işe alındığında iki kaynak sınıfı ayrı kalır. |
| Doğrudan tek hizmet/onarım talebi | Geniş ürün pazarı, otomatik ihale veya yeni bot işletmeci/işçi şart değildir; ilk NPC alıcının satın alması da mevcut iş rezervasyonuna girer. |

Bu nedenle **aday alternatif sıra**: A → B5b → dar D1 (NPC hizmet alıcısı) → C1–C4. D2/D3 ihaleler ve ürün alım kolu daha sonra kalabilir. Eski tablonun C'den sonra D'yi göstermesi zorunlu teknik bağımlılık değildir; bu alternatif sıra henüz rollout kararı değildir.

Öne alınmaması gereken hâller: bot talep kaynağı/bütçe sınırları kararsız; B5b tam settlement/refund yok; işin tamamlanması henüz olmayan çalışan yetkinliğine dayanıyor; NPC bina hesabı insan kasasıyla karıştırılıyor; veya kazanılmış paranın sahibi cüzdanına geçişi tanımlanmamış. Bu durumda “müşteri var” diye para dağıtmak yerine D1 kapalı kalır. İlk gerçek NPC tüketimi ayrıca kullanıcı onayı gerektirir.

## 7. Onay ve geri alma sınırı

Şimdi: yalnız karar + hazırlık planı; merge/yayın yok. Sonra: kararların onayı → küçük izole kod → test edilmiş boş şema → ayrı canlı migration → ayrı actor backfill/NPC seed → ayrı aktivasyon/yayın. Bu adımlar birbirini otomatik yetkilendirmez.

Hazırlık belgeleri git revert ile geri alınabilir; oyun/veri rollback'i yoktur. Gelecek A1 kodu, actor bulunmadığında eski oyunu etkilememeli; NPC oluşturulmuş kalıcılık diliminde geri çekme silme/kimlik yeniden üretme değil, yeni yazmaları durdurup geçmişi koruma planıyla yapılır.
