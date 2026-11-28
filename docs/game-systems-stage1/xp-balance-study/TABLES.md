# Sayısal ek — bütün değerler öneri / simülasyon varsayımıdır

Bu dosya `study.py` tarafından config.json'dan üretilir; üretim kuralı değildir.

## Model A: kademelik ve toplam XP

| Seviye | Kademe XP | Toplam XP | 3600 toplamda kademe | 3600 toplamda birikimli |
| --- | --- | --- | --- | --- |
| 0 | 0 | 0 | 0 | 0 |
| 1 | 80 | 80 | 360 | 360 |
| 2 | 80 | 160 | 360 | 720 |
| 3 | 80 | 240 | 360 | 1080 |
| 4 | 80 | 320 | 360 | 1440 |
| 5 | 80 | 400 | 360 | 1800 |
| 6 | 80 | 480 | 360 | 2160 |
| 7 | 80 | 560 | 360 | 2520 |
| 8 | 80 | 640 | 360 | 2880 |
| 9 | 80 | 720 | 360 | 3240 |
| 10 | 80 | 800 | 360 | 3600 |

## Model A: tek yetenekte kilometre taşları

Günler kayıt başlangıcından itibaren takvim günüdür; bütün günler aktiftir. 180 sonrası değerler 1460 güne uzatılmış aynı simülasyondan gelir.

| dk/gün | L1 gün | L3 gün | L5 gün | L7 gün | L10 gün | L10 çalışma dk |
| --- | --- | --- | --- | --- | --- | --- |
| 15 | 3 | 8 | 13 | 18 | 25 | 375 |
| 30 | 2 | 4 | 6 | 8 | 12 | 340 |
| 60 | 1 | 3 | 4 | 6 | 8 | 470 |
| 120 | 1 | 3 | 4 | 6 | 8 | 735 |
| 180 | 1 | 3 | 4 | 6 | 8 | 735 |

## Model A: çift yetenek (Tesisat / İşletmecilik)

<30dk günler tek alana dönüşümlü; ≥30dk eşit 5 dk bloklarıyla bölünür. Aynı gün işlem sırası dönüşümlüdür.

| dk | 7g | 14g | 30g | 60g | 90g | 180g | İşletme5 gün | İki L10 gün | Hazırlık gün | Önce İşletme hazır gün |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 15 | 1/1 | 2/2 | 6/6 | 10/10 | 10/10 | 10/10 | 26 | 50 | 26 | 21 |
| 30 | 2/2 | 5/5 | 10/10 | 10/10 | 10/10 | 10/10 | 13 | 25 | 13 | 10 |
| 60 | 4/4 | 8/8 | 10/10 | 10/10 | 10/10 | 10/10 | 9 | 17 | 9 | 7 |
| 120 | 5/3 | 8/8 | 10/10 | 10/10 | 10/10 | 10/10 | 8 | 16 | 8 | 7 |
| 180 | 5/3 | 8/8 | 10/10 | 10/10 | 10/10 | 10/10 | 8 | 16 | 8 | 7 |

## Model A: tek yetenek 180g tavan etkisi

| dk | Doğrulanmış potansiyel XP | Verilen XP | Tavan nedeniyle verilmeyen | L10 taşması | Düzenli çalışma dk |
| --- | --- | --- | --- | --- | --- |
| 15 | 812 | 800 | 0 | 12 | 375 |
| 30 | 820 | 800 | 0 | 20 | 340 |
| 60 | 1068 | 800 | 268 | 0 | 470 |
| 120 | 1516 | 800 | 716 | 0 | 735 |
| 180 | 1516 | 800 | 716 | 0 | 735 |

## Model B: kademelik ve toplam XP

