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
