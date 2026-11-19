# Test sınırları ve tekrar çalıştırma

## Başarıyla çalıştırılanlar

- `npm test`: 3 test, başarılı.
- `npm run build`: strict TypeScript kontrolü ve Vite üretim derlemesi başarılı.
- `npm run test:sql`: PostgreSQL 17.11 üzerinde 11 grup başarılı. RLS, davetiye, aynı anda 13 kullanıcının kapasite mücadelesi, benzersiz kullanıcı adı/daire, mesaj sahipliği/spam/uzunluk, engelleme/şikâyet, 24 saat, ikinci oy, yetkisiz oy, eşitlik, katılım, bütçe, altı eşzamanlı sonuçlandırıcı, mükerrer ekonomik etki ve kalıcı gelişme kayıtları gerçek SQL ile doğrulandı.
- `npm audit --omit=dev`: 0 bilinen üretim bağımlılığı açığı.

SQL testleri Supabase Auth HTTP'nin yerine test auth.users tablosu ve auth.uid JWT ayarını kullanır. Kullanıcı şifresi, gerçek oturum cookie/storage davranışı veya WebSocket bağlantısı bu testten çıkarılamaz.

## Tam Supabase süiti: hazırlanmış, çalıştırılamadı

`tests/database.mjs` gerçek kayıt/giriş/çıkış/token yenileme, iki farklı oturumda çift yönlü Postgres Changes sohbeti ve kalan oyun işlemlerini içerir. Yerel Supabase PostgreSQL imajı açılırken Docker katmanı disk sınırına takıldı; ardından kayıt servisi rate limit döndürdü. Bu süit geçti diye raporlanmaz.

Yeterli disk alanına sahip ayrı bir **bulut geliştirme ortamında**:

1. Kaynakların yeni olduğunu, 54321/54322 portlarında başka proje bulunmadığını kontrol edin. `supabase --help` ve `supabase start --help` inceleyin.
2. Sadece bu disposable ortamda `supabase/config.toml` içindeki `[auth.email].enable_confirmations` değerini false yapın. Canlı projede e-posta doğrulamayı kapatmayın.
3. `supabase start` çalıştırın. Dosyada başvurulan seed.sql kullanılmadığı için `[db.seed].enabled=false` ayarlanmıştır.
4. `supabase status --help` inceleyin; desteklenen JSON çıktı ile `supabase status -o json > work/local-status.json` kaydedin. Bu dosya yerel servis anahtarlarını içerebilir; gitignore altında kalır, içeriğini paylaşmayın.
5. `npm run test:db`. Test yalnızca localhost 54321/54322 hedefini kabul eder ve boş memberships tablosu bekler. 14 adet test hesabı oluşturur; canlı projeye yönlendirmeyin. Test verileri bu disposable ortamda kalır.
6. Yerel yığını durdurun. Config'teki e-posta doğrulamayı true geri alın. Kaynakları veya başka Docker kaynaklarını topluca silmeyin.

## Canlı kabul testleri (bekliyor)

- İki ayrı tarayıcı profilinde kayıt, e-posta doğrulaması, giriş/çıkış; sayfa yenilemede oturumun korunması.
- Ayrı davetiyelerle aynı apartmana katılım, kullanıcı/daire isimleri.
- Çift yönlü canlı sohbet, geçmiş sayfalama, engel ve şikâyet.
- Yetkisiz bir hesap ve oturumsuz istemciden mesajlara erişim reddi.
- İlk oylamada farklı hesapların oyları, ikinci oyun reddi ve süre sonunda gerçek kasa etkisi.
- `cron.job_run_details` üzerinden çevrimdışı cron çalışması ve Security Advisor.
- 360/390 px mobil ve masaüstü görünümü, klavye/focus ve koyu tema.
- Gerçek GitHub Actions ve Pages URL'sinde alt dizin dosyalarının yüklenmesi.

Bu ortamda Sites yönetilen önizlemesi için gerekli `cua_repl.js` mevcut değil. Tarayıcı önizlemesi ve mobil görsel QA çalıştırılamadı. Responsive CSS uygulanmış olması mobil kabul testinin geçtiği anlamına gelmez.


## UI/UX v1 (19 Kasım 2026)

`npm test`, `test:ui`, `build`, `test:sql`, `test:v02`, `test:rbac` ve `test:advanced` başarılı. Ayrıntılı kapsam ve tamamlanmamış mobil/masaüstü tarayıcı kabul listesi [UI yenileme belgesinde](UI_REFRESH_V1.md). Tema testleri normal metin, form sınırları ve odak rengi kontrastını hesaplar; statik React testleri yerleşim veya gerçek Auth/Realtime testi sayılmaz.
