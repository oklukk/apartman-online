# APARTMAN Online — UI/UX v2 Ana Tasarım Şartnamesi

**Durum:** Tasarım kapsamı kararlaştırıldı; kodlama onayı veya otomatik birleştirme anlamına gelmez.  
**Proje:** `oklukk/apartman-online` — React 19, TypeScript, Vite 7, Supabase, GitHub Pages.  
**İncelenen başlangıç:** `main` / `c459a4c98eeaea70a9d1506d0da4fef74b278095` (20.11.2026 itibarıyla).  
**Ana hedef:** Teknik olarak çalışan kart/form uygulamasını, özgün 2D sanat kimliği ve doğru etkileşim mimarisi olan görsel ağırlıklı sosyal yaşam simülasyonuna dönüştürmek.

## 1. Bağlayıcı ürün kararları

- **Görsel yön:** Görsel ağırlıklı sosyal simülasyon; **yerleşim:** görsel/işlev dengesi. Apartman ekranı görsel ağırlıklı, Bugün eylem ağırlıklı, Dairem dengeli, Komşular sohbet/sosyal işlev ağırlıklı.
- **Dört ana sekme:** `Bugün`, `Dairem`, `Apartman`, `Komşular`.
- **Oyuncu dünyası:** 4 konut katı × katta 3 daire; 1–3 birinci katta, 4–6 ikinci, 7–9 üçüncü, 10–12 dördüncü katta. Zemin/giriş konut katı sayılmaz. Dış cephe ile etkileşim.
- **Sanat:** Özgün modern 2D çizgi film; sıcak mahalle estetiği. İkonlar ayrı, tutarlı bir set; görüntüler fotoğraf/emoji yığını olmayacak.
- **Avatarlar:** 16 farklı özgün portre. UI/UX v2'de kullanıcı ID'sine deterministik atanır; seçme/değiştirme **v2.1**'e bırakılır.
- **Sosyal profil:** Hızlı profil kartı ve tam profil. Temel kimlik aynı apartmanın sakinlerine görünür. Biyografi/meslek/başarılar/sosyal istatistikler yalnızca oyuncunun açık tercihiyle paylaşılır; bu alanlar v2.1'de eklenir.
- **Sistem Yönetim Merkezi:** Normal oyuncu sekmelerinin dışında; yalnızca gerçekten yetkili personele görünür; rol/scope/izin ve MFA kontrolleri korunur. Seçilmiş apartman yöneticiliği otomatik personel yetkisi vermez.
- **Mevcut mekanikler korunur:** Auth, davetiyeyle yerleşme, Realtime sohbet, engel/mesaj şikâyeti, ekonomi, günlük iş/ek iş, aidat, seçim/oy, kasa, duyuru/gelişme, yönetici işlemleri, moderasyon, RBAC, MFA, audit, işlem gerekçesi, onay ve telafi.
- **v2 ilk pakette migration yok.** Veritabanı şeması, RPC imzaları, RLS, ekonomik sayılar, iş kuralları ve canlı oyun verileri değişmez.
- **Bildirimler:** Mevcut `activity`/Realtime, kişi bazlı okunmuş/okunmamış bildirim kutusu değildir. Çalışmayan zil, sahte sayaç veya sahte bildirim eklenmez. Gerçek sistem v2.1.

## 2. Görsel dil ve marka

### 2.1 Stil

Orta kalınlıkta tutarlı konturlar, sıcak aydınlatma, az ve kontrollü gölge, yuvarlak formlar, sade zemin. Yetişkinler için de uygun, oyun hissi veren ama çocuk oyuncağı gibi görünmeyen estetik. Tek resimlik dev bir arka plan değil; bina, pencereler, kapı, doluluk/rozet ve etkileşim ayrı katmanlar.

**Başlangıç sanat paleti** (nihai arayüz metni bunlardan bağımsız WCAG uyumlu kontrasta sahip olacak): krem `#F7E8D0`, mercan `#EB987A`, adaçayı `#9BC5AC`, petrol `#315D59`, altın `#D9AC65`. Açık/koyu/sistem temaları; sınırlı hareket. Marka logo tipi ve küçük favicon özgün.

### 2.2 Varlık envanteri

