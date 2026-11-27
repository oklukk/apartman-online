# A1 hazırlığı — D01/D04 karar dosyası

**27 Kasım 2026 · Tercih edilen D01/D04 sayıları kaydedildi; canlı kurulum/seed onayı değildir.** Kaynak: birleşmiş PR #16, `main/94ff0230c6efb9bfb1f93c68d2e7c9b9637de315`. [Mimari](ARCHITECTURE.md) ve [D01–D20 kaydı](DECISIONS_AND_DELIVERY.md) geçerlidir. Bu dosya actor, profil, bot, konut veya skill kaydı **oluşturmaz**; gerçek hesap/UUID/ad listesi içermez. Canlı oyuncu sayısı/verisi sorgulanmadı.

## 1. Kesin olanlar ve henüz seçilmemiş olanlar

Kesin: skill ölçeği 0–10; botun kimliği/profili/mesleği/konutu kalıcı ve yetenekleri sabit; insan ve bot konutları ayrı; bot nüfusu planlı/sınırlı; aynı bot çok işletmede çalışabilir ama her ilişki yeni bot/konut üretmez. Her aktif öğretilebilir alan için nitelikli bot öğretim görevlisi planlanır.

Bot alan öğretim görevlisi sabit **Temel Öğreticilik=5, İleri Öğreticilik=3, alan=6**; öğretilen alan öğreticilikse alan için 6 önceliklidir. Genel bot çalışanının mesleki3, bot işletmecinin ilgili4 standardı ayrıdır. Bu sabitler, ilk dünyada kaç NPC/kurum/konut oluşturulacağını belirlemez.

**Kullanıcının tercih ettiği başlangıç politikası:** apartmana yerleşmiş mevcut ve yeni oyuncular dört alanda seviye0/XP0 ile başlar; eski meslek/aktivite otomatik deneyim üretmez. **Tercih edilen pilot:** bir NPC apartmanı, 12 konut, iki ayrı alan öğretim görevlisi; pilot nüfus tavanı2. Bunlar canlı migration, backfill, NPC/konut oluşturma veya seed onayı değildir. Gerçekte henüz başlatılmamış değer UI'da seviye0 varmış gibi sunulmaz.

## 2. D01 — mevcut ve yeni oyuncu için kararlar

