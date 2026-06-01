<img width="1095" height="612" alt="main" src="https://github.com/user-attachments/assets/13d442c1-e0e4-4f5b-96db-7358489969f4" />

# TrafficerTR

TrafficerTR, Minecraft botlarini tek bir masaustu arayuzunden yonetmek icin gelistirilen Electron tabanli bir istemcidir. v1.2 ile proje Gemini tabanli chat-control AI moduna, daha akici arayuze, coklu bot yonetimine ve guncel surum kontrolune odaklanir.

GitHub: [Cmmdx256/TrafficerTR](https://github.com/Cmmdx256/TrafficerTR)

## Ozellikler

- Minecraft bot baglantilarini baslatma, durdurma ve izleme
- Botlar icin chat, hareket, envanter, hotbar, Anti AFK, KillAura ve Pathfinder kontrolleri
- Gemini AI mode: sunucu chatinden yazdiklarinizi duyar ve Mineflayer aksiyonlariyla botu yonetir
- Gemini ile `move_to`, `follow_player`, `mine_block`, `place_block`, `craft_item`, `eat_food`, `attack_entity`, `give_items`, `explore`, `smelt_item` ve `sleep` aksiyonlari
- Coklu botlarda global Gemini queue/rate-limit ve tekrar mesaj onleme
- Botlar uzerinde basit script calistirma
- Proxy listesi ekleme, proxy test etme ve proxy loglarini takip etme
- Discord webhook ile bot olaylarini, sunucu sohbetini ve proxy loglarini gonderme
- Turkce ve English dil secimi
- Summer/Winter tema secimi, ozel GIF arkaplan destegi ve gece/gunduz atmosferi
- GitHub uzerinden surum kontrolu

## Durum

- Uygulama adi: TrafficerTR
- Surum: v1.2.0
- 26.1.x Minecraft protokol secenekleri listede kalir ancak Mineflayer/minecraft-protocol native destek gelene kadar kapali kalir
- Nuker sonraki surumde gelecek
- AI mode Gemini tabanlidir; eski local/Ollama AI mimarisi kaldirilmistir

## Gemini AI Kullanimi

Gemini API anahtarini uygulamayi baslatmadan once ortam degiskeni olarak ver:

```powershell
$env:GEMINI_API_KEY="BURAYA_API_KEY"
npm run dev
```

Varsayilan model `gemini-2.5-flash-lite` olarak ayarlanmistir. Istersen model degistirebilirsin:

```powershell
$env:GEMINI_MODEL="gemini-2.5-flash"
```

Gemini kotasini korumak icin tum botlar tek bir global kuyruk kullanir. Istersen istek araligini artir:

```powershell
$env:GEMINI_MIN_INTERVAL_MS="2500"
```

AI mode acikken Minecraft chatinden normal dilde yazabilirsin:

```text
ai beni takip et
ai yakindaki tasi kaz
ai bana odun getir
ai dur
ai durum
```

Botun adini mesaja yazarsan sadece o bot cevap verir. Birden fazla bot ayni mesaji duydugunda tekrar istek ve tekrar cevap onleme sistemi devreye girer.

## Kurulum

Gerekenler:

- Node.js
- npm
- Gemini API key

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

TrafficerTR; daha temiz bir arayuz, yeni Minecraft surumlerine daha iyi uyumluluk ve Gemini destekli bot kontrolu hedefiyle gelistirilmektedir.
