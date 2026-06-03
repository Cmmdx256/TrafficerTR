const translations = {
  en: {
    'splash.subtitle': 'Preparing bot console',
    'nav.general': 'General',
    'nav.botting': 'Botting',
    'nav.scripting': 'Scripting',
    'nav.proxy': 'Proxy',
    'nav.webhook': 'Webhook',
    'nav.about': 'About',
    'nav.settings': 'Settings',
    'settings.app': 'App settings',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.background': 'Background GIF',
    'settings.backgroundChoose': 'Choose file',
    'settings.backgroundClear': 'Remove',
    'settings.backgroundSize': 'Recommended: 1920x1080, minimum 1100x620',
    'badge.maintenance': 'UNDERMAINTENANCE',
    'settings.bot': 'Bot settings',
    'theme.winter': 'Winter',
    'theme.summer': 'Summer',
    'bot.serverChat': 'Server',
    'placeholder.script':
      '# Repeat, random delay, variables\nrepeat 3\nchat Hello {player} {random:6}\ndelay 500 1500\nend',
    'placeholder.username': 'username / token',
    'placeholder.server': 'localhost:25565',
    'placeholder.joinMessage': '/register',
    'placeholder.chatMsg': 'Message',
    'placeholder.number': 'number',
    'placeholder.coords': 'eg: 0 1 0',
    'placeholder.command': 'command',
    'placeholder.geminiApiKey': 'Gemini API key',
    'placeholder.proxy': 'Proxy:Port:Username:Password',
    'notify.reset': 'Config has been reset. Please restart the app',
    'notify.clearProxy': 'Cleared duplicate proxies',
    'notify.proxyStopped': 'Stopped proxy test.',
    'notify.maintenanceTitle': 'Temporarily under maintenance',
    'notify.maintenanceBody': 'This feature is paused and will return in future versions.',
    'notify.updateTitle': 'Client update available',
    'notify.updateBody':
      'This client is an old version. Current: v{current}. New: v{latest}. Click this notification to open GitHub and download the new version.',
    'bot.connected': 'Connected to the server.',
    'bot.kicked': 'Kicked: ',
    'bot.connection': 'Connection: ',
    'nuker.quickRange': 'Quick range',
    'nuker.quickRangeTip': 'Set the horizontal area size. Any value creates an NxN length/width area; height uses advanced up/down.',
    'nuker.simpleRange': 'Simple range',
    'nuker.advancedRange': 'Advanced directional range',
    'nuker.up': 'Up',
    'nuker.down': 'Down',
    'nuker.left': 'Left',
    'nuker.right': 'Right',
    'nuker.forward': 'Forward',
    'nuker.back': 'Back',
    'nuker.blockFilter': 'Block filter',
    'nuker.blockFilterTip': 'Blacklist protects listed blocks. Whitelist breaks only listed blocks.',
    'nuker.targetMode': 'Target mode',
    'nuker.blacklistMode': 'Blacklist: ignore listed blocks',
    'nuker.whitelistMode': 'Whitelist: break only listed blocks',
    'nuker.blocks': 'Blocks',
    'nuker.blocksPlaceholder': 'dirt,glass,stone',
    'nuker.blocksTip': 'Comma separated block IDs. Example: dirt,grass_block,stone',
    'nuker.speed': 'Speed',
    'nuker.speedTip': 'Fastplace breaks the whole selected range in one burst. Blocks/tick is used only when Fastplace is off.',
    'nuker.blocksPerTick': 'Blocks/tick',
    'nuker.blocksPerTickPlaceholder': 'empty = all in range',
    'nuker.fastplace': 'Fastplace',
    'nuker.rotateHead': 'Head rotate',
    'nuker.toggle': 'Toggle',
    'nuker.start': 'Start',
    'nuker.stop': 'Stop'
  },
  tr: {
    'splash.subtitle': 'Bot konsolu hazırlanıyor',
    'nav.general': 'Genel',
    'nav.botting': 'Botlar',
    'nav.scripting': 'Script',
    'nav.proxy': 'Proxy',
    'nav.webhook': 'Webhook',
    'nav.about': 'Hakkında',
    'nav.settings': 'Ayarlar',
    'settings.app': 'Uygulama ayarları',
    'settings.language': 'Dil',
    'settings.theme': 'Tema',
    'settings.background': 'Arka plan GIF',
    'settings.backgroundChoose': 'Dosya seç',
    'settings.backgroundClear': 'Kaldır',
    'settings.backgroundSize': 'Önerilen: 1920x1080, minimum 1100x620',
    'badge.maintenance': 'BAKIMDA',
    'settings.bot': 'Bot ayarları',
    'theme.winter': 'Kış',
    'theme.summer': 'Yaz',
    'bot.serverChat': 'Sunucu',
    'placeholder.script':
      '# Tekrar, rastgele bekleme, değişkenler\nrepeat 3\nchat Merhaba {player} {random:6}\ndelay 500 1500\nend',
    'placeholder.username': 'kullanıcı adı / token',
    'placeholder.server': 'localhost:25565',
    'placeholder.joinMessage': '/register',
    'placeholder.chatMsg': 'Mesaj',
    'placeholder.number': 'sayı',
    'placeholder.coords': 'örn: 0 1 0',
    'placeholder.command': 'komut',
    'placeholder.geminiApiKey': 'Gemini API anahtari',
    'placeholder.proxy': 'Proxy:Port:Kullanıcı:Şifre',
    'notify.reset': 'Config sıfırlandı. Lütfen uygulamayı yeniden başlat.',
    'notify.clearProxy': 'Tekrarlanan proxyler temizlendi',
    'notify.proxyStopped': 'Proxy testi durduruldu.',
    'notify.maintenanceTitle': 'Geçici olarak bakımda',
    'notify.maintenanceBody': 'Bu özellik askıya alındı ve sonraki versiyonlarda gelecek.',
    'notify.updateTitle': 'Client eski bir sürüm',
    'notify.updateBody':
      'Şu an bu client eski bir sürüm. Mevcut: v{current}. Yeni: v{latest}. Yeni sürüm için GitHub sayfasına yönlendirmeme izin vermek istersen bildirime tıkla.',
    'bot.connected': 'Sunucuya bağlandı.',
    'bot.kicked': 'Atıldı: ',
    'bot.connection': 'Bağlantı: ',
    'nuker.quickRange': 'Hızlı menzil',
    'nuker.quickRangeTip': 'Yatay alan boyutunu ayarlar. Hangi değer seçilirse o değer kadar NxN uzunluk/genişlik alanı olur; yükseklik gelişmiş yukarı/aşağı ayarını kullanır.',
    'nuker.simpleRange': 'Tek menzil',
    'nuker.advancedRange': 'Gelişmiş yön menzili',
    'nuker.up': 'Yukarı',
    'nuker.down': 'Aşağı',
    'nuker.left': 'Sol',
    'nuker.right': 'Sağ',
    'nuker.forward': 'İleri',
    'nuker.back': 'Geri',
    'nuker.blockFilter': 'Blok filtresi',
    'nuker.blockFilterTip': 'Blacklist listedeki blokları korur. Whitelist sadece listedeki blokları kırar.',
    'nuker.targetMode': 'Hedef modu',
    'nuker.blacklistMode': 'Blacklist: listedeki blokları kırma',
    'nuker.whitelistMode': 'Whitelist: sadece listedeki blokları kır',
    'nuker.blocks': 'Bloklar',
    'nuker.blocksPlaceholder': 'dirt,glass,stone',
    'nuker.blocksTip': 'Virgülle ayrılmış blok IDleri. Örnek: dirt,grass_block,stone',
    'nuker.speed': 'Hız',
    'nuker.speedTip': 'Fastplace seçili menzilin tamamını tek dalgada kırar. Blok/tick sadece Fastplace kapalıyken kullanılır.',
    'nuker.blocksPerTick': 'Blok/tick',
    'nuker.blocksPerTickPlaceholder': 'boş = menzildeki hepsi',
    'nuker.fastplace': 'Fastplace',
    'nuker.rotateHead': 'Kafa döndürme',
    'nuker.toggle': 'Aç/Kapat',
    'nuker.start': 'Başlat',
    'nuker.stop': 'Durdur'
  }
}

