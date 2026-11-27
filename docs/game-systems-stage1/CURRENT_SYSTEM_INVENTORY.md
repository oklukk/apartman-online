# Mevcut sistem envanteri

Kaynak: `main/a2656e9`, 27 Kasım 2026. **Repository incelemesidir; canlı veritabanı şeması, cron durumu veya oyuncu sayısı yeniden sorgulanmadı.** Aşağıdaki sayılar kaynakta tanımlanan nesnelerdir; canlı veri sayısı değildir.

## 1. Teknoloji ve kullanıcı akışı

React 19.3.1 + TypeScript 5.9.3 + Vite 7.3.8; `@supabase/supabase-js` 2.119.0. Ayrı Node uygulama sunucusu yoktur. Kaynaklar: [package.json](../../package.json), [App](../../src/App.tsx), [API tipleri/istemci](../../src/api.ts), [ekonomi tipleri](../../src/economy.ts), [navigasyon](../../src/navigation.ts).

| Mevcut işlev | Gerçek davranış / sınır | İlgili kaynak |
| --- | --- | --- |
| Hesap | E-posta/şifre kayıt/giriş, kalıcı oturum, çıkış; benzersiz kullanıcı adı; profil Auth trigger'ıyla açılır | App, API, initial migration |
| Yerleşme | Hash'li, süre/kullanım sınırlı davetiye; bir hesap bir daire, 12 daire/bina; bina kilidi altında ilk boş daire | `join_building`, memberships/apartments |
| Sosyal | Kalıcı 500 karakter mesaj; spam koruması, geçmiş sayfalama; kendi görünümünde engel/gizleme ve mesaj şikâyeti | App, initial, moderation |
| Cüzdan/iş | Bir kez 300 OP; office/shop/technical; aynı günlük taban 100, ek iş 25; üç saniyelik ek iş; iş değişimi 7 gün | EconomyPanel, `player_action` |
| Zamanlı ekonomi | Son 7 gün aktif kişiye cari gün maaşı; ilk sonraki gün maaş; TR pazartesi aidatı, yeni taşınana sonraki dönem; geçmişe sınırsız ödeme/borç yok | v02 ve son v032 economy_tick gövdesi |
| Aidat/gider | Başlangıç 150/hafta; atomik kişisel ödeme→kasa; temizlik 80+20×aktif kişi, bakım 50+10×aktif kişi; yetersiz kasa bekler | pay_dues, economy_settings, operating_expenses |
| Ortak karar | İlk asansör oylaması en az 3 oy, 24 saat; diğer yönetim önerileri farklı quorum; bütçe sonucu bir kez uygulanır | polls, votes, resolve_poll |
| Yönetici seçimi | Ayrı aday/oy/seçmen modeli; en az 2 seçmen/oy; 24 saat adaylık, 48 saat oy, 14 gün görev; eşitlik/katılım/aday yokluğunda sonuçsuz + yeniden seçim | GovernancePanel, v02/v033 |
| Yönetici masası | Geçerli ve voided olmayan manager_terms; 100–200 OP aidat önerisi veya sabit katalog harcaması; doğrudan kişisel/kasa yazma yetkisi yok | propose_management, current_manager |
| Personel | Rol/kapsam, AAL2, gerekçe, audit; oyuncu adı/cüzdan/kasa/ayar düzeltme, yaptırım, seçim/görev müdahalesi, desteklenen ters kayıt | StaffPanel/Operations/ControlCenter, v03–v033 |
| Görünüm/sosyal dünya | 12 erişilebilir daire, gerçek üyelik/aktif yönetici rozeti; 16 deterministik avatar; aynı binaya sınırlı dar sosyal profil modeli | BuildingWorld, Avatar, social, ResidentProfiles |
| Ayarlar | Cihazda tema, büyük yazı, kompakt görünüm, hareket azaltma; mevcut engeller ve MFA erişimi | appearance, AccountScreens, StaffMfa |

Bunlar başlangıç/varsayılan ekonomi değerleridir. Personel bazı değerleri değiştirebilir; canlı etkin tutarlar bu incelemede okunmadı. Kişisel meslek, bakiye, borç, e-posta, MFA/personel verisi başka kişinin sosyal profilinde paylaşılmaz. Kalıcı avatar seçimi, biyografi, gerçek bildirim kutusu veya mesleki yetenek/üniversite/işletme/istihdam sistemi **mevcut değildir**.

