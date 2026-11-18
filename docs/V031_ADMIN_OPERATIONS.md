# APARTMAN gelişmiş Yönetim Merkezi — PR #4

Bu sürüm mevcut PR #4 / feat/v031-advanced-admin-actions üzerinde tamamlanmıştır. Canlı migration/yönetim mutasyonu, yeni hesap/rol/proje, PR birleşimi veya Pages yayını yapılmaz. Aşağıdaki üç migration yalnız disposable PostgreSQL üzerinde sınanmıştır. İlk dört migration değişmez.

## 1. Oyuncu ve ekonomi

`20261117150426_v031_staff_economy.sql`: mevcut staging taslağının incelenmiş hali. Kullanıcı adı (benzersiz, 3–20 ASCII harf/rakam/alt çizgi), kişisel bakiye, ortak kasa ve sekiz ekonomi ayarı için checked RPC'ler. AAL2, kapsam izni, 5–500 karakter gerekçe ve audit zorunlu.

Cüzdan/kasa düzeltmeleri mevcut deftere `admin_adjustment` olarak yazılır; negatif bakiye ve integer taşması engellenir. İşlem başına delta sınırı ±1.000.000 OP. `private.staff_requests` global işlem UUID'sini aktör, eylem ve payload'a bağlar: aynı isteğin tekrarı etkisizdir, farklı payload/aktör/işlem türünde aynı UUID reddedilir. Audit ve para güncellemeleri aynı transaction'dadır. UI ağ hatasında aynı UUID'yi korur; başarıdan sonra yeni istek açar. Kullanıcı yeni bir operasyon başlatırsa yeni UUID bilinçli yeni işlemdir; sekme yenilemesinden sonra belirsiz ağ sonucunu audit'ten kontrol etmeden tekrar göndermemelidir.

`staff_compensate` eski parasal düzeltmeye bir kez ters defter kaydı ekler; eski satır silinmez, yeterli bakiye ve yetki yeniden kontrol edilir. Telafi yapılamazsa transaction tamamen geri alınır. Telafi yeni audit kaydıyla orijinale bağlıdır. Yanlış ayar/ad, eski audit değerinden yeni yetkili işlemle geri alınabilir; otomatik geriye dönük maaş/borç yeniden yazılmaz.

Aidat ayarının gerçek etkisi sonraki Türkiye pazartesisinde başlar. `economy_settings.weekly_dues` orijinal baz oran olarak kalır ve ileri tarihli bir değişiklik bu sütunu hemen değiştirmez. Yeni kararlar `private.staff_dues_schedules` tablosuna tarihli ve işlem kimliğiyle kaydedilir; geçmiş haftaların kararları korunur. `private.staff_dues_rate(building,week)` hem v031 hem v032 cron gövdesi tarafından kullanılır; oyuncu oylamaları ile admin kararları yürürlük haftası, karar zamanı ve kimlik sırasıyla karşılaştırılır. Aynı hafta için son karar geçerlidir. Bu haftanın borcu etkilenmez; sonraki haftalarda art arda yapılan değişiklikler geçmiş fiyatı silmez. Panel, mevcut hafta ve gelecek hafta için ayrı etkin tutarları gösterir. Mevcut borç/ödeme tutarları sabittir. Gider ayarları sonraki henüz oluşturulmamış giderlere, maaş/ek iş ayarları henüz ödenmemiş uygun günlük işlemlere etki eder. Eski bordro tekrar ödenmez. Cüzdan integer üst sınırına gelmişse otomatik maaş atlanır; tek hesap tüm cron transaction'ını taşmayla durdurmaz. Manuel artış/ek iş üst sınır aşımı reddedilir. Sıfır maaş/ödül yeni ödeme üretmez; geçmiş dönemi yeniden hesaplamaz.

`staff_operations_history` ayrı `staff.audit.read` izniyle sadece yetkili bina hareketlerini, eski/yeni değer ve gerekçeleri döndürür. Eski genel rol dizini de mevcut audit yetkisi altında bu değerleri görüntüler. Ekonomik bilgileri okuma yetkisi olmayan moderatörün bakiye/kasa alanları maskelenir.

## 2. Oyuncu denetimi

