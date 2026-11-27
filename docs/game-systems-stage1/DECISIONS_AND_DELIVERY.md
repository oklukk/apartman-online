# Kararlar, küçük prototipler ve PR sırası

**Taslak; uygulamaya başlama onayı değildir.** Mevcut [envanter](CURRENT_SYSTEM_INVENTORY.md) ve [mimari](ARCHITECTURE.md) ile birlikte okunur. Belgedeki seçenekler bağımsız şekilde canlıya uygulanmayacak; ilgili engelleyici kararın onayı ilgili kod PR'ının ön koşuludur.

## 1. Kullanıcının kesin kuralları

1. Yetenekler 0–10; oyuncu eğitim/üniversite/mesleki uygulamayla gelişir. Bot kalıcı kimlik/profil/meslek/konut ve sabit yetenek taşır.
2. Gerçek oyuncu İşletmecilik ≥5 ile işletme açar. Genel seviye ile hizmet kalitesi ayrıdır; hizmette mesleki yetenek İşletmecilikten daha etkilidir. Bakım, mevki, donanım ve ekip yetkinliği etkilidir.
3. Bot işletmecinin gerekli yetenekleri 4, olağan bot çalışanın mesleki yeteneği 3; bot işletmesi genel seviye 5. Üniversite öğreticisi alan 6, Temel Öğreticilik 5, İleri Öğreticilik 3; öğretilen alan öğreticilikse alan 6 önceliklidir.
4. Depo, aktif iş, hizmet kapasitesi ayrı; offline teklif rezervasyonlu; kaynak otomatik satın alınmaz.
5. Yeterli sahip çalışabilir. Aynı işletme/görevde en fazla bir bot; o görevde gerçek insanla birlikte çalışamaz. Aynı bot çok sayıda işletmede çalışabilir; kapasitesi işletmeye özgüdür.
6. Botlu zorunlu kadroda insan ilanı sürekli açık; uygun başvuruda bot çıkar, insan otomatik alınır. Bot işletmesi gerçek istihdamına sayı sınırı konmaz; kişisel gelir/XP sınırlıdır.
7. Maaş bantları 1–3 / 4–6 / 7–8 / 9–10; bot işletmesi referans, insan işletmesi ilgili gruptan daha yüksek maaş sunar. İşveren tek taraflı fesihte süreye bağlı tazminat öder. Maaş düşürme **belirsizdir**.
8. Bot ürün/hizmet etkisi standart ve sınırlıdır. Uygun işlerde düşük seviyeli insanın temel kapasitesi bottan yüksek olabilir; bu kalite üstünlüğü demek değildir.
9. Ekonomi apartmanın bakım/onarım/yönetim/kasa/sosyal yaşamına bağlıdır. İnsanlar ve botlar ayrı konut binalarında yaşar.
10. Öğretim görevlisi: Temel Öğreticilik ≥5, İleri ≥3, alan ≥6. Profesör: Temel=10, İleri ≥5, alan ≥6. Özel öğretmen ayrı yeterliktir ve profesörün eğitim verimliliğini aşamaz; özel öğretmen için bu revizyonda ayrı sayısal alt sınır atanmadı (D03). Öğrenci/ders kapasiteleri açık tasarımdır.
11. Dolu insan kadrosuna daha yüksek seviyeli başvuruda önceden belirlenen işveren politikası kullanılır: tazminatlı değiştirme veya eski sözleşmeyi koruyan ek kadro. Maaş düşürme üçüncü kesin seçenek değildir; D13 açıktır.
12. Bot karakterler oyuncu işletmesinin ürün/hizmet müşterisi olabilir; bot apartmanları onarım talep edebilir. Fiyat-performans, sıklık ve bütçe sınırlarıyla; para kaynağı ayrı ve denetlenebilir olmalıdır. Sayı/formül/kaynak tercihi henüz onaylanmadı.
13. Kayıtlı otomatik ihale kuralı gerçek teklif değildir. **Son 10 dakikada** otomatik gerçek teklif denemesi kararlaştırıldı. Gerçek teklif kaynak/kapasite rezerve eder; kaybedince tek release, kazanınca aynı rezervasyonun iş emrine devri gerekir.
14. Botun hızlı tamamlama kotası sonrası işler gecikmeli teslimat veya ileri randevuya gider; sayılar henüz belirlenmedi. Depo/aktif iş/hizmet kapasitesi ayrımı aynen sürer.
15. Bot nüfusu planlı/sınırlı; her kalıcı botun tek kimlik/profil/konutu var. Çoklu işletme ataması yeni NPC/konut yaratmaz. Her aktif öğretilebilir alanın bot öğretim görevlisi kapsaması nüfus/konut kapasitesiyle birlikte planlanır.
16. **A1–A4 eğitim prototipidir; B5b ilk tamamlanmış ücretli apartman hizmeti döngüsüdür.** Bot müşteri otomasyonu, kapsamlı öğretmen unvanları veya otomatik ihale uğruna B5b geciktirilmez.

