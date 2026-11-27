# A1 hazırlığı — D01/D04 karar dosyası

**27 Kasım 2026 · Karar ve sayı önerileri onay bekliyor.** Kaynak: birleşmiş PR #16, `main/94ff0230c6efb9bfb1f93c68d2e7c9b9637de315`. [Mimari](ARCHITECTURE.md) ve [D01–D20 kaydı](DECISIONS_AND_DELIVERY.md) geçerlidir. Bu dosya actor, profil, bot, konut veya skill kaydı **oluşturmaz**; gerçek hesap/UUID/ad listesi içermez. Canlı oyuncu sayısı/verisi sorgulanmadı.

## 1. Kesin olanlar ve henüz seçilmemiş olanlar

Kesin: skill ölçeği 0–10; botun kimliği/profili/mesleği/konutu kalıcı ve yetenekleri sabit; insan ve bot konutları ayrı; bot nüfusu planlı/sınırlı; aynı bot çok işletmede çalışabilir ama her ilişki yeni bot/konut üretmez. Her aktif öğretilebilir alan için nitelikli bot öğretim görevlisi planlanır.

Bot alan öğretim görevlisi sabit **Temel Öğreticilik=5, İleri Öğreticilik=3, alan=6**; öğretilen alan öğreticilikse alan için 6 önceliklidir. Genel bot çalışanının mesleki3, bot işletmecinin ilgili4 standardı ayrıdır. Bu sabitler, ilk dünyada kaç NPC/kurum/konut oluşturulacağını belirlemez.

**Aşağıdaki öneriler kesin kullanıcı kararı değildir.** Özellikle başlangıç skill vektörü, nüfus tavanı, konut sayısı ve alan listesi bugün seçilmedi. Yok/henüz başlatılmamış değer, onaylanmış seviye0 demek değildir; uygulama sessiz varsayılanla bu boşluğu doldurmamalıdır.

## 2. D01 — mevcut ve yeni oyuncu için kararlar

| Alt karar | Açıkça seçilecek değer/politika | Öneri ve gerekçe | Ne zaman gerekli? |
| --- | --- | --- | --- |
| D01.1 Oyuncu kapsamı | Mevcut sakinler mi, tüm Auth profilleri mi; dairesiz staff/hazır bekleyen hesap ne zaman actor olur? | İlk pilotta mevcut/yeni **sakinler**; dairesiz personelin yönetim erişimi actor'a bağlı olmasın. Scope onaysız seçilmez. | Kimlik backfill'i öncesi |
| D01.2 İlk skill kataloğu | Tesisatçılık, İşletmecilik, Temel Öğreticilik, İleri Öğreticilik kodlarının kararlı listesi | Dört ayrı kod; katalogda bulunmak kursa/işe aktif erişim değildir. Legacy `technical/shop/office` farklı kavramlardır. | Domain sözleşmesi / A2 katalog |
| D01.3 Başlangıç seviyeleri | Her alan için 0–10 vektör; herkese eşit mi, sabit profil mi, dağıtılabilir puan mı? | Her mevcut/yeni sakine eşit **[0,0,0,0]** en küçük ve şeffaf başlangıç önerisidir. Alternatif sabit profil/puan havuzu daha fazla kural ister. Değerler **onaylanmadı**. | Skill ilk oluşturma öncesi |
| D01.4 Başlangıç XP | XP0 mı, seçilen seviyenin eşiği mi; XP eğrisi/sürümü? | Seviyeler0 seçilirse XP0 önerilir. Daha yüksek başlangıç için A2 eğrisiyle tutarlı snapshot gerekir. Actor kimliği oluşturmak XP vermek değildir. | A2; kimlik iskeletini büyütmez |
| D01.5 Eski meslek ve geçmiş emek | Önceki iş/aktivite mesleki skill'e çevrilecek mi? | Otomatik dönüşüm ve geçmişe XP yok; teknik iş sahibi olmak Tesisatçılık seviyesi veya sertifika sayılmaz. Aksi istenirse ayrı açık dönüşüm kuralı gerekir. | Başlangıç politikası öncesi |
| D01.6 Eşitlik ve sürüm | Mevcut/yeni kişi aynı politika mı; ileride gelen kişi veya tekrar giriş başlangıcı yeniler mi? | Aynı sürümde aynı başlangıç; `(profile,initialization_policy)` kaynak kaydı bir kez. Sonradan sürüm değişimi eski kişiye tekrar ücretsiz grant üretmez. | Skill initialization/backfill |
| D01.7 Oluşturma zamanı | Kimlik/skill onaylı toplu backfill ile mi, kullanıcı katılımıyla mı; rollout tarihi? | Actor kimliği ve A2 skill initialization ayrı adım. İlk A1 şeması boş olabilir; otomatik Auth/join trigger'ı eklememek önerilir. Gerçek backfill ayrı inceleme/onay. | Veri yazan yol açılmadan |
| D01.8 Mevcut verilere etkisi | Actor'sız/henüz skill almamış kişi eski oyunu oynar mı? | Giriş, daire, sohbet, maaş/ek iş, aidat, oy ve staff aynen çalışır. Bakiye/meslek/seçim güncellenmez; yeni UI'ya sahte seviye gösterilmez. | Bütün A1 dilimleri |
| D01.9 Alanlara ulaşılabilirlik | Seviye0 öğrenime giriş, İşletmecilik5'e yol, ücretli işe minimum, 7–10 gelişim? | D02/D03 ve A2–A4'te çözülür. A1 bu kararlar yokken iş/üniversite açmaz; ücretsiz Business5 veya mesleki başarı atamaz. | İlgili eğitim/iş erişimi |

