# bhhn. v10 — balance between us

## v10 eski görünüm + güvenli geçiş

- Tam ekran giriş sayfası kaldırıldı; uygulama eskisi gibi profil seçimiyle açılır.
- Firebase girişi yalnızca Ayarlar içindeki senkronizasyon düğmesinden açılır.
- İlk ortak alan oluşturulurken mevcut yerel gruplar, harcamalar ve borçlar otomatik taşınır.

## v9 Firebase düzeltmesi

- Firebase API anahtarındaki `0/O` karakter hatası düzeltildi.
- Giriş hataları artık gerçek Firebase hata kodunu anlaşılır biçimde gösterir.

## v8 Firebase bağlantısı

- `bhhn-ac697` Firebase web yapılandırması bağlandı.
- E-posta/şifre ve Google giriş altyapısı aktif edildi.
- PC ve telefon aynı hesap/ortak alana girdiğinde Firestore üzerinden aynı kayıtları görür.

Splitwise tarzı, mobil öncelikli ortak harcama PWA'sı.

## Özellikler
- E-posta/şifre ile hesap açma ve giriş
- Google ile giriş
- Her kullanıcı için özel hesap
- Birden fazla ortak alan
- 8 karakterli güvenli davet koduyla arkadaş ekleme
- Alan içinde sınırsız grup
- Harcama ekleme / düzenleme / silme
- Eşit, tutar bazlı veya yüzdeyle bölme
- Borçları sadeleştirme ve ödeme kapatma
- Canlı Firestore senkronizasyonu
- Workspace'e özel yerel önbellek ve JSON yedek
- PWA, iPhone ana ekranına eklenebilir

## v7 düzeltmesi

- Logo uygulama koduna gömüldü; GitHub Pages üzerinde `assets` klasörü eksik olsa bile görünür.
- Eksik görsel dosyaları artık Service Worker kurulumunu engellemez.
- Tarayıcı sekme ikonu da gömülü logodan oluşturulur.

## v6 yenilikleri

- Gönderilen dört arkadaş görseli ana sayfada, üst çubukta, açılışta, ayarlarda ve PWA ikonlarında görünür.
- İlk profil seçim ekranında herkes için doğrudan `kişi ekle` düğmesi bulunur.
- Ayarlar > Profil bölümünden de yeni kişi eklenebilir.
- Yeni kişi kayıtlı gruplara sonradan eklenebilir veya yeni grup açabilir.
- Service Worker önbelleği `bhhn-v6` olarak yenilendi.

## v5 yenilikleri

- Uygulamanın orijinal `bhhn.` logosu açılışta, ayarlarda ve PWA ikonlarında kullanılıyor.
- Varsayılan üye adı her yerde `Hatice Nur` olarak gösteriliyor; eski yerel kayıtlar açılırken otomatik güncelleniyor.
- Ana sayfadaki “senin borcun” kartında toplamın altında kime ne kadar borç olduğu kişi kişi yazıyor.
- Service Worker önbelleği `bhhn-v5` olarak yenilendi.

## v3 güvenlik düzeltmeleri
- Workspace belgeleri artık sadece üyeler tarafından okunabilir.
- Davet kodu araması workspace koleksiyonunu herkese açmaz; ayrı `workspaceInvites` belgesi kullanılır.
- Davetle katılan kullanıcı yalnızca kendi UID'sini ve kendi profilini ekleyebilir.
- Normal workspace değişiklikleri yalnızca owner tarafından yapılabilir.
- Davet kodu kriptografik rastgele sayı üreteciyle hazırlanır ve kod çakışırsa batch yazımı başarısız olur; uygulama yeni kodla tekrar dener.
- Profil belgelerinde e-posta paylaşılmaz; yalnızca UID ve görünen ad tutulur.
- Her workspace kendi localStorage anahtarını kullanır.
- Service Worker önbelleği sürümle birlikte yenilenir; eski kodun takılı kalma riski azaltılır.

## Firebase kurulumu
1. Firebase Console'da bir proje ve Web App oluştur.
2. Authentication > Sign-in method içinde **Email/Password** ve **Google** sağlayıcılarını aç.
3. Firestore Database oluştur.
4. `firestore.rules` içeriğini Firestore Rules ekranına yapıştır ve yayınla.
5. Firebase Web App config değerlerini `firebase-config.js` içine koy.
6. Siteyi GitHub Pages, Firebase Hosting veya Netlify gibi HTTPS bir statik hosta yayınla.

`firebase-config.js` boş bırakılırsa uygulama otomatik olarak yerel demo modunda açılır.

## Veri modeli
- `/workspaces/{workspaceId}`: alan adı, owner UID, üyeler, profil isimleri ve davet kodu
- `/workspaceInvites/{inviteCode}`: sadece workspace ID + owner UID; yalnızca doğrudan kodla `get` yapılabilir, listeleme kapalıdır
- `/workspaces/{workspaceId}/groups/{groupId}`
- `/workspaces/{workspaceId}/expenses/{expenseId}`
- `/workspaces/{workspaceId}/settlements/{settlementId}`

## Kontrol
`app.js`, `firebase-config.js`, `sw.js` Node syntax kontrolünden; `manifest.webmanifest` JSON doğrulamasından geçirilmiştir. Firebase Rules'ın nihai davranışı Firebase projesinde Rules Simulator/Emulator ile de test edilmelidir.
