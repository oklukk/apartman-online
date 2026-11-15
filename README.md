# APARTMAN v0.2

Çınar Apartmanı'nda gerçek oyuncuların birlikte yaşadığı, Türkçe metin ve menü tabanlı online oyunun ilk sürümü. React + TypeScript + Vite, Supabase Auth/PostgreSQL/Realtime, GitHub Pages. Ayrı uygulama sunucusu veya ücretli kaynak gerekmez.

**v0.2:** Mevcut dört ekran ve sosyal sistem korunarak kişisel cüzdan/iş hayatı, haftalık aidat/işletme giderleri ve 14 günlük yönetici seçimleri eklendi. Ekonomi, takvim, güvenlik, testler ve veri koruma yaklaşımı [v0.2 belgesinde](docs/V02.md). Başlangıç 300 OP, eşit maaşlı üç meslek 100 OP/gün, ek iş 25 OP/gün, aidat 150 OP/hafta. Bütün para ve yetki işlemleri sunucudadır.

[Oyun](https://oklukk.github.io/apartman-online/) · [Repository](https://github.com/oklukk/apartman-online). Yayın ve canlı migration durumu `docs/STATUS.md` içinde.

## İlk sürüm

- E-posta/şifre ile kayıt, benzersiz kullanıcı adı, giriş/çıkış ve Supabase oturumu.
- Davetiyeyle, sunucu tarafından ilk boş daireye atama. 12 daire, kullanıcı başına tek daire. Davetiyeler yalnızca hash olarak saklanır.
- Apartman, Dairem, Komşular ve Yönetim bölümleri; sistem/açık/koyu tema ve responsive CSS.
- Kalıcı ve Realtime sohbet; 50 mesajlık sayfalama, 500 karakter, kullanıcı başına 2 saniye sınırı, engelleme ve şikâyet. Şikâyet incelemesi proje sahibinin SQL Editor akışıyla yapılır.
- İlk taşınmada başlayan 24 saatlik asansör oylaması; en az 3 oy, eşitlikte ret, bir oyuncuya bir oy.
- Kabulde 1.200 OP'lik atomik harcama, yetersiz bütçede ret, karar başına tek kasa hareketi. Başlangıç kasası 5.000 OP.
- Veritabanı işlemlerinden üretilen gelişmeler; PostgreSQL cron ile çevrimdışı sonuçlandırma, istemcide 30 saniyelik toparlama ve Realtime güncellemeleri.

## Buluttan kurulum

Bilgisayara yazılım kurmak gerekmez. Kod GitHub'a aktarıldıktan sonra Codespaces kullanabilirsiniz. Codespaces ücretsiz kota sınırları hesap planınıza bağlıdır; ücretli kota açmayın.

1. `apartman-online` isminde **yeni, boş** repository oluşturun. GitHub Free Pages için public repository gerekir. Mevcut repository görünürlüğünü değiştirmeyin. Bağlı GitHub uygulamasına bu yeni depoyu ayrıca açmanız gerekebilir.
2. Bu kaynak ağacını `main` dalına yükleyin. Başka projenin üzerine yazmayın.
3. Supabase'de seçtiğiniz organizasyonda **yeni** `apartman-online` projesini, Free plan ve yakın desteklenen bölge (örneğin Frankfurt `eu-central-1`) ile oluşturun. Ücret gösterilirse durun. Mevcut projeyi kullanmayın.
4. Supabase CLI'yi bulut terminalinde kurun. Komutları kullanmadan sürüm ve `--help` çıktısını inceleyin. Bu teslimde migration üretimi CLI **2.75.0** ile yapıldı. CLI 3'te uzak hedef onaylama kuralları değişti; komutları körlemesine kopyalamayın.
5. CLI oturumunu güvenli biçimde açıp `supabase link --help`, ardından `supabase link --project-ref <YENI_PROJE_REF>` kullanın. Parola/tokenı terminal komut satırına, koda veya GitHub'a yazmayın; güvenli etkileşimli girişi kullanın.
6. Hedefin yeni proje olduğunu ve `public` şemasının boş olduğunu kontrol edin. İki SQL migration dosyasını inceleyin. `supabase db push --help`, sonra destekleniyorsa `supabase db push --dry-run`, ardından yeni projeye `supabase db push` uygulayın. CLI kurulamıyorsa dosyaları **sırasıyla** SQL Editor'da uygulayın; bu yöntem migration history oluşturmayacağı için daha sonraki CLI geçişinde migration history'yi uzlaştırın.
7. `cron.job` içinde `apartman-resolve-polls` etkin olmalı. `supabase_realtime` yayınında messages/memberships/polls/buildings/activity tablolarını doğrulayın. Security Advisor çalıştırın. `private` şemasını Data API'ye açmayın.
8. Auth > URL Configuration: Site URL `https://oklukk.github.io/apartman-online/`; redirect allowlist'e aynı tam URL'yi ekleyin. E-posta/şifre kaydı ve e-posta doğrulama açık, minimum şifre 8 karakter olmalı. OAuth/anonim kayıt gerekmiyor. `supabase/config.toml` bu niyeti belgeler; uzak projeye uygulanmış sayılmaz. Sağlanan e-posta servisinin ücretsiz gönderim sınırları testleri sınırlayabilir; ücretli SMTP açmayın.
9. Projenin API URL'sini ve **publishable** anahtarını alın. Repository Settings > Secrets and variables > Actions > **Variables** altında `VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY` oluşturun. Bunlar tarayıcıya açık değerlerdir. Service-role/secret anahtarı kesinlikle eklemeyin. Bu kurulumun workflow dosyası, Variables yazma erişimi bulunmadığında yeni projenin yalnızca public URL/publishable değerlerini güvenli varsayılan olarak kullanır; dolayısıyla bu iki Variables alanı mevcut kurulumda zorunlu değildir.
10. Repository Settings > Pages > Source: **GitHub Actions** seçin. `.github/workflows/pages.yml` main push'unda test, TypeScript derlemesi ve Pages deploy çalıştırır. Sunucu bağlantı değerleri boşsa yayın durur; bu proje için public varsayılanlar tanımlıdır. Vite base `/apartman-online/` olarak ayarlanmıştır; uygulama pathname yönlendirmesi kullanmadığından Pages yenilemeleri alt sayfa 404'ü oluşturmaz.
11. SQL Editor'da `supabase/admin/create-invitation.sql` çalıştırın. Dönen kodu yalnızca davet edeceğiniz kişiye verin. Her çalıştırma 7 gün geçerli tek kullanımlık davetiye üretir. Kodları GitHub'a koymayın.
12. İki ayrı tarayıcı oturumunda farklı e-posta/kullanıcı adıyla kayıt olun, e-postaları doğrulayın, ayrı davetiyelerle katılın ve çift yönlü sohbet/oylamayı kontrol edin. Bu testler tamamlanmadan canlı sürümü tamamlanmış saymayın.

## Geliştirme

```sh
npm ci
# .env.example -> .env.local; yalnızca publishable değerleri doldurun
npm run dev
npm test
npm run build
```

Yerel makine yerine bulut terminali kullanılabilir. `.env.local`, geçici test dosyaları ve CLI bağlantı durumu gitignore ile hariçtir. Vite dev adresinin `/apartman-online/` yolunu açın. Bağımlılık sürümleri ve lockfile sabittir.

## Testler

`npm test`: üç yayın/yapılandırma kontrolü. Bunlar oyun entegrasyon testlerinin yerine geçmez.

`npm run test:sql`: gerçek PostgreSQL 17 üzerinde 11 test grubu. Test yalnızca sabit `127.0.0.1:55432` adresindeki **yeni, tek kullanımlık** test veritabanına bağlanır. Auth JWT kimliği ve auth.users kabuğu testte oluşturulur; Supabase Auth HTTP/Realtime/cron zamanlayıcısını doğrulamaz. İki migration'ın tüm oyun işlevleri ve worker gövdesi çalıştırılır; pg_cron kurulumu plain PostgreSQL'de yoktur.

CI'daki PostgreSQL servisi bu testi otomatik çalıştırır. Bulut Docker terminalinde isterseniz:

```sh
docker run -d --name apartman-test-postgres \
  -e POSTGRES_PASSWORD=local-test-only \
  -p 127.0.0.1:55432:5432 postgres:17-alpine -c wal_level=logical
npm run test:sql
# Yalnızca BU test konteynerini kaldırın; gerçek veritabanını silmeyin.
docker rm -f apartman-test-postgres
```

`npm run test:db`: **henüz başarıyla çalıştırılmadı**. Tam disposable Supabase üzerinde iki ayrı gerçek Auth oturumu ve Realtime'ı da test eden ek süit. Gerekli yalıtım ve ayarlar `docs/TESTING.md` içinde. Canlı projeye karşı çalıştırmayın.

## Mimari ve güvenlik

`profiles`, `buildings`, `apartments`, `memberships`, `messages`, `blocks`, `message_reports`, `events`, `polls`, `votes`, `treasury_transactions`, `activity`, `announcements` ilişkisel modellerdir. Yalnızca Çınar seed edilir; building_id ilişkileri gelecekte farklı apartmanları destekleyecek şekilde tutulur.

RLS ve açık GRANT kuralları bütün tablolarda geçerlidir. Oyun tablolarında oyuncuya doğrudan yazma verilmez. `public` RPC'ler SECURITY INVOKER kabuklarıdır; kontrol yapan SECURITY DEFINER kodu, sabit boş search_path ile Data API'ye kapalı `private` şemasındadır. Kimlik yalnızca `auth.uid()` ile alınır, kullanıcı metadatası yalnızca görünen kullanıcı adını oluşturur, yetki belirlemez. İç çözümleyiciyi sadece postgres/cron çağırabilir.

Daire ataması ve oy/sonuçlandırma önce apartman satırını kilitler. UNIQUE üyelik/daire/oy/karar hareketi kısıtları ek koruma sağlar. Oylama sonucu gerçek votes satırlarından hesaplanır. Karar, kasa, işlem ve gelişme kaydı aynı transaction içinde yazılır. Sunucu saati son kararı verir.

Realtime bildirimleri tablo RLS kurallarına tabidir. Engellenen mesajlar hem RLS hem mevcut istemci listesiyle gizlenir. Bağlantı koptuğunda 30 saniyelik okuma tekrarları geçmişi toparlar. Sohbet 50 mesajlık sayfalar, gelişmeler en son 30 kayıttır; kayıtlar veritabanında kalır. Bu sürüm kullanıcı/veri silme, gelişmiş moderasyon veya parola sıfırlama akışı içermez.

Tasarım: `src/api.ts` veri sözleşmeleri/istemci; `src/components` oylama ve gelişme bileşenleri; `src/main.tsx` oturum, ekranlar ve Realtime; `src/style.css` responsive temalar. Yönergeler `AGENTS.md` içindedir.