| Varlık | Adet | Teknik yaklaşım |
|---|---:|---|
| Logo ve favicon | 2 | Özgün SVG, okunabilir marka |
| 4×3 etkileşimli bina cephesi | 1 ana kompozisyon | SVG, seçilebilir 12 daire için HTML erişilebilir hedefler / ölçek uyumlu koordinatlar |
| Pencere, kapı, balkon, giriş, durum katmanları | Gerekli kadar | Yeniden kullanılabilir SVG şekilleri |
| Daire içi atmosfer | 1 | Optimize SVG/WebP; dekorasyon mekaniği yok |
| Çizgi film avatarı | 16 | Farklı yüz, saç, kıyafet ve görsel silüet; tutarlı karakter oranları; yerel WebP/SVG |
| Günlük işler/ekonomi/kararlar | 3–4 | Küçük işlevsel illüstrasyon |
| Pano/seçim temaları | 2–3 | Sınırlı illüstrasyon |
| Boş durum çizimleri | 3–4 | Tek sanat dili, yalın |
| UI ikonları | Ortak set | Tercihen `lucide-react`, görsel dekorlardan ayrı |

**Kalite kapısı:** Varlıklar *gerçekten repoda* bulunmalı ve arayüzde kullanılmalı. Emoji, aynı portreden 16 kopya, stok görsel bağlantıları, CSS ile boyanmış boş dikdörtgenler veya sadece `asset-brief` dosyası tamamlanmış illüstrasyon sayılmaz. Eğer Codex ortamı istenen özgün sanat kalitesini üretemiyorsa bunu açıkça bildirsin; görsel varlık onayı almadan PR'ı “tasarım tamamlandı” olarak sunmasın. Dış kaynak kullanılırsa açık lisans ve atıf şartı, ancak özgün üretim tercih edilir. Herhangi bir lisans doğrulanmadan başka oyunlardan sanat kopyalanmaz.

### 2.3 Dosya, optimizasyon ve erişilebilirlik

Varlıklar repoda `src/assets/` ve gerektiğinde `public/` altında; harici, çalışma zamanı sıcak bağlantısı olmadan saklanır. Gerçek çözünürlük ve format dosyaya göre seçilir. 512×512 kaynak avatar portreleri kalite ölçütü; küçük UI'da uygun boyut. Lazy loading, boyut bildirimi, bozuk görsel fallback, görselde gömülü dinamik yazı olmaması. Dekoratif görseller `aria-hidden`; etkileşim düğmeleri isimli. Hafif animasyonlar `prefers-reduced-motion` ile kapanır.

## 3. Navigasyon ve kullanıcı durumları

### 3.1 Ana sekmeler

| Sekme | Ana işlev | Alt görünüm |
|---|---|---|
| **Bugün** | Güncel eylemler ve kısa durum | Açık işler, borç varsa aidat, katılınabilir oylama, gelişmeler |
| **Dairem** | Kişisel yaşam | Daire / İşler / Cüzdan |
| **Apartman** | Görsel bina ve ortak kararlar | Binayı Keşfet / Kararlar / Kasa ve Pano; etkin apartman yöneticisinde Yönetici Masası |
| **Komşular** | Sakinler ve sosyal alan | Sakinler / Sohbet |

Mobilde alt sabit 4 sekme; masaüstünde sol navigasyon. Üstte bağlamsal apartman adı, hesap profili ve gerektiğinde kişisel durum. Aynı bileşenin gereksiz farklı kopyaları olmasın.

### 3.2 Diğer ekranlar

Profil avatarı menüsü: `Profilim`, `Ayarlar`, `Hesap güvenliği`, `Sistem Yönetim Merkezi` (yalnızca izin varsa), `Çıkış yap`. Ziyaretçi giriş/kayıt; giriş yapmış yerleşmemiş oyuncu davetiye/katılım + hesap ayarları; normal sakin dört sekme; seçilmiş apartman yöneticisi ek `Yönetici Masası`; personel ayrı `Sistem Yönetim Merkezi`.