const offlineCleanupTimers = new Map()
const OFFLINE_BOT_CLEANUP_MS = 30000

const textKeys = {
  'Username:': 'Username:',
  'Server:': 'Server:',
  'Max accounts:': 'Max accounts:',
  'Join delay:': 'Join delay:',
  'Join message:': 'Join message:',
  Start: 'Start',
  Stop: 'Stop',
  Options: 'Options',
  'Name:': 'Name:',
  Default: 'Default',
  Random: 'Random',
  Legit: 'Legit',
  File: 'File',
  'Choose a file': 'Choose a file',
  'Auth:': 'Auth:',
  Cracked: 'Cracked',
  'Version:': 'Version:',
  Auto: 'Auto',
  'Mode:': 'Mode:',
  Normal: 'Normal',
  Minimal: 'Minimal',
  Select: 'Select',
  Controls: 'Controls',
  Chat: 'Chat',
  Hotbar: 'Hotbar',
  Inventory: 'Inventory',
  Move: 'Move',
  Look: 'Look',
  AntiAFK: 'AntiAFK',
  KillAura: 'KillAura',
  Interact: 'Interact',
  Nuker: 'Nuker',
  Pathfinder: 'Pathfinder',
  Disconnect: 'Disconnect',
  Send: 'Send',
  Spam: 'Spam',
  Delay: 'Delay',
  Bypass: 'Bypass',
  Set: 'Set',
  Use: 'Use',
  Slot: 'Slot',
  Left: 'Left',
  Right: 'Right',
  All: 'All',
  'Close window': 'Close window',
  Close: 'Close',
  Reset: 'Reset',
  Forward: 'Forward',
  Backwards: 'Backwards',
  Jump: 'Jump',
  Sprint: 'Sprint',
  Sneak: 'Sneak',
  North: 'North',
  South: 'South',
  East: 'East',
  West: 'West',
  'Anti AFK': 'Anti AFK',
  'Interact [Premium]': 'Interact [Premium]',
  Coords: 'Coords',
  'Mouse button': 'Mouse button',
  Targets: 'Targets',
  Player: 'Player',
  Vehicle: 'Vehicle',
  Mob: 'Mob',
  Animal: 'Animal',
  Settings: 'Settings',
  Range: 'Range',
  Priority: 'Priority',
  Nearest: 'Nearest',
  Health: 'Health',
  'Max targets': 'Max targets',
  'Only visible': 'Only visible',
  'Hit once': 'Hit once',
  Rotate: 'Rotate',
  Toggle: 'Toggle',
  'Target mode': 'Target mode',
  Blacklist: 'Blacklist',
  Whitelist: 'Whitelist',
  Blocks: 'Blocks',
  'Blcks/tick': 'Blcks/tick',
  'Blocks/tick': 'Blocks/tick',
  Commands: 'Commands',
  Run: 'Run',
  'Follows a player': 'Follows a player',
  'Forms a line': 'Forms a line',
  'Walks to a visible player': 'Walks to a visible player',
  'Walks to a location': 'Walks to a location',
  'Shows current coordinates': 'Shows current coordinates',
  'Shows a visible player position': 'Shows a visible player position',
  'Finds the nearest loaded block': 'Finds the nearest loaded block',
  'Mines nearby loaded blocks': 'Mines nearby loaded blocks',
  'Walks to a moving player': 'Walks to a moving player',
  'Gives collected items': 'Gives collected items',
  'Shows coordinates': 'Shows coordinates',
  'AI mode': 'AI mode',
  BETA: 'BETA',
  'Gemini API key:': 'Gemini API key:',
  'Gemini model:': 'Gemini model:',
  'Changes Gemini model': 'Changes Gemini model',
  Survival: 'Survival',
  Mining: 'Mining',
  Wood: 'Wood',
  Farm: 'Farm',
  Village: 'Village',
  Trade: 'Trade',
  Combat: 'Combat',
  Loot: 'Loot',
  Nether: 'Nether',
  End: 'End',
  'Controls autonomous mode': 'Controls autonomous mode',
  'Shows the current survival objective': 'Shows the current survival objective',
  'Responds from server chat': 'Responds from server chat',
  'Checks portal materials': 'Checks portal materials',
  'Moves with body controls': 'Moves with body controls',
  'Controls body states': 'Controls body states',
  'Controls camera': 'Controls camera',
  'Breaks blocks': 'Breaks blocks',
  'Places blocks': 'Places blocks',
  'Uses held item': 'Uses held item',
  'Stops pathfinder': 'Stops pathfinder',
  'Show chat': 'Show chat',
  'Auto scroll': 'Auto scroll',
  Clear: 'Clear',
  Script: 'Script',
  'Run on connect': 'Run on connect',
  'Run on spawn': 'Run on spawn',
  'Type:': 'Type:',
  None: 'None',
  Test: 'Test',
  'Proxy per bot': 'Proxy per bot',
  'Randomize order': 'Randomize order',
  Scrape: 'Scrape',
  'Clear Dupe': 'Clear Dupe',
  'Proxy test': 'Proxy test',
  Timeout: 'Timeout',
  Logs: 'Logs',
  'Webhook:': 'Webhook:',
  Actions: 'Actions',
  'Proxy error': 'Proxy error',
  'Proxy logs': 'Proxy logs',
  Feedback: 'Feedback',
  Joins: 'Joins',
  Kicks: 'Kicks',
  'Auth message': 'Auth message',
  'Linear delay': 'Linear delay',
  'Auto Reconnect': 'Auto Reconnect',
  'Physics [Premium]': 'Physics [Premium]',
  'Map notifications [Premium]': 'Map notifications [Premium]',
  'Accept resource packs [Premium]': 'Accept resource packs [Premium]',
  'Chat [Premium]': 'Chat [Premium]',
  'Feedback [Premium]': 'Feedback [Premium]',
  'Join [Premium]': 'Join [Premium]',
  'Kicks [Premium]': 'Kicks [Premium]',
  'Auth message [Premium]': 'Auth message [Premium]',
  Config: 'Config',
  'My name is Glock (Cmmdx).': 'My name is Glock (Cmmdx).',
  'I maintain TrafficerTR with a focus on clean fixes, newer Minecraft compatibility, and a smoother experience for people who want a simple client they can build and run themselves.':
    'I maintain TrafficerTR with a focus on clean fixes, newer Minecraft compatibility, and a smoother experience for people who want a simple client they can build and run themselves.',
  'This build is maintained independently and is not connected to the original project social links.':
    'This build is maintained independently and is not connected to the original project social links.',
  'TrafficerTR is maintained by Glock (Cmmdx) with a focus on modern Minecraft bot control, Gemini chat automation, and a cleaner desktop experience.':
    'TrafficerTR is maintained by Glock (Cmmdx) with a focus on modern Minecraft bot control, Gemini chat automation, and a cleaner desktop experience.',
  'Version 1.2 moves AI control to Gemini, improves multi-bot queue handling, and keeps the interface focused on fast bot operations.':
    'Version 1.2 moves AI control to Gemini, improves multi-bot queue handling, and keeps the interface focused on fast bot operations.',
  'TrafficerTR v1.2 Fixed focuses on Gemini-only AI control, intent-based commands, Mobility Engine repair, custom UI backgrounds, and cleaner multi-bot operation.':
    'TrafficerTR v1.2 Fixed focuses on Gemini-only AI control, intent-based commands, Mobility Engine repair, custom UI backgrounds, and cleaner multi-bot operation.',
  Added: 'Added',
  'Fixed / being fixed': 'Fixed / being fixed',
  'Under maintenance': 'Under maintenance',
  'In development': 'In development',
  'Gemini API key field, Gemini Flash Latest model option, intent router, live player-follow intents, custom GIF backgrounds, Ely.by auth, GitHub update link, and provider queue status.':
    'Gemini API key field, Gemini Flash Latest model option, intent router, live player-follow intents, custom GIF backgrounds, Ely.by auth, GitHub update link, and provider queue status.',
  'Duplicate Gemini replies, quota/rate-limit handling, bot-name-only chat triggering, offline bot cleanup, front/back block detection, spawn readiness, Vec3 position safety, strict movement verification, and recovery loops.':
    'Duplicate Gemini replies, quota/rate-limit handling, bot-name-only chat triggering, offline bot cleanup, front/back block detection, spawn readiness, Vec3 position safety, strict movement verification, and recovery loops.',
  'AI Mode is still marked BETA / UNDERMAINTENANCE while the intent-driven autonomous agent layer is being stabilized. Nuker is planned for the next version.':
    'AI Mode is still marked BETA / UNDERMAINTENANCE while the intent-driven autonomous agent layer is being stabilized. Nuker is planned for the next version.',
  'World Model persistence, Skill Registry, Minecraft Brain, Knowledge Graph, Goal Manager, Planner, Survival Engine, Combat Engine, Building Engine, and Reflection Engine.':
    'World Model persistence, Skill Registry, Minecraft Brain, Knowledge Graph, Goal Manager, Planner, Survival Engine, Combat Engine, Building Engine, and Reflection Engine.',
  'Independent Minecraft bot client': 'Independent Minecraft bot client',
  Build: 'Build',
  Focus: 'Focus',
  Status: 'Status',
  'TrafficerTR v1.2': 'TrafficerTR v1.2',
  'TrafficerTR v1.2 Fixed': 'TrafficerTR v1.2 Fixed',
  'Gemini AI, pathfinder, webhooks': 'Gemini AI, pathfinder, webhooks',
  'Actively maintained': 'Actively maintained'
}