AGENTS güvenliği ve UI/UX v2 tasarımı korunur. Bu kurallar işletme/üniversite özelliklerini mevcut oyunda uygulanmış hâle getirmez.

## 2. Karar kaydı — açık ve engelleyici konular

**P0** ilgili ilk uygulanabilir PR'dan önce onay ister; **P1** daha sonraki dilimden önce gerekir. Bir sayısal önerinin burada bulunması, kabul edildiği anlamına gelmez.

| ID / öncelik | Açık konu veya gerilim | Önerilen yön / onay gerektiren nokta | Bloke ettiği dilim |
| --- | --- | --- | --- |
| D01 / P0 | Mevcut kişilerin başlangıç yetenekleri, XP eğrisi/günlük limit | Legacy technical/ofis işi skill'e otomatik çevrilmesin; kendi karakteri için kaynaklı başlangıç snapshot'ı. Gerçek başlangıç değerlerini kullanıcı belirlesin. | A1–A2 |
| D02 / P0 | Yetenek 0 hangi işi yapar? Maaş grubu 0 yok | Ücretli mesleki iş için minimumu açık belirle; 0'ın eğitim/çıraklık statüsü ayrı. Sessizce 1–3 grubuna sokma. | A3, B, C |
| D03 / P0 | Eğitim/öğretmenlik: kesin eşikler, kalan verim ve kapasite | Öğretim görevlisi ≥5/≥3/≥6, profesör 10/≥5/≥6 kesindir; özel öğretmen verimi profesörü aşamaz. Onaylanan sayılar öğretim görevlisi/profesör içindir; özel öğretmenin ayrı sayısal politikası açıktır, başka unvandan otomatik kopyalanmaz. Öğrenci/grup/aktif ders/period kapasitesi, verim formülü, 7–10 ve mezuniyet/gelir açıktır. Özel ders kapalı kalabilir; bot öğretim görevlisiyle A3 yolu ayrıdır. | A3–A4; özel ders/unvan genişlemesi B5b sonrası |
| D04 / P0 | Sınırlı NPC nüfusu, konut ve alan/eğitmen kapsaması | Nüfus planı/kimlik listesi/konut tavanı ve aktif alan kapsaması seçilsin. Genel bot çalışan3 ile öğretim görevlisi6/5/3 istisnası korunur; öğreticilik alanında6 öncelikli. İş/ihale/müşteri ilişkisi bot üretmez; kaynak yetmeyen alan otomatik yeni NPC ile açılmaz. | A1, A3 |
| D05 / P0 | İşletme açılış sermayesi/ücreti, tür lisansı, owner çalışma eşiği | Business≥5 tek kesin açılış yeteneği; ek profesyonel şart varsa açık katalog. Başlangıç 300 OP tekrar verilmez. İşletmecilik 5'e erişim, işletme sayısı, sermaye/serbest gelir çekimi ve owner emeğinin gelir türü seçilsin. Ücret/iş teminatı çekilemez. | B2 |
| D06 / P0 | Genel seviye/Q formülü, bakım/mevki/donanım kaynakları | Mimari Q katsayıları yalnız örnektir. Kaliteyi gerçek iş yapan mesleğe bağla; bot genel=5 ayrı. İlk prototipte yükseltme/arsa piyasası geliştirme. | B2 |
| D07 / P0 | Tedarik, üç kapasite ve hızlı bot kotası sonrası sıra | Manuel girdi/stok/depo, hızlı kota/dönem, gecikmeli teslimat veya ileri randevu ufku, ders kapsamlı alt limitler ve TTL sayıları seçilsin. Otomatik kaynak alımı yok. İleri rezervasyon yeni gün hızlı kotasıyla iki kez sayılmaz; dolu kuyruk sınırsız uzamaz. | B3–B4; geniş bot hizmeti B5b sonrası |
| D08 / P0 | Apartman onayı ve ihale/son-10-dakika ayrımı | Eski poll ikinci debit yapmaz. B5a dar hizmet onayını seçer. Daha sonraki ihalede kural kaydı kaynak tutmaz; gerçek teklif tutar. Son10dakika kesindir; kısa/uzatılmış ihale, eşitlik, teklif değişikliği, kapanış/batch ve müşteri bütçesi kuralları açıktır. Gerçek kaynak yoksa teklif yok. | B5a onay köprüsü; D2–D3 ihale ayrıntıları |
| D09 / P0 | Legacy günlük 100 OP + sözleşme maaşı çakışması | Opt-in ve gelecekteki gün sınırında kaynak değiştirme; tek gelir dönemi kimliği. Aynı gün çift sistem/sözleşme maaşı ve geçmiş kesinti yok. Ek iş 25 OP'nin yeni limitteki yeri seçilsin. | C2 |
| D10 / P0 | Her bant referans tutarı, birimi ve insan maaş farkı | Bot referansını dönem/sürümle yayımla. İnsan ücreti > referans. Saatlik/günlük/iş birimi; skill grubu değişince sonraki döneme güncelleme ve referans artışına sözleşme uyumu seçilsin. | C1–C2 |
| D11 / P0 | Bot ücret limiti ve bot müşteriden para girişi ayrı | Bot işlerinde kişi/gün gelir/XP sınırı korunur. Bot alıcının periyot/global/tüketici/bina bütçesi, alım sıklığı ve satıcı yoğunlaşma limiti seçilsin. Merkezi sınırlı talep bütçesi mi, bot ücretlerinden kapalı havuz mu? Kaynak henüz onaylanmadı; aynı para tahsis+satışta iki kez yaratılmaz. İade bütçeye döner. | C2–C3 gelir; D1 bot müşteriler |
| D12 / P0 | Süreye bağlı tazminat ve yüksek seviyeliyle değiştirme | Tek taraflı fesih ve önceden seçilmiş değiştirme politikasında eski hak ediş+tazminat zorunludur. Formül, süre, haklı fesih/üst sınır ve teminat seçilsin. Yeni işe alım fonlanmadan eski sözleşme silinmez; ek kadroda eski sözleşme aynen kalır. | C1, C4 |
| D13 / P0 | Maaş düşürme politikası kesin değil | İlk prototipte maaş düşürme özelliği kapsam dışı tutulsun; rıza/yeni sözleşme/temerrüt modeli henüz seçilmedi. Bu, genel politika olarak “asla düşürülemez” demek değildir. | C1–C4 |
| D14 / P0 | Botun devam eden işleri ile anında insan alımı | Bot→insan zorunlu geçişi, dolu insan kadrosundaki iki politikadan ayrıdır. Botu eski işleri bitirirken aynı görevde insanla aktif tutma; devir/iptal/iade ve bekleyen randevu politikası seçilsin. Uygun başvuru keyfî geciktirilemez. | C3 |
| D15 / P0 | Botlu ilan daima açık fakat işveren parası yetmiyorsa otomatik işe alım | Zorunlu bot kadrosu açılırken insan sözleşmesi teminatını rezerve et; owner çekemesin. Funding yokken ilanı sahte açık tutmak veya gizlice başvuruyu reddetmek çözüm değil. | C1, C3 |
| D16 / P1 | Önceden işveren politikası ve insan ek-kadro sınırları | Tazminatlı değiştirme veya eski sözleşme korunan ek kadro önceden ilan/snapshot olmalı; başvurudan sonra geriye yürütülemez. İlgili alan/seviye kıyası, eşitlik, politika değişimi, insan işletmesi ek kadrosu ve çoklu sözleşme sınırları seçilsin. Bot işletmesindeki sınırsız insan sayısı korunur. | C1, C3–C4 |
| D17 / P0 | İş/teklif/ihale iptal ve kaynak/para iadesi | Tüketilmiş stok yeniden yaratılmaz. Kaybeden gerçek teklifin stock/slot/kotası bir kez release; kazananın aynı rezervasyonu ordera transfer olur. Gerçek iş iptali, gecikmeli teslimat/randevu refund ve garanti koşulları seçilsin. İhale iptal/sonuçsuzsa ayrılmış alıcı bütçesi de tek release olur. | B4–B5; D2–D3 ihale |
| D18 / P1 | Bot ürün etkisi ve bot alıcının fiyat-performansı | Bot çıktısı standart/sınırlı kalır; Q/stack politikası seçilsin. Alıcı değerlendirmesinde gerçek etki/Q, fiyat ve vaat edilen teslimat birlikte; kalite/ücret tavanı, skor ağırlığı/eşitlik/dağıtım henüz formül değildir. Sırf genel seviye5 veya en düşük fiyat otomatik kazanan değildir. Ürün alım kolunun bitmiş ürün katalog/stock kaynağı da onaylanmalı; servis talebi var diye ürün üretimi uygulanmış sayılmaz. | B2, C; D1–D2 alıcı seçimi |
| D19 / P1 | İşveren hangi çalışan verisini görebilir? Binalar arası erişim? | İlk pilot tek insan binası + ayrı NPC katalog; sadece gerekli skill uygunluğu. Farklı binadaki gerçek profil/meslek paylaşımı rıza ve dar projeksiyon onayı olmadan açılmasın. | A4, B2, C3 |
| D20 / P0 | Ban/kapanma, hak edilmiş ücret, açık işler ve NPC bütçe | Yeni üretimi ve yetkisi kalmayan otomatik kuralı durdur; eski ücret/iş/ihale/escrow geçmişini koru. Kazanılmış hak, bekleyen teslimat/randevu, teklif rezervasyonu ve tüketilmemiş NPC fonunun kapatma/geri çekme yolu seçilsin. Geç worker ikinci ödeme veya kazanan yaratamaz. | B5, C2–C4, D1–D3 |