`20261117150533_v032_moderation.sql`: private.player_sanctions ile süreli/süresiz ban, susturma, kaldırma ve kalıcı uyarı geçmişi. `players.ban` ban/kaldırma; `players.moderate` mute/kaldırma/uyarı ve izinli yaptırım geçmişi içindir. Rol adıyla yetki verilmez; katalogdaki atamalar ve apartman kapsamı sunucuda değerlendirilir. Son banlanmamış global Süper Yönetici korunur.

Ban, Auth hesabını silmez ve token süresinin dolmasını beklemez. Aktif JWT'yle dahi güncel yaptırım tablosu okunur. Mevcut join/send/vote/settle/job/pay/election/proposal private girişleri guarded wrapper olur; önceki gövdeler authenticated/anon için kapatılır. Blocks/reports doğrudan yazmalarında trigger guard vardır. Banlı kullanıcının bina verisi kapsamı kapanır; kendi hesap güvenliği/Auth erişimi korunur. Susturma sohbet göndermeyi durdurur; diğer oyun işlemlerini durdurmaz. Kaldırma eski yaptırımı silmez; revoked_at ekler. Süre bitişi sunucu saatiyle kendiliğinden etkisiz olur.

Banlı kullanıcı yeni maaş/aidat üretimine dahil edilmez. Daha önce oluşmuş borç, mesaj, oy ve adaylık silinmez; geçmiş geçerli oylar normal seçim sayımında korunur. Banlı seçilmiş yöneticinin oyun RPC'leri kapalıdır; görev kaydını otomatik silmek yerine yetkili yönetici görevden alma işlemi kullanılabilir. Susturma otomatik gelirleri etkilemez.

Kilit sırası: staff RBAC transaction advisory lock → building → kullanıcı yaptırım advisory lock. Oyuncu girişleri building → kullanıcı kilidi alır. Cron building kilidini kullanır ve RBAC kilidini istemez. Ban/iptal ile oyun yazmaları sıralanır; ayrı yeni özellikler bu guard'ı atlamamalıdır.

## 3. Seçim ve yöneticilik

`20261117150534_v033_governance_operations.sql`:

- Seçim başlat/olağanüstü seçim, yeniden başlat, iptal ve takvim değişikliği: `governance.elections.manage`.
- Normal erken sonuç: adaylık bitmiş olmalı, mevcut oylar ve katılım koşullarıyla normal resolver çalışır.
- Zorunlu aday sonucu: `governance.elections.override`; geçerli, banlı olmayan bir aday gerekir. Sahte oy eklenmez, gerçek sayımlar korunur. Aday olmayan sakin doğrudan yönetici atama ile atanır.
- Yönetici atama/kaldırma/görev bitişi: `governance.manager.appoint`. Doğrudan atama sahte seçim üretmez (election_id nullable); 14 gün başlar. Takvim düzenlemesi en çok 90 gün ileriye yapılabilir. Tüm eski/new snapshot audit'tedir. Gelecekteki iptal edilmiş görevler `voided` olarak korunur, geçmiş kayıtlar silinmez. Biten etkin görevin eski bitişi audit'te saklanır.
- Ortak kararı iptal/normal sonuçlandırma ve zorunlu kabul/ret. Zorunlu kabul katılımdan bağımsızdır fakat bütçe ve tek harcama kısıtlarını aşmaz. Eski oylar değişmez. Kabul edilmiş harcama ikinci kez işletilemez; yanlış harcama için ayrıca muhasebe telafisi gerekir.

DB btree_gist exclusion constraint aynı binada çakışan etkin/future görev aralıklarını reddeder; süre kontrolü yalnız UI'da değildir. İlk eski 14-gün sabit CHECK yeni pozitif-aralık CHECK ile genişletilir. Cron/election_tick voided görevleri yok sayar. Seçim iptali 24 saat retry bırakır; doğrudan görevden almadan sonra normal cron uygun seçim sürecini başlatabilir. Hiçbir işlem geçmiş aday/oy/seçmen kaydını silmez.

`staff_governance_state` yetkili binanın önizlemesini ve revision hash'ini verir. Mutasyon shared RBAC → building kilidi altında seçim/aday/oy/görev/poll/bütçe snapshot'ını yeniden karşılaştırır. Cron veya kullanıcı oyu arada değişmişse eski onay reddedilir. Aynı operation UUID'siyle başarılı yanıtı tekrar istemek yeni etki yaratmaz. Her mutasyon gerekçe + AAL2 + kapsam + old/new audit gerektirir.

## Panel