const localizedText = {
  tr: {
    'Username:': 'Kullanıcı adı:',
    'Server:': 'Sunucu:',
    'Max accounts:': 'Maks. hesap:',
    'Join delay:': 'Giriş gecikmesi:',
    'Join message:': 'Giriş mesajı:',
    Start: 'Başlat',
    Stop: 'Durdur',
    Options: 'Seçenekler',
    'Name:': 'İsim:',
    Default: 'Varsayılan',
    Random: 'Rastgele',
    Legit: 'Gerçekçi',
    File: 'Dosya',
    'Choose a file': 'Dosya seç',
    'Auth:': 'Giriş:',
    Cracked: 'Cracked',
    'Version:': 'Sürüm:',
    Auto: 'Otomatik',
    'Mode:': 'Mod:',
    Normal: 'Normal',
    Minimal: 'Minimal',
    Select: 'Seç',
    Controls: 'Kontroller',
    Chat: 'Sohbet',
    Hotbar: 'Hotbar',
    Inventory: 'Envanter',
    Move: 'Hareket',
    Look: 'Bakış',
    AntiAFK: 'Anti AFK',
    KillAura: 'KillAura',
    Interact: 'Etkileşim',
    Nuker: 'Nuker',
    Pathfinder: 'Yol Bulucu',
    Disconnect: 'Bağlantıyı kes',
    Send: 'Gönder',
    Spam: 'Spam',
    Delay: 'Gecikme',
    Bypass: 'Bypass',
    Set: 'Ayarla',
    Use: 'Kullan',
    Slot: 'Slot',
    Left: 'Sol',
    Right: 'Sağ',
    All: 'Tümü',
    'Close window': 'Pencereyi kapat',
    Close: 'Kapat',
    Reset: 'Sıfırla',
    Forward: 'İleri',
    Backwards: 'Geri',
    Jump: 'Zıpla',
    Sprint: 'Koş',
    Sneak: 'Eğil',
    North: 'Kuzey',
    South: 'Güney',
    East: 'Doğu',
    West: 'Batı',
    'Anti AFK': 'Anti AFK',
    'Interact [Premium]': 'Etkileşim [Premium]',
    Coords: 'Koordinat',
    'Mouse button': 'Fare tuşu',
    Targets: 'Hedefler',
    Player: 'Oyuncu',
    Vehicle: 'Araç',
    Mob: 'Mob',
    Animal: 'Hayvan',
    Settings: 'Ayarlar',
    Range: 'Menzil',
    Priority: 'Öncelik',
    Nearest: 'En yakın',
    Health: 'Can',
    'Max targets': 'Maks. hedef',
    'Only visible': 'Sadece görünen',
    'Hit once': 'Bir kez vur',
    Rotate: 'Döndür',
    Toggle: 'Aç/Kapat',
    'Target mode': 'Hedef modu',
    Blacklist: 'Kara liste',
    Whitelist: 'Beyaz liste',
    Blocks: 'Bloklar',
    'Blcks/tick': 'Blok/tick',
    'Blocks/tick': 'Blok/tick',
    Commands: 'Komutlar',
    Run: 'Çalıştır',
    'Follows a player': 'Bir oyuncuyu takip eder',
    'Forms a line': 'Sıra oluşturur',
    'Walks to a visible player': 'Görünen bir oyuncuya yürür',
    'Walks to a location': 'Bir konuma yürür',
    'Shows current coordinates': 'Mevcut koordinatı gösterir',
    'Shows a visible player position': 'Görünen oyuncu konumunu gösterir',
    'Finds the nearest loaded block': 'Yakındaki yüklü bloğu bulur',
    'Mines nearby loaded blocks': 'Yakındaki yüklü blokları kazar',
    'Walks to a moving player': 'Hareket eden oyuncuya gider',
    'Gives collected items': 'Toplanan eşyaları verir',
    'Shows coordinates': 'Koordinatları gösterir',
    'AI mode': 'AI modu',
    BETA: 'BETA',
    'Gemini API key:': 'Gemini API anahtari:',
    'Gemini model:': 'Gemini modeli:',
    'Changes Gemini model': 'Gemini modelini değiştirir',
    Survival: 'Hayatta kalma',
    Mining: 'Madencilik',
    Wood: 'Odun',
    Farm: 'Tarla',
    Village: 'Köy',
    Trade: 'Ticaret',
    Combat: 'Savaş',
    Loot: 'Loot',
    Nether: 'Nether',
    End: 'End',
    'Controls autonomous mode': 'Otonom modu kontrol eder',
    'Shows the current survival objective': 'Mevcut survival hedefini gösterir',
    'Responds from server chat': 'Sunucu sohbetinden yanıt verir',
    'Checks portal materials': 'Portal malzemelerini kontrol eder',
    'Moves with body controls': 'Beden kontrolleriyle hareket eder',
    'Controls body states': 'Beden durumlarını kontrol eder',
    'Controls camera': 'Kamerayı kontrol eder',
    'Breaks blocks': 'Blok kırar',
    'Places blocks': 'Blok koyar',
    'Uses held item': 'Eldeki eşyayı kullanır',
    'Stops pathfinder': 'Yol bulucuyu durdurur',
    'Show chat': 'Sohbeti göster',
    'Auto scroll': 'Otomatik kaydır',
    Clear: 'Temizle',
    Script: 'Script',
    'Run on connect': 'Bağlanınca çalıştır',
    'Run on spawn': 'Spawn olunca çalıştır',
    'Type:': 'Tür:',
    None: 'Yok',
    Test: 'Test',
    'Proxy per bot': 'Bot başına proxy',
    'Randomize order': 'Sırayı karıştır',
    Scrape: 'Çek',
    'Clear Dupe': 'Tekrarları sil',
    'Proxy test': 'Proxy testi',
    Timeout: 'Zaman aşımı',
    Logs: 'Kayıtlar',
    'Webhook:': 'Webhook:',
    Actions: 'Aksiyonlar',
    'Proxy error': 'Proxy hatası',
    'Proxy logs': 'Proxy kayıtları',
    Feedback: 'Geri bildirim',
    Joins: 'Girişler',
    Kicks: 'Atılmalar',
    'Auth message': 'Giriş mesajı',
    'Linear delay': 'Sıralı gecikme',
    'Auto Reconnect': 'Otomatik bağlan',
    'Physics [Premium]': 'Fizik [Premium]',
    'Map notifications [Premium]': 'Harita bildirimleri [Premium]',
    'Accept resource packs [Premium]': 'Resource pack kabul et [Premium]',
    'Chat [Premium]': 'Sohbet [Premium]',
    'Feedback [Premium]': 'Geri bildirim [Premium]',
    'Join [Premium]': 'Giriş [Premium]',
    'Kicks [Premium]': 'Atılmalar [Premium]',
    'Auth message [Premium]': 'Giriş mesajı [Premium]',
    Config: 'Config',
    'My name is Glock (Cmmdx).': 'Benim adım Glock (Cmmdx).',
    'I maintain TrafficerTR with a focus on clean fixes, newer Minecraft compatibility, and a smoother experience for people who want a simple client they can build and run themselves.':
      'TrafficerTR yapısını temiz düzeltmeler, yeni Minecraft uyumluluğu ve kendi derleyip çalıştırmak isteyenler için daha akıcı bir deneyim odağıyla geliştiriyorum.',
    'This build is maintained independently and is not connected to the original project social links.':
      'Bu sürüm bağımsız olarak geliştirilmektedir ve orijinal projenin sosyal bağlantılarıyla ilişkili değildir.',
    'TrafficerTR is maintained by Glock (Cmmdx) with a focus on modern Minecraft bot control, Gemini chat automation, and a cleaner desktop experience.':
      'TrafficerTR; modern Minecraft bot kontrolü, Gemini sohbet otomasyonu ve daha temiz bir masaüstü deneyimi odağıyla Glock (Cmmdx) tarafından geliştiriliyor.',
    'Version 1.2 moves AI control to Gemini, improves multi-bot queue handling, and keeps the interface focused on fast bot operations.':
      'Sürüm 1.2, AI kontrolünü Geminiye taşır, çoklu bot kuyruk yönetimini iyileştirir ve arayüzü hızlı bot işlemlerine odaklı tutar.',
    'Independent Minecraft bot client': 'Bağımsız Minecraft bot client',
    'TrafficerTR v1.2 Fixed focuses on Gemini-only AI control, intent-based commands, Mobility Engine repair, custom UI backgrounds, and cleaner multi-bot operation.':
      'TrafficerTR v1.2 Fixed; sadece Gemini AI kontrolu, intent tabanli komutlar, Mobility Engine onarimi, ozel GIF arka planlari ve daha temiz coklu bot kullanimina odaklanir.',
    Added: 'Eklenenler',
    'Fixed / being fixed': 'Duzeltilenler / duzeltilmeye calisilanlar',
    'Under maintenance': 'Bakimda',
    'In development': 'Gelistirme asamasinda',
    'Gemini API key field, Gemini Flash Latest model option, intent router, live player-follow intents, custom GIF backgrounds, Ely.by auth, GitHub update link, and provider queue status.':
      'Gemini API key alani, Gemini Flash Latest model secenegi, intent router, canli oyuncu takip intentleri, ozel GIF arka planlari, Ely.by girisi, GitHub guncelleme baglantisi ve provider kuyruk durumu eklendi.',
    'Duplicate Gemini replies, quota/rate-limit handling, bot-name-only chat triggering, offline bot cleanup, front/back block detection, spawn readiness, Vec3 position safety, strict movement verification, and recovery loops.':
      'Tekrarlanan Gemini cevaplari, kota/rate-limit yonetimi, sadece bot adiyla tetikleme, offline bot temizleme, on/arka blok algilama, spawn hazirligi, Vec3 konum guvenligi, siki hareket dogrulama ve recovery donguleri duzeltiliyor.',
    'AI Mode is still marked BETA / UNDERMAINTENANCE while the intent-driven autonomous agent layer is being stabilized. Nuker is planned for the next version.':
      'AI Mode, intent tabanli otonom agent katmani stabil hale getirilirken BETA / BAKIMDA olarak isaretlidir. Nuker sonraki surum icin planlaniyor.',
    'World Model persistence, Skill Registry, Minecraft Brain, Knowledge Graph, Goal Manager, Planner, Survival Engine, Combat Engine, Building Engine, and Reflection Engine.':
      'World Model kaliciligi, Skill Registry, Minecraft Brain, Knowledge Graph, Goal Manager, Planner, Survival Engine, Combat Engine, Building Engine ve Reflection Engine gelistiriliyor.',
    Build: 'Derleme',
    Focus: 'Odak',
    Status: 'Durum',
    'TrafficerTR v1.2': 'TrafficerTR v1.2',
    'TrafficerTR v1.2 Fixed': 'TrafficerTR v1.2 Fixed',
    'Gemini AI, pathfinder, webhooks': 'Gemini AI, yol bulucu, webhook',
    'Actively maintained': 'Aktif olarak geliştiriliyor'
  }
}