| Seviye | Kademe XP | Toplam XP | 3600 toplamda kademe | 3600 toplamda birikimli |
| --- | --- | --- | --- | --- |
| 0 | 0 | 0 | 0 | 0 |
| 1 | 20 | 20 | 20 | 20 |
| 2 | 40 | 60 | 41 | 61 |
| 3 | 80 | 140 | 81 | 142 |
| 4 | 120 | 260 | 122 | 264 |
| 5 | 180 | 440 | 183 | 447 |
| 6 | 260 | 700 | 264 | 711 |
| 7 | 380 | 1080 | 386 | 1097 |
| 8 | 560 | 1640 | 570 | 1667 |
| 9 | 800 | 2440 | 814 | 2481 |
| 10 | 1100 | 3540 | 1119 | 3600 |

## Model B: tek yetenekte kilometre taşları

Günler kayıt başlangıcından itibaren takvim günüdür; bütün günler aktiftir. 180 sonrası değerler 1460 güne uzatılmış aynı simülasyondan gelir.

| dk/gün | L1 gün | L3 gün | L5 gün | L7 gün | L10 gün | L10 çalışma dk |
| --- | --- | --- | --- | --- | --- | --- |
| 15 | 1 | 6 | 19 | 46 | 150 | 2235 |
| 30 | 1 | 3 | 9 | 20 | 67 | 2000 |
| 60 | 1 | 2 | 7 | 16 | 51 | 3030 |
| 120 | 1 | 2 | 7 | 16 | 51 | 4820 |
| 180 | 1 | 2 | 7 | 16 | 51 | 4820 |

## Model B: çift yetenek (Tesisat / İşletmecilik)

<30dk günler tek alana dönüşümlü; ≥30dk eşit 5 dk bloklarıyla bölünür. Aynı gün işlem sırası dönüşümlüdür.

| dk | 7g | 14g | 30g | 60g | 90g | 180g | İşletme5 gün | İki L10 gün | Hazırlık gün | Önce İşletme hazır gün |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 15 | 2/2 | 3/3 | 4/4 | 6/6 | 6/6 | 8/8 | 38 | 300 | 38 | 25 |
| 30 | 3/3 | 4/4 | 6/6 | 7/7 | 8/8 | 10/10 | 19 | 150 | 19 | 12 |
| 60 | 4/4 | 6/6 | 7/7 | 9/9 | 10/10 | 10/10 | 9 | 67 | 9 | 9 |
| 120 | 4/4 | 6/6 | 8/8 | 9/9 | 10/10 | 10/10 | 8 | 65 | 8 | 9 |
| 180 | 4/4 | 6/6 | 8/8 | 9/9 | 10/10 | 10/10 | 8 | 65 | 8 | 9 |

## Model B: tek yetenek 180g tavan etkisi

| dk | Doğrulanmış potansiyel XP | Verilen XP | Tavan nedeniyle verilmeyen | L10 taşması | Düzenli çalışma dk |
| --- | --- | --- | --- | --- | --- |
| 15 | 3540 | 3540 | 0 | 0 | 2235 |
| 30 | 3546 | 3540 | 0 | 6 | 2000 |
| 60 | 5094 | 3540 | 1550 | 4 | 3030 |
| 120 | 7152 | 3540 | 3612 | 0 | 4820 |
| 180 | 7152 | 3540 | 3612 | 0 | 4820 |

## Model C: kademelik ve toplam XP

| Seviye | Kademe XP | Toplam XP | 3600 toplamda kademe | 3600 toplamda birikimli |
| --- | --- | --- | --- | --- |
| 0 | 0 | 0 | 0 | 0 |
| 1 | 30 | 30 | 9 | 9 |
| 2 | 120 | 150 | 37 | 46 |
| 3 | 270 | 420 | 84 | 130 |
| 4 | 480 | 900 | 150 | 280 |
| 5 | 750 | 1650 | 234 | 514 |
| 6 | 1080 | 2730 | 337 | 851 |
| 7 | 1470 | 4200 | 458 | 1309 |
| 8 | 1920 | 6120 | 599 | 1908 |
| 9 | 2430 | 8550 | 757 | 2665 |
| 10 | 3000 | 11550 | 935 | 3600 |

