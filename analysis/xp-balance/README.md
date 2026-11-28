# A2-2 çevrimdışı XP araştırması

**Bütün sayılar öneri / simülasyon varsayımıdır. Üretim oyunu bu dosyaları kullanmaz.**

Ana rapor: [A2_2_BALANCE_STUDY.md](../../docs/game-systems-stage1/A2_2_BALANCE_STUDY.md).

- `config.json`: önerilen üç paket, zaman/erişim/ödül/limit varsayımları.
- `simulate.py`: yalnız bellek üzerinde deterministik tek oyuncu deneyleri; dünya/genel kaynak güvenliğinin sunucu uygulaması değildir.
- `study.py`: 15 senaryo × 3 paket × 5 zaman bütçesi; altı rapor günü, kapı/çoklu ödül/tavan/parametre/uzun oturum duyarlılığı. Temel veri için yalnız Python 3.10+ standart kütüphanesi ve IANA `Europe/Istanbul` saat dilimi verisi gerekir.
- `test_simulation.py`: `unittest`; üçüncü taraf test bağımlılığı yok.
- `render.py`: isteğe bağlı çevrimdışı Matplotlib grafikleri. Üretim paketlerine bağımlılık eklemez. Teslim grafikleri Matplotlib 3.10.8 ile üretildi (ortam sürümü rapor doğrulamasında kontrol edilir).

```sh
python3 -m unittest discover -s analysis/xp-balance -p 'test_*.py' -v
python3 analysis/xp-balance/study.py --check
python3 analysis/xp-balance/study.py
MPLCONFIGDIR=/tmp/apartman-xp-mpl python3 analysis/xp-balance/study.py --figures
```

`--check`, geçici dizinde ürettiği metin verilerini teslim dosyalarıyla birebir karşılaştırır; grafik byte'ları font/çizim sürümüne bağlıdır. Rastgelelik yoktur. Başlangıç tarihi sentetiktir; ortam değişkeni, hesap bilgisi, ağ, Supabase/SQL bağlantısı veya gerçek kaynak UUID'si kullanılmaz. Sentetik kaynaklar `synthetic:` öneki taşır. Dosyaları üretimden içe aktarmayın.

Yeni parametre araştırması için config'i kopyalayın, `--config <dosya> --out <ayrı-dizin>` verin. Değişiklik oyun kuralı seçmek veya uygulamak değildir.

Çıktılar `docs/game-systems-stage1/xp-balance-study/` altındadır. Ufuk dışı/ulaşılmayan kilometre taşları CSV'de boş; 180 sonrası günler 1460 güne uzatılmış varsayımsal deneydir. Tek yetenek/iki yetenek stratejisi, yeterlilik erişimi, başarısızlık ve günlük ham XP kaybı anlamları ana raporda açıklanır. Bilinen sınırlar: eğitim/iş arzı varsayımsal, ekonomi ve eğitmen kapasitesi modellenmiyor, gerçek güvenlik/eşzamanlı veritabanı testi değil.

## PR #24 revizyonu: sınırlı öğrenme (ayrı takvim boyutu)

Önceki A/B/C XP paketleri, `config.json`, ilk betikler, sonuçlar ve 18 test korunur. Önceki sınırsız içerik/kapasite varsayımı yalnız **kontrol deneyi** olarak okunmalıdır; yeni tasarım hedefi değildir.

- `calendar-config.json`: önerilen takvim A/B/C, sonlu içerik, haklar, aşama koşulları, iki pilot eğitmen için ayrı sınırlı kapasite.
- `calendar_sim.py`: bağımsız sentetik sınıf/grup simülasyonu. Altı kişilik referans grubunda bir ölçülen oyuncu ve 30dk oynayan beş sabit arka plan öğrencisi; 12 kişilik yük senaryosu da var. Gerçek oyuncu/NPC/kurs oluşturmaz.
- `calendar_study.py`: 15/30/60/120dk, altı rapor tarihi; tek/iki alan, ara/düzensizlik, başarısızlık, pilot sınırı, kontenjan, az ihtiyaç, başlangıç günü, başlangıç paketi ve tek değişken kaldırma deneyleri. Çıktı: `docs/game-systems-stage1/xp-balance-study/calendar/`.
- `calendar_render.py`: isteğe bağlı Matplotlib görselleri. Yeni paket kurulumu veya npm bağımlılığı yok.
- `test_calendar.py`: 25 yeni analiz testi; eski 18 ile toplam43. Bunlar gerçek Auth/MFA/Realtime veya veritabanı güvenlik testleri değildir.

