# bhhn. v7 — ortak telefon senkronizasyonu

Gönderilen orijinal V7 görünümü ve kullanım akışı korunmuştur. Giriş, hesap veya ortak alan ekranı yoktur.

## Bu pakette çalışanlar

- Nisu, Hatice Nur, Berfin ve Heda profilleri
- Profil ekranından yeni kişi ekleme
- Grup, harcama ve ödeme ekleme/düzenleme/silme
- Kişiye göre borç/alacak hesabı
- PC ve telefonlar arasında gerçek zamanlı Firestore senkronizasyonu
- Silinen harcamayı 6 saniye içinde “geri al” ile kurtarma; geri gelen kayıt diğer cihazlara da eşitlenir
- GitHub'a `assets` klasörü eksik yüklense bile görünen gömülü logo
- Eski PWA önbelleğini yenileyen `v7sync2` sürümü

## Yayınlama

1. Bu ZIP içindeki bütün dosya ve `assets` klasörünü GitHub reposunun köküne yükle.
2. Firebase Console → Firestore Database → Rules ekranında bu paketteki `firestore.rules` içeriğini yayınla.
3. İlk olarak mevcut harcama ve grupların bulunduğu PC'de `https://nnurallar-commits.github.io/bhhn/?v=7sync2` adresini aç.
4. Üstteki bulut simgesi dolu görünce aynı adresi telefonlarda aç.

İlk açılan PC'deki V7 verisi ortak başlangıç kaydı olur. Bundan sonra kişi, grup, harcama ve ödeme değişiklikleri diğer açık cihazlara otomatik gelir.

## Önemli

Bu sürümde giriş ekranı olmadığı için uygulama linkini bilen herkes ortak veriyi görebilir ve değiştirebilir. Firestore kuralları yalnızca `/sharedApps/bhhn-main` belgesini açar; projenin diğer belgeleri kapalıdır.

## Kontrol

`app.js`, `firebase-config.js` ve `sw.js` JavaScript sözdizimi kontrolünden; `manifest.webmanifest` JSON doğrulamasından geçirilmiştir.