## Model C: tek yetenekte kilometre taşları

Günler kayıt başlangıcından itibaren takvim günüdür; bütün günler aktiftir. 180 sonrası değerler 1460 güne uzatılmış aynı simülasyondan gelir.

| dk/gün | L1 gün | L3 gün | L5 gün | L7 gün | L10 gün | L10 çalışma dk |
| --- | --- | --- | --- | --- | --- | --- |
| 15 | 2 | 24 | 92 | 235 | 650 | 9730 |
| 30 | 1 | 12 | 46 | 117 | 325 | 9735 |
| 60 | 1 | 8 | 30 | 77 | 212 | 12690 |
| 120 | 1 | 8 | 30 | 77 | 210 | 19985 |
| 180 | 1 | 8 | 30 | 77 | 210 | 20030 |

## Model C: çift yetenek (Tesisat / İşletmecilik)

<30dk günler tek alana dönüşümlü; ≥30dk eşit 5 dk bloklarıyla bölünür. Aynı gün işlem sırası dönüşümlüdür.

| dk | 7g | 14g | 30g | 60g | 90g | 180g | İşletme5 gün | İki L10 gün | Hazırlık gün | Önce İşletme hazır gün |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 15 | 1/1 | 1/1 | 2/2 | 3/3 | 3/3 | 4/4 | 184 | 1300 | 184 | 116 |
| 30 | 1/1 | 2/2 | 3/3 | 4/4 | 4/4 | 6/6 | 92 | 650 | 92 | 58 |
| 60 | 2/2 | 3/3 | 4/4 | 5/5 | 6/6 | 8/8 | 46 | 325 | 46 | 38 |
| 120 | 2/2 | 3/3 | 5/5 | 6/6 | 7/7 | 9/9 | 30 | 212 | 30 | 38 |
| 180 | 2/2 | 3/3 | 5/5 | 6/6 | 7/7 | 9/9 | 30 | 211 | 30 | 38 |

## Model C: tek yetenek 180g tavan etkisi

| dk | Doğrulanmış potansiyel XP | Verilen XP | Tavan nedeniyle verilmeyen | L10 taşması | Düzenli çalışma dk |
| --- | --- | --- | --- | --- | --- |
| 15 | 3218 | 3218 | 0 | 0 | 2680 |
| 30 | 6428 | 6428 | 0 | 0 | 5400 |
| 60 | 12836 | 9825 | 3011 | 0 | 10800 |
| 120 | 18332 | 9900 | 8432 | 0 | 17165 |
| 180 | 18368 | 9900 | 8468 | 0 | 17210 |

## Model B: düzensiz / mola / yeni katılım (30dk, çift yetenek)

| Senaryo | 30g | 60g | 90g | 180g | 180g XP | 180g çalışma dk |
| --- | --- | --- | --- | --- | --- | --- |
| dual | 6/6 | 7/7 | 8/8 | 10/10 | 7080 | 4470 |
| irregular | 4/4 | 5/5 | 6/6 | 8/8 | 3624 | 2290 |
| break14 | 4/4 | 7/7 | 8/8 | 10/10 | 7080 | 4470 |
| break60 | 6/6 | 6/6 | 6/6 | 9/9 | 5640 | 3570 |
| return_bonus | 4/4 | 7/7 | 8/8 | 10/10 | 7080 | 4440 |
| newcomer30 | 0/0 | 6/6 | 7/7 | 10/10 | 7080 | 4470 |
| failure20 | 6/6 | 7/7 | 8/8 | 10/10 | 7080 | 4505 |
| business_unavailable | 6/0 | 7/0 | 8/0 | 10/0 | 3540 | 2235 |

## Model B 180dk: tavan türü ve alan değiştirme (ikinci aktif gün)