```sh
python3 -m unittest discover -s analysis/xp-balance -p 'test_*.py' -v
python3 analysis/xp-balance/study.py --check
python3 analysis/xp-balance/calendar_study.py --check
# Yeniden üretim; --config ve --out ile ayrı parametre deneyi de yapılabilir:
python3 analysis/xp-balance/calendar_study.py
MPLCONFIGDIR=/tmp/apartman-xp-mpl XDG_CACHE_HOME=/tmp/apartman-xp-cache python3 analysis/xp-balance/calendar_render.py
```

Takvim A/B/C, XP paketleri A/B/C değildir: yeni deneyler **B XP eğrisi ve B ödül/tavan referansında** yapılır. Kısa başlangıç alternatifleri ayrıca etiketlenir. Varsayımsal ileri portfolyo/içerik yolu, alanı6 olan pilot öğretim görevlilerinin uzmanlık dersi verebildiği anlamına gelmez. `pilot_only` senaryosu ileri yol yokken L6'da durur. Dört alanda sıfırdan başlangıç sınanır; iki öğreticilik alanına 4+ eğitim verecek öğretim görevlisi pilotta yoktur.

Bekleme kısıt günleri çakışabilir. `no_work_active_days` gerçekten öğrenme çalışması yapılamayan aktif günleri, `zero_xp_active_days` kısmi/0XP yeterlilik çalışmasını da içerir. `unused_minutes` oyuncunun beklemek zorunda olduğu süre değil, kullanamadığı varsayımsal öğrenme bütçesidir. `waiting.csv` içindeki `idle_minutes_*` ayrı öncelikli tanımlayıcı sınıflandırmadır; nedensel ayrıştırma değildir. Nedensel karşılaştırma `ablations.csv` içindedir; etkiler toplanamaz. Karşılaştırmalarda arka plan öğrencileri sabit kalır; kapasite çarpanı tüm kurumu etkiler.

Kapasite giriş/kontenjan sayısıdır; öğretme verimi veya öğrenci kapasitesine ilişkin kesin oyun formülü değildir. Ders/kitap kimliği dönemden bağımsız; deneme veya ders sunumu değişince ikinci XP üretmez. Yeni günlük uygulamalar gerçekte farklı, doğrulanmış görevler var olduğu **varsayımıdır**; tarih değişince ücretsiz/otomatik XP basılması önerilmez. `low_demand` bu varsayımın etkisini azaltılmış görev arzıyla ölçer.

## B+ erişim varyantı (aynı PR#24)

Önceki43 test, analiz kodu, parametreler ve A/B/C sonuçları değişmez. Yeni dosyalar:

- `bplus-config.json`: mekanizma alternatifleri; başarısız ilk birleşim, bekleyen sonlu içerik ve haftaya yayılmış hak deneyleri de korunur. Sonuç hedefi için XP eğrisi/ödülü değiştirilmez.
- `bplus_sim.py`: yalnız çevrimdışı `CalendarSimulation` alt sınıfı. Kapalı, sonlu kanıt/atama kütüğü; ortak apartman ihtiyacına tek kişinin tamamlaması; sınırlı aynı-modül bireysel çalışma; kontenjanlı ön kayıt/kuyruk. Üretim ödül işlevi veya güvenlik servisi değildir.
- `bplus_study.py`: eski B ve kısa başlangıç kontrolü; ayrı mekanizmalar;15/30/60/120dk;6/12 öğrenci; iki alan; düzensiz/ara; ileri yol var/yok;64/192 olgu duyarlılığı. Çıktılar ayrı `xp-balance-study/bplus/` dizinindedir.
- `test_bplus.py`: önceki43 üzerine27 test (toplam70). Kaynak adı/tarihi değişimi, aynı anlamsal kaynağa yeniID, kapsam, sınırlı katalog, ön kayıt iptali/devamsızlık, kapasite, alternatifte aynı içerik/ön koşul, başarısızlık, dönem hakları ve ölçüm ayrımı sınanır.
- `bplus_render.py`: isteğe bağlı Matplotlib grafikleri; CI'a çizim bağımlılığı eklenmez.
- `.github/workflows/xp-research.yml`: yalnız ilgili PR dosyalarında, read-only ve secrets/DB olmadan Python testleri + üç metin çıktısının tekrar üretimi. Mevcut Pages workflow'u değiştirilmez; yeni workflow push/deploy/publish yapmaz.

