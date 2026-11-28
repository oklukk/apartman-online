# B+ karşılaştırması — yalnız öneri / çevrimdışı varsayım

B XP eğrisi değişmez. Takvim B_original eski başlangıç; B_short herkes için5dk/32XP kısa başlangıç.180 sonrası kilometre taşları1460 gün ufkuna uzanır. Boş hücre=ufukta erişilemedi.

## Mekanizmalar,30dk tek Tesisatçılık

| Varyant | L3 | L5 | L7 | L10 | Boş öğrenme: L10 öncesi | Boş öğrenme:180g tamamı | Çalışma dk@180 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A_reference | 4 | 12 | 29 | 114 | 20 | 86 | 2120 |
| C_reference | 5 | 23 | 85 | 303 | 70 | 70 | 1350 |
| B_original | 5 | 17 | 51 | 226 | 44 | 44 | 1800 |
| B_short | 3 | 16 | 51 | 225 | 45 | 45 | 1770 |
| source_control | 3 | 16 | 51 | — | 45 | 45 | 1770 |
| rights_only | 3 | 13 | 39 | 163 | 0 | 17 | 2085 |
| study_only | 3 | 15 | 45 | — | 45 | 45 | 1820 |
| queue_only | 3 | 15 | 47 | — | 44 | 44 | 1785 |
| distribution_only | 3 | 16 | 51 | — | 45 | 45 | 1770 |
| needs_only | 3 | 16 | 51 | — | 45 | 45 | 1770 |
| Bplus | 3 | 11 | 33 | 158 | 47 | 69 | 2135 |
| Bplus_expiring | 3 | 11 | 33 | — | 71 | 71 | 2075 |
| backlog_only | 3 | 16 | 51 | 225 | 45 | 45 | 1770 |
| Bplus_paced | 3 | 12 | 33 | 161 | 0 | 19 | 2135 |
| paced_no_selfstudy | 3 | 13 | 37 | 161 | 0 | 19 | 2080 |
| paced_no_queue | 3 | 12 | 36 | 162 | 0 | 18 | 2120 |

## B_original: tek alan süre ve boş gün

| dk | L3 | L5 | L7 | L10 | Boş L10 öncesi | Boş180g |
| --- | --- | --- | --- | --- | --- | --- |
| 15 | 8 | 26 | 66 | 239 | 25 | 25 |
| 30 | 5 | 17 | 51 | 226 | 44 | 44 |
| 60 | 3 | 16 | 50 | 225 | 47 | 47 |
| 120 | 3 | 16 | 50 | 225 | 47 | 47 |

## B_short: tek alan süre ve boş gün

| dk | L3 | L5 | L7 | L10 | Boş L10 öncesi | Boş180g |
| --- | --- | --- | --- | --- | --- | --- |
| 15 | 4 | 22 | 59 | 234 | 27 | 27 |
| 30 | 3 | 16 | 51 | 225 | 45 | 45 |
| 60 | 3 | 16 | 51 | 225 | 47 | 47 |
| 120 | 3 | 16 | 51 | 225 | 47 | 47 |

## Bplus_paced: tek alan süre ve boş gün

| dk | L3 | L5 | L7 | L10 | Boş L10 öncesi | Boş180g |
| --- | --- | --- | --- | --- | --- | --- |
| 15 | 4 | 23 | 61 | 197 | 0 | 0 |
| 30 | 3 | 12 | 33 | 161 | 0 | 19 |
| 60 | 3 | 11 | 33 | 160 | 0 | 20 |
| 120 | 3 | 11 | 33 | 160 | 0 | 20 |

## paced_no_selfstudy: tek alan süre ve boş gün

| dk | L3 | L5 | L7 | L10 | Boş L10 öncesi | Boş180g |
| --- | --- | --- | --- | --- | --- | --- |
| 15 | 4 | 21 | 59 | 193 | 0 | 0 |
| 30 | 3 | 13 | 37 | 161 | 0 | 19 |
| 60 | 3 | 13 | 37 | 161 | 0 | 19 |
| 120 | 3 | 13 | 37 | 161 | 0 | 19 |

## Bplus: tek alan süre ve boş gün

| dk | L3 | L5 | L7 | L10 | Boş L10 öncesi | Boş180g |
| --- | --- | --- | --- | --- | --- | --- |
| 15 | 4 | 23 | 61 | 197 | 0 | 0 |
| 30 | 3 | 11 | 33 | 158 | 47 | 69 |
| 60 | 3 | 10 | 32 | 158 | 52 | 74 |
| 120 | 3 | 10 | 32 | 158 | 52 | 74 |

## Bplus_expiring: tek alan süre ve boş gün

| dk | L3 | L5 | L7 | L10 | Boş L10 öncesi | Boş180g |
| --- | --- | --- | --- | --- | --- | --- |
| 15 | 4 | 23 | 61 | — | 27 | 27 |
| 30 | 3 | 11 | 33 | — | 71 | 71 |
| 60 | 3 | 10 | 32 | — | 76 | 76 |
| 120 | 3 | 10 | 32 | — | 76 | 76 |

## İki alan: B_short ve Bplus_paced

| Varyant | dk | İşletmecilik5 | İki alan L10 | Boş180g |
| --- | --- | --- | --- | --- |
| B_short | 15 | 40 | 382 | 0 |
| B_short | 30 | 22 | 236 | 21 |
| B_short | 60 | 18 | 227 | 43 |
| B_short | 120 | 19 | 228 | 45 |
| Bplus_paced | 15 | 52 | 394 | 0 |
| Bplus_paced | 30 | 23 | 197 | 0 |
| Bplus_paced | 60 | 12 | 163 | 17 |
| Bplus_paced | 120 | 12 | 164 | 16 |
| paced_no_selfstudy | 15 | 40 | 382 | 0 |
| paced_no_selfstudy | 30 | 21 | 193 | 0 |
| paced_no_selfstudy | 60 | 14 | 168 | 12 |
| paced_no_selfstudy | 120 | 14 | 168 | 12 |

## Kontenjan / kesinti / pilot / içerik riski (30dk)

| Varyant | Senaryo | L5 | L7 | L10 | İki alan L10 | Boş180g |
| --- | --- | --- | --- | --- | --- | --- |
| B_short | irregular | 57 | 127 | 444 | 444 | 0 |
| Bplus_paced | irregular | 64 | 139 | 458 | 458 | 0 |
| paced_no_selfstudy | irregular | 50 | 127 | 444 | 444 | 0 |
| B_short | break14 | 35 | 73 | 248 | 248 | 16 |
| Bplus_paced | break14 | 40 | 75 | 211 | 211 | 0 |
| paced_no_selfstudy | break14 | 34 | 70 | 205 | 205 | 0 |
| B_short | class12 | 19 | 59 | 233 | 233 | 45 |
| Bplus_paced | class12 | 12 | 35 | 164 | 164 | 16 |
| paced_no_selfstudy | class12 | 15 | 44 | 172 | 172 | 8 |
| B_short | class12_dual | 23 | 64 | 238 | 243 | 28 |
| Bplus_paced | class12_dual | 24 | 61 | 197 | 198 | 0 |
| paced_no_selfstudy | class12_dual | 22 | 59 | 194 | 195 | 0 |
| B_short | pilot_only | 16 | — | — | — | 156 |
| Bplus_paced | pilot_only | 12 | — | — | — | 159 |
| paced_no_selfstudy | pilot_only | 13 | — | — | — | 158 |
| Bplus_paced | library64 | 12 | 33 | — | — | 96 |
| paced_no_selfstudy | library64 | 13 | 37 | — | — | 95 |