| Alt karar | Açıkça seçilecek değer/politika | Öneri ve gerekçe | Ne zaman gerekli? |
| --- | --- | --- | --- |
| D01.1 Oyuncu kapsamı | Mevcut sakinler mi, tüm Auth profilleri mi; dairesiz staff/hazır bekleyen hesap ne zaman actor olur? | Tercih: apartmana yerleşmiş mevcut/yeni **sakinler**. Dairesiz personelin yönetim erişimi actor'a bağlı değildir; tüm Auth profilleri topluca dönüştürülmez. | Kimlik backfill'i öncesi |
| D01.2 İlk skill kataloğu | Tesisatçılık, İşletmecilik, Temel Öğreticilik, İleri Öğreticilik kodlarının kararlı listesi | Dört ayrı kod; katalogda bulunmak kursa/işe aktif erişim değildir. Legacy `technical/shop/office` farklı kavramlardır. | Domain sözleşmesi / A2 katalog |
| D01.3 Başlangıç seviyeleri | Her alan için 0–10 vektör; herkese eşit mi, sabit profil mi, dağıtılabilir puan mı? | Tercih: Tesisatçılık/İşletmecilik/Temel Öğreticilik/İleri Öğreticilik için **[0,0,0,0]**. Puan havuzu veya meslek şablonu uygulanmaz; gerçek initialization ayrı onaydır. | Skill ilk oluşturma öncesi |
| D01.4 Başlangıç XP | XP0 mı, seçilen seviyenin eşiği mi; XP eğrisi/sürümü? | Tercih: dört alanda **XP0**. XP eğrisi/kazanım formülü hâlâ A2 konusudur; actor kimliği oluşturmak XP/para vermek değildir. | A2; kimlik iskeletini büyütmez |
| D01.5 Eski meslek ve geçmiş emek | Önceki iş/aktivite mesleki skill'e çevrilecek mi? | Tercih: otomatik dönüşüm ve geçmişe XP yok. Teknik iş sahibi olmak Tesisatçılık seviyesi veya sertifika sayılmaz; mevcut job/maaş/aktivite kayıtları değişmez. | Başlangıç politikası öncesi |
| D01.6 Eşitlik ve sürüm | Mevcut/yeni kişi aynı politika mı; ileride gelen kişi veya tekrar giriş başlangıcı yeniler mi? | Aynı sürümde aynı başlangıç; `(profile,initialization_policy)` kaynak kaydı bir kez. Sonradan sürüm değişimi eski kişiye tekrar ücretsiz grant üretmez. | Skill initialization/backfill |
| D01.7 Oluşturma zamanı | Kimlik/skill onaylı toplu backfill ile mi, kullanıcı katılımıyla mı; rollout tarihi? | Actor kimliği ve A2 skill initialization ayrı adım. İlk A1 şeması boş olabilir; otomatik Auth/join trigger'ı eklememek önerilir. Gerçek backfill ayrı inceleme/onay. | Veri yazan yol açılmadan |
| D01.8 Mevcut verilere etkisi | Actor'sız/henüz skill almamış kişi eski oyunu oynar mı? | Giriş, daire, sohbet, maaş/ek iş, aidat, oy ve staff aynen çalışır. Bakiye/meslek/seçim güncellenmez; yeni UI'ya sahte seviye gösterilmez. | Bütün A1 dilimleri |
| D01.9 Alanlara ulaşılabilirlik | Seviye0 öğrenime giriş, İşletmecilik5'e yol, ücretli işe minimum, 7–10 gelişim? | **Zorunlu tasarım şartı:** seviye0'dan erişilebilir başlangıç eğitimi/gelişim yolu bulunmalı; seviye1 isteyen tek girişle kilitlenme olmaz. Katalogdaki dört alanın yolu A2–A4'te tasarlanır, alan aktive edilmeden kontrol edilir. A1 kurs varmış gibi davranmaz, Business5 atamaz. | İlgili eğitim/iş erişimi |

Kimlik eşlemesi için öneri: mevcut `profiles.id` korunur; tek yeni `actor_id` ile bire bir referans, idempotent backend kaydı. Yeni Auth hesabı/username/üyelik üretilmez. Hesap silme/actor arşivleme ve finans geçmişi FK davranışı ayrıca incelenmeden cascade seçilmez.

**D01'in A1 için asgari kararı:** actor kapsamı, kimlik eşlemesi ve gelecekteki initialization'ın açıkça ayrı olması. Seviye0/XP0 tercihi kaydedildi, fakat gerçek actor/skill backfill'i için ayrıca onay gerekir; XP eğrisinin tamamını A1'e taşımak gerekmez.

## 3. D04 — ilk NPC nüfusu ve konut planı