**İlk inceleme için öncelik:** D01/D02, D03'ün A3 için gerekli eğitim/kapasite kısmı ve D04 eğitim prototipini; D05–D08'in temel onay kısmı ve D17 dar tesisat işletmesini; D09–D16 istihdamı açar. D08'in ihale/otomasyon, D11'in müşteri bütçesi, D18'in bot alıcı seçimi ayrıntıları **B5b ön koşulu değildir**. Özel öğretmen eşikleri ve kapsamlı profesör ekranları da ilk bot öğretim görevliliği kursunu genişletme gerekçesi değildir. Her şey aynı anda kararlaştırılmak zorunda değildir; ilgili blok çözülmeden o dilim açılmaz. D01–D20 kimlikleri korundu; kesinleşen eşikler açık sayıymış gibi yeniden sorulmaz.

## 3. Küçük ve test edilebilir PR sırası

Aşağıdaki PR'lar **gelecek önerisidir; bu görevde hiçbiri açılmayacak veya uygulanmayacak**. Her kod PR'ı en son onaylı main'den kendi dar dalına çıkar; migration yalnız ek dosya ve disposable test ile. Özellik tamamlanana kadar sunucu erişimi kapalı tutulur. Miktar/politika kararları kod PR'ından önce versiyonlanmış şartname güncellemesiyle onaylanır.