## 2. Yedi migration ve veri modeli

Eski migration dosyaları değiştirilmeyecek; timestamp uyumu yeniden onarılmayacak, staging ayrıca uygulanmayacak.

| Dosya | Kaynakta getirdiği kapsam |
| --- | --- |
| `20261115141348_initial_game.sql` | Auth profili, bina/daire/üyelik, davetiye, sohbet, oy ve eski kasa |
| `20261115141400_scheduled_resolution.sql` | Zamanı gelen oylamaları çözümleyen cron |
| `20261115185834_v02_economy_governance.sql` | Cüzdan, maaş/ek iş, aidat/gider, seçim/görev ve yeni kasa defteri |
| `20261116134945_v03_admin_rbac_foundation.sql` | Rol/izin/kapsam/audit; güvenli ilk sahip atama yöntemi |
| `20261118203012_v031_staff_economy.sql` | Personel ekonomi yazmaları, idempotency, tarihli aidat ayarı/telafi |
| `20261118203040_v032_moderation.sql` | Ban/mute/warning, doğrudan RPC'lerde guard, güncellenmiş rutin ekonomi |
| `20261118203100_v033_governance_operations.sql` | Revision denetimli seçim/karar/görev müdahalesi; görev çakışma constraint'i |

Bütün dosyalar [supabase/migrations](../../supabase/migrations) içindedir. **26 public + 10 private = 36 tablo**; bir birleştirici görünüm vardır. `dues_overview` tablo/görünüm değil checked RPC'dir.

| Tablolar | İlişki ve korunacak bütünlük |
| --- | --- |
| `public.profiles` | PK `auth.users.id`; küçük/büyük harf duyarsız benzersiz username |
| `public.buildings`, `apartments`, `memberships` | Daire 1–12; `(building_id,number)` unique; üyelik PK user, daire unique; bileşik daire/bina FK |
| `private.invitations` | Bina FK, benzersiz code_hash, expires_at ve uses_remaining; açık davetiye istemciye okunmaz |
| `public.messages`, `blocks`, `message_reports` | Yazarı sunucu belirler; engel çifti PK; rapor `(reporter_id,message_id)` unique |
| `public.events`, `polls`, `votes` | Bina/olay ilişkisi; oy `(poll_id,user_id)` PK; events türü+bina ve poll.event_id tekilliği |
| `public.treasury_transactions` | Eski oylamanın yalnız negatif, poll_id başına bir harcama defteri |
| `public.activity`, `announcements` | Aynı bina gelişmeleri ve duyuruları; activity gerçek server işlemlerinden üretilir |
| `public.economy_settings`, `wallets` | Bina ayarları; kişi başına tek cüzdan, job/aktivite; negatif bakiye yok |
| `public.wallet_transactions` | `(user_id,kind,period_key)` unique; miktar/balance_after ve açıklama; doğrudan oyuncu yazması yok |
| `public.dues_rates`, `dues` | Etkin pazartesi, poll ilişkisi; kişi/hafta borcu tek; ödeme geçmişi korunur |
| `public.operating_expenses` | `(building_id,week_start,kind)` unique; aktif kişi sayısı snapshot'ı |
| `public.treasury_entries` | Yeni gelir/gider/ayar hareketi; `source_key` unique |
| `public.expense_catalog` | Sabit tür/fiyatlı üç yönetici harcaması |
| `public.elections`, `election_electorate`, `election_candidates`, `election_votes` | Seçim FK'leri/bina sınırı; seçmen listesi snapshot; tek adaylık/oy, geçerli aday FK'si |
| `public.manager_terms` | Profil/bina/seçim; `[starts_at,ends_at)` geçerliliği; voided olmayan görevler aynı binada çakışamaz |
| `private.staff_roles`, `staff_permissions`, `staff_role_permissions` | Benzersiz rol/izin katalogları ve çoktan çoğa ilişki |
| `private.staff_assignments` | Auth kullanıcısına çoklu global/bina kapsamlı ve süreli/süresiz atama |
| `private.staff_audit` | Aktör/hedef/gerekçe/eski-yeni değer; checked yazmalarda aynı transaction |
| `private.staff_requests` | UUID → aktör/eylem/payload; yanlış payload veya aktörle tekrar reddi |
| `private.staff_dues_schedules` | Tarihli gelecekteki aidat kararları; eski kararları silmeden etkin oran |
| `private.staff_compensations` | Orijinal audit başına bir ters işlem ve unique operation_id |
| `private.player_sanctions` | Hedef, bina, ban/mute/warning, bitiş/kaldırma, gerekçe/aktör/operation_id |

