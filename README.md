# bhhn. v3 — balance between us

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

## v3 güvenlik düzeltmeleri
- Workspace belgeleri artık sadece üyeler tarafından okunabilir.
- Davet kodu araması workspace koleksiyonunu herkese açmaz; ayrı `workspaceInvites` belgesi kullanılır.
- Davetle katılan kullanıcı yalnızca kendi UID'sini ve kendi profilini ekleyebilir.
- Normal workspace değişiklikleri yalnızca owner tarafından yapılabilir.
- Davet kodu kriptografik rastgele sayı üreteciyle hazırlanır ve kod çakışırsa batch yazımı başarısız olur; uygulama yeni kodla tekrar dener.
- Profil belgelerinde e-posta paylaşılmaz; yalnızca UID ve görünen ad tutulur.
- Her workspace kendi localStorage anahtarını kullanır.
- Service Worker önbelleği `bhhn-v3` olarak yenilendi; eski kodun takılı kalma riski azaltıldı.

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
