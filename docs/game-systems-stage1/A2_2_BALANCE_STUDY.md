# A2-2 — XP dengesi, ilerleme eğrileri ve çevrimdışı simülasyon

**Durum: kullanıcı incelemesine sunulan araştırma; bütün yeni sayılar ÖNERİ / SİMÜLASYON VARSAYIMIDIR.**
Başlangıç: `4c2521d574b7d095a4a6c526d4fa7575078d9bd7` (PR #23 sonrası).
Hiçbir paket seçilmiş oyun kuralı değildir. Uygulamaya, SQL'e veya canlı dünyaya uygulanmamıştır.

**Revizyon notu:** 1–12. bölümlerdeki A/B/C paketleri ve sınırsız içerik erişimli ölçümler tarihsel kontrol karşılaştırmasıdır. Yeni tasarım hedefi ve takvim deneyleri [13. bölümde](#13-sınırlı-öğrenme-ve-günlük-oyun-döngüsü) yer alır. Takvim A/B/C, XP paketi A/B/C ile karıştırılmamalıdır.

## 1. Önce bütünleşik üç seçenek

| Öneri | A — Hızlı | B — Dengeli | C — Uzun vadeli |
| --- | --- | --- | --- |
| Eğri | Doğrusal: kademe başına 80 XP | Karma: 20/40/80/120/180/260/380/560/800/1100 | Artan: `30 × hedef_seviye²` |
| Toplam L10 | 800 XP | 3540 XP | 11550 XP |
| Başlangıç / kurs / kitap / uygulama / ücretli iş XP | 20 / 32 / 14 / 24 / 40 | 12 / 24 / 8 / 18 / 30 | 8 / 18 / 6 / 12 / 24 |
| Günlük sınır | Oyuncu genelinde 100 XP | Genel 110 + yetenek başına 70 XP | Yetenek başına 55 XP; genel sınır yok |
| Uzmanlık | Yalnız XP | L7: iki başarılı ileri uygulama; L9: 20 dk proje; L10: 10 dk yeterlilik | L7: dört uygulama; L8: 30 dk proje; L9: 15 dk yeterlilik; L10: 60 dk bitirme çalışması |
| Çoklu yetenek | Bir kaynak, tek ana yetenek | Hizmet yalnız mesleğe; ayrı doğrulanmış yönetim faaliyeti İşletmeciliğe | Hizmet toplam XP'sinin %80'i mesleğe, %20'si İşletmeciliğe |
| 30 dk, tek yetenek: L1 / L3 / L5 / L7 / L10 günü | 2 / 4 / 6 / 8 / 12 | 1 / 3 / 9 / 20 / 67 | 1 / 12 / 46 / 117 / 325 |
| 30 dk, iki yetenek: İşletmecilik 5 / ikisi de 10 | 13 / 25 gün | 19 / 150 gün | 92 / 650 gün |
| Güçlü yanı | Erken erişim, düşük giriş yükü | İlk ödül erken, orta hedefler ulaşılabilir | Uzmanlık uzun ömürlü, sabit botlar başlangıç desteği |
| Başlıca risk | Uzmanlık günler içinde tüketilir | Tavan sonrası çalışma cazibesini kaybedebilir | İşletme açma gecikir; tek alan ve çok alan oyuncusu ayrışır |

**İnceleme önerim B paketidir; uygulama onayı değildir.** A kısa pilot veya hızlı tur dünyasına, C uzun sezon ve geniş içerik havuzuna daha uygundur. Üçü de bağımsız geçerli seçeneklerdir; B'nin bütün parametrelerinin birlikte onaylanması gerekmez. C'nin çoklu ödül yolu mevcut tek-hedef kaynak sözleşmesiyle uygulanamaz; aşağıda ayrıca ele alınır.

## 2. Mevcut durum ve araştırmanın sınırı

- `actor_skills` tek kanonik seviye/XP tablosudur; bu çalışma onu okumaz veya yazmaz.
- Katalog, A1 oyuncu/NPC oluşturma ve A2 kaynak **rezervasyonu** vardır. XP dağıtımı, seviye yükseltme, başlangıç dersi, kurs, üniversite, kitap okuma, mesleki uygulama, işletme ve ücretli hizmet bu aşamada etkin değildir.
- `xp_source_claims.source_id` dünya genelinde tek UUID'dir; kaynak türü, aktör ve hedef yetenek bağını değiştirerek tekrar kullanılamaz. Mevcut kayıt **ödül miktarı veya gerçekleşmiş XP kredisi değildir**. `reserved_on` kazanım günü sayılamaz.
- Eski meslek, günlük ek iş ve maaşlar karakter XP'si üretmez. Başlangıç 300 OP, günlük maaş 100 OP, ek iş 25 OP ve başlangıç haftalık aidat 150 OP kuralları korunur. Bu araştırma OP geliri, fiyat, ücret veya kasa akışı hesaplamaz.
- Bot çalışan meslek 3; bot işletmeci meslek 4 ve İşletmecilik 4; bot öğretim görevlisi alan 6, Temel 5, İleri 3 olarak sabittir. Botlar ilerlemez ve XP almaz.
- Yetkiler, Auth/MFA, RLS, RPC, cron, frontend, eski migration'lar ve NPC nüfus planları değiştirilmez. Üretim uygulaması analiz dosyalarını içe aktarmaz.

Bu rapor yeni eğitim veya ödül sistemi tasarımının **sayısal adaylarını** inceler. Simülasyonun belleğindeki `Ledger`, bir sunucu ödül uygulaması, güvenlik kanıtı veya gerçek XP kaydı değildir.

## 3. Tekrar üretilebilir deney tasarımı

Kaynak: [`analysis/xp-balance/`](../../analysis/xp-balance/README.md).
Parametreler ayrı [`config.json`](../../analysis/xp-balance/config.json) dosyasında; hiçbir üretim ayarı bu dosyayı okumaz.

Tüm profiller dört alanda 0 seviye / 0 XP başlar. Günlük üst zaman bütçeleri 15, 30, 60, 120 ve 180 dakikadır; 240/360 dk duyarlılığı ayrıca vardır. Günlük bütçe harcanması zorunlu değildir; biten hedefte çalışma durur. Zaman, varsayımsal **doğrulanmış etkin emektir**; açık sekmede bekleme süresi değildir. Oyuncunun normal sohbet/gezinti süresi ayrıca modellenmez.

**Erişim varsayımları:** her alanda sıfırdan erişilebilir ücretsiz başlangıç dersi, yeterli sayıda farklı ders/kitap bölümü, gözetimli uygulama, gerekli seviyeye uygun eğitmen ve parçalı yeterlilik fırsatı hazır kabul edilir. Bu, gerçekte var olan bir eğitim hizmeti veya eğitmen kapasitesi iddiası değildir. İleri içerik/eğitmen arzı ayrıca tasarlanmalıdır; pilot alan 6 öğretim görevlisi tek başına alan 10'a eğitim verebilir diye varsayılmaz. Faaliyetlerin OP maliyeti, sıra bekleme ve pazar talebi temel karşılaştırmadan çıkarıldığı için sonuçlar iyimser erişim senaryosudur.

- Başlangıç dersi yetenek başına bir kez, 5 dk. Sonraki faaliyetler: kurs 15 dk (günde en çok 3), kitap 10 dk (2), uygulama 10 dk (3). Bu sayılar **öğrenci faaliyet tekrarı** varsayımıdır; öğretmenin öğrenci/ders kapasitesi formülü değildir.
- Temel senaryoda ücretli hizmet yoktur. Ayrı deneyde 15 dk hizmet (günde en çok 2) ancak varsayımsal Tesisatçılık 3 + İşletmecilik 5 sonrasında açılır. İşletmecilik 5 mevcut işletme açma tasarım şartıdır; **Tesisatçılık 3 burada yalnız karşılaştırma/erişim varsayımıdır**, kesin hizmet yeterliliği değildir. Her seçilen hizmet için gerçekçi talep ve doğrulanmış başarı hazır sayılır; talep yokken XP oluşması öngörülmez.
- İki alanlı ana strateji: 15 dk profil aktif günleri dönüşümlü tek alana ayırır; ≥30 dk profil süreyi iki alana 5 dk bloklarla böler, gün içi işlem sırasını dönüşümlü yapar. Ayrıca bütün profiller için dönüşümlü günler ve önce İşletmecilik 5 sonra Tesisatçılık 3 stratejisi karşılaştırılır. **30 dk eşiğinde strateji de değişir**; süre farkını tek neden saymayın.
- Faaliyet seçimi süre ve tekrar kısıtları içinde ham XP'yi artıran deterministik bir paketleme hesabıdır. Tavanı dikkate almadan seçer: kaybedilen potansiyel XP, aynı çalışmanın tavansız karşılığıdır. Oyuncuya tavana rağmen çalışmasını önermiyoruz; rasyonel oyuncu daha erken durabilir.
- Yeterlilikler ücretsiz, tek oyuncuyla erişilebilir ve 5 dk parçalara bölünebilir kabul edilir. İleri uygulama sayacı yalnız seviye 6'dan **sonraki başarılı** uygulamaları sayar. Yeterlilik etkinliğinin kendisi 0 XP'dir. XP üst sınırı L10 toplamıdır; yeterlilik yokken XP birikebilir ama seviye geçmez. Bu biriktirme politikası da onay bekler.
- Ana deneyde başarı %100'dür; her beşinci uygulama/hizmet/yeterlilik denemesinin başarısız olduğu duyarlılık ayrıca ölçülür. Başarısızlık süre tüketir, XP ve başarı kanıtı üretmez.
- Düzensiz profil pazartesi/çarşamba/cumartesi oynar. Ara veren profil 15–28. günler yoktur. Geç gelen profil 31. gün başlar. Uzun ara senaryosu ayrıca 31–90. günler (60 gün) yoktur. Gerçek kayıt tarihi yerine **2027-01-04 sentetik pazartesi** kullanılır; yayın takvimi değildir.
- Sonuçlar 7/14/30/60/90/180. günlerde kaydedilir. L10 gecikirse aynı varsayımlarla en çok **1460 güne** uzatılır; 180 sonrası kilometre taşları gözlenen 180 günlük sonuç değildir. CSV'de boş kilometre taşı ulaşılamayan/ufuk dışı hedefi gösterir.

## 4. Eğriler, formüller ve çalışma miktarı

Hedef seviye `l`, kademe maliyeti `Δ(l)`, toplam maliyet `T(l)=Σ(i=1..l) Δ(i)`; `T(0)=0`.

- A: `Δ(l)=80`, `T(l)=80l`. Başlangıç ve uzmanlık aynı maliyetli.
- C: `Δ(l)=30l²`, `T(l)=30l(l+1)(2l+1)/6`. Örnek `T(3)=30×14=420`, `T(10)=11550`.
- B: açık parametre dizisi `Δ=[20,40,80,120,180,260,380,560,800,1100]`. Örnek `T(5)=20+40+80+120+180=440`, `T(7)=1080`. İlk kademe 20, son kademe 1100 XP: motive edici giriş, 55 kat pahalı son adım.

[Sayısal ek](xp-balance-study/TABLES.md) her paket için **0–10 bütün kademe ve toplam tablolarını** içerir. Eğri biçimini paket ödülünden ayırmak için üçünün de toplamı ayrıca 3600 XP'ye ölçeklenmiştir. `3600×Δ/T(10)` oranları en büyük kalan yöntemiyle tamsayıya paylaştırılır; toplam değişmez. Bu eşit maliyetli tablolar alternatif oyun kuralı değildir, kontrollü karşılaştırmadır.

![Önerilen ve aynı toplamda karşılaştırılmış eğriler](xp-balance-study/curves.png)

**30 dk/gün tek yetenek: takvim günü / birikimli doğrulanmış çalışma dakikası**

| Hedef | A | B | C |
| --- | --- | --- | --- |
| L1 | 2 / 40 | 1 / 20 | 1 / 30 |
| L3 | 4 / 100 | 3 / 80 | 12 / 360 |
| L5 | 6 / 170 | 9 / 250 | 46 / 1380 |
| L7 | 8 / 240 | 20 / 600 | 117 / 3510 |
| L10 | 12 / 340 | 67 / 2000 | 325 / 9735 |

Dakikalar hedefe ulaşana kadar **gerçekten simüle edilen faaliyetlerin** toplamıdır; takvim günü × günlük bütçe olmak zorunda değildir. Son faaliyet hedefi aşabilir. B'de 15 dk profil ilk gün başlangıç 12 + kitap 8 = 20 XP ile L1 olur. İkinci günden 15 dk kurs 24 XP varsayımıyla `20+5×24=140`: L3 altıncı gündür. Aynı profil yalnız kursa giderse L5 için `ceil((440−20)/24)+1=19` gün gerekir. İleri aşamada yeterlilikler süre kullandığından bu basit bölme tüm üst seviyeleri açıklamaz.

Bir saati olan oyuncu her zaman iki kat hızlı ilerlemez. Örneğin B'de tek alanda günlük 70 tavanı, 60 dk profili L10'a 51 günde; 30 dk profili 67 günde ulaştırır. Çalışma ise 3030 ve 2000 dk olur: daha uzun oturum tavan sonrası daha fazla ham faaliyet yapmıştır. Bu, zorunlu günlük görev önerisi değil, tavanın gereksiz tekrar üretebildiğinin ölçümüdür.

## 5. Faaliyet ödülü seçenekleri ve kötüye kullanım

Aşağıdaki örneklerin tamamı varsayımsaldır; karşılaştırma betiği **sabit başarılı-tamamlama ödülünü** kullanır. Süre ve kalite alternatifleri tablo içindeki tasarım karşılaştırmasıdır, çalıştırılmış denge paketleri değildir.

| Faaliyet | Sabit / B adayı | Doğrulanmış emek-süre alternatifi | Sonuç alternatifi | Tekrar ve kötüye kullanım sınırı |
| --- | --- | --- | --- | --- |
| Başlangıç | Bir kez 12 XP / 5 dk | Sunucu ders adımlarına en çok 5 dk eşdeğeri | Küçük yeterlilik kontrolü sonrası 12 | Aynı aktör/alan için tek tamamlanma; yeni cihazla tekrar yok |
| Kurs / üniversite | 24 XP / 15 dk bölüm | `min(doğrulanmış_dk,15)×1.6`, tamamlama şartıyla | 24 × başarı katsayısı | Farklı bölüm kimliği; aynı bölümden tekrar ödül yok; oturum/bölüm kotası |
| Kitap / bireysel | 8 XP / 10 dk bölüm | Doğrulanmış ilerleme için en çok 0.8 XP/dk | Bölüm soruları/uygulaması sonrası 8 | Sayfa yenileme, istemci zamanlayıcı veya aynı bölüm döngüsü ödül sayılmaz |
| Mesleki uygulama | Başarılı 18 XP / 10 dk | En çok 1.8 XP/dk doğrulanmış görev emeği | Başarıyla tamamlanan görev için 18; başarısız deneme 0 | Gerçek farklı görev, sonuç kanıtı, günlük sayı; bot tıklama döngüsü yok |
| Gerçek ücretli iş | Doğrulanmış tamamlanma 30 XP / 15 dk | İşin doğrulanmış aşamaları için en çok 2 XP/dk | Doğrulanmış kaliteye göre sınırlı aday ödül | Siparişin tek tamamlanması; iptal/iade/tekrar çağrı tekrar ödül üretmez |

Örnek süre alternatifi: 15 dakikalık kurs için tarayıcı 50 dakika bildirse de en fazla 24 XP adayıdır. Sunucuda ders ilerleme kanıtı yoksa **0**; yalnız zamanın geçmesi yetmez. Kalite alternatifi örneği `24×min(1,başarı_oranı)` ve yuvarlama politikası olabilir; katsayı/formül onaylanmadı. Sınavı tekrar deneyip kaliteyi artırmak aynı tamamlanma kaynağından yeni ödül yaratmamalıdır.

Sabit ödül açıklanabilir ve idempotency kolaydır, fakat çok kısa işleri çiftçilik için teşvik edebilir. Süre temelli ödül uzun işleri gözetir, fakat AFK ve gereksiz uzatma yaratabilir. Sonuç temelli ödül ustalığı ödüllendirir, fakat düşük seviyedekileri kilitleyebilir. B için başlangıçta sabit, doğrulanmış tamamlanma adayını; süreyi ödül çarpanı yerine uygunluk/üst maliyet kontrolü olarak değerlendirmeyi öneriyorum. Bu bir uygulama kararı değildir.

Ücretli iş XP'si ileride siparişin sunucu tarafından doğrulanmış bitişine bağlanmalı. Aynı tamamlanma kimliği, aktör ve hedef değiştirilemeden tek kaynak olur; işveren, işletme, meslek veya RPC adı değiştirilerek ikinci ödül çıkarılamaz. Kendi kendine sipariş, karşılıklı sahte hizmet ve kaynak havuzunu yeniden adlandırma ayrı kötüye kullanım kontrolleri gerektirir. Bu araştırma bunları uygulanmış saymaz.

## 6. Günlük limitler ve kazanım günü

B ödülleri sabit tutulduğunda, ikinci aktif günde 180 dk bütçe için:

| Alan sayısı | Sadece genel 110: verilen / ham XP | Sadece alan 70 | Genel 110 + alan 70 |
| --- | --- | --- | --- |
| Tek | 110 / 142 | 70 / 142 | 70 / 142 |
| Dört | 110 / 312 | 280 / 312 | 110 / 312 |

Dört alana eğitim erişimi de varsayımdır. Sadece alan sınırı farklı meslek/işletme/alanlara yayılan oyuncuya daha çok toplam XP sağlar; C'nin geniş uzmanlık portföyünü hızlandırır. Sadece genel sınır tek alanda uzmanlaşmayı hızlandırır ama çeşitli faaliyetleri aynı havuzda yarıştırır. B'nin birlikte sınırı tek alanda 70, toplamda 110 tutar; çeşitlenmeye 40 XP alan bırakır, çok alan çiftçiliğini sınırlar. İşlem sırası son bütçeyi etkileyebilir; simülasyonda sıra dönüşür. Gelecekte önizleme bunu anlaşılır göstermelidir.

**15 ve 180 dk karşılaştırması, tek alan / 180 gün:**

| Paket | 15 dk verilen / tavan kaybı | 180 dk verilen / tavan kaybı | Seviye farkı (15 / 180 dk) |
| --- | --- | --- | --- |
| A | 800 / 0 | 800 / 716 | 10 / 10 |
| B | 3540 / 0 | 3540 / 3612 | 10 / 10 |
| C | 3218 / 0 | 9900 / 8468 | 6 / 9 |

Tavan kaybı, aynı varsayımsal tamamlanmaların **doğrulanmış ham XP'si − tavan sonrası XP**'dir. L10 toplamını aşan son ödül ayrıca `max_lost_xp`, başarısız denemenin potansiyeli ayrıca `failed_potential_xp` olarak tutulur; üçü karıştırılmaz. L10 ve bütün kapılar tamamlanınca o alanda yeni XP faaliyeti durur; 180 gün boyunca anlamsız çiftçilik varsayılmaz.

- Gün anahtarı sunucunun gerçek kazanım zamanından `Europe/Istanbul` ile hesaplanmalı. Örnek UTC 20:59 = Türkiye 23:59, UTC 21:00 = ertesi gün 00:00. İstemci tarihi veya cihaz saat dilimi kullanılmaz.
- Bir kaynak önceki gün rezerve edilip ertesi gün doğrulanırsa **kazanım gününün** limitini tüketir. `reserved_on` yalnız rezervasyon bilgisidir. Bu görev mevcut SQL'e kazanım tarihi eklemez.
- Aynı kaynak ertesi gün yeniden çağrıldığında kalan ödül alınmaz. Araştırma, tavanla kesilen kaynağı tüketilmiş sayar; devreden XP veya bekletilmiş kredi yoktur. Tamamlama öncesi XP kaybı uyarısı / kaynak tüketme politikası ayrıca onay gerektirir.
- İleride aktörün genel günlük sayacı ve `(aktör,yetenek,gün)` sayacı ile kaynak tüketimi ve kanonik XP güncellemesi **aynı atomik işlemde**, sabit kilit sırasıyla korunmalı. Farklı faaliyet, meslek, işletme ve yeniden denemeler aynı sayaçlara uğramalı. Aynı anda gece yarısına gelen işlemlerde kazanım anı bir kez sunucuda seçilmeli.
- Rezervasyon günlerine yayılmış kaynaklar tek günde tamamlanınca genel limiti aşamamalı. İki kaynak aynı kaynağın kopyasıysa farklı UUID vermek çözüm değildir; gerçek tamamlanma kimliğinin de tekilliği gerekir.
- Boş günlerin limitleri bankalanmaz. Bu tavanlar yeni bir cron, ödül RPC'si veya günlük sayaç tablosu olarak bu PR'da uygulanmaz.

## 7. Uzmanlık: XP'den fazlası ne kadar gerekli?

| Seçenek | Güçlü yanı | Kilitlenme / tekrar riski | Erişilebilirlik tedbiri |
| --- | --- | --- | --- |
| Yalnız XP | Açık, düşük işletim maliyeti | Aynı düşük işi tekrarla uzmanlık | İleri içerik çeşitliliği gerekir |
| XP + başarılı uygulama | Meslek pratiği anlamlı | Az talep olan meslekte ilerleme durabilir | Ücretli müşteri şartı yerine ücretsiz gözetimli uygulama alternatifi |
| XP + sınav/proje | Uzmanlığı farklılaştırır | Sınav kaygısı, eğitmen kuyruğu, tek oturum yükü | Ücretsiz, parçalara bölünmüş, tekrar denenebilir yeterlilik |
| Bazı seviyelerde hibrit | Eşikler anlamlı, her seviye bürokrasi değil | Kanıt kayıtları ve XP biriktirme daha karmaşık | L7/L9/L10 ile sınırlı aday; ayrı solo erişim yolu |

A'da yalnız XP; B'de L7 iki ileri uygulama, L9 20 dk proje, L10 10 dk yeterlilik; C'de daha uzun koşullar vardır. Ek deneyde her seviyede uygulama ve her seviyede yeterlilik modelleri de sınanır. Bunlar pedagojik verim formülü değil, ek ilerleme koşulu adaylarıdır.

**Yalnız kapı politikasını değiştirme, B eğrisi/ödülü/limiti sabit:** 15 dk profilde XP-only L10 148 gün, uygulama-only 150, yeterlilik-only 153, B hibrit 150, C tarzı geniş kapılar 156 gündür. 60 dk profilde çoğu seçenek 51 gün: günlük XP tavanı zaten belirleyicidir. Kapıları eklemek tek başına uzun dönem içeriği üretmez.

Yeterlilik erişimi tümüyle kapatıldığında B 30 dk profil 180 günde 3540 XP biriktirir ama **L6'da kalır**. Bu açık kilitlenme kanıtıdır; üst seviye uygun içerik mevcut olmadan bu kapılar etkinleştirilmemeli. Aşırı XP bankalama, kapı açılınca çok seviye atlamayı da kolaylaştırabilir; bankalama limiti/önizleme politikası sonraki karardır.

**Önceden kesinleşmiş öğretmenlik şartları değişmez:**

| Görev | Temel Öğreticilik | İleri Öğreticilik | Öğretilen alan |
| --- | --- | --- | --- |
| Özel öğretmen | ≥5 | Şart yok | ≥5 |
| Üniversite öğretim görevlisi | ≥5 | ≥3 | ≥6 |
| Profesör | 10 | ≥5 | ≥6 |

Özel öğretmen profesörden yüksek eğitim verimine ulaşamaz. Verim ve öğrenci/ders kapasitesi formülü bu çalışmada seçilmez. Üç alanlı özel senaryoda (Temel 10 + İleri 5 + Tesisat 6) 30 dk profil A'da 25, B'de 90, C'de 447 günde eşiklere ulaşır. Bu **otomatik unvan/işe alım veya çalışan üniversite** değildir; varsayımsal eğitim erişiminde seviye eşiklerinin birlikte maliyetidir.

## 8. Tek faaliyet, çoklu yetenek

| Politika | Yarar | Bedel / güvenlik koşulu |
| --- | --- | --- |
| Tek ana alan | Açıklanabilir; mevcut tek-hedef kaynak sözleşmesine uygun aday | İşletme sahibinin yönetim öğrenmesi ayrı faaliyet ister |
| Toplamı koruyan %80 ana / %20 yan | İki rolü yansıtır; yeni toplam XP üretmez | Ana alan yavaşlar; eşzamanlı iki alan/genel limit ve kaynak modeli genişlemesi gerekir |
| İşletmecilik yalnız ayrı yönetim faaliyetinde | Sahip olmayı otomatik ustalık saymaz; meslek ve yönetim emeği ayrılır | Gerçek, doğrulanabilir yönetim faaliyeti henüz yoktur; aynı hizmeti yeniden adlandırmak olamaz |

B hizmeti tek alana bağlar; işletme yönetimi için ayrı gerçek tamamlanma varsa en çok 10 dk/18 XP (günde 2) analiz adayıdır. Bu faaliyetin içeriği henüz geliştirilmemiştir. Kitap/uygulama erişimi olan temel simülasyonda aynı süre/ödüldeki yönetim faaliyeti çoğu kez mevcut uygulamanın yerini alır; **bağımsız yönetim öğrenme avantajı üretmediği** sonuçlarda görünür. Bu yüzden yeni yönetim mekaniği bu sayılarla gerekçelendirilmiş sayılmaz.

Örnek B hizmeti 30 XP: tek alan `30/0`; korunan bölüşüm `24/6`; toplamı artıran `30/6` ise **%20 ek ham XP** yaratır. Sonuncusu yalnız enflasyon duyarlılığıdır, paket önerisi değildir. 15 dk çift alan profilinde 180 günde ana-only toplam 4620 XP, korunan bölüşüm 4626, eklemeli bölüşüm 4992'dir. Korunan toplamların zaman içinde biraz farklılaşması, değişen seviyeler/sonraki faaliyet seçimi ve tavan etkisidir; tek hizmetin bütçesi artmaz. Tesisat L10 sırasıyla 249/275/249 gündür.

**Mevcut `xp_source_claims` bir UUID'yi bir hedef yeteneğe bağlar.** Çoklu ödül mevcut imzaya sahte alt UUID'ler üreterek sığdırılmamalı. İleride kullanıcı çoklu ödülü seçerse tek değişmez tamamlanma ebeveyni, ona bağlı benzersiz `(kaynak,yetenek)` tahsisleri, toplam ödül bütçesi ve aynı atomik işlemde tüm sayaçlar gerekir. Ebeveyn actor/kaynak kimliği değiştirilemez; tekrar deneme bütün ödül vektörüne göre eşleşir. Bu **gelecek tasarım alternatifidir**; mevcut rezervasyon/SQL değiştirilmez. B'nin tek ana ödülünü onaylamak bu genişlemeyi gerektirmez.

## 9. Oyuncu profilleri ve 180 günlük sonuçlar

Aşağıdaki çizim ve [tam ek](xp-balance-study/TABLES.md), bütün 15/30/60/120/180 dk profillerini her üç modelde karşılaştırır. CSV'de 7/14/30/60/90/180 günlerin tamamı vardır.

![Tek ve çift yetenek zaman içindeki seviye gelişimi](xp-balance-study/progression.png)

**İki yeteneğin eşzamanlı gelişimi — Tesisat / İşletmecilik seviyesi, 30 dk/gün:**

| Paket | 7g | 14g | 30g | 60g | 90g | 180g |
| --- | --- | --- | --- | --- | --- | --- |
| A | 2/2 | 5/5 | 10/10 | 10/10 | 10/10 | 10/10 |
| B | 3/3 | 4/4 | 6/6 | 7/7 | 8/8 | 10/10 |
| C | 1/1 | 2/2 | 3/3 | 4/4 | 4/4 | 6/6 |

**B: iki ayrı yeteneğin maliyeti, aynı başlangıç:**

| dk/gün | Tek Tesisat L3 | Tek İşletmecilik L5 | Çift alanda İşletmecilik L5 | Her iki alanda L10 | Önce İşletmecilik5 sonra Tesisat3 |
| --- | --- | --- | --- | --- | --- |
| 15 | 6g | 19g | 38g | 300g | 25g |
| 30 | 3g | 9g | 19g | 150g | 12g |
| 60 | 2g | 7g | 9g | 67g | 9g |
| 120 | 2g | 7g | 8g | 65g | 9g |
| 180 | 2g | 7g | 8g | 65g | 9g |

Sıralı hedef çalışması iş açma eşiğini erkene çekebilir; genel tavan nedeniyle her zaman üstün değildir. B 30 dk dönüşümlü tam günler stratejisinde iki L10 134 gün, eşit günlük bölmede 150 gündür; B 60 dk için aynı değerler 102 ve 67 gündür. Tek “oynama süresi → seviye” formülüyle bütün davranışlar temsil edilemez. Strateji sonuçları `dual_alternate` ve `business_first` satırlarında bulunur.

**3 saat üstü:** `long_sessions.csv` 180/240/360 dk'yı karşılaştırır. B'de tek L10 her üçünde 51 gün, çift L10 65 gündür. C'de çift L10 211/210/210 gündür. Üst süreyi artırmak yeni ilerleme alanı açmıyor; oyuncu sosyal veya yönetim faaliyetlerine yönelebilir. Yeni tekrar eden zorunlu XP görevleriyle bu boşluğu doldurmayı önermiyorum.

**Düzensizlik ve dönüş:** B 30 dk çift alan profilinde 90. gün düzenli 8/8, 14 gün ara veren 8/8, 31. gün başlayan 7/7, haftada üç gün gelen 6/6'dır. Aynı seviye farklı XP'yi gizleyebilir; [CSV](xp-balance-study/snapshots.csv) tam XP içerir. 180. gün ilk üç profil 10/10'a ulaşır; haftada üç gün gelen 8/8 ve 3624 toplam XP'dedir. Geç başlayan oyuncunun yetişmesi **sonlu L10 tavanından** kaynaklanır; ücretsiz geçmiş XP dağıtılmaz. Düzenli oyuncu bitişe daha erken ulaşmış, önceki dönemde daha fazla erişim sağlamıştır.

![Düzenli, düzensiz ve ara veren profiller](xp-balance-study/attendance.png)

İsteğe bağlı duyarlılık: ≥7 günlük aradan sonra yalnız bir kez 7 aktif gün boyunca doğrulanmış XP'ye %25 ek, aynı günlük sınırlar içinde. B'de 180 gün iki L10 çalışma miktarını 4470'ten 4440 dk'ya düşürür; dramatik telafi değildir. C'de dönüş senaryosunun 180g toplamı 5932 yerine 5988 olur. **Bu bonus paketlerin kuralı değildir.** Sürekli ara vererek avantaj, hesap yaşına göre ceza veya çevrimdışı biriken XP önermiyoruz. Geç başlayanlar için ücretsiz erişilebilir eğitim, içerik çeşitliliği ve eşit günlük tavanlar önce değerlendirilmelidir.

60 gün ara veren B 30 dk çift alan profili 30. günde 6/6 ve 1440 toplam XP iken 90. güne kadar aynı kalır; 180. günde 9/9 ve 5640 XP olur. Eski günlerin limitleri geri verilmez. Geçici seviye eşitliği, önceki erişim veya XP farkının kapanması anlamına gelmez.

İşletmecilik eğitimi erişilemez bırakıldığında bütün paketlerde İşletmecilik 0 kalır; iş açma hazırlığı ve ücretli hizmet XP'si oluşmaz. “19 gün” gibi sonuçlar mevcut oyunda ulaşılabilir hedef değil, gelecekteki varsayımsal erişimin maliyetidir.

## 10. Apartman ekonomisi, botlar ve motivasyon

- Bot çalışan 3'e karşı insanın Tesisat 3'e erişimi B'de tek odak 2–6 gündür; alan 6 öğretim görevlileri başlangıç referansı olarak kalır. İnsan daha sonra 7–10'a ilerleyebilir, bot sabit kalır. Seviye eşitliği aynı kapasite veya hizmet kalitesi demek değildir; insan/bot kapasite avantajı ve bot işletmesinin sabit genel 5 seviyesi burada yeniden formüle edilmez.
- İşletmecilik 5 bot işletmecinin 4 seviyesinin üstündedir. A'da 30 dk tek alan 6, B'de 9, C'de 46 gün; iki alana bölünürse 13/19/92 gün. A hızlı işletme arzı ve rekabet, C az sayıda erken işletmeci/uzun bot bağımlılığı riski taşır. B daha erken küçük apartman hizmeti döngüsü için uygun adaydır.
- Bunlar **erişim süresi etkileridir**, OP enflasyonu tahmini değildir. Sermaye, kaynak rezervasyonu, malzeme maliyeti, hizmet talebi, kadro, maaş ve bot müşteriler henüz bu modelde yoktur. İşletmecilik5 tek başına işletmenin kurulmuş/finanse edilmiş olduğunu göstermez.
- Eğitim apartman bakım ve onarımına açılan yol olmalı; sonsuz kitap tıklama döngüsü apartman oyununun yerini almamalı. Aynı içerik tekrarını ödüllendirmek yerine farklı görev/kanıt ve ücretli hizmette tek doğrulanmış tamamlanma gerekir.
- B'de 15 dk ilk seviye ilk gün, Tesisat3 altıncı gün: erken somut hedef vardır. 120–180 dk profillerin tavan sonrası kaybı büyüktür; günlük XP “yapılacaklar borcu” olarak sunulmamalı. Ödül dışında sosyal ilişki/ortak karar motivasyonu önemlidir; bu görevde yeni sosyal mekanik önerileri etkinleştirilmez.
- A'nın L10'a çok kısa süresi, yeni içerik eklenmeden tekrarı bitirir; reset/sonsuz prestij varsayılmaz. C'de 15 dk iki alan L10 1300 gün: erişilebilirlik ve geri dönme motivasyonu zayıflayabilir. B'de 300 gün daha makul olsa da altı aylık iki L10 hedefini kısa oynayan herkes karşılamaz; bu gerçek denge tercihi onay gerektirir.

## 11. Önerilen inceleme ve ayarlanabilir parametreler

B'yi **sınırlı çevrimdışı denge adayı** olarak tercih ediyorum: ilk seviye/mesleğe giriş erişilebilir, iki alan geliştirmenin bedeli görünür, günlük aşırı süre avantajı sınırlıdır. Dezavantajları tavan sonrası verimsizlik, çok alanlı kullanıcı için genel bütçe rekabeti ve henüz olmayan ileri eğitim/yeterlilik arzıdır. A veya C seçilirse de bu raporun karşılaştırma temeli korunabilir.

Parametreler daha sonra sürümlü ve sunucu kaynaklı yapılandırmaya uygun tutulmalı; bu PR üretim yapılandırması oluşturmaz:

- Kademe maliyetleri, faaliyet başına **sabit tamamlanma ödülü**, doğrulama uygunluğu ve günlük tekrar sayısı.
- Genel/alan tavanı, kazanım günü ve tavan nedeniyle kalan ödülün tüketilmesi/uyarısı.
- Üst seviye kanıtları, parçalı tamamlama, başarısızlıkta tekrar ve XP bankalama sınırı.
- Başlangıç ve ileri eğitim erişimi/maliyeti; eğitmen verimi/öğrenci kapasitesi hâlâ ayrı açık karardır.
- Tek kaynak/tek hedef ya da toplamı koruyan çoklu tahsis; gerçek yönetim faaliyeti tanımı.
- Sonlu L10 sonrası motivasyon; dönüş desteği yalnız ayrıca istenirse değerlendirilir.

`tuning.csv`, B ödüllerini ve **her iki tavanını birlikte** ±%25 değiştirir (tamsayı aşağı yuvarlama). 30 dk çift alan profilde ödül %75/%100/%125 iken İşletmecilik5 günü 25/19/15, Tesisat10 günü 200/150/121'dir; bu profilde tavan değişimi sonucu etkilemez. Yani her sorunu tavanla çözmek mümkün değildir. Daha uzun oturumlarda tavan etkisi vardır; tüm 27 kombinasyon dosyada bulunur.

**Kullanıcı onayı bekleyen kararlar:** paket/eğri, ödüller, günlük limit türü ve sayıları, 7–10 kapıları ve erişimi, XP bankalama/tavan kaybı, çoklu yetenek politikası, başlangıç eğitim yolunun gerçek erişimi. Öğretmenlik kesin eşikleri bu onay maddelerinden değildir; zaten korunur. Bir denge adayının seçilmesi canlı migration, kaynak rezervasyonu, NPC veya oyuncu oluşturma onayı değildir.

## 12. Teknik doğrulama, dosyalar ve sınırlamalar

- Betikler standart Python kütüphanesiyle çevrimdışı çalışır; parametre dosyası yalnız analizdir. Grafik için isteğe bağlı Matplotlib kullanılır; npm bağımlılığı eklenmez.
- 18 otomatik araştırma testi: maliyet toplamları, planın zaman/tekrar kısıtları, gün değişimi, kaynak tekrarının hedef değiştirememesi, tavan bileşimi, başarısız kanıt, üst XP sınırı, devretmeme, eksik eğitim/yeterlilik, parçalı proje, deterministik sonuç ve toplam korunumu.
- `study.py --check` CSV/JSON/Markdown'ı sıfırdan geçici dizinde üretip byte bazında karşılaştırır. PNG/SVG yeniden çizilebilir; Matplotlib/font sürümleri görüntü byte'larını etkileyebilir. Grafikler gerçek Matplotlib çıktısıdır, oyun ekran görüntüsü değildir.
- [`TABLES.md`](xp-balance-study/TABLES.md): insan tarafından okunur sayısal ek. `curves.csv`, `snapshots.csv`, `milestones.csv`, `daily.csv`, `cap_comparison.csv`, `sensitivity.csv`, `tuning.csv`, `long_sessions.csv`: ayrıntılı veri. `summary.json`: özet; `manifest.json`: parametre SHA256, başlangıç commit'i ve senaryo tanımları. Üç grafik PNG ve SVG olarak saklanır.
- Yerel doğrulama (28 Kasım 2026): araştırma 18/18, `study.py --check` birebir tekrar üretim, `npm test` 81/81, `npm run test:ui` ve `npm run build` başarılıdır. Bunlar uygulama regresyon kontrolleridir; araştırma testlerinin yerini almaz. PR'ın mevcut CI'ı ayrıca disposable PostgreSQL paketlerini çalıştırır; bu çalışma veritabanı test verisi oluşturmak için canlı projeye bağlanmaz.
- Simülasyon bir davranış tahmini veya güvenli ödül servisi değildir. Sosyal süre, OP bütçesi, pazar talebi, eğitmen kapasitesi, makro ekonomi ve gerçek oyuncu varyansı modellenmedi. Başarılı sentetik tamamlanmalar gerçek Auth/MFA/Realtime veya canlı eğitim kabul testi değildir.
- Güvenli geri alma: yalnız eklenen `analysis/xp-balance` ve bu rapor/sonuç dizinini geri al. Üretim kodu, eski doküman, şema veya veri geri alma işlemi gerekmez.

### Tekrar üretme

```sh
python3 -m unittest discover -s analysis/xp-balance -p 'test_*.py' -v
python3 analysis/xp-balance/study.py --check
# Grafikler isteğe bağlı; ortamda Matplotlib varsa:
MPLCONFIGDIR=/tmp/apartman-xp-mpl python3 analysis/xp-balance/study.py --figures
# Parametre deneyi repo sonuçlarını ezmeden ayrı dizine:
python3 analysis/xp-balance/study.py --config /tmp/xp-candidate.json --out /tmp/xp-candidate-results
```

Bu PR taslaktır. Birleştirme, yayın, üretim geliştirmesi veya canlı XP işlemi yapılmaz; denge ve tasarım kabulü kullanıcıya aittir.

## 13. Sınırlı Öğrenme ve Günlük Oyun Döngüsü

### 13.1 Karar ile öneriyi ayırma

**Kesin kullanıcı kararı:** gelişim yalnız XP biriktirmek değildir; zaman içinde açılan faaliyet, ön koşul, ilerleme sınırı ve başarılı uygulama gerekir. Her yetenekte sıfırdan erişilebilir başlangıç yolu bulunmalıdır. Dar dakikalık giriş zorunluluğu, giriş düğmesinden XP, zorunlu seri ödülü veya yoklukta seviye kaybı yoktur.

**Onay bekleyen sayılar:** aşağıdaki bütün takvimler, süreler, XP ödülleri, haklar, kontenjanlar, başarı sayıları ve gün sonuçları yalnız **öneri / çevrimdışı simülasyon varsayımıdır**. Mevcut A/B/C XP paketleri silinmedi; yeni deneylerde **B XP eğrisi, normal faaliyet ödülleri ve genel110/alan70 günlük tavanları sabittir**. Yeni takvim A/B/C bağımsız bir eksendir. Başlangıç paketi alternatiflerinde yalnız açıkça belirtilen faaliyet süresi/ödülü değişir; eğri değişmez.

[Sayısal takvim eki](xp-balance-study/calendar/TABLES.md), [parametreler](../../analysis/xp-balance/calendar-config.json), [tekrar üretme](../../analysis/xp-balance/README.md) ve `calendar/` altındaki CSV'ler yeni sonuçların kaynağıdır. İlk rapordaki sınırsız erişim varsayımı artık tasarım önerisi değil, karşılaştırma kontrolüdür.

### 13.2 Aşamalar, sonlu içerik ve yeterlilik

| Aralık | Önerilen öğrenme yolu | Ön koşul ve ilerleme sınırı |
| --- | --- | --- |
| 0–3 | Bir kez 5dk yönlendirilmiş uygulama; üç farklı başlangıç modülü; iki kitap bölümü; sınırlı günlük temel uygulama | İlk modül **seviye0** ile başlar; modüller sırayla tamamlanır. L3 için üç modülün başarısı gerekir. Temel faaliyetten XP en çok T(3)=140'a kadar; aynı modül/kitap tekrar XP vermez. NPC kurs kontenjanı gerekmez. |
| 4–6 | Dönem/gün pencereli meslek kursları; dört farklı kitap bölümü; gerçek farklı uygulamalar | L4: en az1 orta modül +3 başarılı orta uygulama; L5: en az2 modül +6 uygulama; L6: en az3 modül +10 uygulama. Kalan orta modüller 12 ile sınırlı; düşük aşama işi T(6)=700 üstüne ilerletmez. |
| 7–10 | İleri çalışma/portfolyo modülleri, farklı ileri uygulamalar ve yeterlilik | L7:1 ileri modül +4 ileri uygulama; L8:2 +10; L9:3 +18 ve20dk proje; L10:4 +28 ve10dk yeterlilik. İleri modül kataloğu12, kitap bölümü6; toplam XP T(10)=3540 ile sınırlı. Proje önceki seviye açıldıktan sonra başlar. |

Başlangıç/modül/kitap listeleri her yetenekte ayrı ve sonludur. Modül önceki modülün başarısını ister; başlangıç dersi kendisinin kazandıracağı seviyeyi istemez. Dört mevcut yeteneğin başlangıcı ayrı sınanır. **Pilot öğretim görevlileri yalnız Tesisatçılık ve İşletmecilik alanındadır:** Temel/İleri Öğreticilik için 4+ örgün eğitim pilotta mevcut sayılmaz; bu alanlar başlangıç sonrasında uygun öğretici arzını bekler. Öğretmen/profesör eşikleri 7. bölümdeki hâliyle korunur.

Temel çalışma kendi aşamasının XP tavanına geldiğinde yeni seviye üretemez. Gerekli kurs/başarı yoksa biriken XP seviyeyle aynı şey değildir. Yeterlilik çalışması 5dk parçalara bölünebilir; son parça ve başarılı doğrulama olmadan kanıt tamamlanmaz. Projeler XP vermez. Bir kitap bölümü, modül veya başarı kaynağı dönem/deneme kimliği değiştirilerek ikinci kez ödüllendirilemez.

**İleri yol sınırı:** alan6/Temel5/İleri3 olan iki NPC, alan7–10 öğretebilir varsayılmadı. Ana uzmanlık sonuçları, ayrıca onaylanıp geliştirilecek sınırlı ileri çalışma içeriği ve doğrulanabilir portfolyo değerlendirmesi **varsa** hesaplanır. Bu varsayımsal yol için ayrıca sınırlı değerlendirme kontenjanı vardır; yeni öğretim görevlisi/NPC oluşturulmaz. Yalnız mevcut pilotun bulunduğu `pilot_only` karşı senaryosu **L6 ve700 XP'de durur**. İleri kurs açılışı veya uzmanlık yetkilisi gerçekten mevcut değildir.

### 13.3 Üç öğrenme takvimi

Pencereler Türkiye yerel gününün00.00'ında açılır; son günün ertesi00.00'ında kapanır. Aşağıdaki günler Tesisatçılık içindir; aynı iki eğitmenin İşletmecilik takvimi bir gün kaydırılır. Pazar→pazartesi devirleri gün/hafta hesaplarında sınanır.

| Öneri | Takvim A — Esnek | Takvim B — Dengeli | Takvim C — Planlı |
| --- | --- | --- | --- |
| Uygulama hakkı (gün/hafta) | 2 /10 | 1 /5 | 1 /4 |
| Ayrı varsayımsal yeni görev arzı (haftada, oyuncu/alan) | 12 | 7 | 5 |
| Göreve erişim penceresi | 3 gün | 3 gün | 4 gün |
| Orta kurs yeni sunum günleri | Her gün | Pazartesi, çarşamba, cumartesi | İki haftada bir pazartesi, perşembe |
| Kurs katılım penceresi | 3 gün | 3 gün | 7 gün |
| Oyuncu kurs başlangıç hakkı (gün/hafta/alan) | 2 /4 | 1 /3 | 1 /2 |
| Aynı sunumun toplam kontenjanı | 2 | 2 | 2 |
| Eğitmen başına haftalık yeni kabul tavanı | 12 | 6 | 4 |
| Varsayımsal ileri içerik sunumu | Salı, cuma;4 gün açık | Cuma;7 gün açık | Dört haftada bir pazartesi;7 gün açık |
| İleri sunum kontenjanı / haftalık kabul | 2 /4 | 2 /2 | 2 /2 |
| Proje penceresi | Her gün /7 gün açık | Pazartesi, cumartesi /7 gün açık | İki haftada bir pazartesi /7 gün açık |
| Başarısız deneme bütçesi (hafta/alan) | 3 | 2 | 2 |

**Yeterlilik ≠ kontenjan ≠ takvim.** Öğretim görevlisinin alan/öğreticilik eşikleri ayrı doğrulanır. Uygun eğitmen bile haftalık kontenjanı aşamaz. Kontenjan bulunması da kapalı sunuma girmeyi veya ön koşulu atlamayı sağlamaz. Bu tabloda kapasite, yeni öğrenci kabul sayısıdır; kesin öğretme verimi/öğrenci kapasitesi formülü seçilmedi.

Başvurunca o sunumun toplam kontenjanı ve kabul haftasının eğitmen bütçesi bir kez tüketilir. Çalışmayı sonraki gün sürdürmek ikinci kabul sayılmaz. Pencere kapanırsa kısmi ilerleme korunur; sonraki sunuma yeni yer gerekir, aynı modül kimliğiyle devam edilir. Başarıdan sonra yeni sunuma kayıt dahi ikinci XP üretmez. Başarısızlık süre ve deneme hakkı harcar; bütçe bitince sonraki Türkiye haftası beklenir. Seviye düşmez. Kitap için günde en fazla bir bölüm tamamlanır; başlangıçta günde bir modül vardır.

Günlük uygulama ve kurs hakları **faaliyet türü/alan** düzeyindedir; başarısız uygulama da hakkı tüketir. Hepsinin verdiği XP ayrıca aynı genel/alan XP tavanına uğrar. Kullanılmayan haklar/XP limitleri birikmez. Farklı işletme, günün başka faaliyeti veya yeniden çağrı yeni hak yaratmaz.

### 13.4 Deney kapsamı ve bekleme tanımları

Referans, biri ölçülen olmak üzere **altı sentetik öğrencidir**; diğer beşi sabit30dk/gün oynar ve Tesisatçılık/İşletmecilik arasında dağılır. İki sınırlı pilot eğitmen vardır; arka plan oyuncuları kapasiteyi gerçekten tüketir. Günlük işlem önceliği dönüşümlüdür. Bu gerçek sınıf, oyuncu, NPC veya kurs kaydı değildir. Tek öğrenci,12 kişilik talep ve iki kat kurum kontenjanı da karşılaştırılır. Bunlar adil sıra veya garanti edilmiş bekleme süresi kanıtı değildir.

Ölçülen profiller15/30/60/120dk; rapor günleri7/14/30/60/90/180'dir. Tek Tesisatçılık, tek İşletmecilik ve iki alan; haftada üç gün katılım;14 gün ara; her beşinci denemede başarısızlık; yalnız pilot; düşük görev arzı ve başlangıç haftanın günü senaryoları vardır.180 sonrası kilometre taşları en çok1460 günlük aynı deneyin uzantısıdır. Kaynaklar tamamen sentetiktir.

Faaliyet önceliği modül→proje→kitap→uygulamadır; bu sabit davranış varsayımı optimal oyuncu stratejisi değildir.15dk iki alan günleri dönüşümlü, diğerleri günlük bölünmüş bütçe kullanır. Biten alanın artan bütçesi aynı gün otomatik aktarılmaz. Uzun oturumun kursa daha erken girmesi, diğer öğrencilerle yarışını da değiştirir; sonuçları mutlak dakika avantajı veya oyuncuyu cezalandırma kuralı saymayın.

- `no_work_active_days`: aktif olup **hiç öğrenme çalışması yapılamayan** gün. Gerçek bekleme riskine en yakın ölçüm.
- `zero_xp_active_days`: XP olmayan aktif gün; kısmi ders/proje gibi anlamlı0XP çalışma da buna girebilir. Boş beklemeyle eşit değildir.
- `unused_minutes`: ayrılmış ama kullanılmayan öğrenme bütçesi. Oyuncunun ekranda beklemesi gerekmez; sohbet/yönetim süresi değildir.
- `calendar_closed`, `instructor_capacity`, günlük/haftalık hak, ön koşul, tekrar bütçesi, XP tavanı ve aşama tavanı ayrı izlenir. Bir gün birden fazla kısıt olabilir; gün sayıları **toplanmaz**.
- `idle_minutes_*`, kullanılmayan bütçenin tek bir öncelikli açıklamasıdır: ileri yol yokluğu→eğitmen yokluğu→kontenjan→kapalı takvim→deneme bütçesi→haftalık→günlük hak→ön koşul→içerik→süre. Bu atıf nedensel ölçüm değildir; nedensel karşılaştırma tek değişken kaldırma deneyleridir. Sıfır kullanılmayan dakikada görülen kapasite reddi de “boş gün” değildir.

### 13.5 Yeni süreler — aynı B XP eğrisinde

**Tek Tesisatçılık: takvim günü / birikimli gerçek simülasyon çalışma dakikası.** Günlük ayrılmış bütçe bütünüyle harcanmak zorunda değildir. Aktif gün sayıları da `milestones.csv` içindedir.

| Takvim | dk/gün | L3 | L5 | L7 | L10 |
| --- | --- | --- | --- | --- | --- |
| A | 15 | 8 /100 | 29 /380 | 60 /710 | 195 /2130 |
| A | 30 | 4 /100 | 12 /300 | 29 /705 | 114 /2120 |
| A | 60 | 3 /110 | 10 /320 | 29 /760 | 116 /2210 |
| A | 120 | 3 /110 | 11 /345 | 29 /770 | 116 /2225 |
| B | 15 | 8 /100 | 26 /305 | 66 /705 | 239 /2125 |
| B | 30 | 5 /100 | 17 /305 | 51 /705 | 226 /2120 |
| B | 60 | 3 /100 | 16 /305 | 50 /710 | 225 /2125 |
| B | 120 | 3 /100 | 16 /305 | 50 /710 | 225 /2125 |
| C | 15 | 8 /100 | 31 /300 | 87 /700 | 311 /2105 |
| C | 30 | 5 /100 | 23 /295 | 85 /740 | 303 /2105 |
| C | 60 | 3 /100 | 23 /295 | 85 /740 | 303 /2105 |
| C | 120 | 3 /100 | 23 /295 | 85 /740 | 303 /2105 |

B eğrisinin eski sınırsız erişimli30dk referansında L10 **67 gündü**. Yeni226 gün sonucu XP maliyetinin yükseltilmesinden kaynaklanmaz. Çalışma2000→2120dk iken takvim çok daha fazla uzar; erişim ve haftalık hakların etkisi görünür.

![Aynı B eğrisinde üç sınırlı takvim](xp-balance-study/calendar/calendar-progression.png)

**İşletmecilik5: tek alan / iki alana ayrılan süreyle takvim günü**

| dk/gün | Takvim A | Takvim B | Takvim C |
| --- | --- | --- | --- |
| 15 | 24 /58 | 26 /56 | 31 /52 |
| 30 | 11 /24 | 18 /26 | 25 /31 |
| 60 | 10 /11 | 17 /18 | 23 /25 |
| 120 | 11 /12 | 17 /18 | 23 /25 |

Bu erişim işletmenin açıldığı veya sermayesinin bulunduğu anlamına gelmez; yalnız seviye koşuludur. Eğitimi henüz oyunda yoktur. Yeni denge, mevcut başlangıç OP/maaş/aidatını değiştirmez. Süreyi birden fazla alana bölmek işletme açma eşiğini geciktirebilir; C'nin15dk çift alanı B'den erken5 olması farklı dönem/sıra etkileşimidir, C'nin her durumda hızlı olduğuna işaret etmez.

**İki alanlı30dk profili: 7/14/30/60/90/180 gün seviyeleri (Tesisat/İşletmecilik):** A:2/2,3/3,5/5,7/7,8/8,9/9; B:2/2,3/3,5/5,6/6,7/7,9/9; C:2/2,3/3,4/4,6/6,7/7,8/8. Bütün diğer süreler ve tek alan sonuçları CSV/tabloda yer alır.

### 13.6 Bekleme nedenleri ve kaçırılan eğitim

B30dk tek alanda ilk180 gün:44 aktif gün öğrenme çalışması yapılamaz;1800dk çalışılır,3600dk ayrılmış öğrenme bütçesi kullanılmaz. Aynı dönemde125 gün bir kurs kontenjanı reddi,133 gün günlük,47 gün haftalık hak kısıtı görülür; bunlar birbirinden bağımsız boş günler değildir. Öncelikli dakika atfı:2755 kontenjan,590 günlük hak,255 haftalık hak. Katılım pencereleri örtüştüğü için aynı profilde **kapalı takvim günü0**; kısıtın adını yanlışlıkla “ders günü kapalı” koymuyoruz.

|30dk, ilk180 gün|Takvim A|Takvim B|Takvim C|
| --- | --- | --- | --- |
| Hiç çalışma olmayan aktif gün |20|44|70|
| Kullanılmayan öğrenme bütçesi (dk) |1290|3600|4050|
| Kontenjan kısıtı görülen gün |46|125|54|
| Kapalı takvim görülen gün |0|0|114|

**Kısıtları tek tek kaldırma, B30dk:**

| Deney | L5 günü | L7 günü | L10 günü |
| --- | --- | --- | --- |
| Tam sınırlı model |17|51|226|
| Açılma zamanı kısıtı kalkarsa |15|45|221|
| Kontenjan kısıtı kalkarsa |15|39|220|
| Kurs/uygulama günlük-haftalık hakları kalkarsa |13|36|162|
| Ek yeterlilik koşulları kalkarsa |17|51|226|
| Günlük XP tavanı kalkarsa |17|51|226|

Sonuç: bu adayda XP tavanı çoğu zaman bağlayıcı değildir; günlük/haftalık faaliyet hakkı ve erişim daha önemlidir. Ek yeterlilikler ana30dk patikada XP birikirken zaten tamamlandığından L10 gününü değiştirmez, yalnız gerçek çalışma gerektirir. Dolayısıyla bu başarı sayılarını “uzmanlık hızını tek başına yavaşlatıyor” diye sunamayız. Etkiler doğrusal değildir ve toplanamaz. Hak kaldırma deneyinde başlangıç modülünün ve kitabın günde bir sınırı sabit kalır; arka plan öğrencileri tam kurallarla devam eder.

![Tek değişkenli kısıt karşılaştırması](xp-balance-study/calendar/calendar-ablation.png)

Ders kaçınca aynı modül sonraki sunumda, önceki çalışma korunarak alınabilir. Yeni sunumlar arasındaki en uzun öneri aralığı A/B/C orta kursta1/3/11, ileri içerikte4/7/28 gündür. Örtüşen geniş pencereler nedeniyle yer varsa orta kurs için A/B'de takvim bütünüyle kapanmaz; C'de en çok4 kapalı gün vardır. Yerleşik dönemde ileri içerikte A/B tamamen kapalı gün0, C'de21 gündür; ilk pazartesi başlayan oyuncunun ilk ileri sunuma kadar ayrıca A'da1, B'de4 gün başlangıç boşluğu vardır. **Bunlar kontenjan garantisi değildir**; dolu sınıfta sonraki haftaya kalınabilir. `availability.csv` başlangıç ve dönem içi kapanmayı ayırır.

C'nin21 günlük ileri kapanması, günlük geri dönüş hedefi için ciddi risktir. Bir günlük dar pencerelerle B'yi sınayan, yalnız pazartesi/çarşamba/cumartesi gelen profil cuma ileri içeriğine hiç giremez ve L10'a ulaşamaz. Varsayılan7 günlük pencere bu kalıcı dışlanma nedenini kaldırır. Gerçekte önceden kayıt/alternatif değerlendirme, görünür sıra ve esnek tekrar sunumu tasarlanmalı; simülasyondaki dönüşümlü öncelik gerçek rezervasyon sistemi sayılmaz.

Diğer B30dk sonuçları: tek alanda sınıf12 kişi olursa L5=22 gün, iki kat kurum kontenjanıyla15 gün (temel17). Görev arzı haftada yalnız2 olursa L5=30, L10=547 gün; sürekli yeni gerçek ihtiyaç varsayımı önemlidir. İki alanda haftada üç gün gelen oyuncu İşletmecilik5'e66, iki alanda L10'a454 günde ulaşır;14 gün ara verenin İşletmecilik5'i38 gün olur. Seviye/XP kaybı yoktur; ücret veya çevrimdışı telafi XP'si varsayılmaz. Kesin bekleme garantisi veya gerçek oyuncu tutma oranı üretilmedi.

### 13.7 İlk14 gün ve hızlı başlangıç alternatifi

Temel takvim B'de15dk oyuncunun L3'e8 günde gelmesi hızlı başlangıç hedefi için zayıf kalabilir. XP eğrisini değiştirmeden **yalnız üç adet tek kullanımlık başlangıç modülünü** değiştiren küçük deney:

| Başlangıç modülü adayı |15dk profilde L3 günü / gerçek çalışma dk|
| --- | --- |
|15dk /24XP (referans)|8 /100|
|5dk /24XP (yalnız süre değişir)|6 /70|
|15dk /32XP (yalnız ödül değişir)|6 /80|
|5dk /32XP (ikisi birlikte)|4 /50|

Bu son aday yalnız0–3'e, üç farklı başarıyla tamamlanmış kısa uygulamaya ve140XP aşama tavanına aittir. Sürekli tekrar yapılabilecek yüksek verimli kurs değildir. Kullanıcı onayı ve anlamlı görev tasarımı olmadan seçilmiş sayılmaz; beş dakikalık gerçek doğrulanabilir emek varsayımıdır. Dar zaman penceresi veya NPC eğitmen sırası başlangıcı engellemez. İlk üç modülden sonra hız artırımı sona erer.

**Önerilen kısa başlangıç + takvim B,15dk tek Tesisat, altı sentetik öğrencili grupta ilk14 gün:**

| Gün | Çalışma dk | Toplam XP | Seviye | Deneyimin yorumu |
| --- | --- | --- | --- | --- |
|1|15|44|1|Yönlendirilmiş uygulama, ilk kısa modül ve kısmi okuma|
|2|10|84|2|İkinci farklı modül ve önceki okumanın bitişi|
|3|15|124|2|Üçüncü farklı modül, son temel bölüm|
|4|15|140|3|Temel uygulama başarıyla tamamlanır; orta eğitime ilk çalışma|
|5|15|164|3|İlk orta modülün tamamlanması|
|6|15|188|3|İkinci orta modül|
|7|15|214|3|Okuma ve ilk orta uygulama|
|8|10|222|3|Farklı orta okuma bölümü|
|9|10|230|3|Bir sonraki farklı okuma bölümü|
|10|15|254|3|Yeni orta modül|
|11|10|262|3|Yeni okuma; XP260'ı geçse de yeterli uygulama yok|
|12|10|280|3|İkinci başarılı orta uygulama|
|13|15|304|3|Bir sonraki modül|
|14|10|322|4|Üçüncü orta uygulama, L4 koşulu gerçekten tamamlanır|

Kaynak: `starter_first14.csv`. Bu örnekte XP eşiği11. gün geçilirken seviye4 ancak14. gün kanıtla açılır; XP tek başına yetmez. Standart15dk ve30dk oyuncuların orijinal ilk14 günlük ayrıntıları `first14.csv` ve değişmez içerik/deneme kimlikleriyle `first14_events.csv` içindedir. Standart B30dk oyuncusu14. gün hiç öğrenme işi yapamaz; yeni eğitim önizlemesi ve sosyal içerik olmadan bu boşluk sorun yaratabilir. Tablo bir UI teslimi veya gerçek oyuncu kabul testi değildir.

### 13.8 Apartman temalı günlük ve haftalık döngü

**Günlük öneri:** önce dünkü çalışma sonucunu ve bir sonraki fırsatı gör → bugün uygun **gerçek farklı** ihtiyacı/öğrenme adımını seç → karar/uygulama/başarı kanıtını tamamla → sonuç ve meslek ilerlemesini gör → isterse komşu sohbeti ve mevcut apartman yönetimine katıl. Sadece giriş, zamanlayıcı veya düğmeye basma XP üretmez. Başarı değerlendirmesini gecikmeli sunma yalnız tasarım alternatifidir; mevcut deneyler başarıyı tamamlanma anında değerlendirir, gecikmeli sonuç mekanizması geliştirilmedi.

**Haftalık öneri:** pazartesi esnek öğrenme planı; çarşamba/cumartesi yeni kurs sunumları; hafta boyunca kişisel eksik modül/uygulama takibi; hafta sonu kısa “ne öğrendim, hangi apartman ihtiyacında kullanabilirim?” özeti. Haftalık hedef gönüllü yol göstericidir; bitirmeyene ceza, kaçırılan seri veya otomatik ekstra XP yoktur. Oyuncu “sonraki planlı sunum”, “yer henüz garanti değil”, “eksik ön koşul”, “tamamlanan modül” ayrımını görebilmeli. Bu göstergeler bu PR'da frontend'e eklenmez.

Apartmanla ilişkili farklı içerik adayları: vana yönünü güvenle seçme, sızıntı teşhisi, doğru malzeme planı, ortak bakım işi için fiyat karşılaştırması, iş sırası/teslim planı, bakım sonrası kontrol raporu. Her birinin ayrı gerçek görev/sonuç kimliği gerekir. Aynı somut tamiri birden fazla kişiye veya tarihe kopyalamak, eski maaş/ek işi yeniden adlandırmak yeni XP kaynağı değildir. Ortak ihtiyaçlardan ücretli hizmete geçiş daha sonraki onaylı aşamadır; burada OP, sipariş veya ekonomik hareket yoktur.

Günlük fırsat tükenince sistem oyuncuyu boş ekrana hapsetmemeli: sıradaki oturumu göstermeli, mevcut komşuluk/oylama/pano faaliyetlerine yön verebilmeli ve isterse oyundan çıkabilmesini doğal karşılamalı.15dk oyuncunun4 günlük başlangıç alternatifi kısa oturuma karşılık verir.120dk oyuncu aynı alanda sınırsız XP yerine sınırlı ikinci alan, farklı ihtiyaca katkı ve sosyal/yönetim etkinliği seçebilir. Bunlara mevcut olmayan otomatik XP, para veya başarımlar vaat edilmez. Ana takvim B'de30 ve120dk profillerinin L10=226/225 gün olması fazla sürenin tek alanda çok az karşılık bulduğunu gösterir; **bu bir tasarım riski**, tutma başarısı değildir.

Aynı şablonları her gün yeniden okumak kısa sürede yorabilir. Konu/başarı kanıtı çeşitlenmeli, bitmiş içerik XP üretmeden tekrar gözden geçirilebilmeli, haftalık planın tamamı zorunlu yapılacaklar listesine dönüşmemeli. Kaç gün sonra sıkılındığı veya günlük geri dönüşün artacağı simülasyondan çıkarılamaz;15dk ve uzun oturum gönüllü katılımcılarla daha sonra test edilmesi gereken davranış hipotezidir. Birkaç gün ara vermek seviye kaybettirmez; üst sınır ve tekrar sunumları geri dönüşe izin verir, herkesin aynı takvim gününde yetişeceği garanti edilmez.

### 13.9 Revize öneri, sınırlar ve onay

**Nihai inceleme önerim: B XP eğrisi + takvim B'yi başlangıç adayı tutmak;0–3 için üç kısa/tekil modüllü alternatifi ayrıca değerlendirmek.** Bu aday A'ya göre orta/üst aşamayı anlamlı takvime yayar, C'nin21 günlük ileri kapanmasını önler ve iki pilot eğitmenin sınırlı arzını görünür kılar. Buna rağmen44/180 boş öğrenme günü,30dk ile120dk arasındaki zayıf fark ve dönemsel kontenjan baskısı kabul riski taşır. B'yi olduğu gibi canlıya geçirmeyi önermiyorum; önce kontenjan/alternatif fırsat ve anlamlı görev içerikleri kullanıcıyla gözden geçirilmelidir.

Sayısal takip için başlangıç hedefi15dk profilde L3≈4–6 gün; orta aralıkta birkaç haftalık gelişim; uzmanlıkta aylar adayı tartışılabilir. Bunlar **hedef önerisi**, seçilmiş oyun kuralı değildir. A daha az bekleme isteyen pilot için, C gönüllü uzun dönem uzmanlık programı için ayrı seçenek olarak korunur. Sadece takvim/XP maliyetini sertleştirerek içerik eksikliği çözülemez.

Onay gerekenler: başlangıç modüllerinin süre/ödül/başarı içeriği; haftalık kurs günleri ve geniş pencereler; iki eğitmenin kabul bütçesi; bekleme sırası/yeniden fırsat garantisi; günlük/haftalık haklar ve başarısızlık politikası; gerçekten farklı uygulama arzı; aşama XP tavanı ve kanıt eşikleri; ileri içerik/doğrulama yetkisi ve erişimi. Öğretmen yeterliliği, verim ve öğrenci kapasitesi aynı karar değildir. Bu sayılar onaylansa bile kurs, NPC, kaynak rezervasyonu, canlı veri veya üretim geliştirmesi kendiliğinden yetkilendirilmiş olmaz.

**Doğrulama:** önceki18 test değiştirilmedi;25 takvim/erişim testi eklendi (toplam43). Gerçek tarih/pencere/hafta sınırları, dört sıfır başlangıç yolu, kapasite/hak/ön koşul ayrımı, sabit içerik kimliğiyle yeniden sunum, başarısızlık ve hafta devri, parçalı proje, XP/aşama tavanı, pilotta L6 sınırı, yoklukta kayıp olmaması ve deterministik bekleme ölçüleri sınanır. Yeni simülasyonun arka plan öğrencisi bitince ölçülen oyuncudan önce durmaması da regresyon testiyle korunur. CSV/JSON/Markdown `calendar_study.py --check` ile byte bazında tekrar üretilir. Grafikler gerçek çevrimdışı Matplotlib çıktılarıdır; oyun ekran görüntüsü değildir.

Yerel regresyon: `npm test`81/81, statik React `npm run test:ui`, `npm run build`, eski ve yeni çıktıların `--check` tekrar üretimi başarılıdır. Yeni25 test mevcut CI workflow'una eklenmedi; bağımsız araştırma komutuyla çalıştırıldı. PR CI'ı mevcut disposable PostgreSQL paketlerini ayrıca kontrol eder; canlı bağlantı testi değildir.

Bu bölümde yeni bir sunucu ödül işlevi, kurs sistemi, RPC, migration, tablo, frontend veya canlı bağlantı yoktur. Gerçek Auth/MFA/Realtime ve insan katılım/tutma kabul testi yapılmadı. Geri alma yalnız araştırma dosyalarını geri almakla sınırlıdır. PR#24 taslak kalır; merge, yayın ve uygulama için kullanıcı onayı beklenir.