Mevcut StaffOperations korunmuştur; kategorili StaffControlCenter eklendi. Oyuncu/ekonomi, yaptırım geçmişi, seçim/görev/ortak karar ve eski/yeni audit alanları ayrıdır. Ekonomik düzeltmelerde eski/yeni bakiye önizlemesi ve onay; denetim/yönetim işlemlerinde ayrı son onay kartı bulunur. Yönetim modülü normal oyuncuya yüklenmemesi için lazy import edilir. Responsive grid ve sarılan/kaydırılabilen JSON alanları kullanılır. Etkileşimli telefon/masaüstü ve gerçek MFA/Realtime kabulü bu ortamda tamamlandı diye raporlanmaz; CSS ve statik React incelemesi bunların yerine geçmez.

## Testler

- npm test: 16 statik/kontrat testi.
- test:sql / test:v02 / test:rbac: mevcut 11 + 24 + 14 PostgreSQL grup korunur.
- test:advanced: tüm ilk dört migration üzerine üç yeni migration uygulanır. 14 gerçek PostgreSQL grup; çok sayıda alt assertion ile ekonomi/idempotency/kapsam/MFA/muhasebe/telafi/aidat etkisi, yaptırım süresi/iptali/aktif-claim bypass engeli/bordro, normal/zorunlu seçim/iptal/takvim/görev/çakışma/bütçe/cron yarışları doğrulanır.
- test:ui: mevcut React statik render kontrolleri.
- test:db: tam yerel Supabase stack ister. work/local-status.json bulunmayan bu ortamda gerçek Auth/Realtime testi çalıştırılamaz; canlıya yönlendirilmez.
- npm run build: strict TypeScript ve gerçek publishable değişkenlerle Vite.

Testler sabit localhost 55432'de disposable apartman_advanced veritabanını oluşturur/siler. Tarih/bakiye/üyelik fixture değişiklikleri yalnız bu DB'dedir. Gerçek aktif Auth oturumunun JWT geçerliliği ve MFA seremonisi mock edilmiştir; SQL bağlamı gerçek Auth uçtan uca testi diye raporlanmaz. Cron fonksiyon gövdeleri gerçek PostgreSQL üzerinde çalışır; pg_cron zamanlayıcısı yerel fixture'da kurulmaz.

## Onay sonrası güvenli yayın sırası (şimdi UYGULANMAZ)

1. PR #4 CI ve insan incelemesi; hedef projenin rmoytuncahutqurttknt olduğu ve üç yeni migration'ın henüz uygulanmadığı kontrolü. Eski dört migration kesinlikle tekrar çalıştırılmaz. v0.3 dosya sürümü ile canlı aracın oluşturduğu kayıt arasında daha önce bildirilen fark vardır; CLI dry-run/history eşleştirmesi ayrı onayla çözülmeden körlemesine db push yapılmaz.
2. Kullanıcı/daire/mesaj/cüzdan/ledger/kasa/borç/seçim/görev snapshot'ları ve aktif cron durumunu salt okunur kaydet. Mevcut manager_terms aralıklarının çakışmadığını kontrol et; çakışma varsa yeni exclusion migration'ı uygulamadan dur, veri düzeltmesi için ayrı onay iste.
3. Rollout açık onayından sonra sırayla v031 → v032 → v033 migration; staging'i ayrıca çalıştırma. Migration anında eski RPC'ler geriye uyumludur; wrapper yetkileri ve rename edilmiş gövdelerin kapalı olduğu kontrol edilir. İlk v031 RPC'leri bu PR öncesi canlıda bulunmadığından yeni signature geriye dönük yayın kırılması yaratmaz.
4. RLS/GRANT, scope, ledger tutarlılığı, cron ve veri korumasını kontrol et. Hata varsa yayınlama; otomatik DROP/DELETE down migration kullanma. Yeni kayıtları silmeden operatör incelemesiyle durdurma/ileri düzeltme uygulanır.
5. Ayrı merge/yayın onayıyla PR #4 main'e alınır, Pages dağıtımı ve iki gerçek oturumla MFA, mobil/masaüstü, yaptırım engeli ve seçim önizleme kabulü yapılır. Gerçek kullanıcıda yaptırım/para/oy müdahalesi için ayrıca açık hedef ve gerekçe izni gerekir; kabul için rastgele oyuncu seçilmez.

Yeni proje/repository/ücretli kaynak yoktur. Bu çalışmada canlı Supabase aracıyla hiçbir yönetim veya migration çağrısı yapılmamıştır.