| PR | Ön koşul / dar kapsam | Zorunlu kabul testi ve açılma kapısı |
| --- | --- | --- |
| **A1 — Aktör ve sabit NPC temeli** | D01/D04; sınırlı nüfus/konut planı, alan/eğitmen kapsaması, actor/player FK, salt okunur projection; erişim konfigürasyonu fail-closed | Seed ikinci çalışmada çoğalmaz; bot Auth/üyelik/wallet/oy yaratmaz; insan bot evine atanamaz; bir bot çoklu işte aynı kimlik/konutla kalır; tavan ve alan kapsaması; sabit öğretici profilleri doğru. Katalog kurulumunun canlı çalıştırılması ayrı onay. |
| **A2 — Skill/XP çekirdeği** | A1; 0–10, skill catalog ve source ledger, günlük kazanım rezervasyonu | 0/10 sınırları; forged XP ve başka actor yazması reddi; bot skill mutasyonu reddi; eşzamanlı aynı kaynak bir kez; başlangıç snapshot'ı bir kez. Legacy maaş/oy veri özeti sabit. |
| **A3 — Tek kurs ve server öğrenimi** | A2 + D02/D03; Tesisatçılık kursu, öğretim görevlisi ≥5/≥3/≥6, öğrenci/ders slotu, dar private worker | Eğitmen eşik/prerequisite, iki kişi son öğrenci/ders slotu yarışı, erken/çift bitirme, TTL, bot alan istisnası; cron tekrar/çökme. İlk ücretli kurs kapalı; finansman B1'e bağlı. |
| **A4 — Öğrenim ve tesisat uygulaması dikey prototipi** | A3; mevcut Dairem/İşler alt alanında kendi beceri+kurs durumu, bir öğrenim amaçlı tesisat uygulaması | Tam kurs→XP→uygulama→bir kez XP; yenile/geri/erişilebilirlik/390-1440; farklı kişinin skill/öğrenci verisi sızmaz. Uygulama **eğitim** diye etiketli; gerçek bina onarılmış/kasa ödenmiş gibi sunulmaz. Önce disposable + sentetik uçtan uca demo; ücretli iş yok. |
| **B1 — Defter/escrow köprüsü** | D07/D17; yeni operasyon/hesap defteri, mevcut wallet/treasury köprü referansları; dar kontrol API'si | Conservation, replay/payload conflict, paralel aidat/escrow/admin/cron, yetersiz bakiye, integer sınırı, ters kayıt; eski defter tekrar gösterilmez. Oyuncuya henüz ticaret UI açılmaz. |
| **B2 — Kendi çalışan tesisat işletmesi** | A2+B1+D05/D06 ve gerçek İşletmecilik eğitim yolu; Business≥5, sahip çalışma ataması, tür/donanım/bakım girdileri, ayrı seviye/Q read modeli | Business4 gerçek kişi reddi/bot owner4 sistem istisnası; owner yeterli değilse iş üretemez; Q'da meslek daha güçlü; bot genel5 sabit. Çalışan istihdamı yok. |
| **B3 — Manuel stok ve üç kapasite** | B2+D07; iki/az sayıda tesisat girdisi, depo hareketi, zaman slotu ve günlük hizmet kota modeli | Depo/iş/hizmet birbirinden bağımsız; kaynak otomatik alınmaz; rezervasyon negatif olmaz; aynı NPC'nin iki işletmede kotaları ayrı; hızlı kota dolunca gelecekteki slot/randevu ve dönem yenilemede çift hak yok; son birim yarışı. |
| **B4 — Offline rezervasyon ve iş emri** | B3+D17; publish/accept/expire/cancel; fiyat ve politika snapshot'ı | Kaynak yetersiz teklif açılmaz; son stok/slot/OP için iki kabulden biri; TTL kabul yarışı; ağ replay; tek rezervasyondan tek order; manüel tedarik dışında hareket yok. Önce kişisel/sandbox müşteri, kasa bağlantısı yok. |
| **B5a — Apartman ihtiyaç/onay köprüsü** | B4+D08'in temel kısmı; yeni küçük tesisat ihtiyacı + dar doğrudan bina hizmet onayı; ihale motoru olmadan, legacy poll'u değiştirmeyen model | Üye/yönetici/personel ayrımı; görev bitimi/başkası adına harcama reddi; aynı onay ikinci order çıkarmaz; eski asansör harcaması aynen bir kez. Bütçe/escrow uygunluk testi. |
| **B5b — Sonuç/ödeme/etki ve pilot kabul** | B5a; gerçek iş completion, stok tüketimi, escrow settlement/refund, kaynaklı XP ve bina bakım etkisi | Aynı order tek ücret/etki/XP; server süre/revision; kaynak/OP üretmeyen cancel; worker crash/replay; iki gerçek oturum kabulü için ayrıca onay. İlk oynanabilir ücretli onarım bu kapıdan sonra açılır. |
| **C1 — İş/görev/ücret/sözleşme modeli** | B5b + D10/D12–D16; required role, önceden değiştirme/ek-kadro politikası, ücret referansı, ilan ve fonlu sözleşme/teminat snapshot'ları | Bant sınırları0/1/3/4/6/7/8/9/10; insan maaşı referanstan üstün; role başına bot/insan constraint'i; botlu required ilan zorunluluğu; owner görev istisnası yok. Henüz başvuru kabul/çalışan üretimi açılmaz. |
| **C2 — Tek gelir kaynağı ve bordro** | C1+D09/D11/D20; opt-in income_mode, gelecek dönem geçişi, hak ediş ve payroll | Aynı gün legacy+contract iki maaş vermez; eski paraya dokunmaz; farklı bot işlerinden kişi/gün cap ortak; gün/hafta TR; earned wage ve ban ayrımı; ücret ödemesi tek, kayıp günlere sınırsız accrual yok. |
| **C3 — Başvuru ve atomik bot→insan değişimi** | C2 + D14/D15/D16; bot→insan otomatik geçişi ve önceden seçilmiş ek-kadro politikası; tazminatlı insan değiştirme C4'e kadar kapalı | İki uygun başvuru yarışı; tek bot çıkar; iş/fon/devralma bir yerde hata verirse tamamı rollback; aynı işte hiçbir aralıkta bot+insan çakışmaz; sahte kapalı/açık ilan yok; aynı bot başka işletmede kalabilir. |
| **C4 — Fesih/tazminat ve güvenli çıkış** | C3+D12/D13/D16/D20; tek taraflı fesih ve yüksek seviyeliyle tazminatlı değiştirme, eski hak ediş+fonlu yeni giriş atomik; maaş düşürme kapsam dışı | Tam/ara dönem, aynı fesih tekrarı, tazminat teminatı, kazanılmış maaş, işletme kapanması; owner ile çalışan eşzamanlı istek ve cron. C3 canlı açılışı C4 bitene kadar kapalı. |
| **D1 — Sınırlı bot müşteri ve apartman talebi** | B5b sonrası; C ücretleriyle kaynaklar ayrılır. D04/D11/D18/D20; mevcut kalıcı NPC/bina ihtiyacı, kaynaklı bütçe/sıklık, fiyat-performans ile doğrudan ürün/hizmet/onarıma sipariş | Son bütçe için iki alım yarışı, dönem ve tüketici/global tavanı, atama artınca ek nüfus/para yok, aynı ihtiyaç tek harcama, gecikmeli teslimatı hesaba katma, refund bütçeye; otomatik ihale şart değil. |
| **D2 — Dar ihale ve gerçek teklif yaşamı** | B4+B5a/B5b+D1 ve D08/D17/D18; bütçeli talep, manuel gerçek teklifler, seçim/sonuç; rezervasyon/lose/award transfer | Tek kaynakla iki teklif verilemez; kayıpta bir release, kazanımda aynı rezervasyon; no-winner/cancel müşteri bütçe iadesi; eşitlik/revision/kapanış ve çift sonuçlandırma yarışı. Otomatik teklif yok. |
| **D3 — Son 10 dakika otomatik teklif** | D2; önceden owner kural kaydı, yetki/sürüm kontrolü, sınırlı worker denemesi | Kural kaydı stok tutmaz; pencere dışında/kapanış sonrası gerçek teklif yok; son10dk içinde gerçek teklif atomik rezervasyon; kaynak yoksa alım/teklif yok; ban/yetki iptali, kural güncelleme/worker replay ile duplicate yok. |
| **R1 — Bütünleşik denge/erişim/kabul** | A–D onaylı; dar UI tamamlama, regresyon/operasyon runbook'u, gerçek oturum kabul planı | Mevcut 7 test komutu + yeni PostgreSQL/Chromium; rollback ile açık escrow; aktif seçimleri/aidatı koruma; enflasyon/XP simülasyonu; ücretsiz kaynak bütçesi; ayrı canlı rollout onayı. |

