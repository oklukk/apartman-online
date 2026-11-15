# v0.2 geliştirme ve canlı migration durumu

- PR https://github.com/oklukk/apartman-online/pull/1 birleştirildi. Merge commit: `9aa1fb4`. GitHub CI veritabanı, derleme ve Pages dağıtımı başarılı: https://github.com/oklukk/apartman-online/actions/runs/43750022282 .
- Mevcut `rmoytuncahutqurttknt` projesine yalnızca yeni `20261115185834_v02_economy_governance.sql` uygulandı. İlk iki migration ve geçmiş sürümleri değiştirilmedi. Yeni yerel dosyanın adı Supabase aracının oluşturduğu yeni sürüm numarasına eşleştirildi; SQL içeriği değişmedi.
- Önce/sonra: 2 hesap, 2 üyelik, 2 mesaj, 2 oy, 2 davetiye ve 5.000 OP kasa. Eski kayıt özeti `11ab7ca750368207b51ff9c8a2056cb3`, daire özeti `18699c489d1a7986af34c14ff5f139d2` iki tarafta aynı. Eski verilerde silme/sıfırlama yapılmadı.
- Mevcut iki sakinde 300'er OP, toplam iki başlangıç grant'i (600 OP) doğrulandı. Başlangıç parası ortak kasadan alınmadı. Henüz meslek seçilmedi; eski oyuncular adına seçim/iş/ödeme yapılmadı.
- İlk aidat/işletme haftası 16 Kasım 2026 Pazartesi. Geçmiş borç veya işletme gideri üretilmedi. Yeni `apartman-v02-tick` ve eski `apartman-resolve-polls` etkin.
- 3 yapılandırma, 11 eski PostgreSQL, 24 yeni PostgreSQL test grubu; statik React render testi ve bağlı üretim derlemesi geçti. Tam yerel Supabase Auth/Realtime süiti `work/local-status.json` olmadığından ENOENT ile engellendi. Mobil tarayıcı/gerçek iki oturum testi yapıldı diye raporlanmıyor.
- Yeni tabloların tümünde RLS, iç para/cron/yetki işlevlerinde anon/authenticated execute yasağı doğrulandı. Mevcut Auth `leaked password protection disabled` uyarısı sürüyor. Supabase belgelerine göre bu koruma Pro ve üstü planlarda; ücretsiz kapsam korunarak ücretli özellik açılmadı: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Özel davetiye tablosunun RLS/policy INFO kaydı erişimin bilinçli kapalı olduğunu gösterir.
- Yayın https://oklukk.github.io/apartman-online/ . HTML, v0.2 JS/CSS ve Supabase URL/publishable bağlantısı HTTP 200 ile doğrulandı. Yeni RPC adları ve sürüm yayımlanan pakette mevcut. Bu, gerçek tarayıcı/mobil kabulü yerine geçmez.
- Canlıda salt okunur iki kullanıcı kimlik bağlamında ayrı ayrı tek kişisel cüzdan/başlangıç hareketi ve eski sohbet görünürlüğü doğrulandı; gerçek Auth login/session testi olarak sayılmadı. Oturumsuz REST cüzdan/hareket/aidat/ortak defter erişimleri 401 ile reddedildi.
- Her iki cron başarıyla çalışıyor. İlk seçim iki seçmen ve iki oy şartıyla adaylık aşamasında; adaylık 16 Kasım 2026 21:59, oy verme 18 Kasım 2026 21:59 Türkiye saatinde sona eriyor. Görev sonucu kullanıcılar oy verdikten ve gerçek süre dolduktan sonra işlenecek; test için canlı takvim değiştirilmedi.
- Ekonomi/seçim kuralları ve geri çekme yaklaşımı `V02.md` içindedir. Kullanıcı kabulü: iki ayrı oturumda meslek/ek iş, seçim adaylığı/oy ve ilk pazartesi aidat ödemesi ile Realtime/mobil kontrolü. Manuel servis kurulumu veya ücretli kaynak gerekmiyor.

Aşağıdaki bölüm v0.1 kurulumunun tarihsel raporudur; yeni özelliklerin kabul sonucu olarak kullanılmamalıdır.

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

## GitHub ve Pages: yayımlandı

- Repository: https://github.com/oklukk/apartman-online — public.
- Bu aşamada yetkili Git doğrudan push başarılı oldu. `62e96ae` ve `3d8b92e` dahil mevcut Git geçmişi korunarak `main` yüklendi. Önceki 403 engeli doğrudan Git aktarımında artık yok.
- Pages `build_type=workflow` olarak doğrulandı. Başarılı ilk workflow: https://github.com/oklukk/apartman-online/actions/runs/43724394615
- Yayın: https://oklukk.github.io/apartman-online/ — HTML, JavaScript ve CSS **HTTP 200**. Türkçe belge, uygulama root'u, doğru `/apartman-online/` asset yolları ve yayımlanan JS içindeki doğru Supabase URL/publishable yapılandırması doğrulandı.
- GitHub Actions üzerinde build, database ve deploy işleri başarılı. 3 yapılandırma testi ve 11 PostgreSQL entegrasyon grubu geçti.
- `.github/workflows/pages.yml` yalnızca public Supabase URL/publishable anahtarı varsayılanlarını kullanır. `VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY` adlı Repository Variables isteğe bağlıdır; varsa varsayılanları geçersiz kılar. Gizli/service-role anahtarı eklenmedi.
- Bu yayın aşamasında Supabase projesine, migrationlara veya oyun verisine değişiklik uygulanmadı. Auth settings API okuması HTTP 200 döndürdü: e-posta kaydı/doğrulaması açık.

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
- GitHub Actions ve Pages HTTP/asset kontrolleri tamamlandı; gerçek tarayıcıda oturum ve kullanıcı etkileşimleri henüz test edilmedi.
- Mobil/tarayıcı görsel testi henüz yapılmadı.
- CLI `supabase link` erişim tokenı olmadığı için çalışmadı. Migration işlemleri bağlı Supabase MCP aracıyla başarılı tamamlandı; token eksikliği migrationları engellemedi. CLI bağlantısı gelecekteki CLI işleri için gereklidir.

## Kullanıcının kalan adımları

1. Yeni projenin Auth URL Configuration ekranında Site URL ve redirect allowlist'e `https://oklukk.github.io/apartman-online/` ekleyin. Minimum şifreyi 8 karakter yapın. E-posta kaydını/doğrulamayı açık, anonim hesapları kapalı tutun. Bu ayarlar uzaktan tamamlandı diye raporlanmıyor.
2. Yayımlanan uygulamada iki gerçek e-posta ile uygulamadaki kayıt formundan kullanıcı adı seçerek kaydolun ve e-postaları doğrulayın. Şifrelerinizi paylaşmayın. Dahili Auth kullanıcı tablosuna elle satır eklemeyin; Auth Dashboard'da metadata olmadan kullanıcı oluşturmak bu uygulamanın kullanıcı adı kuralını karşılamaz.
3. Proje sahibi `supabase/admin/create-invitation.sql` ile iki tek kullanımlık davetiye üretebilir. Çıktı kodlarını GitHub'a koymayın. Sonrasında iki ayrı oturumda taşınma/sohbet/oylama ve mobil kabulü tamamlayın.

Ücretli abonelik, başka projeye müdahale, gerçek kullanıcı/veri silme veya gizli anahtar paylaşımı yapılmadı.