**Kısayol hedefi tam açılmalı:** Bugün'deki `Aidat öde` ⇒ Dairem/Cüzdan/Aidat; `Ek iş` ⇒ Dairem/İşler/Ek iş; `Oy kullan` ⇒ Apartman/Kararlar/ilgili açık süreç; `Sohbete katıl` ⇒ Komşular/Sohbet. Sadece ana sekmeyi açıp oyuncuya form arattırmak kabul edilmez. Derin link, geri/ileri, ekran yenileme ve `GitHub Pages` taban yolu uyumlu olmalı. Supabase Auth yönlendirmeleri korunmalı. Bütün navigasyon tek bir modelde izlenmeli.

## 4. Dört ekranın kesin içeriği

### 4.1 Bugün

Kısa görsel karşılayıcı; bakiye/durum özetleri; **gerçekten yapılabilir** işlemlerin sıralı kartları; aktif karar/aidat varsa gösterim; en yeni gelişme ve duyuru. Oyuncunun verisinden türetilen doğru durum. Günlük maaş otomatik olduğundan sahte `Maaşını al` eylemi olmaz. Günlük işlem yapıldıysa ayrı büyük buton yerine tamamlanma göstergesi. Açık karar yoksa oy eylemi yok; gereksiz uzun boş kartlar yok.

### 4.2 Dairem

Sınırlı, sıcak oda illüstrasyonu. Daire numarası/özeti; `Daire`, `İşler`, `Cüzdan`. Mevcut meslek seçimi/değişikliği (7 günlük kural korunur), ek iş, günlük gelir durumu; kişisel bakiye/işlem geçmişi; aidat borcu ve ödeme aynen çalışır. Büyük oda görseli her alt ekranda tekrar etmez. Kişisel mali bilgiler başkasının sosyal profilinde görünmez.

### 4.3 Apartman

**Görselde zemin + 4 konut katı; sırasıyla** 1. kat `01/02/03`, 2. `04/05/06`, 3. `07/08/09`, 4. `10/11/12`. Dolu/boş/benim/yönetici vurguları canlı veriyle hesaplanır; iki tür rozet aynı dairede bulunabilir. Işığı açık pencere “çevrim içi” anlamına gelmez. Bina girişi ⇒ Pano. Daire ⇒ Hızlı kart; kendi dairem ⇒ Dairem bağlantısı; dolu yabancı daire ⇒ sakin profili; boş daire ⇒ sadece bilgi. Yanlışlıkla daire atama, davet, satın alma yok. Seçim/oylamalar ve kasa geçmişi `Kararlar` / `Kasa ve Pano` altında işlev kaybetmeden yaşar. Aktif apartman yöneticisi için Yönetici Masası sadece gerçek yetkisi ve oyun durumu ölçüsünde.

### 4.4 Komşular

`Sakinler` avatar kartları, daire bilgileri, aynı apartmandaki oyuncular. `Sohbet` ayrı mobil görünüm, geniş alan, sabit/kolay erişilen yazma alanı. Kendi ve diğer mesajlar ayrılır, uzun metinler taşmaz, eski mesaj yükleme sürer, RealTime korunur. Sohbet kullanıcı adına/avatarına dokunmak ⇒ aynı `ResidentQuickProfile` bileşeni; kapanınca eski kaydırma konumu korunur. Mesajın üç nokta menüsünde gerçek mesaj şikâyeti; profilde gerçek mesaj gizleme/geri alma. Henüz olmayan özel mesaj, takip, arkadaşlık, genel oyuncu şikâyeti eklenmez.

## 5. Profil, avatar, gizlilik

### 5.1 UI/UX v2 kapsamında

- **16 özgün çizgi film portresi**, sabit kullanıcı ID'sinden deterministik atama; cihazlar arasında tutarlı.
- `ResidentQuickProfile`: avatar, kullanıcı adı, daire/kat, apartmana katılım ayı, aktif yönetici rozeti, sohbete git, daireyi gör; kısa panel.
- `ResidentFullProfile`: aynı temel alanlar; **yalnızca gerçek veriler**. v2.1 biyografi/başarı/istatistik alanlarını boş oyuncu verisi gibi göstermeyin.
- `MyProfile`: kendi kimliği, dairem, ayarlar, güvenlik; mevcut sistem izin vermediği için kullanıcı adı serbest düzenlenmez.
- Engelleme = mevcut sistemde **engellenen oyuncunun mesajlarını benim görünümümden gizleme**. Tam karşılıklı erişim engeli olduğu iddia edilmez. Mesaj şikâyeti mesaj bağlamında kalır. Engelli profil tamamen kaybolmaz; engeli kaldırma erişilebilir.
- Mobil: hızlı profil `bottom sheet`; masaüstü: sağ panel. Dialog/back/escape, odak tuzağı ve kapatınca odağın geri dönmesi. Erişilemeyen ve silinmiş kullanıcıda güvenli boş durum.

