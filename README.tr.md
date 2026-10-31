# opencode-usage-meter

OpenCode Desktop için kota göstergesi. Oturum başlığında, context window halkasının
yanında **5 saatlik / haftalık / aylık kalan OpenCode Go kotasını** gösterir.
Tıklayınca detay kartı açılır: pencereler, sıfırlanma süreleri, varsa Console bütçesi
ve günün kullanımı.

> [English README](README.md)

## Menüde ne var

| Satır | Anlamı |
| --- | --- |
| `5 saatlik / Haftalık / Aylık` | Her pencerenin kalan yüzdesi, çubuğu ve sıfırlanmasına kalan süre |
| `Aylık bütçe` | Console'da tanımlı üye bütçesi (`harcanan / limit`), yalnızca varsa |
| `Bugün` | Günün istek (model adımı) sayısı, toplam token, giriş/çıkış, cache okuması, prompt ve oturum sayısı |

Renkler: %70 kullanımın altında yeşil, %70'ten sonra amber, %90'dan sonra kırmızı.

## Veri nereden geliyor

Uydurma bir hesap yok, hiçbir şey kazınmıyor — OpenCode sunucusu bu veriyi zaten
yerelde sunuyor:

```sh
opencode api get /api/experimental/usage/limits
```

```json
{
  "workspace": { "id": "org_...", "name": "Personal", "usageURL": "https://opencode.ai/console/..." },
  "go": {
    "rolling": { "percent": 14, "limited": false, "resetsAt": 1793366176000 },
    "weekly":  { "percent": 10, "limited": false, "resetsAt": 1793577600000 },
    "monthly": { "percent": 5,  "limited": false, "resetsAt": 1795953708000 }
  },
  "budgets": []
}
```

- `rolling` = 5 saatlik pencere (Go planında aylık limitin %20'si), `weekly` = %50,
  `monthly` = %100.
- `percent` = **kullanılan** yüzde; gösterge `100 - percent` değerini yazar.
- Günlük blok `GET /api/experimental/session/stats` ucundan gelir; `opencode stats
  --days 0` ile aynı kaynak. Toplam token aynı muhasebeyi kullanır:
  `giriş + çıkış + reasoning + cache read + cache write`. Önbellek okuması dahil
  edilmezse toplam, altındaki satırlarla tutarsız görünür.

Gösterge 60 saniyede bir yenilenir ve menü kapalıyken hiç istek atmaz (günlük blok
yalnızca menü açılınca çekilir). Console oturumu yoksa hiçbir şey çizilmez; istek hata
verirse üzerine gelince hatayı gösteren küçük bir `kota ?` yazısı çıkar.

## Kurulum

### GitHub üzerinden

```sh
opencode plugin add github:olcanaskar/opencode-usage-meter
```

Paketi kurar ve global `opencode.json` içine ekler. `prepare` betiği GUI paketini
kurulum sırasında derler.

### Yerel kopya ile

```sh
git clone https://github.com/olcanaskar/opencode-usage-meter
cd opencode-usage-meter
npm install
```

Sonra OpenCode'a dizini gösterin:

```jsonc
// ~/.config/opencode/opencode.json
{
  "plugins": [{ "package": "C:\\Projects\\opencode-usage-meter" }]
}
```

`dist/gui-experimental.cjs` depoda tutuluyor, yani kopyalayıp doğrudan kullanabilirsiniz.
Dosya değiştiğinde masaüstü uygulaması eklentiyi her pencerede yeniden yükler.

## Geliştirme

```sh
npm install
npm run watch   # her kayıtta yeniden derler, uygulama eklentiyi yeniden yükler
```

| Dosya | İş |
| --- | --- |
| `src/index.ts` | Sunucu tarafı; eklentiye `usage-meter` kimliğini verir, iş yapmaz. |
| `src/gui.tsx` | Arayüz tarafı; `session.header` slotuna yerleşir. |
| `vite.config.ts` | `@opencode/plugin/gui/vite` preset'i ile tek CJS dosyası üretir. |
| `dist/gui-experimental.cjs` | Derlenmiş çıktı; uygulama bunu yükler. |

## Yerleşimi değiştirmek

Kullanılabilir slotlar: `window.bottom`, `session.header`, `session.location.menu`,
`session.panel.end`. `src/gui.tsx` sonundaki adı değiştirip yeniden derlemek yeterli:

```ts
ctx.add(Slot, { at: "session.header", order: 10, render: () => <UsageMeter /> })
```

## Notlar

- GUI eklenti API'si deneysel (`./gui-experimental`); `Plugin`, `Slot` ve `usePlugin`
  OpenCode sürümleri arasında değişebilir. OpenCode 2.2.1 ve `@opencode/plugin` 2.2.1
  ile derlendi.
- `./gui-experimental` yalnızca OpenCode Desktop tarafından yüklenir. TUI, eklentileri
  `cli.json` üzerinden okur ve ayrı bir `./tui` parçası gerekir (henüz yok).
- Go kotası dolar cinsinden tanımlı, ama dolar tutarı yerel veriden birebir
  üretilemiyor: peak saat tarifesi ve istek başına gerçek `opencode.allowance` değeri
  yerelde açık değil. Token × fiyat listesi tahmini denendi ve Console'dan 20–30 sent
  saptığı için kaldırıldı. Kesin tutar için **Console'da aç ↗**.

## Lisans

[MIT](LICENSE)
