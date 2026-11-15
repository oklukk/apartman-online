# APARTMAN kurulum durumu

## Canlı Supabase: oluşturuldu

- Organizasyon: Apartman Yöneticisi. Maliyet aracı yeni projeyi aylık **0 USD** olarak bildirdi; ücretli kaynak oluşturulmadı.
- Yeni proje: `apartman-online`, ref `rmoytuncahutqurttknt`, Frankfurt (`eu-central-1`).
- Dashboard: https://supabase.com/dashboard/project/rmoytuncahutqurttknt
- API: https://rmoytuncahutqurttknt.supabase.co
- Hedefin yeni ve boş olduğu tablolar incelenerek doğrulandı. Organizasyondaki mevcut proje üzerinde değişiklik yapılmadı.
- Önceden hazırlanan SQL içerikleri değişmeden iki migration uygulandı. Uzak migration geçmişi `20261115141348 initial_game` ve `20261115141400 scheduled_resolution`. Yerel dosya adları uzak sürümlerle eşleştirildi; gelecekte CLI aynı SQL'i tekrar uygulamaya çalışmayacak.
- Çınar Apartmanı, 12 daire, 5.000 OP kasa doğrulandı. Şu anda gerçek üye/test hesabı yok; canlı test için oyun verisi veya zaman değiştirilmedi.
- Tüm public/private tablolarda RLS açık. Oyuncuya kasa güncelleme, davetiyeleri okuma veya iç sonuçlandırma işlevlerini çalıştırma yetkisi yok. public şemasında SECURITY DEFINER işlev yok.
- messages/memberships/polls/buildings/activity Realtime yayınına eklendi.
- Her dakika çalışan cron etkin; `cron.job_run_details` başarılı çalışmaları doğruluyor. Henüz canlı oylama olmadığı için bu, canlı ekonomik sonuçlandırmanın uçtan uca testi değildir.
- Auth API erişilebilir; e-posta kaydı açık, e-posta doğrulama açık, anonim hesaplar kapalı. Site URL/redirect ve minimum şifre ayarları bu bağlantıdaki araçlarla değiştirilemedi; kontrol/tamamlama gerekiyor.

## GitHub ve Pages: yazma yetkisi engeli

- Repository: https://github.com/oklukk/apartman-online — mevcut, public ve boş.
- Hesap repository permission yanıtı push/admin gösterse de Git push, bağlı GitHub aracıyla Contents yazma ve Actions Variables yazma ayrı ayrı 403 `Resource not accessible by integration` döndürdü. Hesabın yetkisi, entegrasyon tokenının kapsamını garanti etmiyor.
- Kaynak GitHub'a yüklenemedi; başka repository'ye yazılmadı, görünürlük değiştirilmedi.
- Pages API yapılandırması zaten `build_type=workflow` olarak doğrulandı.
- Hedef yayın: https://oklukk.github.io/apartman-online/ — şu anda **404**, çalışan oyun bağlantısı olarak sunulmamalı.
- `.github/workflows/pages.yml` için yalnızca public Supabase URL/publishable anahtarı varsayılanları eklendi. Bu değişiklik, Actions Variables yazma yetkisi olmadan da bağlantılı build yapılmasını sağlar. Repository Variables mevcutsa önceliklidir. Hiçbir service-role/gizli anahtar kaynakta yok.
- Başlangıç commit'i `62e96ae` korunuyor; kurulum belgeleri, workflow ve migration ad eşleştirmesi ek commit olarak hazırlanıyor.

## Bu aşamada başarılı testler

- `npm test`: 3/3.
- Gerçek Supabase URL/publishable değeriyle strict TypeScript + Vite üretim derlemesi başarılı.
- Yeni disposable PostgreSQL 17 üzerinde `npm run test:sql`: 11/11 grup. 13 eşzamanlı taşınma, 12 daire kapasitesi, RLS, tekil sahiplik, mesaj kimliği/uzunluk/spam, engelleme/şikâyet, 24 saat/ikinci oy, çoğunluk/katılım/bütçe ve altı eşzamanlı sonuçlandırmada tek harcama yeniden geçti.
- Canlı REST API'de oturumsuz messages/memberships/buildings okuma ve send_message çağrıları 42501 yetki hatasıyla reddedildi.
- Canlı cron çalışmaları başarılı; 12 daire ve 5.000 kasa, RLS ve iç işlev yetkileri sorgularla doğrulandı.
- Security Advisor hata/uyarı üretmedi. `private.invitations` için RLS açık/policy yok **INFO** kaydı beklenen kapalı erişim modelidir; oyuncular davetiyeleri doğrudan okuyamaz. Açıklama: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Performance Advisor henüz kullanılmayan indexler ve iki FK için kapsayıcı index önerisi (INFO) verdi; bu yeni, 12 dairelik kurulumda güvenlik engeli yok. Açıklama: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

## Tamamlanamayan doğrulamalar

- İki ayrı örnek adresle canlı signUp denendi; Supabase `email_address_invalid` döndürdü. Hesap oluşmadı, oturum/giriş/çift yönlü Realtime testi yapılamadı. Örnek adres doğrulaması veya e-posta güvenliği aşılmadı.
- Canlı daire ataması ve oylama, iki gerçek doğrulanmış hesap olmadığı için test edilmedi; bunların PostgreSQL kuralları yukarıdaki disposable testlerde geçti.
- GitHub Actions gerçek koşusu ve Pages açılışı, kod yazma yetkisi engeli nedeniyle doğrulanamadı.
- Mobil/tarayıcı görsel testi henüz yapılmadı.
- CLI `supabase link` erişim tokenı olmadığı için çalışmadı. Migration işlemleri bağlı Supabase MCP aracıyla başarılı tamamlandı; token eksikliği migrationları engellemedi. CLI bağlantısı gelecekteki CLI işleri için gereklidir.

## Kullanıcının kalan adımları

1. GitHub entegrasyonunu `oklukk/apartman-online` deposu için **Contents ve Workflows yazma** erişimiyle yeniden yetkilendirin. Yalnızca repository oluşturmak veya insan hesabına admin vermek entegrasyon kapsamını değiştirmiyor. GitHub kurulumu: https://github.com/settings/installations . Sonrasında kaynak ve workflow aktarımı tekrar yapılabilir. Actions Variables zorunlu değil; workflow güvenli public varsayılanları içeriyor.
2. Yeni projenin Auth URL Configuration ekranında Site URL ve redirect allowlist'e `https://oklukk.github.io/apartman-online/` ekleyin. Minimum şifreyi 8 karakter yapın. E-posta kaydını/doğrulamayı açık, anonim hesapları kapalı tutun. Bu ayarlar uzaktan tamamlandı diye raporlanmıyor.
3. Pages yayını açıldıktan sonra iki gerçek e-posta ile uygulamadaki kayıt formundan kullanıcı adı seçerek kaydolun ve e-postaları doğrulayın. Şifrelerinizi paylaşmayın. Dahili Auth kullanıcı tablosuna elle satır eklemeyin; Auth Dashboard'da metadata olmadan kullanıcı oluşturmak bu uygulamanın kullanıcı adı kuralını karşılamaz.
4. Proje sahibi `supabase/admin/create-invitation.sql` ile iki tek kullanımlık davetiye üretebilir. Çıktı kodlarını GitHub'a koymayın. Sonrasında iki ayrı oturumda taşınma/sohbet/oylama ve mobil kabulü tamamlayın.

Ücretli abonelik, başka projeye müdahale, gerçek kullanıcı/veri silme veya gizli anahtar paylaşımı yapılmadı.