| Alt karar | Seçilecek şey | Öneri / korunacak sınır |
| --- | --- | --- |
| D04.1 Pilot nüfus | İlk kalıcı NPC sayısı N; nüfus tavanı P; kapsam global mi pilot bölge mi? | Tercih: iki ayrı alan öğretim görevlisi; **pilot N=2/P=2**. Kalıcı dünya sınırı değildir; işletmeci/çalışan/müşteri için fazladan NPC eklenmez. |
| D04.2 Konut | NPC bina sayısı, birim kapasitesi H, hangi konut hangi kalıcı NPC'ye ait? | Tercih: **bir NPC apartmanı / 12 konut**; insan `buildings/apartments/memberships` dışında. Her NPC tek konut; boş on konut yeni bot izni değildir. Gerçek konut oluşturma ayrıca onaylanır. |
| D04.3 Alan listesi | İlk aktif öğretilebilir alanlar F; yalnız Tesisat mı, İşletmecilik de mi? | Pilot kapsaması Tesisatçılık ve İşletmecilik için iki ayrı öğretim görevlisidir. Temel/İleri Öğreticilik skill kataloğunda bulunur; dördünün dersinin aktif olduğu anlamına gelmez. |
| D04.4 Eğitmen eşlemesi | Her alan için hangi sabit öğretim görevlisi; bir öğretmen birden fazla alanı kapsayabilir mi? | Her atamada alan≥6 ve Temel≥5/İleri≥3; bot sabitleri ve alan-öğreticilik istisnası birlikte doğrulanır. Eksik kapsama otomatik NPC üretimiyle tamamlanmaz. |
| D04.5 Kalıcı profiller | İsim, meslek, stable seed anahtarı, sabit beceri vektörü ve konut eşlemesi | Bu hazırlıkta ad/UUID/manifest yok. Ayrı incelenecek plan, çelişen meslek/skill sabitlerini tek NPC'ye yüklemez. Aynı NPC'nin başka işte yeteneği değişmez. |
| D04.6 Ders/öğrenci kapasitesi | Kurum, öğretmen-ataması ve dönem başına kotanın kapsamı/sayıları | D03/A3'te sayılar seçilir. Nitelikli eğitmenin bulunması sınırsız ders/öğrenci garantisi değildir; botun işletmeye özgü kapasitesi korunur. |
| D04.7 Büyüme/retire | P/H artışı, yeni alan, NPC'nin pasif olması veya konut değişimi nasıl onaylanır? | Pasife alma yeni kimlik/konut yaratma sayacını sıfırlamasın; eski kayıt silinmesin. Plan revizyonu ve provisioning ayrı onay ister. |
| D04.8 Kurulum ve replay | Onaylı plan nasıl uygulanacak, aynı plan yeniden çalışırsa ne olacak? | Sürüm+kararlı anahtar ve unique eşleme; eski kimliği başka role çevirmeme. Gerçek provisioning bir defa ve ayrıca onaylı; bu PR'da seed komutu yok. |
| D04.9 Atamalar ve müşterilik | Aynı NPC çok işletmede çalışınca/müşteri olunca ne artacak? | Yalnız ilişki; N/H/skill ve müşteri bütçesi artmaz. Müşterilik yeni meslek veya ikinci konut değildir. D1 için sonra ayrı talep bütçesi onayı gerekir. |

## 4. Konut–nüfus–alan–eğitmen ilişkisi

Tanımlar: N oluşturulacak kalıcı bot, P onaylı nüfus tavanı, H toplam kullanılabilir NPC konutu, F planlanan aktif öğretilebilir alanlar. Gereken koşullar: **N≤P ve N≤H**; her NPC tek kimlik/profil/konut; her `f∈F` için en az bir **atanabilir ve yeterli** öğretim görevlisi.

Tek öğretmen birden çok alan için sabit yeterlik taşıyabiliyorsa mutlaka `N≥alan sayısı` gerekmez. Ama kapsama matrisi ve kurum/atama bazlı ders kotası bunu desteklemelidir. Aynı öğretmenin adını iki alana yazmak, ikinci bir konut/NPC veya iki kat hizmet hakkı üretmez. Alanların hepsinde yeterli öğretmen yoksa boş ev bulunması alanı aktifleştirmek için yeterli değildir.

### Tercih edilen pilot (canlı kurulum onayı değil)

**Bir NPC apartmanı, H=12 konut; iki ayrı bot öğretim görevlisi; N=2 ve P=2.** P=2 yalnız ilk pilotun sınırıdır, kalıcı dünyanın sınırı değildir. Alan kapsaması Tesisatçılık + İşletmecilik. Boş on konut otomatik NPC oluşturmaz. Yeni alan/işletmeci/çalışan ihtiyacı ayrı plan revizyonu gerektirir. Bugün bot veya konut oluşturulmadı.

