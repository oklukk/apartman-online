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

AGENTS güvenliği ve UI/UX v2 tasarımı korunur. Bu kurallar işletme/üniversite özelliklerini mevcut oyunda uygulanmış hâle getirmez.

## 2. Karar kaydı — açık ve engelleyici konular

**P0** ilgili ilk uygulanabilir PR'dan önce onay ister; **P1** daha sonraki dilimden önce gerekir. Bir sayısal önerinin burada bulunması, kabul edildiği anlamına gelmez.

| ID / öncelik | Açık konu veya gerilim | Önerilen yön / onay gerektiren nokta | Bloke ettiği dilim |
| --- | --- | --- | --- |
| D01 / P0 | Mevcut kişilerin başlangıç yetenekleri, XP eğrisi/günlük limit | Legacy technical/ofis işi skill'e otomatik çevrilmesin; kendi karakteri için kaynaklı başlangıç snapshot'ı. Gerçek başlangıç değerlerini kullanıcı belirlesin. | A1–A2 |
| D02 / P0 | Yetenek 0 hangi işi yapar? Maaş grubu 0 yok | Ücretli mesleki iş için minimumu açık belirle; 0'ın eğitim/çıraklık statüsü ayrı. Sessizce 1–3 grubuna sokma. | A3, B, C |
| D03 / P0 | Eğitim süresi/ücreti, giriş/mezuniyet/sertifika, öğretici yetkisi | Alan hedefi eğitmeni aşmasın; Temel/İleri hangi hedefe kadar, hangi prerequisite ve müfredat? 7–10 için gerçek uzman/uygulama yolu ayrıca tanımlansın. | A3–A4 |
| D04 / P0 | Bot öğretici 6 ile olağan çalışan 3; alan öğreticilikse 5/3 ile 6 çakışması | Öğretici özel standart, alan 6 öncelikli sabit profil; çelişen görevler farklı kalıcı NPC. Aynı actor'ın skilli işe göre değişmesin. | A1, A3 |
| D05 / P0 | İşletme açılış sermayesi/ücreti, tür lisansı, owner çalışma eşiği | Business≥5 tek kesin açılış yeteneği; ek profesyonel şart varsa açık katalog. Başlangıç 300 OP tekrar verilmez. İşletmecilik 5'e erişim, işletme sayısı, sermaye/serbest gelir çekimi ve owner emeğinin gelir türü seçilsin. Ücret/iş teminatı çekilemez. | B2 |
| D06 / P0 | Genel seviye/Q formülü, bakım/mevki/donanım kaynakları | Mimari Q katsayıları yalnız örnektir. Kaliteyi gerçek iş yapan mesleğe bağla; bot genel=5 ayrı. İlk prototipte yükseltme/arsa piyasası geliştirme. | B2 |
| D07 / P0 | Kaynak tedariki, depo birimi, iş/hizmet kotaları, TTL ve sıra | İlk tesisat için küçük manuel sistem tedarik kataloğu; fiyat/stok kaynağı/period/teklif TTL kullanıcıca belirlenmeli. Otomatik satın alma kesinlikle yok. | B3–B4 |
| D08 / P0 | Eski oy harcaması hemen debit; yeni hizmet settlement'ı ikinci harcama riski | Yeni hizmet satın alma onayı + escrow türü önerilir. Eski oylama aynen sürer; yeni proposal modeli mi, yeni handler mı? Yönetici değişiminde imzalanmış işin yetkisi korunmalı mı? | B5 |
| D09 / P0 | Legacy günlük 100 OP + sözleşme maaşı çakışması | Opt-in ve gelecekteki gün sınırında kaynak değiştirme; tek gelir dönemi kimliği. Aynı gün çift sistem/sözleşme maaşı ve geçmiş kesinti yok. Ek iş 25 OP'nin yeni limitteki yeri seçilsin. | C2 |
| D10 / P0 | Her bant referans tutarı, birimi ve insan maaş farkı | Bot referansını dönem/sürümle yayımla. İnsan ücreti > referans. Saatlik/günlük/iş birimi; skill grubu değişince sonraki döneme güncelleme ve referans artışına sözleşme uyumu seçilsin. | C1–C2 |
| D11 / P0 | Bot işletmesinde sınırsız çalışan/çoklu işler ve sınırlı kişisel üretim | Bütün bot işleri arasında ortak kişi/gün gelir/XP/gerçek görev limiti; miktarlar ve çevrimdışı hak ediş koşulu belirlensin. İşletme başına toplam insan sınırı koyma. | C2–C3 |
| D12 / P0 | Fesih tazminatı formülü, süre hesabı, ücret teminatı | İlk pilotta sabit süreli, azami tazminatı ve sözleşme yükümlülüğü önceden fonlanmış sözleşme; takvim/aktif gün, üst sınır ve haklı fesih tanımlansın. Kazanılmış ücret silinmez. | C1, C4 |
| D13 / P0 | Maaş düşürme politikası kesin değil | İlk prototipte maaş düşürme özelliği kapsam dışı tutulsun; rıza/yeni sözleşme/temerrüt modeli henüz seçilmedi. Bu, genel politika olarak “asla düşürülemez” demek değildir. | C1–C4 |
| D14 / P0 | Botun devam eden işi varken anında işe alma + birlikte çalışma yasağı | İnsan hemen başlarken botu “eski işleri bitirsin” diye aktif bırakma. Atomik görev devri veya açık iptal/iade politikası seçilmeli. İlk pilot uzun bot görevlerini sınırlandırabilir ama uygun başvuruyu keyfî geciktiremez. | C3 |
| D15 / P0 | Botlu ilan daima açık fakat işveren parası yetmiyorsa otomatik işe alım | Zorunlu bot kadrosu açılırken insan sözleşmesi teminatını rezerve et; owner çekemesin. Funding yokken ilanı sahte açık tutmak veya gizlice başvuruyu reddetmek çözüm değil. | C1, C3 |
| D16 / P1 | Aynı görevde kaç gerçek insan? Bir kişinin kaç sözleşmesi/işletmesi? | İnsan işletmelerinin kadro ve oyuncu aktif zaman sınırı açık seçilsin; bot işletmesindeki sınırsız insan sayısı korunur. Owner emeği gerçek görev ataması sayılır. | C1–C3 |
| D17 / P0 | İptal, kaynak tüketimi, kalite etkisi, garanti ve refund | İlk tesisat deterministik sonuç önerisi; tüketilmiş stok geri yaratılmaz. Kim iptal ederse hangi ücret/kapasite geri gelir? Eski defter silinmez. | B4–B5 |
| D18 / P1 | Bot ürününün standart etkisi ile değişken insan çalışan Q'su | Bot katalog etkisi sabit/sınırlı kalsın; yüksek skill/çalışan sayısıyla buff aşılamasın. Q gösterimi ve stacking/yenileme politikası onaylansın. | B2, C |
| D19 / P1 | İşveren hangi çalışan verisini görebilir? Binalar arası erişim? | İlk pilot tek insan binası + ayrı NPC katalog; sadece gerekli skill uygunluğu. Farklı binadaki gerçek profil/meslek paylaşımı rıza ve dar projeksiyon onayı olmadan açılmasın. | A4, B2, C3 |
| D20 / P0 | Ban/işletme kapanması, hak edilmiş ücret, açık escrow | Yeni üretimi durdur; kazanılmış hak ve finansal geçmişi koru. Çıkış/fesih/kurum kapanması ve imzalanmış işleri tamamlayacak yetki/operatör yolu tanımlansın. | B5, C2–C4 |

