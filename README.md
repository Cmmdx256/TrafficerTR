<img width="1095" height="612" alt="main" src="https://github.com/user-attachments/assets/13d442c1-e0e4-4f5b-96db-7358489969f4" />
# TrafficerTR

TrafficerTR, Minecraft botlarini tek bir masaustu arayuzunden yonetmek icin gelistirilen Electron tabanli bir istemcidir. Proje, TrafficerTR v1.1 ile yeni arayuz, coklu dil destegi, tema secimi, script calistirma, proxy testleri, Discord webhook loglari ve kontrollu otonom AI modu uzerine odaklanir.


## Ozellikler

- Minecraft bot baglantilarini baslatma, durdurma ve izleme
- Botlar icin chat, hareket, envanter, hotbar, Anti AFK ve KillAura kontrolleri
- Botlar uzerinde basit script calistirma
- Pathfinder icin kontrollu otonom AI modu
- Chatten `ai gel`, `ai dur`, `ai diamond bul 3`, `ai bana tas getir 32` gibi komutlari yorumlama
- Survival brain: acikma durumunda yemek yeme, yakindaki tehlikeli moblara karsi savunma, temel kaynak stogu takip etme
- Elmas, antik kalinti, zumrut, altin, demir gibi onemli madenleri bulunca konsola haber verme
- `ai ver` veya `give` komutu ile toplanan esyalari oyuncuya getirme
- `ai portal` ile Nether portal malzeme durumunu kontrol etme
- `ai plan` ile oyunu bitirme yolundaki mevcut hedefi raporlama
- Beat-game roadmap: odun, tahta, crafting table, kazma, tas, komur, demir, elmas, obsidyen, portal malzemesi, blaze rod, ender pearl asamalarini takip etme
- Proxy listesi ekleme, proxy test etme ve proxy loglarini takip etme
- Discord webhook ile bot olaylarini, sunucu sohbetini ve proxy loglarini gonderme
- Turkce ve English dil secimi
- Summer ve Winter tema secimi
- Gercek zamanli bolgesel saat ve gece/gunduz atmosferi
- TrafficerTR icin yeni animasyonlu acilis ekrani ve yeni marka gorselleri
- GitHub uzerinden ileride kullanilacak yeni surum kontrol altyapisi

## Durum

- Uygulama adi: TrafficerTR
- Surum: v1.1.0
- 26.1.x Minecraft protokol destegi native destek gelene kadar gecici olarak askida
- Interact ve Nuker kontrolleri gecici olarak bakim modunda
- Pathfinder ve AI modu aktif gelistirme asamasinda; portal yerlestirme, Nether kale navigasyonu, stronghold rotasi ve End savasi sonraki asamalarda genisletilecek

## Kurulum

Gerekenler:

- Node.js
- npm

Bagimliliklari kur:

```bash
npm install
```

Gelistirme modunda calistir:

```bash
npm run dev
```

Production build al:

```bash
npm run build
```

Windows icin paketle:

```bash
npm run build:win
```


## Gelistirici

My name is Glock (Cmmdx).

TrafficerTR; daha temiz bir arayuz, yeni Minecraft surumlerine daha iyi uyumluluk ve kendi derleyip kullanmak isteyenler icin daha akici bir deneyim hedefiyle gelistirilmektedir.