| scope | cap_policy | raw_xp_day2 | credited_day2 | cap_lost_day2 |
| --- | --- | --- | --- | --- |
| single_skill | general | 142 | 110 | 32 |
| single_skill | skill | 142 | 70 | 72 |
| single_skill | combined | 142 | 70 | 72 |
| four_skills | general | 312 | 110 | 202 |
| four_skills | skill | 312 | 280 | 32 |
| four_skills | combined | 312 | 110 | 202 |

## Model B: üst seviye şartını tek başına değiştirme

| Şart | dk | L7 gün | L10 gün | 180g L |
| --- | --- | --- | --- | --- |
| xp_only | 15 | 45 | 148 | 10 |
| practice_only | 15 | 46 | 150 | 10 |
| qualification_only | 15 | 46 | 153 | 10 |
| hybrid | 15 | 46 | 150 | 10 |
| extended | 15 | 46 | 156 | 10 |
| xp_only | 30 | 20 | 66 | 10 |
| practice_only | 30 | 20 | 66 | 10 |
| qualification_only | 30 | 21 | 69 | 10 |
| hybrid | 30 | 20 | 67 | 10 |
| extended | 30 | 20 | 70 | 10 |
| xp_only | 60 | 16 | 51 | 10 |
| practice_only | 60 | 16 | 51 | 10 |
| qualification_only | 60 | 16 | 51 | 10 |
| hybrid | 60 | 16 | 51 | 10 |
| extended | 60 | 16 | 52 | 10 |
| xp_only | 120 | 16 | 51 | 10 |
| practice_only | 120 | 16 | 51 | 10 |
| qualification_only | 120 | 16 | 51 | 10 |
| hybrid | 120 | 16 | 51 | 10 |
| extended | 120 | 16 | 51 | 10 |
| xp_only | 180 | 16 | 51 | 10 |
| practice_only | 180 | 16 | 51 | 10 |
| qualification_only | 180 | 16 | 51 | 10 |
| hybrid | 180 | 16 | 51 | 10 |
| extended | 180 | 16 | 51 | 10 |

## Model B: ücretli hizmet sonrası çoklu yetenek varsayımı

Ücretli işler ancak varsayımsal Tesisat3+İşletmecilik5 sonrası ve doğrulanmış talep varsa açılır; mevcut oyunda açık değildir.

| Politika | dk | 180g T/B | 180g toplam XP | Ücretli iş | Tesisat L10 gün |
| --- | --- | --- | --- | --- | --- |
| main_only | 15 | 9/8 | 4620 | 66 | 249 |
| conserved_split | 15 | 8/9 | 4626 | 67 | 275 |
| separate_management | 15 | 9/8 | 4620 | 66 | 249 |
| additive_split | 15 | 9/9 | 4992 | 66 | 249 |
| main_only | 30 | 10/10 | 7080 | 101 | 125 |
| conserved_split | 30 | 10/10 | 7080 | 126 | 138 |
| separate_management | 30 | 10/10 | 7080 | 101 | 125 |
| additive_split | 30 | 10/10 | 7080 | 101 | 125 |
| main_only | 60 | 10/10 | 7080 | 102 | 63 |
| conserved_split | 60 | 10/10 | 7080 | 116 | 70 |
| separate_management | 60 | 10/10 | 7080 | 102 | 63 |
| additive_split | 60 | 10/10 | 7080 | 109 | 67 |
| main_only | 120 | 10/10 | 7080 | 115 | 65 |
| conserved_split | 120 | 10/10 | 7080 | 115 | 65 |
| separate_management | 120 | 10/10 | 7080 | 115 | 65 |
| additive_split | 120 | 10/10 | 7080 | 115 | 65 |
| main_only | 180 | 10/10 | 7080 | 114 | 65 |
| conserved_split | 180 | 10/10 | 7080 | 114 | 65 |
| separate_management | 180 | 10/10 | 7080 | 114 | 65 |
| additive_split | 180 | 10/10 | 7080 | 114 | 65 |