**İlk inceleme için öncelik:** D01–D04 eğitim prototipini; D05–D08 ve D17 kendi çalışan tesisat işletmesini; D09–D16 ücretli istihdamı açar. Her şey aynı anda kararlaştırılmak zorunda değildir; fakat ilgili blok çözülmeden o dilimin canlı geliştirmesine geçilmez.

## 3. Küçük ve test edilebilir PR sırası

Aşağıdaki PR'lar **gelecek önerisidir; bu görevde hiçbiri açılmayacak veya uygulanmayacak**. Her kod PR'ı en son onaylı main'den kendi dar dalına çıkar; migration yalnız ek dosya ve disposable test ile. Özellik tamamlanana kadar sunucu erişimi kapalı tutulur. Miktar/politika kararları kod PR'ından önce versiyonlanmış şartname güncellemesiyle onaylanır.

| PR | Ön koşul / dar kapsam | Zorunlu kabul testi ve açılma kapısı |
| --- | --- | --- |
| **A1 — Aktör ve sabit NPC temeli** | D01/D04; actor/player FK, ayrı NPC konut/profil, salt okunur projection; erişim konfigürasyonu fail-closed | Seed ikinci çalışmada çoğalmaz; bot Auth/üyelik/wallet/oy yaratmaz; insan bot evine atanamaz; sabit öğretici profilleri doğru. Katalog kurulumunun canlı çalıştırılması ayrı onay. |
| **A2 — Skill/XP çekirdeği** | A1; 0–10, skill catalog ve source ledger, günlük kazanım rezervasyonu | 0/10 sınırları; forged XP ve başka actor yazması reddi; bot skill mutasyonu reddi; eşzamanlı aynı kaynak bir kez; başlangıç snapshot'ı bir kez. Legacy maaş/oy veri özeti sabit. |
| **A3 — Tek kurs ve server öğrenimi** | A2 + D02/D03; Tesisatçılık kursu, gerekli öğreticilik snapshot'ları, koltuk/zaman, dar private worker | Eğitmen alanı/prerequisite, iki kişi son koltuk yarışı, erken/çift bitirme, TTL, bot seviye istisnası; cron tekrar/çökme. İlk ücretli kurs kapalı; finansman B1'e bağlı. |
| **A4 — Öğrenim ve tesisat uygulaması dikey prototipi** | A3; mevcut Dairem/İşler alt alanında kendi beceri+kurs durumu, bir öğrenim amaçlı tesisat uygulaması | Tam kurs→XP→uygulama→bir kez XP; yenile/geri/erişilebilirlik/390-1440; farklı kişinin skill/öğrenci verisi sızmaz. Uygulama **eğitim** diye etiketli; gerçek bina onarılmış/kasa ödenmiş gibi sunulmaz. Önce disposable + sentetik uçtan uca demo; ücretli iş yok. |
| **B1 — Defter/escrow köprüsü** | D07/D17; yeni operasyon/hesap defteri, mevcut wallet/treasury köprü referansları; dar kontrol API'si | Conservation, replay/payload conflict, paralel aidat/escrow/admin/cron, yetersiz bakiye, integer sınırı, ters kayıt; eski defter tekrar gösterilmez. Oyuncuya henüz ticaret UI açılmaz. |
| **B2 — Kendi çalışan tesisat işletmesi** | A2+B1+D05/D06 ve gerçek İşletmecilik eğitim yolu; Business≥5, sahip çalışma ataması, tür/donanım/bakım girdileri, ayrı seviye/Q read modeli | Business4 gerçek kişi reddi/bot owner4 sistem istisnası; owner yeterli değilse iş üretemez; Q'da meslek daha güçlü; bot genel5 sabit. Çalışan istihdamı yok. |
| **B3 — Manuel stok ve üç kapasite** | B2+D07; iki/az sayıda tesisat girdisi, depo hareketi, zaman slotu ve günlük hizmet kota modeli | Depo/iş/hizmet birbirinden bağımsız; kaynak otomatik alınmaz; rezervasyon negatif olmaz; aynı NPC'nin iki işletmede kotaları ayrı; son birim yarışı. |
| **B4 — Offline rezervasyon ve iş emri** | B3+D17; publish/accept/expire/cancel; fiyat ve politika snapshot'ı | Kaynak yetersiz teklif açılmaz; son stok/slot/OP için iki kabulden biri; TTL kabul yarışı; ağ replay; tek rezervasyondan tek order; manüel tedarik dışında hareket yok. Önce kişisel/sandbox müşteri, kasa bağlantısı yok. |
| **B5a — Apartman ihtiyaç/onay köprüsü** | B4+D08; yeni küçük tesisat ihtiyacı + bina hizmet onayı, legacy poll'u değiştirmeyen model | Üye/yönetici/personel ayrımı; görev bitimi/başkası adına harcama reddi; aynı onay ikinci order çıkarmaz; eski asansör harcaması aynen bir kez. Bütçe/escrow uygunluk testi. |
| **B5b — Sonuç/ödeme/etki ve pilot kabul** | B5a; gerçek iş completion, stok tüketimi, escrow settlement/refund, kaynaklı XP ve bina bakım etkisi | Aynı order tek ücret/etki/XP; server süre/revision; kaynak/OP üretmeyen cancel; worker crash/replay; iki gerçek oturum kabulü için ayrıca onay. İlk oynanabilir ücretli onarım bu kapıdan sonra açılır. |
| **C1 — İş/görev/ücret/sözleşme modeli** | B5b + D10/D12–D16; required role, ücret referansı, ilan ve ön fonlu sözleşme/teminat snapshot'ları | Bant sınırları0/1/3/4/6/7/8/9/10; insan maaşı referanstan üstün; role başına bot/insan constraint'i; botlu required ilan zorunluluğu; owner görev istisnası yok. Henüz başvuru kabul/çalışan üretimi açılmaz. |
| **C2 — Tek gelir kaynağı ve bordro** | C1+D09/D11/D20; opt-in income_mode, gelecek dönem geçişi, hak ediş ve payroll | Aynı gün legacy+contract iki maaş vermez; eski paraya dokunmaz; farklı bot işlerinden kişi/gün cap ortak; gün/hafta TR; earned wage ve ban ayrımı; ücret ödemesi tek, kayıp günlere sınırsız accrual yok. |
| **C3 — Başvuru ve atomik bot→insan değişimi** | C2 + D14/D15 çözümleri; bir gerçek görev için uygunluk→otomatik kabul→fonlu sözleşme→atama | İki uygun başvuru yarışı; tek bot çıkar; iş/fon/devralma bir yerde hata verirse tamamı rollback; aynı işte hiçbir aralıkta bot+insan çakışmaz; sahte kapalı/açık ilan yok; aynı bot başka işletmede kalabilir. |
| **C4 — Fesih/tazminat ve güvenli çıkış** | C3+D12/D13/D20; tek taraflı fesih, süre hesabı, hak ediş+ters kayıt; maaş düşürme kapsam dışı | Tam/ara dönem, aynı fesih tekrarı, tazminat teminatı, kazanılmış maaş, işletme kapanması; owner ile çalışan eşzamanlı istek ve cron. C3 canlı açılışı C4 bitene kadar kapalı. |
| **R1 — Bütünleşik denge/erişim/kabul** | A–C onaylı; dar UI tamamlama, regresyon/operasyon runbook'u, gerçek oturum kabul planı | Mevcut 7 test komutu + yeni PostgreSQL/Chromium; rollback ile açık escrow; aktif seçimleri/aidatı koruma; enflasyon/XP simülasyonu; ücretsiz kaynak bütçesi; ayrı canlı rollout onayı. |