Kimlik eşlemesi için öneri: mevcut `profiles.id` korunur; tek yeni `actor_id` ile bire bir referans, idempotent backend kaydı. Yeni Auth hesabı/username/üyelik üretilmez. Hesap silme/actor arşivleme ve finans geçmişi FK davranışı ayrıca incelenmeden cascade seçilmez.

**D01'in A1 için asgari kararı:** actor kapsamı, kimlik eşlemesi ve gelecekteki initialization'ın açıkça ayrı olması. Seviye/XP dağıtımı onaylanmadıkça gerçek actor/skill backfill'i yoktur; XP eğrisinin tamamını A1'e taşımak gerekmez.

## 3. D04 — ilk NPC nüfusu ve konut planı

| Alt karar | Seçilecek şey | Öneri / korunacak sınır |
| --- | --- | --- |
| D04.1 Pilot nüfus | İlk kalıcı NPC sayısı N; nüfus tavanı P; kapsam global mi pilot bölge mi? | İlk nüfus öğretim görevlileriyle sınırlı olsun. İşletmeci/olağan çalışan/müşteri için sırf gelecekte gerekebilir diye NPC doldurulmasın. Sayılar aşağıda yalnız örnektir. |
| D04.2 Konut | NPC bina sayısı, birim kapasitesi H, hangi konut hangi kalıcı NPC'ye ait? | İnsan `buildings/apartments/memberships` dışında ayrı katalog. Her NPC'ye bir konut; bir konutta en çok bir NPC. Boş NPC evi yeni bot oluşturma yetkisi değildir. |
| D04.3 Alan listesi | İlk aktif öğretilebilir alanlar F; yalnız Tesisat mı, İşletmecilik de mi? | Tesisat ilk dikey dilimdir. İşletmecilik'i de kapsamak, daha sonra owner için gereken5'e yol açar. Dört skill'in katalogda olması dördünün dersinin aktif olması değildir. |
| D04.4 Eğitmen eşlemesi | Her alan için hangi sabit öğretim görevlisi; bir öğretmen birden fazla alanı kapsayabilir mi? | Her atamada alan≥6 ve Temel≥5/İleri≥3; bot sabitleri ve alan-öğreticilik istisnası birlikte doğrulanır. Eksik kapsama otomatik NPC üretimiyle tamamlanmaz. |
| D04.5 Kalıcı profiller | İsim, meslek, stable seed anahtarı, sabit beceri vektörü ve konut eşlemesi | Bu hazırlıkta ad/UUID/manifest yok. Ayrı incelenecek plan, çelişen meslek/skill sabitlerini tek NPC'ye yüklemez. Aynı NPC'nin başka işte yeteneği değişmez. |
| D04.6 Ders/öğrenci kapasitesi | Kurum, öğretmen-ataması ve dönem başına kotanın kapsamı/sayıları | D03/A3'te sayılar seçilir. Nitelikli eğitmenin bulunması sınırsız ders/öğrenci garantisi değildir; botun işletmeye özgü kapasitesi korunur. |
| D04.7 Büyüme/retire | P/H artışı, yeni alan, NPC'nin pasif olması veya konut değişimi nasıl onaylanır? | Pasife alma yeni kimlik/konut yaratma sayacını sıfırlamasın; eski kayıt silinmesin. Plan revizyonu ve provisioning ayrı onay ister. |
| D04.8 Kurulum ve replay | Onaylı plan nasıl uygulanacak, aynı plan yeniden çalışırsa ne olacak? | Sürüm+kararlı anahtar ve unique eşleme; eski kimliği başka role çevirmeme. Gerçek provisioning bir defa ve ayrıca onaylı; bu PR'da seed komutu yok. |
| D04.9 Atamalar ve müşterilik | Aynı NPC çok işletmede çalışınca/müşteri olunca ne artacak? | Yalnız ilişki; N/H/skill ve müşteri bütçesi artmaz. Müşterilik yeni meslek veya ikinci konut değildir. D1 için sonra ayrı talep bütçesi onayı gerekir. |

## 4. Konut–nüfus–alan–eğitmen ilişkisi

