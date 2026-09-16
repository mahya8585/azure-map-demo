# 配送トラッキングデモ

登録済みルートと5台の配送車両をAzure Maps上へ表示する、ビルド不要の静的デモです。各車両は時速50kmでルート上を進み、10秒ごとに配送商品、次の目的地までの時間、最終到着予想時刻を更新します。

## 起動方法

1. 設定ファイルのサンプルを`config.js`へコピーします。

```powershell
Copy-Item route-app/config.example.js route-app/config.js
```

1. `config.js`の`azureMapsKey`をAzure Mapsのサブスクリプションキーへ置き換えます。

```javascript
window.ROUTE_APP_CONFIG = {
  azureMapsKey: "YOUR_AZURE_MAPS_SUBSCRIPTION_KEY"
};
```

1. リポジトリのルートでHTTPサーバーを起動します。

```powershell
python -m http.server 8000
```

1. ブラウザで `http://localhost:8000/route-app/` を開きます。

データファイルを`fetch`で取得するため、`file://`からは起動できません。`config.js`は`.gitignore`の対象です。実キーをGitへコミットしないでください。

## Azure Static Web Appsへデプロイ

このデモはビルド処理やバックエンドを必要としません。Bicepと手動デプロイスクリプトで、次のリソースを作成します。

- Resource Group
- Azure Static Web Apps Free
- Azure Maps Gen2 (G2)

前提として、Azure CLIとAzure Static Web Apps CLIをインストールし、リポジトリのルートでAzureへサインインします。

```powershell
az login
az account set --subscription <SUBSCRIPTION_ID>
```

次のコマンドで、変更内容の確認、Azureリソースの作成、静的ファイルの配置を順に実行します。

```powershell
.\scripts\deploy.ps1 -EnvironmentName demo
```

Resource Group、Static Web Apps、Azure Mapsの名前はサブスクリプション、リージョン、環境名から自動生成されます。既定のリージョンは`westus2`です。本番オリジンと`http://localhost:8000`がAzure MapsのCORSへ登録されます。ローカルオリジンを許可しない場合は`-ExcludeLocalhost`を指定してください。

スクリプトはAzure MapsキーとStatic Web Appsのデプロイトークンを取得し、一時ディレクトリ内だけに`config.js`を生成して配置します。GitHub ActionsやRepository secretsは使用しません。処理完了時にデプロイ先URLが表示されます。

サブスクリプションキーは配信後のブラウザーから確認できます。短期デモでは許可オリジンを本番URLへ限定し、Azure Mapsの使用量を監視して、デモ終了後にキーをローテーションしてください。一般公開または継続運用へ移行する場合は、共有キーではなく短期間のSASトークンまたはMicrosoft Entra IDとAzure RBACを使用してください。

## 操作

- 車両は起動時に自動で進行し、各車両の位置とETAが更新されます。
- 車両カードまたは地図上の車アイコンを選択すると、その車両へ地図が移動します。
- 「全体表示」で登録済みの全ルートを表示します。
- 車両は最終目的地で停止し、「配送完了」になります。

## ファイル構成

```text
infra/
  main.bicep             Resource Groupとモジュール配置
  route-app.bicep        Static Web AppsとAzure Maps
  main.parameters.json   環境別パラメーター
scripts/
  deploy.ps1             Azureリソース作成と静的ファイル配置
route-app/
  index.html            画面構造とAzure Maps Web SDKの読込
  css/styles.css        配送管制画面のレスポンシブスタイル
  js/app.js             データ検証、画面描画、アプリ統合
  js/geo.js             距離、ルート上位置、方位、ETA計算
  js/map.js             Azure Mapsのソース、レイヤー、カメラ制御
  js/simulation.js      車両速度と更新間隔から移動距離を求めるシミュレーター
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
| `speedMetersPerSecond` | 移動量とETA算出に使う速度。時速50kmは約13.89m/s |
| `cargo` | SKU、商品名、数量の配列 |

## シミュレーション仕様

- 更新間隔: 10秒
- 走行速度: 50km/h（約13.89m/s）
- 1回の移動距離: 約138.89m（速度 × 10秒）
- 次の目的地までの表示: ルート上の残距離を速度で割り、分単位で切り上げ
- 最終到着予想: 現在時刻へ最終地点までの所要秒数を加算
- 到着時: ルート終端へ位置を固定し、配送完了として停止

一定速度を前提とするため、信号待ち、荷下ろし、渋滞、交通規制はETAへ反映しません。実運用で想定するGPS収集、DB、バックエンド、認証、配送履歴の永続化はこのデモには含まれません。

## トラブルシューティング

- 地図が表示されない場合は、キー、Azure Mapsアカウントの状態、ブラウザの開発者コンソールを確認してください。
- 「HTTPサーバーが必要です」と表示された場合は、上記コマンドで配信して`localhost`から開いてください。
- データ読込エラーの場合はJSON構文、重複した`routeId`、存在しない車両の`routeId`、範囲外の`coordinateIndex`を確認してください。
- キーを公開リポジトリへコミットした場合は、Azure Portalでキーを直ちにローテーションしてください。