A1–A4 ilk küçük **tesisatçılık ve öğreticilik prototipi**dir; ileride çalışanın oynayacağı beceri/öğrenim akışı kanıtlanır. B1–B5 ücretli, kendi çalışan işletme ve apartmana gerçek hizmet dilimidir. C1–C4 çalışanlı işletme/istihdam dilimidir. Hepsini tek büyük migration veya PR'da birleştirmek önerilmez.

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

### UI ve kabul

Mevcut dört sekme, Pages hash+Auth fragment, dar ekranlar320/390/768/1440, iki tema/büyük yazı/klavye/hareket azaltma, sosyal profilde gizli veri, chat draft/scroll ve personel modal akışları regresyon kalır. Eğitim, depo, aktif iş ve hizmet kotası ayrı adlarla ve gerçek server verisiyle gösterilir. “Bot” etiketi açık, presence/sahte oyuncu veya hayalî stok yoktur.

Gerçek Auth/MFA/Realtime kabulü yeni kod PR'larında ayrıca listelenir; sentetik Chromium veya disposable Auth claims testi bunun yerine geçmez. Canlıya test verisi/tarih müdahalesi yoktur. Gerçek çalışan/işletme kabulü ancak yalıtılmış test tamamlanıp kullanıcı rollout onayı geldikten sonra, veri koruyan senaryo ile yapılır.

