# UI/UX v1 — sunum katmanı

19 Kasım 2026. Dal: `feat/ui-refresh-v1`; başlangıç: `main` / `3ea283f`.
Bu çalışma henüz canlıya yayımlanmamıştır. Birleştirme ve yayın inceleme/onay bekler.

## Ekran ve işlev envanteri

| Ekran | Korunan işlevler | Sunum değişikliği |
| --- | --- | --- |
| Giriş / kayıt / davetiye | E-posta, şifre, kullanıcı adı, davetiyeyle yerleşme | Daha büyük metinler, belirgin form sınırları, seçili giriş/kayıt düğmesi için erişilebilir durum |
| Apartman | Doluluk, kasa, duyurular, oylamalar, gelişmeler | Dengeli kartlar, okunabilir metrikler, haftalık gelir-gider grupları, boş duyuru/gelişme mesajları |
| Dairem | Profil, cüzdan geçmişi, meslek, ek iş, aidat ödemesi | Tek tip para hareketleri, belirgin bakiye, okunabilir görev/borç açıklamaları ve boş durumlar |
| Komşular | Sakinler, canlı sohbet, geçmiş, engelleme, şikâyet | Uzun metinleri saran mesajlar, daha büyük zaman/işlem metinleri, dar ekranda alt satıra geçen gönderme düğmesi |
| Yönetim | Seçimler, adaylık/oy, yönetici teklifleri, giderler, kasa geçmişi | Ortak kart/form dili, ayrı gelir-gider değerleri ve boş durumlar |
| Hesap güvenliği | Her oturum açmış oyuncu için mevcut MFA kurulum/doğrulama akışı | Teknik oturum terimlerinin sadeleştirilmesi, okunabilir kod alanı; yönetici rolü koşulu eklenmedi |
| Sistem yönetimi | Bütün mevcut rol, ekonomi, denetim, seçim ve telafi işlemleri | Yetki özeti ve dört yerel açılır grup; Türkçe işlem başlıkları; kritik onay için uyarı yüzeyi |

## Tasarım sistemi

- Mevcut yeşil apartman kimliği ve font aileleri korunur. Yeni font, ikon paketi veya bağımlılık eklenmez.
- `src/style.css`: tarayıcı yazı ayarına uyan 16 px varsayılan kök, rem ölçeği, en az 12 px yardımcı metin, uyumlu kartlar ve aralıklar.
- Açık, koyu ve sistem temalarında ortak renk değişkenleri. Birincil düğme metni ayrı `--on-accent` değişkeni kullanır; sistemin koyu temasındaki kontrast da düzeltilmiştir.
- Form sınırları kart sınırlarından daha belirgin; kontroller en az 44 px yüksekliğinde. Onay kutuları bu ölçünün dışındadır.
- Belirgin klavye odağı, içeriğe atlama bağlantısı, seçili bölümün `aria-current` bilgisi ve dekoratif menü simgelerinin ekran okuyucudan gizlenmesi.
- 900 px altında üst menü; 480 px altında tek sütun metrikler, sarılan para hareketleri ve sohbet formu. Grid hücreleri `minmax(0, …)` ile uzun içeriği sınırlar.
- Hareket azaltma tercihi desteklenir. Yeni animasyon, yoğun gradyan veya gölge eklenmez.

## Yönetim grupları

`PanelGroup` yalnızca HTML `details/summary` kullanır; yeni durum, yetki kontrolü veya veri yükleme davranışı eklemez. Kapalı grupların içeriği DOM'da kalır; form alanları ve hazırlanmış değerler kaldırılmaz.

1. Hesap güvenliği.
2. Oyuncular ve ekonomi.
3. Denetim ve apartman yönetimi.
4. Roller ve apartman ayarları (mevcut dizin erişimi koşuluyla).

Son işlem onayı, kapanabilir grubun **dışındadır**. Gerekçe, MFA, önizleme, onay, işlem kimliği, telafi ve sunucu izin kontrolleri korunur. Türkçe audit başlıklarının teknik kodları ayrıntılarda erişilebilir kalır; bilinmeyen yeni kodlar gizlenmez. `src/uiText.ts` yalnızca görüntü etiketlerini dönüştürür; RPC argümanları ve izin kodları aynı kalır.

## Doğrulama

| Komut | Sonuç |
| --- | --- |
| `npm test` | 22 test başarılı; yeni tema kontrast kontrolleri dahil |
| `npm run test:ui` | Statik React render kontrolleri başarılı |
| `npm run build` | TypeScript + Vite başarılı |
| `npm run test:sql` | 11 PostgreSQL kontrolü başarılı |
| `npm run test:v02` | 24 entegrasyon grubu başarılı |
| `npm run test:rbac` | 14 entegrasyon grubu başarılı |
| `npm run test:advanced` | 15 entegrasyon grubu başarılı |

PostgreSQL testleri yalnızca mevcut `apartman-v02-tests` disposable altyapısında, localhost:55432 üzerindeki ayrı test veritabanlarında çalıştırıldı. Canlı Supabase'e bağlanılmadı. Migration, şema, ekonomi, Auth/Realtime/MFA uygulama mantığı, veri erişim katmanı, bağımlılık veya yayın workflow'u değiştirilmedi.

Yeni statik kontroller: aidatın yetersiz bakiye/ödendi sunumu, mevcut oylamanın oy verildi görünümü, oyuncu-yönetici ayrımı, kapalı grupta formun korunması, MFA başlangıç metni, semantik haftalık özet ve audit etiketleri. Renk testleri normal metinde 4,5:1, form sınırları/odak halkasında 3:1 oranını denetler. Bu testler tüm sayfanın erişilebilirlik sertifikası değildir.

## Tarayıcı kabulü — bekliyor

[Sites SKILL.md](skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites/SKILL.md) talimatı: “If `cua_repl.js` is unavailable, skip browser QA: do not start a preview server, install a browser, or improvise another browser-control path.” Yönetilen ortamda bu araç bulunmadığı için önizleme, ekran görüntüsü ve etkileşimli tarayıcı testi yapılmadı. SSR testleri CSS yerleşimini, klavye etkileşimini, gerçek oturumu veya WebSocket'i doğrulamaz. Aşağıdakiler **geçti olarak işaretlenmemiştir**:

- 320, 360, 390, 768, 1280 ve 1440 px: her ekranda yatay taşma, uzun kullanıcı/apartman adları, uzun sohbet ve denetim kayıtları.
- Aynı genişliklerde açık/koyu/sistem teması; %200 yakınlaştırma ve sistem fontu büyütme.
- Klavyeyle içeriğe atlama, menü seçimi, native açılır grupları Enter/Space ile açma/kapama; görünür odak ve ekran okuyucu duyuruları.
- Giriş/kayıt/çıkış, yenilemede oturum, dört oyun bölümü, meslek/ek iş/aidat, canlı sohbet, oylama ve seçim ekranları.
- Yönetici olmayan oyuncuda Hesap güvenliği erişimi ve Sistem yönetimi bağlantısının yokluğu.
- Gerçek MFA kurulumu / yarım kurulum kurtarma / doğrulama. Yönetim grubu kapatılıp açılınca girilen gerekçe ve form değerlerinin kalması.
- Uygun ayrı test ortamında yetkili/yetkisiz roller, gerekçe, önizleme, son onay ve telafi akışlarının görünümü. Görsel kontrol için canlıda ekonomik veya seçim işlemi oluşturmayın.

İnceleme tamamlanınca PR üzerinden birleştirme/yayın için ayrıca onay verilebilir. Bu UI dalı için veritabanı kurulumu veya migration adımı yoktur.