### 5.2 UI/UX v2.1'e ertelenenler

`avatar_id` kalıcı seçim, 160 karaktere kadar biyografi, kapak/çerçeve, meslek görünürlüğü, gizlilik tercihleri, başarı koleksiyonu, sosyal istatistikler. **Temel kimlik aynı apartmanda görünür**, ek alanlar **varsayılan gizli; açık opt-in ile görünür**. Başkasının özel alanlarını API yanıtında göstermeyen sunucu tarafı güvenli veri erişimi, yalnızca UI gizlemesi değil. Biyografi moderasyonu ayrıca tasarlanacak. Kişisel OP bakiye, özel işlemler, e-posta, MFA, yaptırım/personel yetkileri genel profilde gösterilmez.

## 6. Ayarlar

`Ayarlar` ana dört sekmenin dışında, profil menüsünde. Alt alanlar: `Görünüm`, `Gizlilik`, `Bildirimler`, `Hesap güvenliği`. `Profilim → Görünümüm` gelecekteki karakter kişiselleştirmesidir; UI temasından farklıdır.

**v2 aktif:** Tema sistem/açık/koyu; yazı boyutu normal/büyük; ekran yoğunluğu standart/kompakt; hareket azaltma; varsa tasarlanmış gündüz/akşam bina atmosferi. Bu tercihler cihazda tutulabilir, erişilebilirlik etkileri test edilir. `Engellediğim Komşular` mevcut `blocks` verisinden çalışabilir. Mevcut MFA aynen korunur. **v2.1:** Kalıcı sosyal gizlilik, avatar özelleştirmesi, gerçek bildirim tercihleri.

## 7. Bildirim Merkezi (v2.1)

Kişiye özgü `notifications`, `notification_preferences`, okunma durumu, doğru olay kayıtları, Realtime ve gerçek işlem bağlantıları. Oylama/seçim, kişisel aidat, duyuru ve önemli güvenlik olayları; her sohbet mesajı için gürültülü push önerilmez. Tarayıcı/telefon push ayrı sonraki karar. Uydurma zil/sayıç yok. Bildirim üretimi server-side, yinelenen olaylara karşı tekilleştirme, RLS yalnızca kendi bildirimlerini okuma, okundu durumu cihazlar arasında korunma.

## 8. Sistem Yönetim Merkezi

Normal dört sekmeden bağımsız çalışma alanı. İzin ve kapsamlar gerçek `staff_me` / sunucu kontrollerinden türetilir; salt `staff.roles.length` tek başına ekran alt izinlerini belirlemez. Modüller: `Genel Bakış`, `Oyuncular ve Denetim`, `Ekonomi`, `Seçimler ve Yönetim`, `Roller ve Yetkiler`, `İşlem Geçmişi/Telafi`; yalnızca gerçekten çalışan modüller gösterilir. İçerik, bakım vb. backend fonksiyonu olmayan modüller varmış gibi sunulmaz. Geçerli işlemlerin gerekçe–önizleme–MFA–son onay–kayıt–telafi zinciri korunur; kritik işlem onay penceresi form state'ini düşürmez. Oyuncu ekranında personel düğmeleri görünmez. Personel girişi olsa bile dairesi olmayan hesabın personel sayfaları erişilebilir kalır.

## 9. Teknik ve kalite koşulları