**Oynanabilirlik sınırı:** A1–A4 **yalnız eğitim prototipidir**; ücretli apartman hizmeti tamamlandı diye sunulmaz. **B5b ilk tamamlanmış ücretli apartman hizmeti döngüsüdür:** gerçek ihtiyaç/onay → kaynak/kapasite/para rezervasyonu → onarım → tek ücret/XP/bina etkisi → görülebilir sonuç. B1–B5b'nin amacı bu tek dikey dilimdir.

B5b'ye kadar kapsamlı özel ders/profesör/üniversite yönetimi, geniş ürün pazarı, bot müşteri talep motoru veya otomatik ihale eklenmez. İlk döngü, gerçek insan apartmanının doğrudan onaylı tesisat işiyle doğrulanabilir. Gerekli eğitim/slot/escrow çekirdeği bunun dışındaki modülleri “hazır olsun” diye topluca geliştirme gerekçesi değildir.

C1–C4 çalışanlı işletme/istihdam; **D1–D3 B5b sonrasında** bot talebi ve ihaledir. Üç yeni PR, sayı korumak için değil üç ayrı test edilebilir risk sınırı için eklendi: (D1) para kaynağı ve tüketici sınırları, (D2) gerçek ihale/rezervasyon/sonuç, (D3) zamanlı talimat yürütme. Artık 18 önerilen teslim adımı vardır; hepsini tek migration/PR'a veya B5b öncesine sıkıştırmak önerilmez. Her dilimin kendi test/kabulü vardır; R1 önceki dikey dilimlerin testini ertelemez.