`public.treasury_history` **security_invoker** görünümü eski `treasury_transactions` ile yeni `treasury_entries` kayıtlarını `UNION ALL` birleştirir. Eski hareketler taşınmaz veya kopyalanmaz. Wallet/treasury kayıt türleri kısıtlıdır; v031 eklediği `admin_adjustment` dışında keyfî yeni tür yazılamaz. Yeni iş geliri için gelecekte yeni additive constraint/kayıt türü gerekir; `admin_adjustment` oyun işlemi etiketi olarak kötüye kullanılamaz.

## 3. Mevcut 27 public RPC

Aşağıdakiler kaynak SQL'deki sözleşmelerdir; private iç işlevler veya geleceğe önerilen API'lerle karıştırılmamalıdır. Public checked köprüler security invoker, yetkili gövdeler private/boş search_path kullanır. EXECUTE olması işleme iş kuralı yetkisi vermez.

| RPC ve argümanlar | Kapsam |
| --- | --- |
| `cast_vote(target_poll uuid,approve boolean)` | Evet/hayır oy |
| `dues_overview()` | Kişisel borç dökümü yerine haftalık bina toplamı |
| `election_action(target_election uuid,action text,value text)` | Adaylık / seçim oyu |
| `join_building(invite_code text)` | Davetiyeli yerleşme |
| `pay_dues(target_due uuid)` | Atomik aidat |
| `player_action(action text,value text default null)` | heartbeat / job / side_start / side_finish |
| `propose_management(proposal text,new_dues integer default null)` | Görevdeki yönetici önerisi |
| `send_message(message_body text)` | Yazar/spam kontrolüyle sohbet |
| `settle_polls()` | Mevcut binanın süresi dolmuş kararları |
| `staff_adjust_treasury(target_building uuid,amount integer,operation_id uuid,reason text)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_adjust_wallet(target_user uuid,amount integer,operation_id uuid,reason text)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_compensate(original_audit_id uuid,operation_id uuid,reason text)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_create_role(role_code text,role_title text,role_description text,permission_codes text[],reason text)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_directory()` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_game_overview()` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_governance_action(target_building uuid,action text,args jsonb,expected_revision text,operation_id uuid,reason text)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_governance_state(target_building uuid)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_grant(target_user uuid,role_code text,target_scope text,scope uuid,reason text)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_me()` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_operations_history(target_building uuid)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_rename_building(target_building uuid,new_name text,reason text)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_rename_player(target_user uuid,new_username text,reason text,operation_id uuid)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_revoke(assignment_id uuid,reason text)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_sanction(target_user uuid,action text,until_at timestamptz,operation_id uuid,reason text)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_sanction_history(target_user uuid)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_set_role_permissions(role_code text,permission_codes text[],reason text)` | Personel: mevcut rol/kapsam ve checked erişim |
| `staff_update_economy(target_building uuid,setting_key text,new_value integer,reason text,operation_id uuid)` | Personel: mevcut rol/kapsam ve checked erişim |

`private.wallet_post`, `treasury_post`, `economy_tick`, `run_v02`, `resolve_poll`, `resolve_due_polls`, `current_manager`, `assert_player_allowed`, `staff_can`, `staff_game_write_check`, `staff_claim_request` kritik iç yapı taşlarıdır; genel istemci API'si değildir. `*_before_moderation` eski gövdeleri authenticated'a kapalıdır. `private.staff_bootstrap` yalnız doğrulanmış ilk sahip için DB owner yoludur; bot veya yeni oyuncu oluşturma API'si olarak kullanılamaz.

## 4. Yetki, veri erişimi ve eşzamanlılık

- Public tablolar RLS'lidir. Profil/üyelik/oyun ortak verisi aynı binaya; cüzdan/hareket/borç yalnız sahibine açılır. `blocks` ve `message_reports` için mevcut sahiplik/mesaj görünürlüğüyle sınırlı doğrudan istemci mutasyonları vardır; bütün yazmaların RPC olduğu iddia edilmez. Para/oy/üyelik/personel mutasyonları checked RPC'dir.
- Eski `votes` yalnız kendi oyunu açar; `election_*` yeni seçim kayıtları bina RLS'siyle açılır. “Bütün oy tabloları aynı gizlilik modelindedir” varsayımı yapılmamalıdır.
- Private tabloların doğrudan oyuncu yazma/okuması kapalıdır. Checked köprülerin ihtiyaç duyduğu açık function grant'leri vardır; internal ledger/worker işlevleri kullanıcıya açılmaz. User metadata rol kaynağı değildir.
- Global Süper Yönetici gelecekte kataloglanmış izinleri de kapsar. Admin mevcut oyuncu/ekonomi/seçim/bina izinleriyle sınırlıdır; Moderatör oyuncu okuma/moderasyon + seçim okuma; Editörün katalogdaki içerik izinleri için çalışan içerik düzenleme RPC'si yoktur, dünya/bina okuması gerçektir. `players.move`, `economy.dues.manage`, dünya/toplu/feature katalog girdileri var diye işlev uygulanmış sayılmaz.
- Çoklu rol birleşimi, bina scope, canlı assignment/expiry çözümü korunur. Rol mutasyonları global Süper Yönetici ister. Personel yazmaları AAL2, gerekçe, audit ve lock; gelişmiş işlemler request UUID/payload doğrulaması ister. Eski rol mutasyonlarının operation_id sözleşmesi yoktur.
- Yazmaların ortak başlangıcı **building → wallet/decision** kilididir. RBAC yazma lock'u `741029030`; moderasyon hedef guard'ı `hashtextextended(user_id,741032)` ile bina kilidinden sonra gelir. Yeni sıra bu grafiği ters çeviremez.
- Ban aktif JWT veya doğrudan RPC ile atlanamaz. Mute sohbet üretimini engeller. Süresi geçen/silinmeyen audit ve yaptırım geçmişi korunur. Seçim müdahalesi revision ve bina kilidiyle cron karşısında kontrol edilir.

## 5. Zamanlayıcı, Realtime ve istemci veri modeli

`apartman-resolve-polls` ve `apartman-v02-tick` **dakikada bir** çalışacak şekilde migration'da tanımlıdır. Birincisi `private.resolve_due_polls()`, ikincisi `private.run_v02()` çağırır; güncel ekonomi/moderasyon gövdesi sonraki migration'larda değiştirilmiştir. Türkiye günü/haftası SQL'de hesaplanır. Bu rapor canlı job_run durumunu doğrulamamıştır.

App aynı bina için 14 public tabloya değişim aboneliği açar: wallets, dues, operating_expenses, treasury_entries, elections, election_candidates, election_votes, manager_terms, dues_rates, messages, memberships, polls, buildings, activity. Realtime publication kaynakta aynı tabloları içerir. Görünüm tabloları ve private staff kayıtları ayrı genel yayın değildir. Abonelikten sonra/yaklaşık 30 saniyelik heartbeat/focus'ta mevcut veri tekrar yüklenir; staff_me de düzenli/focus yenilenir.

App, `economyTables` ve temel oyun tablolarını çoğunlukla `select('*')` ile RLS altında toplar. Sohbet son 50, activity son 30; eski mesajlar ayrıca alınır. `Data` ortak oyun+kişisel ekonomi tiplerini birleştirir. Sosyal profil ise **yalnız ResidentPublicInfo projeksiyonu** alır. Yeni işletme/maaş/öğrenci verileri bu geniş Data'ya ve sosyal profile körlemesine eklenmemeli; kapsamlı dar RPC/projeksiyon ve cursor sayfalama gerekir. Gerçek presence yoktur.

## 6. UI envanteri ve testler

| Alan | Mevcut bileşen / sınır |
| --- | --- |
| Bugün | App/PlayerScenes: gerçek kasa, günlük eylem ve karar kısayolları |
| Dairem → Daire / İşler / Cüzdan | PlayerScenes, EconomyPanel: avatar/temel kimlik, legacy meslek/ek iş, bakiye/aidat/hareket |
| Apartman → Keşfet / Kararlar / Kasa-Pano / Yönetici | BuildingWorld, PollCard, GovernancePanel, ActivityFeed; görevli yöneticiye özel görünüm |
| Komşular → Sakinler / Sohbet | Avatar, ResidentProfiles, useQuickProfile; aynı bina, engel, rapor, draft/scroll koruması |
| Hesap | AppShell/AccountLayout/AccountScreens/StaffMfa; profil, görünüm/gizlilik, güvenlik; dairesiz hesapta güvenlik açık |
| Personel | Altı modül; StaffConfirmation/Feedback; gerçek izin, native modal, gerekçe ve belirsiz ağ sonucu; oyuncu sekmelerinden ayrı |

Ana UI referansı [UIUX_V2_SPEC](../UIUX_V2_SPEC.md); A–F ayrıntıları ilgili `docs/UIUX_V2_*` raporlarındadır. Yeni gereksinimler için UI/UX v2'nin tarihsel metni veya onaylı sanat dosyaları değiştirilmeyecek.

| Mevcut kontrol | Kapsam / sınır |
| --- | --- |
| `npm test` | 55 mevcut kaynak/konfigürasyon, asset, kontrast, gezinme, görünüm, sosyal ve staff grubu; yeni sistemlerin testi değildir |
| `npm run test:ui` | React SSR; gerçek Auth/Realtime veya piksel kanıtı değildir |
| `npm run build` | Strict TypeScript ve Vite üretim derlemesi |
| `test:sql`, `test:v02`, `test:rbac`, `test:advanced` | Sırasıyla 11/24/14/15 mevcut PostgreSQL grubu; eşzamanlılık, privacy, ekonomi, MFA claims, iptal/revision ve legacy koruma |
| `test:db` | Tam yerel Supabase yığını ister; normal localhost PostgreSQL paketlerinden ayrıdır |
| `tools/check-navigation-browser.py`, `check-social-browser.py`, `check-settings-browser.py`, `check-staff-browser.py` | Gerçek Chromium, sentetik fixture; navigasyon, bina/avatar/profil, tercihler, staff/rol/oturum/önizleme; canlı kabul değildir |
| `check-staff-zoom.py`, `test_screenshot_evidence.py` | Gerçek browser zoom + native viewport/piksel koruması; boş görüntü DOM kontrolünden ayrı yakalanır |

PostgreSQL paketleri sabit localhost:55432 disposable DB oluşturup siler; Auth claim/factor fixture'ları ve cron gövdeleriyle test eder. Gerçek Supabase Auth, TOTP ve WebSocket Realtime uçtan uca testlerinin yerine geçmez. Mevcut Pages workflow'u PR'da kaynak/SSR/build + dört PostgreSQL paketini çalıştırır; deploy PR'da atlanır. Manuel şifreli backup workflow'u ayrıca vardır; bu incelemede tetiklenmedi veya restore yeterliliği varsayılmadı.

## 7. Yeni sistemlere geçişte başlıca engeller

1. `profiles.id` Auth'a bağlıdır; botu profiles/üyelik içine koymak Auth trigger'ı, 300 OP, aidat, nüfus, seçim ve sosyal RLS'yi etkiler.
2. `wallets.job` iş sözleşmesi değil üç değerli legacy tercihtir; `salary` aynı kişiye/güne tek, sistem kaynaklıdır. Yeni sözleşmeyle çift maaş riski vardır.
3. Eski kabul edilmiş harcama oylaması parayı **hemen** düşer; aynı karardan ikinci hizmet faturası üretilmemelidir.
4. Wallet/treasury hareket türleri kapalı check listelidir. Yeni business ödemeleri legacy `admin_adjustment` diye yazılamaz.
5. Apartman 12 daire/tek üyelik ve RLS aynı bina varsayımı, botlar ve farklı bina işletme erişimi için doğrudan genişletilemez.
6. Ledger, cron ve yaptırım kilitleri korunmadan yeni iş/kapasite/ödeme kilitleri eklemek deadlock veya ikinci harcama üretebilir.
7. Yeni proje istemez: mevcut Supabase, checked RPC/private transaction, cron ve React modülleri yeterli başlangıçtır; kapasite/ücretsiz plan yükü ölçülmeden ölçek garantisi verilmez.