```sh
python3 -m unittest discover -s analysis/xp-balance -p 'test_*.py' -v
python3 analysis/xp-balance/study.py --check
python3 analysis/xp-balance/calendar_study.py --check
python3 analysis/xp-balance/bplus_study.py --check
python3 analysis/xp-balance/bplus_study.py
MPLCONFIGDIR=/tmp/apartman-xp-mpl XDG_CACHE_HOME=/tmp/apartman-xp-cache python3 analysis/xp-balance/bplus_render.py
```

`comparison.csv` ve `TABLES.md` kilometre taşları/boş günler; `milestones.csv` aktif gün ve çalışma dakikaları; `snapshots.csv`7/14/30/60/90/180 gün; `sources.csv` sonlu kaynak ve kurum geneli kuyruk sayaçları (ufuk boyunca); `capacity.csv` en yüksek haftalık rezervasyon; `community.csv` yalnız koşullu ödülsüz topluluk fırsatı; `marginal.csv` süre artışının tek/iki alan farkı; `daily.csv`180 günlük iz; `manifest.json` parametre özeti/row sayılarıdır.180 sonrası kilometre taşları1460 güne uzanır.

**Ölçüm uyarısı:** eski `no_work_active_days`, L10 sonrası günleri dışarıda bırakır. Yeni `no_learning_full180` bunları da içerir. Genel anlamlı faaliyet bulunamayan gerçek gün sayısı **bilinmiyor**; açıkça belirtilen sonlu topluluk olaylarıyla yalnız `no_modeled_learning_or_community_days` karşılaştırılır. Sohbet düğmesinin bulunması bu sayacı sıfırlamaz. `validated_*_denial_days` yalnız en az10dk ve uygun gerçek-fixture kaynak varken hak nedeniyle reddedilen aktif günlerdir; eski genel kısıt sayacı ile aynı ölçü değildir. Tamamlanmış rezervasyonun en uzun beklemesi henüz bitmemiş kuyruklar için garanti değildir.

**İçerik uyarısı:**192 farklı bağlamlı tanı/plan olgusu bir talep/öğrenme arzı varsayımıdır;192 pedagojik olarak hazırlanmış ve gerçek oyunda doğrulanmış görev teslimi değildir. Kimlik tarihten türetilmez; var olan anlam/kanıt kimliği başka adla kaydedilemez. Gerçek veritabanında bu sınırların server/unique doğrulaması ayrıca gerekir. Bireysel olgu bekleyen havuzu sonludur; gerçek apartman ihtiyacı52/alan fixture'ıyla sınırlı,3günlük ve sınıfta ortak kaynaktır. Bunlar canlı incident/oyuncu/kurs kaydı değildir. `library64` yalnız B+ sonlu kütüphane duyarlılığıdır; eski B'nin sınırsız yeni görev varsayımını64 olguya çevirmiş sayılmaz.

İlk birleşimde olgular hızlı açılıp kullanılamadan eskir; bekleyen havuz çözümü bunu içerik/XP eklemeden karşılaştırır. Sonraki birleşimde2/gün hakkın önden tüketilmesi boş günleri artırır; `Bplus_paced`, haftanın geçen günleri kadar en çok7 hak, günlük en çok2 ile önceki boş günlerin telafisini sınar. Bu ek seri/giriş ödülü değil; gerçek faaliyet tamamlanmadıkça XP yoktur. `paced_no_selfstudy` ve `paced_no_queue` düşük süreli oyuncunun pahalı alternatif/rezervasyon kullanmaması karşılaştırmalarıdır. Hiçbiri kesinleşmiş oyun kuralı değildir.

Rapor etiketleri: **B+S**=`paced_no_selfstudy` (ders yolu, daha sade aday), **B+D**=`Bplus_paced` (seçilebilir bireysel çalışma da var). B+S karşılaştırmaları tüm katılım/kapasite/pilot/içerik senaryolarında ayrıca hesaplanır; tek alandaki sınırlı marjinal fayda ile iki alan faydası ayrılır.