const placeholderKeys = {
  scriptText: 'placeholder.script',
  username: 'placeholder.username',
  server: 'placeholder.server',
  joinMessage: 'placeholder.joinMessage',
  chatMsg: 'placeholder.chatMsg',
  invSlot: 'placeholder.number',
  interactCoords: 'placeholder.coords',
  pathFinderCommand: 'placeholder.command',
  geminiApiKey: 'placeholder.geminiApiKey',
  proxyList: 'placeholder.proxy'
}

const runtimeText = {
  tr: {
    Info: 'Bilgi',
    Error: 'Hata',
    Success: 'Başarılı',
    'Script Error': 'Script Hatası',
    'Version disabled': 'Sürüm devre dışı',
    'Stopped sending bots.': 'Bot gönderimi durduruldu.',
    'Stopped running scripts.': 'Script çalıştırma durduruldu.',
    'Please enter script text': 'Lütfen script metni gir.',
    'No bots selected': 'Seçili bot yok.',
    'Please insert username': 'Lütfen kullanıcı adı gir.',
    'Please select name file': 'Lütfen isim dosyası seç.',
    'Invalid server address': 'Geçersiz sunucu adresi.',
    'Please enter proxy list': 'Lütfen proxy listesi gir.',
    'Select proxy type': 'Proxy türü seç.',
    'Testing proxies...': 'Proxyler test ediliyor...',
    'Scraping proxies...': 'Proxyler çekiliyor...',
    'Failed to scrape proxies': 'Proxy çekme başarısız.',
    'Please enter a valid Discord webhook URL.': 'Lütfen geçerli bir Discord webhook URL gir.',
    'Webhook test sent.': 'Webhook testi gönderildi.',
    '26.1.x support is paused until Mineflayer/minecraft-protocol adds native support.':
      '26.1.x desteği Mineflayer/minecraft-protocol native destek ekleyene kadar askıda.'
  }
}