## 5. Denge ve operasyon kabul kapıları

Önce disposable/simülasyon: minimum ve maksimum skill, tüm ücret bantları, 2 ve 12 gerçek sakin, bir NPC'nin çoklu işletmesi, bot kurumunda çok sayıda gerçek çalışan. Ölçümler: kişi başı günlük net faucet/sink, öğrenim/uygulama XP üst sınırı, ilk aidatı ödeme süresi, 1.200 OP bakım ihtiyacının finansmanı, işletme nakit akışı, stok/slot kıtlığı, ücret+tazminat teminatı. Burada bir gelir/XP hedef değeri icat edilmedi; denge hedeflerini kullanıcı onaylamalıdır.

Ücretsiz plan için worker batch süresi/kilit bekleme/cron gecikmesi, RLS sorgu planı, indeks ve Realtime fan-out ölçülür. Test verisi ölçeği bir planlama simülasyonudur; üretim kapasitesi garantisi değildir. Ölçmeden yeni ücretli servis veya ayrı backend önerilmez.

Yayın sırası: karar onayı → küçük kod PR'ı → disposable SQL + UI testleri → PR inceleme → ayrı migration/seed/pilot onayı → önce/sonra veri karşılaştırması → kontrollü etkinleştirme. Backfill/worker/feature flag/istihdam geçişi birbirinden ayrı review adımlarıdır. Eski migration'lar yeniden çalıştırılmaz; rollback kayıt silmez.