Üniversitenin bu prototipte yalnız mevcut türü temsil eden dar kurum/kurs modeli bulunur; fakülte/üniversite yönetim ekranı, diploma pazarı, detaylı kariyer ağacı veya serbest oyuncu ticaret pazarı yoktur. Yeni modül ancak gerçek backend ve testinden sonra UI'da gösterilir.

## 4. Yeni test şartnamesi

### Veri koruma ve yetki

- Her migration'da önceki yedi migration'la kurulmuş dolu fixture: Auth/profile/üyelik/daire/mesaj/oy/davet/kasa/cüzdan/aidat/görev hash ve sayıları; izin verilen yalnız yeni nesneler. Tekrar backfill, sıfırlanan kasa/maaş/grant yok.
- RLS hem anon/outsider/aynı bina hem owner/çalışan/öğrenci/staff kapsamıyla; public READ projection'ında yalnız allowlist alanlar. Yetki metadata/user_id/actor_type ile sahteleştirilemez.
- Yeni staff yazmaları AAL1 reddi, AAL2 + izin/kapsam/gerekçe/audit, yetki iptali lock yarışı; yalnız permission catalog eklemek çalışan endpoint sayılmaz.
- Doğrudan authenticated DML ve private internal EXECUTE reddi; guarded player mutasyonlarının eski aliases'ına bypass yok. Muting eğitim/maaşı chat gibi bloke etmez; ban iş üretimi ve kazanılmış hak politikasına göre sınanır.