let currentLanguage = 'en'
let regionalClockTimer

const regionalClocks = {
  en: {
    locale: 'en-US',
    timeZone: 'America/New_York',
    label: 'EN'
  },
  tr: {
    locale: 'tr-TR',
    timeZone: 'Europe/Istanbul',
    label: 'TR'
  }
}

window.addEventListener('DOMContentLoaded', () => {
  restoreUISettings()
  applyUISettings()
  startRegionalClock()
  setTimeout(() => {
    document.getElementById('splashScreen')?.classList.add('hide')
  }, 3900)
  window.electron?.ipcRenderer.send('loaded')

  window.electron?.ipcRenderer.on('setConfig', (event, config, version) => {
    setConfigValues(config)
    applyUISettings()
    document.getElementById('versionString').innerHTML = `v${version.current}`
    syncNukerRangeLabels()
  })

  window.electron?.ipcRenderer.on('fileSelected', (event, id, payload) => {
    const selection = normalizeBackgroundSelection(payload)
    const path = id === 'customBackgroundLabel' ? selection.path : payload
    const filename = String(path || '').match(/[^\\/]+$/)?.[0] || path
    const element = document.getElementById(id)
    if (element) {
      element.textContent = filename || t('settings.backgroundChoose')
      element.title = path
    }
    if (id === 'customBackgroundLabel') {
      applyCustomBackground(selection)
    }
  })

  window.electron?.ipcRenderer.on('showBottab', () => {
    document.getElementById('bottingTab').click()
  })

  const valueElements = document.querySelectorAll(
    'input[type="text"], input[type="password"], input[type="number"], input[type="range"], select, textarea'
  )
  valueElements.forEach((select) => {
    select.addEventListener('change', valueChange)
    if (select.type === 'range') select.addEventListener('input', valueChange)
  })
  document.getElementById('webhookLink')?.addEventListener('input', valueChange)

  const checkboxElements = document.querySelectorAll('input[type="checkbox"]')
  checkboxElements.forEach((check) => {
    check.addEventListener('click', checkboxClick)
  })

  const buttonElements = document.querySelectorAll('button, .button')
  buttonElements.forEach((button) => {
    button.addEventListener('click', buttonClick)
  })

  document.querySelectorAll('a[href^="https://github.com/"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault()
      window.electron?.ipcRenderer.send('openExternal', link.href)
    })
  })

  const tabElements = document.querySelectorAll('.tab, .tab-2')
  tabElements.forEach((tab) => {
    tab.addEventListener('click', navClick)
  })

  window.electron?.ipcRenderer.on('initConfig', () => {
    valueElements.forEach((select) => {
      if (!select.id) return
      window.electron?.ipcRenderer.send('setConfig', 'value', select.id, select.value)
    })
    checkboxElements.forEach((check) => {
      if (!check.id) return
      window.electron?.ipcRenderer.send('setConfig', 'boolean', check.id, check.checked)
    })
  })

  window.electron?.ipcRenderer.on('notify', (event, title, body, type, img, keep) => {
    notify(title, body, type, img, keep)
  })

  window.electron?.ipcRenderer.on('updateAvailable', (event, update) => {
    const body = t('notify.updateBody')
      .replace('{current}', update.currentVersion)
      .replace('{latest}', update.latestVersion)
    notify(t('notify.updateTitle'), body, 'warning', './assets/icons/earth-logo.svg', true, () => {
      window.electron?.ipcRenderer.send('openExternal', update.url)
    })
  })

  window.electron?.ipcRenderer.on('proxyEvent', (event, info) => {
    if (info.event === 'scraped') {
      logProxy('Scraped', 'success', '')
    } else {
      logProxy(info.proxy, info.event, info.message)
    }
    document.getElementById('proxyCheckStatusCount').innerHTML = info.count
    switch (info.event) {
      case 'start':
        document.getElementById('proxyCheckStatus').style.display = 'block'
        document.getElementById('proxyList').value = ''
        break
      case 'stop':
        document.getElementById('proxyCheckStatus').style.display = 'none'
        notify('Info', t('notify.proxyStopped'), 'success')
        updateProxyList()
        break
      case 'success':
        document.getElementById('proxyList').value += `${info.proxy}\n`
        updateProxyList()
        break
      case 'scraped':
        document.getElementById('proxyList').value += `\n${info.message}\n`
        clearProxyEmpty()
        updateProxyList()
        break
      default:
    }
  })

  window.electron?.ipcRenderer.on('botEvent', (event, info) => {
    switch (info.event) {
      case 'login':
        addPlayer(info.id, 'online')
        logChat('Bot', info.id, t('bot.connected'))
        break
      case 'authmsg':
        directChat(
          `<div class="space-h"><div class="flex"><p class="text-sm link">Auth</p></div><div class="space-h-f pl-2"><p class="text-sm" style="user-select: text;">${info.id}</p></div></div><p class="text-sm-2" style="user-select: text;"> First time signing in. Use a web browser to open the page <a href="https://www.microsoft.com/link" target="_blank" rel="noreferrer" class="text-sm-2">https://www.microsoft.com/link</a> and enter the code: <a class="text-sm-2" style="border-bottom: solid 1px #a1a1a1; cursor: pointer;" onclick="navigator.clipboard.writeText('${info.message}')">${info.message} [click to copy]</a></p>`
        )
        break
      case 'chat':
        logChat('Bot', info.id, info.message)
        break
      case 'serverchat':
        logChat(t('bot.serverChat'), info.id, info.message)
        break
      case 'kicked':
        logChat('Bot', info.id, t('bot.kicked') + info.message)
        markPlayerState(info.id, 'kicked', info.message)
        break
      case 'error':
        logChat('Bot', info.id, `Connection error: ${info.message || '-'}`)
        markPlayerState(info.id, 'error', info.message)
        break
      case 'end':
        logChat('Bot', info.id, t('bot.connection') + info.message)
        markPlayerState(info.id, 'offline', info.message)
        break
      default:
    }
  })
  // setInterval(() => {
  //   logChat('Bot', 'Username', 'TEST')
  //   notify('TEST', 'Welcome back User', 'success')
  //   logProxy('proxy:port', 'fail', 'Test')
  // }, 1000)
})