Tercih edilen yeterlik eşlemesi (kişi adları/UUID ve gerçek konut atamaları hâlâ seçilmedi):


| Plan satırı (kişi adı/ID değildir) | Tesisatçılık | İşletmecilik | Temel Öğreticilik | İleri Öğreticilik | Konut ihtiyacı |
| --- | --- | --- | --- | --- | --- |
| Tesisat alan öğretim görevlisi | 6 | Öğretime atanmadı | 5 | 3 | 1 |
| İşletmecilik alan öğretim görevlisi | Öğretime atanmadı | 6 | 5 | 3 | 1 |

“Atanmadı” alan seviyesi0 demek değildir; diğer sabit alanlar profil kararı olmadan doldurulmaz. Temel/İleri Öğreticilik'i doğrudan öğretime açmak bu ilk iki alan planına dâhil değildir; alan=6 istisnası, kapsama ve kapasite yeniden değerlendirilir. 5/3 pedagojik NPC profili profesör değildir; profesör veya özel ders NPC'si otomatik eklenmez.

## 5. Karar çıktısı ve geçiş kapıları

Karar dosyası tamamlandığında aşağıdakiler ayrı ayrı imzalı/sürümlü karara dönüşmelidir; repository'de `approved=true` yazmak canlı çalıştırma yetkisi değildir:

1. **Politika kararı:** D01 oyuncu kapsamı + başlangıç politikası; D04 alan listesi, N/P/H ve sabit rol/profil kapsaması. Seviye0/XP0 ve pilot sayıları tercih olarak belirli; gerçek kimlikler, takvim ve operasyon onayları açık kalır.
2. **Kod/şema incelemesi:** yalnız onaylı sınırların küçük A1 dilimi; disposable test ve RLS/GRANT incelemesi. [A1 planı](A1_IMPLEMENTATION_PLAN.md).
3. **Canlı boş migration onayı:** hedef/SQL/history ve eski veri özeti incelenir; population/backfill içermez.
4. **Gerçek oyuncu actor backfill onayı:** kapsam ve idempotent eşleme ayrı; skill/para/meslek değiştirme yok. Skill initialization A2 için ayrıca değerlendirilir.
5. **NPC provisioning/seed onayı:** onaylı sınırlı plan, sabit profiller, konut ve replay kontrolü. Yalnız bundan sonra gerçek NPC oluşturulabilir.
6. **PR merge ve yayın onayı:** ayrıca verilir; yukarıdaki kararların biri diğerlerini otomatik yetkilendirmez.

Bu hazırlık PR'ı yalnız kararları ve test edilebilir geliştirme sınırını sunar. Tercih edilen D01/D04 değerleri canlı yetki değildir; ayrıca onaylanmadan gerçek bot nüfusu veya canlı seed yoktur; A1 temelinin uygulanmış/tamamlanmış olduğu iddia edilmez.

## Öğretmenlik eşik düzeltmesi

- **Özel öğretmen:** Temel Öğreticilik ≥5 ve öğretilen alanda yetenek ≥5; **İleri Öğreticilik şartı yok**. Öğretilen alan İleri Öğreticilik ise o alanın ≥5 koşulu yine geçerlidir; bu ayrı genel İleri şartı değildir.
- **Üniversite öğretim görevlisi:** Temel ≥5, İleri ≥3, alan ≥6 (korundu).
- **Profesör:** Temel=10, İleri ≥5, alan ≥6 (korundu).

İleri Düzey Öğreticilik, bu belgelerdeki İleri Öğreticilik ile aynı yetenektir; beşinci alan değildir. Özel öğretmen profesörün eğitim verimini aşamaz. Verim katsayıları, öğrenci/ders kapasite sayıları ve XP eğrisi seçilmedi. Bu eşiklerin belirli olması yeni kurs/NPC veya canlı erişim açmaz.
