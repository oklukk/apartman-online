# APARTMAN geliştirme kuralları

- React + TypeScript + Vite ve Supabase kullan. Türkçe, mobil öncelikli, erişilebilir dört bölüm sınırını koru.
- v0.2 kapsamı: mevcut tek Çınar Apartmanı, davetiye/sohbet/oylama temeli üzerine kişisel cüzdan, üç eşit maaşlı meslek, ek iş, aidat, işletme giderleri, yönetici seçimleri ve oylamalı teklifler. Ticaret, para transferi veya çoklu apartman ekleme.
- Kritik işlemler PostgreSQL RPC ile doğrulanır. İstemci rolüne, maliyete, kullanıcı kimliğine veya oylama sonucuna güvenme.
- Her tabloda RLS, en az yetki ve açık GRANT kullan. SECURITY DEFINER yalnızca private şemasında, boş search_path ve açık yetki kontrolüyle kullanılabilir. Internal çözümleme işlevlerini authenticated/anon rollerine açma.
- Üyelik ve kasa işlemlerinde önce apartman, sonra davetiye/oylama satırını kilitle. Kilit sırasını koru. Aynı oylamadan yalnızca bir kasa hareketi üret.
- Servis anahtarı, parola ve erişim tokenını istemciye, kaynak koduna, loga veya GitHub'a koyma. Yalnızca publishable anahtar istemcide kullanılabilir.
- Ücretli kaynak oluşturma. Başka repository veya Supabase projelerine dokunma. Mevcut veriyi izinsiz silme.
- Migration oluşturmadan CLI --help komutunu oku ve `supabase migration new` kullan. Uzak uygulama öncesi hedef proje, mevcut tablolar ve migration SQL dosyalarını kontrol et.
- Canlı projede test için kullanıcı/veri silme veya zamanı değiştirme. Entegrasyon testleri yalnızca özel disposable yerel Supabase üzerinde çalışır.
- Yeni özellikler mümkün olduğunca ayrı branch ve PR üzerinden gelsin. Kilit dosyasını koru, bağımlılık sürümlerini sabitle, gereksiz paket ekleme.
- Her aşamanın sonunda `npm test` ve `npm run build`; veritabanı değiştiğinde disposable yerel stack'te `npm run test:db` çalıştır.
- Test edilmemiş davranışı doğrulanmış gibi, kurulum bekleyen uygulamayı tamamlanmış gibi raporlama.
- Davetiye üretimi ve şikâyet incelemesi README'deki yönetici SQL akışıyla yapılır; kullanıcı arayüzünden yönetici yetkisi atanmaz.

## v0.2 ekonomi ve yönetim

- İlk iki migration değişmez. Yeni dosyalar yalnızca ek migration olarak gelir; canlı kullanıcı, daire, mesaj, oy, davetiye ve eski kasa defterine geriye dönük düzeltme uygulama.
- Bütün ekonomik işlemler önce building, sonra wallet/dues/poll/election kilidi alır. `wallet_post` ve `treasury_post` yalnızca iç işlevdir; authenticated/anon rollerine grant etme.
- Türkiye günü/haftası `Europe/Istanbul` ile SQL'de hesaplanır. Sadece cari gün maaşı ve cari hafta aidatı; 7 günden eski aktiviteye yeni maaş/borç yok. Yeni meslek ilk sonraki günde, yeni sakin aidatı sonraki pazarteside başlar.
- Cüzdan bakiyesi ledger ile aynı transaction içinde güncellenir. Günlük gelirde `(user_id,kind,period_key)`, borçta `(user_id,week_start)` ve kasada source_key tekildir. Eski negatif poll hareketlerini treasury_history görünümünde bir kez göster.
- Yönetici yetkisi sunucuda aktif `manager_terms` aralığıyla belirlenir. Aday/oy modeli evet-hayır poll modelinden ayrıdır. Seçmen listesi açılışta sabitlenir, en az 2 seçmen ve 2 oy gerekir. Görev 14 gündür; süresi dolan yöneticinin yetkisini uzatma.
- `apartman-v02-tick` kendi transaction advisory lock'unu kullanır; mevcut `apartman-resolve-polls` görevini kaldırma veya yeniden oluşturma. Test için canlıda tarih değiştirme ya da worker'ı keyfi çağırma.
- Gerekli kontroller: `npm test`, `npm run test:sql`, `npm run test:v02`, `npm run test:ui`, `npm run build`. `test:sql` ve `test:v02` sabit localhost 55432 üzerinde kendi disposable veritabanlarını oluşturur/siler; canlıya yönlendirilemez. `test:db` gerçek yerel Supabase ister; altyapı yoksa engeli açıkça raporla.

## v0.3 RBAC
- v03 migration ve bootstrap ayrı onaylı rollout adımlarıdır. Sahip UUID'sini tahmin etme, hiçbir hesabı otomatik yükseltme.
- Yeni modüllerde katalog izin kodu ve checked sunucu RPC zorunlu. İstemci rolü/metadata yetki kaynağı değildir.
- RBAC yazmalarında ortak 741029030 transaction advisory lock'u yetki kontrolünden önce al; çözümleyicinin VOLATILE snapshot davranışını koru. Yeni yazma RPC'sine AAL2, kapsam, gerekçe, audit ve iptal yarış testleri ekle.
- `npm run test:rbac` CI'da zorunlu. Canlıda fixture, tarih veya seçim sonucu değiştirme.

## Gelişmiş yönetim (PR #4)
- v031/v032/v033 yalnız ayrı rollout onayıyla canlıya uygulanır. Staging ayrıca çalıştırılmaz; eski dört migration değişmez.
- Yeni staff mutasyonları staff_game_write_check + staff_claim_request, AAL2, kapsam, gerekçe ve audit gerektirir. Para silinmeyen ledger ve unique request ile yazılır; ters kayıt telafisi orijinal audit'e bir kez bağlanır.
- Yeni oyuncu mutasyonu assert_player_allowed guard'ını kullanmalı; eski *_before_moderation fonksiyonlarını authenticated'a açma. Aktif JWT ban/mute kontrolünü atlayamaz.
- Seçim müdahalesi snapshot revision ve building lock ile cron/oylar karşısında kontrol edilir; geçmiş aday/oy/görev silinmez. Görev çakışma constraint'i kaldırılmaz; voided kayıtlar etkin yönetici sayılmaz.
- test:advanced CI'da zorunludur. Gerçek MFA/tarayıcı testini fixture SQL testiyle karıştırma.