function valueChange(event) {
  const selectedValue = event.target.value
  const selectId = event.target.id
  window.electron?.ipcRenderer.send('setConfig', 'value', selectId, selectedValue)
  if (selectId.startsWith('nukerRange')) syncNukerRangeLabels()

  switch (selectId) {
    case 'nameType':
      checkUsername()
      break
    case 'uiLanguage':
    case 'uiTheme':
      saveUISettings()
      applyUISettings()
      break
    case 'webhookLink':
      if (selectedValue.trim()) {
        enableAllWebhookOptions()
      }
      break
    default:
  }
}

function syncNukerRangeLabels() {
  const ids = [
    'nukerRange',
    'nukerRangeUp',
    'nukerRangeDown',
    'nukerRangeLeft',
    'nukerRangeRight',
    'nukerRangeForward',
    'nukerRangeBack'
  ]
  ids.forEach((id) => {
    const input = document.getElementById(id)
    const label = document.getElementById(`${id}Value`)
    if (input && label) label.textContent = input.value || '0'
  })
}

function enableAllWebhookOptions() {
  const checkboxIds = [
    'enableWebhook',
    'actionLogWebhook',
    'proxyLogWebhook',
    'chatLogWebhook',
    'feedbackLogWebhook',
    'joinLogWebhook',
    'kickLogWebhook',
    'authLogWebhook'
  ]

  checkboxIds.forEach((id) => {
    const checkbox = document.getElementById(id)
    if (!checkbox) return
    checkbox.checked = true
    window.electron?.ipcRenderer.send('setConfig', 'boolean', id, true)
  })
}

function buttonClick(event) {
  const buttonId = event.target.id
  switch (buttonId) {
    case 'minimize':
      window.electron?.ipcRenderer.send('win:invoke', 'min')
      break
    case 'close':
      window.electron?.ipcRenderer.send('win:invoke', 'close')
      break
    case 'resetConfig':
      window.electron?.ipcRenderer.send('deleteConfig')
      notify('Info', t('notify.reset'), 'success')
      break
    case 'nameFileLabel':
      window.electron?.ipcRenderer.send('open', 'nameFileLabel', 'Name File')
      break
    case 'customBackgroundLabel':
      window.electron?.ipcRenderer.send('open', 'customBackgroundLabel', 'Custom Background GIF')
      break
    case 'clearCustomBackground':
      window.electron?.ipcRenderer.send('clearCustomBackground')
      applyCustomBackground('')
      break
    case 'selectAll':
      selectAll()
      break
    case 'proxyClearDupe':
      clearDupe()
      notify('Info', t('notify.clearProxy'), 'success')
      break
    default:
      window.electron?.ipcRenderer.send('btnClick', buttonId)
      break
  }
}

function checkboxClick(event) {
  const checkId = event.target.id
  const state = event.target.checked
  window.electron?.ipcRenderer.send('setConfig', 'boolean', checkId, state)
  window.electron?.ipcRenderer.send('checkboxClick', checkId, state)
}

function navClick(event) {
  const target = event.currentTarget
  if (target.classList.contains('maintenance')) {
    notify(t('notify.maintenanceTitle'), t('notify.maintenanceBody'), 'warning')
    return
  }
  if (target.classList.contains('disabled')) return

  const classes = target.classList
  const navName = target.dataset.tab || target.innerText.toLowerCase()
  const tabContent = document.getElementsByClassName(classes[1])

  Array.from(tabContent).forEach((content) => {
    if (!content.classList.contains(classes[0])) {
      content.style.display = 'none'
    }
  })

  const selectedContent = document.getElementById(navName)
  if (!selectedContent) return
  selectedContent.style.display = 'block'

  const tabs = document.getElementsByClassName(classes[0])
  Array.from(tabs).forEach((tab) => {
    tab.classList.remove('selected')
  })

  target.classList.add('selected')
}

function checkUsername() {
  const nameType = document.getElementById('nameType')
  const fileDiv = document.getElementById('nameFileDiv')

  const isFileBased = nameType.value === 'file'
  fileDiv.style.display = isFileBased ? 'block' : 'none'
}

function setConfigValues(obj) {
  if (!obj) return
  for (const keyType in obj) {
    const keys = Object.keys(obj[keyType])
    for (const key of keys) {
      const element = document.getElementById(key)
      if (element) {
        if (keyType === 'value') {
          if (
            key === 'authType' &&
            !Array.from(element.options).some((option) => option.value === obj.value[key])
          ) {
            element.value = 'offline'
          } else {
            element.value = obj.value[key]
          }
        } else if (keyType === 'boolean') {
          element.checked = obj.boolean[key]
        }
      }
    }
  }
  checkUsername()
  if (!obj.value?.customBackground) applyCustomBackground('')
}

function pathToFileUrl(path) {
  if (!path) return ''
  const normalized = String(path).replace(/\\/g, '/')
  if (normalized.startsWith('file:') || normalized.startsWith('data:')) return normalized
  const prefixed = normalized.startsWith('/') ? normalized.slice(1) : normalized
  const encoded = prefixed
    .split('/')
    .map((part, index) => {
      if (index === 0 && /^[A-Za-z]:$/.test(part)) return part
      return encodeURIComponent(part)
    })
    .join('/')
  return `file:///${encoded}`
}

function normalizeBackgroundSelection(payload) {
  if (!payload) return { path: '', url: '', error: '' }
  if (typeof payload === 'object') {
    return {
      path: payload.path || '',
      url: payload.url || '',
      error: payload.error || ''
    }
  }

  const path = String(payload)
  return {
    path,
    url: pathToFileUrl(path),
    error: ''
  }
}

function cssUrl(url) {
  return `url("${String(url).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`
}