### Finans ve eşzamanlılık

- Escrow + aidat + admin düzeltmesi + cron aynı bakiyeyi iki kez harcayamaz. Eski kaynaklar kontrolsüz “hold” parayı tüketemez.
- Request replay, farklı actor/payload ile replay, iki HTTP retry, worker transaction öncesi/sonrası crash; tek ledger/effect/XP/payroll.
- Tüm transfer bacakları ve bakiye/defter mutabakatı; explicit faucet/sink dışı para artışı yok. Ters kayıt eski satırı silmez; iki kez iade yok.
- Son malzeme/koltuk/görev kotası/iş slotu, TTL-kabul ve işe alım/fesih/worker yarışları gerçek PostgreSQL bağlantılarıyla; yalnız JS simülasyonu değil.
- Aynı botun çoklu işletme kotası ayrıdır. İnsan sayısı sınırsız bot işletmesinde kişi bazlı ortak limit; hesap/iş/skill değiştirerek resetlenmez. Sınırsız eşzamanlı gerçek iş, bot atama sayısıyla kâr veya XP çoğaltma yok.
- Türkiye gece yarısı/pazartesi, skill bant geçişi, sözleşme/ücret sürümü değişimi; eski borç/oy/maaş snapshot'ı değişmez.

### Yeni kuralların kabul senaryoları (taslak; bu PR'da çalıştırılmış test değildir)

