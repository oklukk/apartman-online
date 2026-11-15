# APARTMAN geliştirme kuralları

- React + TypeScript + Vite ve Supabase kullan. Türkçe, mobil öncelikli, erişilebilir dört bölüm sınırını koru.
- Bu sürüm yalnızca Çınar Apartmanı (12 daire), davetiye, sohbet, engelleme/şikâyet, kasa ve oylamadır. Kapsamı izinsiz genişletme.
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