function applyCustomBackground(payload) {
  const selection = normalizeBackgroundSelection(payload)
  const path = selection.path
  const sourceUrl = selection.url || (path ? pathToFileUrl(path) : '')
  const themeRow = document.getElementById('themeSettingsRow')
  const themeSelect = document.getElementById('uiTheme')
  const clearButton = document.getElementById('clearCustomBackground')
  const chooseButton = document.getElementById('customBackgroundLabel')

  if (!path) {
    document.body.classList.remove('custom-background')
    document.body.style.removeProperty('--custom-background-image')
    document.body.style.removeProperty('background')
    document.body.style.removeProperty('background-image')
    document.body.style.removeProperty('background-size')
    document.body.style.removeProperty('background-position')
    document.body.style.removeProperty('background-repeat')
    document.body.style.removeProperty('background-attachment')
    if (themeRow) themeRow.style.display = 'flex'
    if (themeSelect) themeSelect.disabled = false
    if (clearButton) clearButton.style.display = 'none'
    if (chooseButton) {
      chooseButton.innerHTML = t('settings.backgroundChoose')
      chooseButton.title = ''
    }
    return
  }

  if (!sourceUrl || selection.error) {
    document.body.classList.remove('custom-background')
    document.body.style.removeProperty('--custom-background-image')
    if (themeRow) themeRow.style.display = 'flex'
    if (themeSelect) themeSelect.disabled = false
    if (clearButton) clearButton.style.display = 'inline-flex'
    notify('Error', selection.error || 'Background GIF could not be loaded', 'error')
    return
  }

  const preview = new Image()
  preview.onload = () => {
    const backgroundUrl = cssUrl(sourceUrl)
    document.body.classList.add('custom-background')
    document.body.style.setProperty('--custom-background-image', backgroundUrl)
    document.body.style.background = `${backgroundUrl} center center / cover no-repeat fixed`
    document.body.style.backgroundImage = backgroundUrl
    document.body.style.backgroundSize = 'cover'
    document.body.style.backgroundPosition = 'center'
    document.body.style.backgroundRepeat = 'no-repeat'
    document.body.style.backgroundAttachment = 'fixed'
    if (themeRow) themeRow.style.display = 'none'
    if (themeSelect) themeSelect.disabled = true
    if (clearButton) clearButton.style.display = 'inline-flex'
  }
  preview.onerror = () => {
    document.body.classList.remove('custom-background')
    document.body.style.removeProperty('--custom-background-image')
    document.body.style.removeProperty('background')
    document.body.style.removeProperty('background-image')
    if (themeRow) themeRow.style.display = 'flex'
    if (themeSelect) themeSelect.disabled = false
    if (clearButton) clearButton.style.display = 'inline-flex'
    notify('Error', 'Background GIF could not be loaded', 'error')
  }
  preview.src = sourceUrl
}

function restoreUISettings() {
  const savedLanguage = localStorage.getItem('trafficertr.language')
  const savedTheme = localStorage.getItem('trafficertr.theme')
  const languageSelect = document.getElementById('uiLanguage')
  const themeSelect = document.getElementById('uiTheme')

  if (savedLanguage && languageSelect) languageSelect.value = savedLanguage
  if (savedTheme && themeSelect) themeSelect.value = savedTheme
}

function saveUISettings() {
  const language = document.getElementById('uiLanguage')?.value || 'en'
  const theme = document.getElementById('uiTheme')?.value || 'winter'

  localStorage.setItem('trafficertr.language', language)
  localStorage.setItem('trafficertr.theme', theme)
}

function applyUISettings() {
  const languageSelect = document.getElementById('uiLanguage')
  const themeSelect = document.getElementById('uiTheme')
  currentLanguage = languageSelect?.value || 'en'
  const theme = themeSelect?.value || 'winter'

  document.documentElement.lang = currentLanguage
  document.body.classList.toggle('theme-summer', theme === 'summer')
  document.body.classList.toggle('theme-winter', theme !== 'summer')
  document.body.dataset.theme = theme

  saveUISettings()
  applyTranslations()
  updateRegionalClock()
}

function startRegionalClock() {
  clearInterval(regionalClockTimer)
  updateRegionalClock()
  regionalClockTimer = setInterval(updateRegionalClock, 1000)
}

function updateRegionalClock() {
  const clock = document.getElementById('idUptime')

  const settings = regionalClocks[currentLanguage] || regionalClocks.en
  const now = new Date()
  const timeText = new Intl.DateTimeFormat(settings.locale, {
    timeZone: settings.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).format(now)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: settings.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)
  const phase = getRegionalDayPhase(hour, minute)

  if (clock) {
    clock.textContent = `${timeText} ${settings.label}`
    clock.title = settings.timeZone
  }
  document.body.dataset.timePhase = phase
  document.body.classList.toggle('time-dawn', phase === 'dawn')
  document.body.classList.toggle('time-day', phase === 'day')
  document.body.classList.toggle('time-evening', phase === 'evening')
  document.body.classList.toggle('time-night', phase === 'night')
  document.body.style.setProperty('--day-progress', ((hour * 60 + minute) / 1440).toFixed(3))
}

function getRegionalDayPhase(hour, minute) {
  const totalMinutes = hour * 60 + minute
  if (totalMinutes >= 300 && totalMinutes < 420) return 'dawn'
  if (totalMinutes >= 420 && totalMinutes < 1020) return 'day'
  if (totalMinutes >= 1020 && totalMinutes < 1200) return 'evening'
  return 'night'
}

function t(key) {
  return translations[currentLanguage]?.[key] || translations.en[key] || key
}

function runtimeTranslate(text) {
  return runtimeText[currentLanguage]?.[text] || text
}

function translateExactText(text) {
  if (!text) return text
  const key = textKeys[text] || text
  return currentLanguage === 'en' ? key : localizedText[currentLanguage]?.[key] || key
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n)
  })

  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder)
  })

  const candidates = document.querySelectorAll('p, button, label, li, option, .input-file')
  candidates.forEach((element) => {
    if (element.dataset.i18n) return
    if (element.closest('#botList, #chatBox, #proxyLogbox, #notifications')) return

    const textNode = Array.from(element.childNodes).find((node) => {
      return node.nodeType === Node.TEXT_NODE && node.textContent.trim()
    })
    if (!textNode) return

    const trimmed = textNode.textContent.trim()
    const key = element.dataset.i18nAuto || textKeys[trimmed]
    if (!key) return

    element.dataset.i18nAuto = key
    const translated = translateExactText(key)
    textNode.textContent = textNode.textContent.replace(trimmed, translated)
  })

  Object.entries(placeholderKeys).forEach(([id, key]) => {
    const element = document.getElementById(id)
    if (element) element.placeholder = t(key)
  })
}

function notify(title, body, type, img, keep, action) {
  const translatedTitle = runtimeTranslate(title)
  const translatedBody = runtimeTranslate(body)
  const notification = document.createElement('li')
  notification.className = type
  if (action) notification.classList.add('clickable')

  const top = document.createElement('div')
  top.className = 'space-h'

  const topbar = document.createElement('div')
  topbar.className = 'flex'

  const titleText = document.createElement('p')
  titleText.className = 'text-sm'
  titleText.innerHTML = translatedTitle
  topbar.appendChild(titleText)

  const closeDiv = document.createElement('div')
  const closeBtn = document.createElement('p')
  closeBtn.className = 'text-sm'
  closeBtn.innerHTML = 'X'
  closeBtn.onclick = (event) => {
    event.stopPropagation()
    rmNotification()
  }
  closeDiv.appendChild(closeBtn)

  top.appendChild(topbar)
  top.appendChild(closeDiv)

  const bodyDiv = document.createElement('div')
  bodyDiv.className = 'n-message'
  const bodyText = document.createElement('p')
  bodyText.className = 'tip-sm'
  bodyText.innerText = translatedBody
  bodyDiv.appendChild(bodyText)
  if (img) {
    const imgTag = document.createElement('img')
    imgTag.src = img
    bodyDiv.appendChild(imgTag)
  }

  notification.appendChild(top)
  notification.appendChild(bodyDiv)
  if (action) {
    notification.addEventListener('click', () => {
      action()
      rmNotification()
    })
  }

  document.getElementById('notifications').appendChild(notification)

  if (!keep) {
    const progress = document.createElement('div')
    progress.className = 'n-progress'
    notification.appendChild(progress)
    setTimeout(() => {
      rmNotification()
    }, 3000)
  }
  function rmNotification() {
    notification.classList.add('fade')
    setTimeout(() => {
      notification.remove()
    }, 300)
  }
}