- Öğretim görevlisi 5/3/6 geçer; 4/3/6, 5/2/6, 5/3/5 geçmez. Profesör 10/5/6 geçer; 9/5/6, 10/4/6, 10/5/5 geçmez. Botun alan öğreticilikse 6 önceliği ve profesör olmayan 6/5/3 kimliği korunur. Özel ders eşikleri doğrulanmadan kabul açılmaz; tüm verim çarpanlarından sonra özel öğretmen profesörü aşamaz.
- Nüfus/konut tavanı ve alan/eğitmen kapsaması; aynı botun birden çok ataması yeni actor/konut/para üretmez. Son öğrenci/ders slotu, hızlı hizmet kotası ve son gelecek randevu için yarış; dolu kuyrukta hayalî anında iş yok.
- Yüksek seviyeli başvuruda önceden seçilmiş değiştirme politikasında tazminat+hak ediş+yeni sözleşme atomik; ek kadroda eski sözleşme/maaş değişmez. Fon yetersizliği veya eşzamanlı başvuruda kısmi işten çıkarma yok; maaş düşürme testi onaylanmış seçenek varsaymaz.
- Bot müşteri sıklık/tüketici-bina/global bütçe limitleri ve fiyat-performans uygunluğu; aynı onarım ihtiyacı bir kez. Bir tahsis+satış iki faucet sayılmaz; iptal/iade veya çoklu iş ilişkisi yeni bütçe, XP veya nüfus yaratmaz.
- Otomatik kural kaydında stok/kapasite aynı; pencere açılınca gerçek teklif rezervasyonu. Kapanış−10dk sınırı, kapanış anı, kısa/uzatılmış ihale ve geç worker politikası; teklif zamanı server kilidinden sonra kontrol edilir. Aynı stok için iki ihale, kaynak eksikliği, çoklu kural/yeniden deneme, kayıpta tek release, kazanımda kesintisiz devir; sonuçsuzda buyer bütçesi bir kez geri açılır.

### UI ve kabul

Mevcut dört sekme, Pages hash+Auth fragment, dar ekranlar320/390/768/1440, iki tema/büyük yazı/klavye/hareket azaltma, sosyal profilde gizli veri, chat draft/scroll ve personel modal akışları regresyon kalır. Eğitim, depo, aktif iş ve hizmet kotası ayrı adlarla ve gerçek server verisiyle gösterilir. “Bot” etiketi açık, presence/sahte oyuncu veya hayalî stok yoktur.

Gerçek Auth/MFA/Realtime kabulü yeni kod PR'larında ayrıca listelenir; sentetik Chromium veya disposable Auth claims testi bunun yerine geçmez. Canlıya test verisi/tarih müdahalesi yoktur. Gerçek çalışan/işletme kabulü ancak yalıtılmış test tamamlanıp kullanıcı rollout onayı geldikten sonra, veri koruyan senaryo ile yapılır.

## 5. Denge ve operasyon kabul kapıları

Önce disposable/simülasyon: minimum ve maksimum skill, tüm ücret bantları, 2 ve 12 gerçek sakin, bir NPC'nin çoklu işletmesi, bot kurumunda çok sayıda gerçek çalışan. Ölçümler: kişi başı günlük net faucet/sink, öğrenim/uygulama XP üst sınırı, ilk aidatı ödeme süresi, 1.200 OP bakım ihtiyacının finansmanı, işletme nakit akışı, stok/slot kıtlığı, ücret+tazminat teminatı; ayrıca NPC nüfus/alan kapsaması, bot hızlı kota ve ileri kuyruk, tüketici sıklık/bütçesi, global NPC OP girişi ve ihale rezervasyon baskısı. Burada bir gelir/XP hedef değeri icat edilmedi; denge hedeflerini kullanıcı onaylamalıdır.

Ücretsiz plan için worker batch süresi/kilit bekleme/cron gecikmesi, RLS sorgu planı, indeks ve Realtime fan-out ölçülür. Test verisi ölçeği bir planlama simülasyonudur; üretim kapasitesi garantisi değildir. Ölçmeden yeni ücretli servis veya ayrı backend önerilmez.

Yayın sırası: karar onayı → küçük kod PR'ı → disposable SQL + UI testleri → PR inceleme → ayrı migration/seed/pilot onayı → önce/sonra veri karşılaştırması → kontrollü etkinleştirme. Backfill/worker/feature flag/istihdam geçişi birbirinden ayrı review adımlarıdır. Eski migration'lar yeniden çalıştırılmaz; rollback kayıt silmez.
