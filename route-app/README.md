# 配送トラッキングデモ

登録済みルートと5台の配送車両をAzure Maps上へ表示する、ビルド不要の静的デモです。各車両は10秒ごとにルート上を50m進み、配送商品、次の目的地までの時間、最終到着予想時刻を更新します。

## 起動方法

1. [js/app.js](js/app.js)の`AZURE_MAPS_KEY`をAzure Mapsのサブスクリプションキーへ置き換えます。

```javascript
const AZURE_MAPS_KEY = "YOUR_AZURE_MAPS_SUBSCRIPTION_KEY";
```

1. リポジトリのルートでHTTPサーバーを起動します。

```powershell
python -m http.server 8000
```

1. ブラウザで `http://localhost:8000/route-app/` を開きます。

データファイルを`fetch`で取得するため、`file://`からは起動できません。実キーはGitへコミットしないでください。公開環境ではMicrosoft Entra ID、短期間のSASトークン、許可オリジン、またはサーバー側プロキシを使用してください。

## 操作

- 「再生」「一時停止」で車両位置の更新を切り替えます。初期表示では自動的に再生します。
- 「リセット」で全車両をデータファイルの初期位置へ戻し、一時停止します。
- 車両カードまたは地図上の車アイコンを選択すると、その車両へ地図が移動します。
- 「全体表示」で登録済みの全ルートを表示します。
- 車両は最終目的地で停止し、「配送完了」になります。

## ファイル構成

```text
route-app/
  index.html            画面構造とAzure Maps Web SDKの読込
  css/styles.css        配送管制画面のレスポンシブスタイル
  js/app.js             データ検証、画面描画、アプリ統合
  js/geo.js             距離、ルート上位置、方位、ETA計算
  js/map.js             Azure Mapsのソース、レイヤー、カメラ制御
  js/simulation.js      10秒ごとに50m進む車両シミュレーター
  data/routes.geojson   登録ルートと配送先
  data/vehicles.json    車両、商品SKU、初期進捗
  README.md             このドキュメント
```

## データ編集

### ルート

[data/routes.geojson](data/routes.geojson)の各`LineString`は次のプロパティを持ちます。

| プロパティ | 内容 |
| --- | --- |
| `routeId` | 車両データから参照する一意なID |
| `name` | ルート表示名 |
| `color` | ルート線のCSSカラー |
| `destinations` | 配送先の順序、名称、ルート座標のインデックス |

`coordinateIndex`は`geometry.coordinates`内の配送先座標を指します。アプリ起動時に、ルート始点からその座標までの累積距離へ変換されます。最終配送先は最後の座標を指定してください。

### 車両

[data/vehicles.json](data/vehicles.json)の各車両は次の値を持ちます。

| プロパティ | 内容 |
| --- | --- |
| `id` / `name` | 車両の一意なIDと表示名 |
| `routeId` | 走行する登録ルート |
| `color` | 車アイコンとカードの識別色 |
| `progressMeters` | 起動時のルート始点からの距離 |
| `speedMetersPerSecond` | ETA算出に使う速度。デモ既定値は5m/s |
| `cargo` | SKU、商品名、数量の配列 |

## シミュレーション仕様

- 更新間隔: 10秒
- 1回の移動距離: 50m
- ETA算出速度: 5m/s
- 次の目的地までの表示: ルート上の残距離を速度で割り、分単位で切り上げ
- 最終到着予想: 現在時刻へ最終地点までの所要秒数を加算
- 到着時: ルート終端へ位置を固定し、配送完了として停止

一定速度を前提とするため、信号待ち、荷下ろし、渋滞、交通規制はETAへ反映しません。実運用で想定するGPS収集、DB、バックエンド、認証、配送履歴の永続化はこのデモには含まれません。

## トラブルシューティング

- 地図が表示されない場合は、キー、Azure Mapsアカウントの状態、ブラウザの開発者コンソールを確認してください。
- 「HTTPサーバーが必要です」と表示された場合は、上記コマンドで配信して`localhost`から開いてください。
- データ読込エラーの場合はJSON構文、重複した`routeId`、存在しない車両の`routeId`、範囲外の`coordinateIndex`を確認してください。
- キーを公開リポジトリへコミットした場合は、Azure Portalでキーを直ちにローテーションしてください。