function getPlayerRow(name) {
  return Array.from(document.querySelectorAll('.botListItem')).find((bot) => {
    return bot.dataset.name === name || bot.textContent.trim() === name
  })
}

function renderPlayerRow(row, name, state = 'online', message = '') {
  row.dataset.name = name
  row.dataset.state = state
  row.classList.toggle('offline', state !== 'online')
  row.classList.toggle('error', state === 'error' || state === 'kicked')
  row.title = message || ''
  row.textContent = state === 'online' ? name : `${name} - ${state}`
}

function cancelOfflineCleanup(name) {
  const timer = offlineCleanupTimers.get(name)
  if (!timer) return
  clearTimeout(timer)
  offlineCleanupTimers.delete(name)
}

function scheduleOfflineCleanup(name) {
  cancelOfflineCleanup(name)
  offlineCleanupTimers.set(
    name,
    setTimeout(() => {
      offlineCleanupTimers.delete(name)
      const row = getPlayerRow(name)
      if (!row || row.dataset.state === 'online') return
      row.remove()
      updateSelected()
      updateBotCount()
    }, OFFLINE_BOT_CLEANUP_MS)
  )
}

function addPlayer(name, state = 'online') {
  const list = document.getElementById('botList')
  const auto = document.getElementById('autoSelect').checked
  let b = getPlayerRow(name)
  if (!b) {
    b = document.createElement('li')
    b.className = 'botListItem'
    list.appendChild(b)
  }
  if (state === 'online') cancelOfflineCleanup(name)
  else scheduleOfflineCleanup(name)
  renderPlayerRow(b, name, state)
  b.onclick = () => {
    if (b.dataset.state !== 'online') return
    b.classList.toggle('selected')
    updateSelected()
  }
  list.scrollTop = list.scrollHeight
  updateBotCount()
  if (auto && state === 'online') {
    selectAll('auto')
  }
}

function markPlayerState(name, state, message = '') {
  let bot = getPlayerRow(name)
  if (!bot) {
    addPlayer(name, state)
    bot = getPlayerRow(name)
  }
  if (!bot) return
  bot.classList.remove('selected')
  if (state === 'online') cancelOfflineCleanup(name)
  else scheduleOfflineCleanup(name)
  renderPlayerRow(bot, name, state, message)
  updateSelected()
  updateBotCount()
}

function updateBotCount() {
  const count = document.getElementById('botCount')
  const list = document.getElementById('botList')
  count.innerHTML = Array.from(list.children).filter((bot) => bot.dataset.state === 'online').length
}

function selectAll(auto) {
  const list = document.getElementById('botList')
  const onlineBots = Array.from(list.children).filter((li) => li.dataset.state === 'online')
  const allSelected = onlineBots.every((li) => li.classList.contains('selected'))
  Array.from(list.children).forEach((bot) => {
    if (bot.dataset.state !== 'online') {
      bot.classList.remove('selected')
      return
    }
    if (auto) {
      bot.classList.toggle('selected', true)
    } else {
      bot.classList.toggle('selected', !allSelected)
    }
  })
  updateSelected()
}

function updateSelected() {
  const list = document.getElementById('botList')
  const selectedBots = Array.from(list.children).filter((bot) => {
    return bot.dataset.state === 'online' && bot.classList.contains('selected')
  })
  window.electron?.ipcRenderer.send(
    'playerList',
    selectedBots.map((bot) => bot.dataset.name)
  )
}

function logProxy(proxy, type, message) {
  const scroll = document.getElementById('autoScrollProxy').checked
  const logBox = document.getElementById('proxyLogbox')
  const li = document.createElement('li')
  li.className = type
  const updiv = document.createElement('div')
  updiv.className = 'space-h'

  const ddiv = document.createElement('div')
  const msg = document.createElement('p')
  msg.className = 'text-sm-2 mu-1'
  msg.style = 'user-select: text;'
  msg.innerHTML = message
  ddiv.appendChild(msg)

  const pl = document.createElement('p')
  pl.style = 'user-select: text;'
  pl.className = 'text-sm'
  pl.innerHTML = proxy
  updiv.appendChild(pl)

  const pr = document.createElement('p')
  pr.className = 'text-sm'
  pr.innerHTML = type

  updiv.appendChild(pr)

  li.appendChild(updiv)
  li.appendChild(ddiv)

  logBox.appendChild(li)
  if (scroll) {
    logBox.scrollTop = logBox.scrollHeight
  }
}

function clearProxyEmpty() {
  const textarea = document.getElementById('proxyList')
  const lines = textarea.value.split('\n')
  const nonEmptyLines = lines.filter(function (line) {
    return line.trim() !== ''
  })
  textarea.value = nonEmptyLines.join('\n')
}

function clearDupe() {
  const textarea = document.getElementById('proxyList')
  const lines = textarea.value.split('\n')
  const uniqueLines = {}
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    uniqueLines[line] = true
  }
  const uniqueLinesArray = Object.keys(uniqueLines)
  const result = uniqueLinesArray.join('\n')
  textarea.value = result
}

function updateProxyList() {
  window.electron?.ipcRenderer.send(
    'setConfig',
    'value',
    'proxyList',
    document.getElementById('proxyList').value
  )
}

function logChat(prefix, name, text) {
  const enable = document.getElementById('enableChat').checked
  if (!enable) return
  const chatBox = document.getElementById('chatBox')
  const scroll = document.getElementById('autoScrollChat').checked

  const li = document.createElement('li')

  const spaceHDiv = document.createElement('div')
  spaceHDiv.className = 'space-h'

  const flexDiv = document.createElement('div')
  flexDiv.className = 'flex'

  const prefixP = document.createElement('p')
  prefixP.className = 'text-sm link'
  prefixP.textContent = prefix

  flexDiv.appendChild(prefixP)

  const spaceHFDiv = document.createElement('div')
  spaceHFDiv.className = 'space-h-f pl-2'

  const nameP = document.createElement('p')
  nameP.className = 'text-sm'
  nameP.style = 'user-select: text;'
  nameP.textContent = name

  spaceHFDiv.appendChild(nameP)

  spaceHDiv.appendChild(flexDiv)
  spaceHDiv.appendChild(spaceHFDiv)

  const textP = document.createElement('p')
  textP.className = 'text-sm-2'
  textP.style = 'user-select: text;'
  textP.textContent = text

  li.appendChild(spaceHDiv)
  li.appendChild(textP)

  chatBox.appendChild(li)

  if (scroll) {
    chatBox.scrollTop = chatBox.scrollHeight
  }
}

function directChat(string) {
  const chatBox = document.getElementById('chatBox')
  const li = document.createElement('li')
  li.innerHTML = string
  chatBox.appendChild(li)
}
