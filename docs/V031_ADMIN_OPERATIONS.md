# APARTMAN v0.3.1 — Gelişmiş Yönetici İşlemleri

## Hazırlanan ilk kod dilimi

Bu daldaki SQL yalnızca staging taslağıdır. Henüz migration olarak canlı veritabanına uygulanmamıştır.

Hazırlanan sunucu işlemleri ve React ekranı:
- Oyuncu adı değiştirme: players.profile.edit.
- Cüzdan bakiyesi düzeltme: economy.wallet.adjust; mevcut ledger kullanılır, mükerrer işlem kimliği önlenir, negatif bakiye reddedilir.
- Apartman kasası düzeltme: economy.treasury.adjust; mevcut kasa defteri kullanılır, negatif bakiye reddedilir.
- Ekonomi ayarları: economy.settings.manage; maaş, ek iş, aidat, giderler ve başlangıç bakiyesi.
- Haklara göre filtrelenmiş oyuncu/ekonomi görüntüleme: staff_game_overview.
- Sunucuda MFA/AAL2 + shared RBAC advisory lock + kapsam + audit gerekçesi kontrolleri.
- Admin panelinde ayrı operasyon formu, ön onay ve işlem gerekçesi.

Hazırlanan dosyalar:
- supabase/admin/staging/v031_operations.sql
- src/components/StaffOperations.tsx
- src/components/StaffPanel.tsx
- tests/admin-operations.test.mjs

## Canlıya geçmeden mutlaka

1. Supabase CLI sürümünü ve migration new --help komutunu incele. Yeni migration oluştur; staging SQL'i detaylı güvenlik incelemesinden sonra taşı.
2. Mevcut üç eski migration ve v0.3 migration'ı değiştirme. Yalnızca yeni bir ileri migration ekle.
3. Disposable PostgreSQL ortamında gerçek RBAC entegrasyon testleri geliştir: AAL1, yetkisiz, kapsam, eşzamanlı yetki iptali, idempotency, negatif bakiye, eski işlem tipleri, aidat ve cron etkileri, kullanıcı adı çakışması, audit.
4. Eski test:sql, test:v02, test:rbac, test:ui, npm test ve npm run build geçsin. Yeni testleri CI'a zorunlu ekle.
5. Kullanıcının açık rollout onayı olmadan canlıda para, isim, seçim veya rol değiştirme. Canlıda otomatik test mutasyonu yapma.
6. Veritabanı migration'ı ile frontend yayınını sıralı yap.

## Henüz kodlanmamış, bir sonraki geliştirme dilimleri

### v0.3.2 — Oyuncu yaptırımları
- Süreli/süresiz ban, mute, kaldırma, gerekçe ve denetim.
- Ban aktif oturumdaki oyuncunun tüm yazma işlemlerine sunucuda uygulanmalı: mesaj, oy, ek iş, aidat, adaylık, yönetim teklifleri, bloklama, raporlar ve diğer RPC'ler.
- JWT süresine güvenme. Devam eden cron maaş/aidat etkisini karara bağla ve test et.
- Supabase Auth erişimini tamamen kesmek gerekirse yalnızca korumalı server-side Edge Function kullanılmalı, secret tarayıcıya girmemeli.
- Süper Yönetici/son yönetici hesaplarının kazara devre dışı kalması özel kontrollere tabi olmalı.

### v0.3.3 — Seçim müdahaleleri
- Adaylık/oylama sürelerini ayarlama, erken bitirme, iptal, olağanüstü seçim, doğrudan yönetici atama ve görevden alma.
- Eski oy/aday/seçmen kayıtlarını koru; seçim tick ile yarışları kilitle, birden fazla açık seçim ve çakışan yönetici sürelerini önle.
- Normal sonuçlandırma ve zorunlu admin sonucu ayrı işlemler olsun.
- Hem aktif seçim hem de seçim sonrası 14 günlük yönetim testleri gerçekleştir.
- Yalnız katalog izni eklemek işlevin varlığı sayılmaz: gerçek sunucu RPC + arayüz + test şart.

Bu çalışma gelecekteki yeni apartman/mahalle/şehir yönetimini de kapsayabilen modüler bir StaffOperations tasarımını hedefler. Her yeni mekanik, mevcut RBAC üzerine izin, RPC ve arayüz eklenerek geliştirilecektir.
