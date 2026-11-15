# APARTMAN ilk sürüm durum raporu

## Hazır

React/TypeScript/Vite uygulaması, dört Türkçe bölüm, kayıt/giriş ve kalıcı Supabase oturum entegrasyonu, davetiye katılımı, 12 dairelik güvenli atama, Realtime sohbet entegrasyonu, geçmiş sayfalama, engelleme ve şikâyet, ortak kasa, 24 saatlik oylama, güvenli sonuçlandırma ve gerçek gelişme kayıtları. Sistem/açık/koyu tema ve responsive CSS.

İki migration: `20261115134128_initial_game.sql`, `20261115134726_scheduled_resolution.sql`. Yeni projeye uygulanmak üzere hazır. Canlıya uygulanmadı.

GitHub Pages Actions workflow ve PostgreSQL test işi, `/apartman-online/` Vite base, README, AGENTS.md, lockfile, Codespaces yapılandırması ve davetiye/şikâyet yönetici SQL dosyaları hazır.

## Doğrulama

3 yapılandırma testi, 11 gerçek PostgreSQL entegrasyon grubu, TypeScript/Vite üretim derlemesi başarılı. Üretim bağımlılıklarında npm audit: 0 açık.

Gerçek Supabase Auth/Realtime uçtan uca süiti **çalıştırılamadı**: yerel Supabase PostgreSQL imajının açılması disk sınırına takıldı. Bunun yerine SQL kuralları daha küçük PostgreSQL 17 konteynerinde sınandı. Cron worker gövdesi sınandı; pg_cron kurulumu/zamanlayıcısı doğrulanmadı.

Tarayıcı/mobil görsel QA yapılamadı: yönetilen önizlemenin gerekli browser aracına erişim yok. Canlı GitHub Pages doğrulanmadı.

## GitHub

Bağlı hesap: `oklukk`. `apartman-online` için sorgu 404 döndü. Yeni repository oluşturma hem CLI hem REST denemesinde `Resource not accessible by integration` ile reddedildi (REST 403). Bu GitHub yetki sınırıdır. Başka repository'ye yazılmadı, görünürlük değiştirilmedi. Kaynak ağacı yerel main dalında hazırlanmıştır; uzak repository/Pages bağlantısı henüz yok.

## Supabase

Bağlı organizasyon: `Apartman Yöneticisi`. Mevcut bir proje görüldü; üzerinde değişiklik yapılmadı. Yeni proje için organizasyon seçimi kullanıcıya soruldu; cevap bekleniyor. Supabase aracının yeni proje oluşturma kuralı organizasyonu kullanıcıya sormayı açıkça gerektiriyor. Ücretli proje veya abonelik oluşturulmadı. Yeni proje, Auth URL ayarı, publishable değişkenler, CLI uzak proje bağlantısı ve canlı migration uygulaması bekliyor.

## Kullanıcıdan gerekenler

1. Bağlı `Apartman Yöneticisi` organizasyonunda ücretsiz yeni Supabase projesi açılmasına organizasyon seçimi yanıtını verin. Ücret çıkarsa işlem yapılmayacak.
2. GitHub'da boş `apartman-online` deposunu oluşturun ve bağlı GitHub uygulamasına bu depoyu açın. GitHub Free Pages için public seçmeniz gerekir; mevcut bir deponun görünürlüğünü değiştirmeniz istenmiyor.
3. Erişimler açılınca kod aktarımı, yeni hedefin kontrolü, migration, Auth/Realtime, GitHub Variables ve Pages kurulumu tamamlanabilir. Kendi bilgisayarınıza yazılım kurmanız gerekmez.
4. Son adımda iki farklı e-posta hesabıyla canlı kayıt, sohbet, oylama ve mobil kabul testleri yapılmalıdır.

## Sonraki adım

Önce bu sürümün gerçek hesaplarla canlı kabulünü tamamlayın; sonra ayrı branch/PR ile yalnızca seçilecek yeni özelliğe geçin. Meslek, pazar, para transferi, çoklu apartman veya diğer kapsam dışı sistemler eklenmedi.
