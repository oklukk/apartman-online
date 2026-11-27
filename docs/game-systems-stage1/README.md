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

## PR #16 inceleme güncellemesi — yedi maddenin yeri

Aynı dokümantasyon PR'ı güncellenir; yeni bir GitHub PR'ı, kod veya migration oluşturulmaz. Mevcut sistem envanteri değişmediği için `CURRENT_SYSTEM_INVENTORY.md` tarihsel kaynak incelemesi olarak korunur. Güvenlik/atomiklik/RLS, legacy maaş geçişi, veri koruma ve rollout/geri çekme ilkeleri aynıdır.

| İnceleme maddesi | Mimari bölümü | Karar / geliştirme yeri |
| --- | --- | --- |
| Özel öğretmen, öğretim görevlisi, profesör; verim ve kapasite | `ARCHITECTURE.md` §3.1–3.2; ayrı yeterlik tablosu | D03/D04; A3 dar bot öğretim görevlisi kursu. Verilen öğretim görevlisi/profesör eşikleri kesin, özel öğretmenin ayrı sayısal alt sınırı atanmadığı için D03'te açık kaldı; başka unvanın şartları ona kopyalanmadı. |
| Dolu insan kadrosunda yüksek seviyeli başvuru | §6.1–6.2; önceden politika, tazminatlı değiştirme / sözleşmeyi koruyan ek kadro | D12/D13/D16; C1/C3/C4. Maaş düşürme hâlâ açık karar. |
| Bot müşteriler ve bot apartmanı talebi; para kaynağı | §5.3, §7–10; ihtiyaç, fiyat-performans, sıklık ve kaynaklı bütçe | D11/D18/D20; **B5b sonrası D1**. Merkezî bütçe/kapalı havuz ve sayılar öneri/açık karar. |
| Kayıtlı kural ile gerçek ihale teklifi; son 10 dakika | §5.1–5.2; gerçek teklif anında rezervasyon, kayıpta release, kazanımda kesintisiz devir | D08/D17; **B5b sonrası D2–D3**. 10 dakika kesin tasarım kararı; skor/iptal/kısa ihale ayrıntıları açık. |
| Bot hızlı hizmet kotası ve sonraki teslimat/randevu | §4; ayrı sayaç ve gelecek slot rezervasyonu | D07/D17; B3/B4 çekirdeği, geniş bot hizmeti sonraki dilim. Sayısal kotalar belirlenmedi. |
| Planlı ve sınırlı NPC nüfusu; her alana eğitmen kapsaması | §2.1; tek kalıcı kimlik/profil/konut, işe göre yeni NPC yok | D04; A1/A3. Nüfus sayısı/kapasite planı ayrı onay bekler. |
| İlk oynanabilir ücretli döngü | `DECISIONS_AND_DELIVERY.md` §3 | A1–A4 **eğitim prototipi**, **B5b ilk tamamlanmış ücretli apartman hizmeti**. D1–D3 ve geniş unvan sistemleri bunun ön şartı değil. |

Mevcut **D01–D20** kimlikleri korunarak içerikleri güncellendi. Yeni müşteri bütçesi, gerçek ihale ve son-10-dakika otomasyonu için üç ayrı risk sınırı bulunduğundan, B5b sonrasına D1/D2/D3 eklendi; 18 önerilen adım sayısı bir hedef değildir. İhtiyaç ve test kapsamı nedeniyle ayrıdır, sayı tutturmak için değil. Bu plan, uygulama veya canlı onay anlamına gelmez.

## A1 hazırlık eki — PR #16 sonrası

PR #16 `main/94ff023` ile birleşmiştir. A1'in ayrı hazırlık çalışması aşağıdaki belgelerde yürür; önceki revizyon açıklamaları tarihsel kayıttır.

- [D01/D04 karar dosyası](A1_DECISIONS.md): oyuncu başlangıç politikası, planlı ilk nüfus ve konut/alan/eğitmen kapsaması. Sayısal öneriler uygulanmış veya onaylanmış değerler değildir.
- [Küçük A1 geliştirme ve test planı](A1_IMPLEMENTATION_PLAN.md): ilk saf domain dilimi, sonraki boş şema/disposable test sınırı, mevcut oyuncu verilerinin korunması ve ayrı operasyon onayları.

Bu ilk hazırlık PR'ında kod/migration, gerçek actor/NPC/konut veya seed yoktur. Yeni A1 testleri planlanmıştır; yalnız mevcut uygulamanın temel testleri çalıştırılır. Bot müşterilerin B5b'den sonra C istihdamını beklemeden gelebilmesi kaynak/bütçe modeline bağlı **alternatif sıra** olarak değerlendirilir; mevcut plan sessizce yeniden onaylanmış sayılmaz.
