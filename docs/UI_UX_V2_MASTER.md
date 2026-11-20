# APARTMAN UI/UX v2 — ana şartname

Kaynak: 20 Kasım 2026 tarihli kullanıcı görevi. `APARTMAN_UIUX_V2_ANA_SARTNAME.md` eki çalışma alanında bulunmadı; bu belge o dosyanın kopyası değildir. Aşağıdaki kesin kararlar prompttan alınmış başlangıç şartnamesidir. Özgün kaynak belge ileride sağlanırsa farklar açıkça uzlaştırılmalıdır.

## Kesin vizyon

APARTMAN Online, görsel ağırlıklı modern 2D çizgi film sosyal simülasyonudur. Görsel ve işlev dengesi ekran amacına göre değişir:

| Gelecek ana sekme sırası | Sunum ilkesi |
| --- | --- |
| Bugün | Eylem odaklı: günün mevcut görevleri ve yapılacak işlemler kolay taranır. |
| Dairem | Dengeli: sıcak ev atmosferi ile kişisel ekonomi/iş hayatı birlikte okunur. |
| Apartman | Görsel odaklı: etkileşim katmanına uygun dış cephe. |
| Komşular | Sohbet odaklı: çizimler mesaj akışını daraltmaz. |

Bu PR sanat temelidir; canlı menü adlarını/sırasını veya herhangi bir oyun akışını değiştirmez. Mevcut Yönetim, Sistem yönetimi ve Hesap güvenliği işlevlerinin v2 ekran yerleşimi sonraki ayrı sunum çalışmasında korunarak çözülmelidir.

## Bina ve karakter sistemi

- Dört konut katı, her katta soldan sağa üç daire. 1. kat 1/2/3, 2. kat 4/5/6, 3. kat 7/8/9, 4. kat 10/11/12. Giriş ayrı seviyedir.
- Dinamik apartman adı ve numaralar SVG'ye gömülmez. Sonraki uygulama erişilebilir HTML metni/butonları ile koordinat katmanını kullanır.
- 16 farklı ve aynı sanat dilinden çizgi film portresi. Farklılık yalnızca renk değişimi değildir: saç, yüz geometrisi, ifade, aksesuar ve kıyafetler değişir.
- Daire atmosferi ve en az üç küçük amaçlı illüstrasyon aynı sanat sistemine aittir.
- Yerel SVG dosyaları; stock/CDN hotlink, bilinmeyen lisanslı oyun görseli veya haricî font zorunluluğu yoktur.

## Kesin palet

Krem `#F7E8D0`, mercan `#EB987A`, adaçayı `#9BC5AC`, petrol `#315D59`, altın `#D9AC65`. Açık renkler yüzey/illüstrasyon içindir; metin ve kontrollerde erişilebilir koyu/açık eşler kullanılır. Yeni tokenlar yalnızca galeriye uygulanır; v1'in açık/koyu/sistem teması etkilenmez.

## Bu PR'ın sınırı ve kabulü

- Özgün logo, favicon, numarasız 4×3 cephe, 16 portre, daire içi ve üç küçük illüstrasyon gerçek dosya olarak teslim edilir.
- Tasarım tokenları, köken/kullanım envanteri, izole galeri ve gerçek 390/1440 px önizlemeler bulunur.
- Oyun mekaniği, RPC, veritabanı, migration, RLS, Auth, MFA, yetkiler ve mevcut workflow davranışı değiştirilmez. Canlı Supabase kullanılmaz.
- Tek dal `feat/uiux-v2-art-foundation`, tek PR. Otomatik birleştirme/yayın yoktur. İnsan sanat onayı beklenir.
- `docs/UI_REFRESH_V1.md` değiştirilmeden tarihsel kayıt olarak tutulur.

## Kaynak belgede henüz bulunmayan / kararlaştırılmayan ayrıntılar

Ayrı kaynak şartname sağlanmadığından aşağıdaki ayrıntılar kullanıcı onayı almış sayılmaz:

- Tam ekran wireframe'leri, görsellerin ekran yüksekliğindeki kesin payı ve bütün kırılım noktaları.
- Bugün sekmesine taşınacak mevcut işlemlerin kesin bilgi mimarisi; mevcut yönetim/güvenlik bağlantılarının son yeri.
- Daire tıklamasının sonucu, doluluk/oyuncu/ziyaret durumlarının görsel karşılıkları. Bu PR herhangi bir tıklama eylemi veya sahiplik ataması eklemez.
- Avatar seçme/atama mekanizması, kullanıcıya kalıcı avatar kaydı, isimler veya karakter hikâyeleri.
- Animasyon, dekorasyon/özelleştirme, satın alma, yeni oyun sistemi ve görsel durum varyantları.
- Son logo tipografisi, yerel font ailesi/lisans tercihi ve nihai illüstrasyon üretim standardı.

Bu eksikler yeni özellik talebi değildir; sonraki tasarım onayı için açık sorulardır. Ayrıntılı sanat ve doğrulama notları: [Sanat rehberi](design/UI_UX_V2_ART_GUIDE.md).
