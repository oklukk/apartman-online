# Canlı migration geçmişi — 19 Kasım 2026

APARTMAN Online canlı Supabase proje ref'i: `rmoytuncahutqurttknt`.
GitHub migration dosyalarının sürüm numaraları, canlı `supabase_migrations.schema_migrations` kayıtlarının **gerçek** sürüm numaralarıyla uyumludur.

| Migration | Canlıda kayıtlı / GitHub'daki kanonik dosya |
| --- | --- |
| İlk oyun | `20261115141348_initial_game.sql` |
| Zamanlanmış çözümleme | `20261115141400_scheduled_resolution.sql` |
| v0.2 ekonomi/yönetim | `20261115185834_v02_economy_governance.sql` |
| v0.3 RBAC | `20261116134945_v03_admin_rbac_foundation.sql` |
| v031 yönetim/ekonomi | `20261118203012_v031_staff_economy.sql` |
| v032 oyuncu denetimi | `20261118203040_v032_moderation.sql` |
| v033 seçim/yönetim | `20261118203100_v033_governance_operations.sql` |

## Neden yalnızca dosya adları değişti?

v0.3 staging SQL'i daha önce yerel olarak `20261116131716` zaman damgasıyla hazırlanmıştı, ancak canlıda `20261116134945` olarak kaydedilmişti. v031/v032/v033 migration'ları ise 18 Kasım'da Supabase yönetim aracıyla sırayla uygulanırken canlı sistem yeni zaman damgaları verdi. GitHub'daki eski dosya adları (`20261117150426`, `20261117150533`, `20261117150534`) bu kayıtlarla eşleşmiyordu.

**Düzeltme yalnızca GitHub'daki dört dosyanın yeniden adlandırılmasıdır.** SQL metninin tek bir karakteri bile değiştirilmedi. Canlı veritabanı, oyuncu bakiyeleri, güvenlik politikaları ve `supabase_migrations` kayıtları değiştirilmedi.

## Gelecek güncelleme için zorunlu sıra

1. Yayın öncesi yedekleme ve geri yüklenebilirlik imkânını değerlendir. Canlı yedekleme hâlâ çözülmüş değil.
2. Hedef projenin `rmoytuncahutqurttknt` olduğunu doğrula.
3. Supabase CLI'nin güncel `--help` çıktısına göre `supabase migration list` ile yerel/canlı sürüm numaralarını karşılaştır.
4. Önce `supabase db push --dry-run` yap; **geçmişte uygulanmış bu yedi migration'ın hiçbiri tekrar listelenmemelidir**. Dry-run başarısız olursa veya aynı migration'lar görünürse işlemi durdur.
5. Yalnızca yeni, gözden geçirilmiş migration'ları sırayla uygula. Mevcut SQL migration'ları geriye dönük olarak değiştirme, yeniden çalıştırma veya yeniden adlandırma.
6. Migration sonrasında canlı verilerin ve cron görevlerinin korunduğunu salt okunur kontrollerle doğrula.

`supabase migration repair` canlı geçmişi değiştirir; bu görevde kullanılmamıştır ve yalnızca ayrı inceleme/onayla değerlendirilebilir. CLI/dry-run için kullanılabilir PostgreSQL bağlantısı gerekecektir; mevcut yedekleme bağlantı kimlik doğrulaması sorunu bu işlemi engelleyebilir.

## CI koruması

`tests/migration-history.test.mjs` ilk yedi migration'ın kanonik sürüm numaralarını ve v031 SQL'inin incelenmiş staging dosyasıyla birebir aynı olmasını doğrular. Yerel disposable PostgreSQL entegrasyon testleri de bu dosyaları tarih sırasıyla uygulayarak uyumluluğu test eder; **CI canlı Supabase'e SQL uygulamaz**.