Tanımlar: N oluşturulacak kalıcı bot, P onaylı nüfus tavanı, H toplam kullanılabilir NPC konutu, F planlanan aktif öğretilebilir alanlar. Gereken koşullar: **N≤P ve N≤H**; her NPC tek kimlik/profil/konut; her `f∈F` için en az bir **atanabilir ve yeterli** öğretim görevlisi.

Tek öğretmen birden çok alan için sabit yeterlik taşıyabiliyorsa mutlaka `N≥alan sayısı` gerekmez. Ama kapsama matrisi ve kurum/atama bazlı ders kotası bunu desteklemelidir. Aynı öğretmenin adını iki alana yazmak, ikinci bir konut/NPC veya iki kat hizmet hakkı üretmez. Alanların hepsinde yeterli öğretmen yoksa boş ev bulunması alanı aktifleştirmek için yeterli değildir.

### Onay bekleyen iki küçük seçenek

| Seçenek | Planlanan alan / öğretim görevlisi | İlk nüfus / tavan / konut | Değerlendirme |
| --- | --- | --- | --- |
| En küçük | Yalnız Tesisatçılık; bir alan öğretim görevlisi | **N=1, P=1**, bir NPC binasında **H=12** önerisi | İlk tek kurs için en dar plan. İşletmecilik dersini açmadan önce kapsama/nüfus planı revizyonu gerekir. |
| Önerilen hazırlık | Tesisatçılık + İşletmecilik; ayrı iki alan öğretim görevlisi | **N=2, P=2**, bir NPC binasında **H=12** önerisi | İşletmecilik5 yolunu da planlar; yalnız iki konut kullanılır, on boş konut yeni NPC izni değildir. İlk A3 dersi yine yalnız Tesisat olabilir. |

**Bu sayılar seçilmedi; konut veya NPC oluşturulmadı.** H=12, insan cephesindeki düzenle uyumlu bir plan önerisidir; NPC konutunda önceden kesinleşmiş sayı değildir. P=2, gelecekte en çok2 bot bulunacak kalıcı oyun kuralı değil, onay bekleyen ilk pilot tavanıdır. Yeni alan/işletmeci/çalışan ihtiyacı sonradan kontrollü plan revizyonu gerektirir.

Önerilen ikinci seçenekte taslak yeterlik eşlemesi:

| Plan satırı (kişi adı/ID değildir) | Tesisatçılık | İşletmecilik | Temel Öğreticilik | İleri Öğreticilik | Konut ihtiyacı |
| --- | --- | --- | --- | --- | --- |
| Tesisat alan öğretim görevlisi | 6 | Öğretime atanmadı | 5 | 3 | 1 |
| İşletmecilik alan öğretim görevlisi | Öğretime atanmadı | 6 | 5 | 3 | 1 |

“Atanmadı” alan seviyesi0 demek değildir; diğer sabit alanlar profil kararı olmadan doldurulmaz. Temel/İleri Öğreticilik'i doğrudan öğretime açmak bu ilk iki alan planına dâhil değildir; alan=6 istisnası, kapsama ve kapasite yeniden değerlendirilir. 5/3 pedagojik NPC profili profesör değildir; profesör veya özel ders NPC'si otomatik eklenmez.

## 5. Karar çıktısı ve geçiş kapıları

Karar dosyası tamamlandığında aşağıdakiler ayrı ayrı imzalı/sürümlü karara dönüşmelidir; repository'de `approved=true` yazmak canlı çalıştırma yetkisi değildir:

1. **Politika kararı:** D01 oyuncu kapsamı + başlangıç politikası; D04 alan listesi, N/P/H ve sabit rol/profil kapsaması. Bugün hepsi yukarıdaki açık alanları içerir.
2. **Kod/şema incelemesi:** yalnız onaylı sınırların küçük A1 dilimi; disposable test ve RLS/GRANT incelemesi. [A1 planı](A1_IMPLEMENTATION_PLAN.md).
3. **Canlı boş migration onayı:** hedef/SQL/history ve eski veri özeti incelenir; population/backfill içermez.
4. **Gerçek oyuncu actor backfill onayı:** kapsam ve idempotent eşleme ayrı; skill/para/meslek değiştirme yok. Skill initialization A2 için ayrıca değerlendirilir.
5. **NPC provisioning/seed onayı:** onaylı sınırlı plan, sabit profiller, konut ve replay kontrolü. Yalnız bundan sonra gerçek NPC oluşturulabilir.
6. **PR merge ve yayın onayı:** ayrıca verilir; yukarıdaki kararların biri diğerlerini otomatik yetkilendirmez.

Bu hazırlık PR'ı yalnız kararları ve test edilebilir geliştirme sınırını sunar. D01/D04 değerleri onaylanmadan gerçek bot nüfusu veya canlı seed yoktur; A1 temelinin uygulanmış/tamamlanmış olduğu iddia edilmez.
