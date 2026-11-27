# Yeni oyun sistemleri — Aşama 1: teknik şartname

**27 Kasım 2026 · İnceleme taslağı · Uygulama onayı değildir.**

Başlangıç: güncel `main`, `a2656e9395013b0a52e7e6cdaa73e81add2921a7`. PR #15'in birleştiği ve bu commit'in [Pages/CI çalışmasının başarılı olduğu](https://github.com/oklukk/apartman-online/actions/runs/45800533859) doğrulandı. Bu belge dalı yalnız dokümantasyondur. Canlı Supabase'e bağlanılmadı; kaynak kodu, migration, hesap, bakiye, seçim ve geçmiş kaydı değiştirilmedi.

1. [Mevcut sistem envanteri](CURRENT_SYSTEM_INVENTORY.md): kaynaklara dayalı özellikler, 36 tablo, 27 public RPC, güvenlik, UI ve testler.
2. [Teknik mimari ve geliştirme şartnamesi](ARCHITECTURE.md): aktör/yetenek, eğitim, işletme, kapasite, kaynak, sözleşme, muhasebe ve apartman bağlantısı; önerilen veri/RPC sınırları.
3. [Karar listesi ve PR sırası](DECISIONS_AND_DELIVERY.md): kesin kullanıcı kararları, öneriler, engelleyici açık konular, küçük prototipler ve kabul testleri.

Belge dili üç durumu ayırır: **Kural** kullanıcı tarafından belirtilen gereksinimdir; **Öneri** mimari/tasarım önerisidir ve henüz onaylı oyun kuralı değildir; **Açık karar** kodlamadan önce netleştirilecek konudur. Tablo/RPC adları taslaktır, mevcut API'de var oldukları anlamına gelmez. Bu PR'da çalıştırılabilir DDL veya migration yoktur.

Hedef günlük döngü: apartmanın gerçek bakım ihtiyacını gör → uygun eğitim veya iş seç → sınırlı kapasite ve gerçek kaynakla hizmet üret → kayıtlı gelirinle aidatını öde → ortak kasa ve yaşam kalitesine katkısını gör. İşletme sistemi apartman yaşamını destekler; ayrı bir sınırsız gelir oyunu hâline gelmez.

Mevcut dört oyuncu sekmesi ve onaylı UI/UX v2 korunur. AGENTS içindeki mevcut sürüm kapsamı, henüz geliştirilmemiş çoklu apartman/ticaret kurallarını otomatik açmaz: bu belgeler gelecek kapsamı **tasarlar**, uygulama yetkisi vermez. Yeni sistemlerin üretime alınması için önce tasarım kararları, ardından ilgili kod/migration PR'ları ayrıca onaylanmalıdır.

## Bu PR'ın doğrulama sınırı

Markdown yerel bağlantıları, envanterdeki tablo/RPC sayıları ve yalnız belge değiştiği kontrol edilir. Mevcut `npm test`, `npm run test:ui`, `npm run build` temel regresyon olarak çalıştırılır; mevcut GitHub CI ayrıca dört disposable PostgreSQL paketini çalıştırır. Son gerçek sonuçlar PR açıklamasında yer alır. Yeni sistemler henüz uygulanmadığı için çalışıyor veya testten geçmiş sayılmaz. Gerçek Auth/MFA/Realtime ya da yeni işletme/üniversite kabul testi yapılmış değildir.

PR taslak bırakılır; `main` dalına birleştirme ve yayın yapılmaz. Uygulama, kullanıcının mimari ve açık karar onayını bekler.