- Kaynak kodu görev temelli bileşenlere ayırın; mevcut `main.tsx` içeriğini adım adım taşıyın, gereksiz toplu yeniden yazım yapmayın. Mevcut API ile ilişkili kimlikleri ve RPC'leri koruyun.
- Kütüphaneler amaçlı ve küçük olsun. Tutarlı UI ikon seti için `lucide-react` kabul edilebilir; ağır UI/kaydırma/animasyon paketleri gerekçesiz eklenmesin.
- Mobil hedef: 320, 360, 390, 430 px. Tablet 768. Masaüstü 1280/1440; açık/koyu/sistem, %200 yakınlaştırma ve uzun ad/mesaj.
- Rahat tıklama alanı (hedef 44 × 44 CSS px), kontrast, görünür klavye odağı, doğru etiket, modal odak/geri, düşük hareket tercihleri, yatay taşma kontrolü.
- **Asla prod Supabase'de test işlemi yapmayın.** Sentetik veri yalnızca test fixture'larında; sahte oyuncu veya bakiye canlı ekrana taşınmaz. Gerçek veri yalnızca izin verilen mevcut sorgulardan gelir.
- PR bazında: `npm test`, `npm run test:ui`, `npm run build`, `npm run test:sql`, `npm run test:v02`, `npm run test:rbac`, `npm run test:advanced`. Gerekli değişiklikler için yeni erişilebilirlik/navigasyon davranış testleri eklenir. Görsel kabul ayrı kapıdır.
- **Görsel kanıt zorunlu:** En az 390 px mobil ve 1440 px masaüstü görünüm, sonradan 320 px kenar kontrolü; açık/koyu; ana ekran ve yönetim ekranı ilgili PR'da. Gerçek tarayıcı otomasyonu yoksa test geçildi iddia edilmez. GitHub Actions içinde yalnızca izole fixture/mock ortamıyla ekran görüntüsü üreten visual-test artifact yolu tercih edilir; hiçbir prod kimliği/anahtarı/test mutasyonu kullanılmaz. Ekran görüntüsü kanıtının eksikliği açıkça yazılır ve tasarım kabulü bekletilir.
- Her PR'da: etkilenen işlev envanteri, test çıktısı, görsel kanıt bağlantısı/eksikliği, bilinen riskler, geri alma notu ve bağımlı bir sonraki PR. **Hiçbir PR otomatik birleştirilmez.**

## 10. Uygulama PR sırası

1. **PR-A:** Sanat yönü, gerçek varlık paketi, tasarım tokenları, görsel galeri/kanıt.
2. **PR-B:** Uygulama iskeleti, dört sekmeli gezinme, profil menüsü, erişim durumları, derin bağlantı.
3. **PR-C:** Bugün/Dairem/Apartman/Komşular işlevsel ekran yeniden yerleşimi ve gerçek kısayollar (metin ve bileşen testleri dahil).
4. **PR-D:** Etkileşimli 4×3 bina, 16 avatar, hızlı/tam sosyal profil ve sohbet etkileşimleri.
5. **PR-E:** Görünüm/temel ayarlar ve engellenenler, güvenlik erişiminin taşınması; gelecek özellikler için sahte kontrol olmaması.
6. **PR-F:** Sistem Yönetim Merkezi bilgi mimarisi, izinli modüller, kritik işlem UX'i, son bütünleşik görsel ve regresyon testi.

**Bir sonraki PR, öncekinin gözden geçirilip birleştirilmesinden sonra açılır.** PR numarası veya tarih varsaymayın. v2.1 veri yapıları bu serinin parçası değildir.

## 11. Kesin kabul ölçütleri

- Dört sekme; mobil ve masaüstünde anlaşılır, tutarlı.
- Apartman ekranında gerçek görsel cephe ve 12 doğru daire; boş/dolu/kendi/yönetici durumu veriyle eşleşir.
- 16 farklı, kaliteli ve tutarlı avatar görüntüsü; aynı oyuncu aynı karakter.
- Bugün'deki mevcut ve yapılabilir işlem kısayolları doğru alt ekrana gider.
- Ekonomi, aidat, seçim, oy, duyuru, sohbet, engelleme, şikâyet ve personel işlemleri regresyonsuz.
- Giriş/kayıt, yerleşmemiş kullanıcı, normal sakin, apartman yöneticisi, yetkili personel ve yetkisiz kullanıcı durumları ayrı doğrulanır.
- Sohbet profili açılıp kapanınca mesaj konumu korunur.
- Hiçbir sahte canlı bildirim, içeriksiz avatar düzenleme, sahte rozet veya olmayan özel mesaj sistemi yok.
- SQL/izin/MFA değişikliği yok; admin kritik işlem zinciri korunur.
- Gerçek görsel kalite kanıtı, manuel kabul ve PR'da açık başarısız/bekleyen kontrollerle sunulur. CI yeşili tek başına tasarım onayı değildir.
