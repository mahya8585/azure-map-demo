# Azure Maps 統合デモ

東京駅を初期表示し、Azure Mapsの地図表示、検索、複数地点ルート、交通、天気、タイムゾーン、IP Geolocationを試す、ビルド不要のデモです。`map-demo.html`は直接開いて使う統合デモ、`http-demo.html`はHTTPオリジンが必要な現在地・ルート保存デモ、`route-app/`は5台の配送車両を自動追跡するデモです。

主なデモシナリオは次の4つです。

1. 複数の目的地を設定し、中間地点の訪問順とルートを最適化する
2. HTTP専用デモで、ルートをブラウザへ保存し、後から読み込んで再計算する
3. 高速道路、有料道路、フェリーの回避条件や、交通考慮の有無によるルートを比較する
4. 登録ルート上を走る配送車両の位置、積載SKU、次の配送先と到着予想を自動更新でリアルタイム表示する

## セットアップ

1. Azure PortalでAzure Mapsアカウントを作成します。
2. Azure Mapsアカウントの「認証」からPrimary Keyを取得します。
3. [map-demo.html](map-demo.html)と[http-demo.html](http-demo.html)を開き、両方の次の定数を取得したキーへ置き換えます。

```javascript
const AZURE_MAPS_KEY = "YOUR_AZURE_MAPS_SUBSCRIPTION_KEY";
```

### HTTPサーバーなしで実行

[map-demo.html](map-demo.html)をエクスプローラーから直接開きます。`file://`で、地図、検索、ルート、交通、天気、タイムゾーン、IP Geolocationを実行できます。

初期地点は東京駅です。地図にはズーム、方位、地図スタイル（道路、グレースケール、衛星画像と道路ラベル）のコントロールが表示されます。

### HTTP専用機能を実行

1. リポジトリのディレクトリで静的HTTPサーバーを起動します。

```powershell
python -m http.server 8000
```

1. ブラウザで `http://localhost:8000/http-demo.html` を開きます。

[http-demo.html](http-demo.html)は、現在地取得とオリジン単位のルート保存を安定して実演するページです。`file://`で開いた場合は機能を開始せず、HTTPサーバーが必要であることを表示します。本番相当の環境ではHTTPSを使用してください。

配送トラッキングデモは `http://localhost:8000/route-app/` で開きます。車両は起動時に自動で進行し、カード選択や全体表示で視点を切り替えられます。セットアップとデータ編集方法は[route-app/README.md](route-app/README.md)を参照してください。

> [!WARNING]
> この実装は説明用デモのため、サブスクリプションキーをHTMLへ記述します。HTMLを公開するとキーも閲覧可能になります。公開環境や本番環境では、Microsoft Entra ID、短期間のSASトークン、許可オリジン、またはサーバー側プロキシを使用してください。実キーをGitへコミットしないでください。

## デモ手順

### 複数地点と訪問順の最適化

1. 「検索」タブで施設名や住所を検索します。
2. 候補の「ルートへ追加」を押して、出発地を含め4地点以上にします。
3. 「ルート」タブで地点の矢印ボタンを使うと、手動でも順番を変更できます。
4. 「訪問順を最適化」を押します。
5. 出発地と終点は固定されたまま、中間地点がAzure Mapsの計算結果に従って並び替わります。

「サンプル地点」を押すと、東京駅、東京スカイツリー、東京タワー、羽田空港をすぐに読み込めます。

ルート計算は2地点以上、訪問順の最適化は出発地・終点と2つ以上の中間地点を含む4地点以上で実行できます。先頭の東京駅は移動・削除できません。検索結果を追加すると末尾が新しい終点になり、それまでの終点は中間地点になります。

### ルート条件の比較

1. 最適化方針から「最速」「最短」「距離・時間バランス」を選びます。
2. 「高速道路を回避」「有料道路を回避」「フェリーを回避」を必要に応じて選びます。
3. 「交通情報を考慮」で、最速ルートの`optimizeRoute`を`fastestWithTraffic`または`fastestWithoutTraffic`へ切り替えます。「最短」と「距離・時間バランス」では、それぞれ`shortest`と`short`を送信します。
4. 「ルート計算」を押し、ルート線、距離、所要時間、交通遅延を比較します。

`avoid`は「可能な限り回避する」条件です。道路網や到達可能性によっては、指定した種類の道路を完全には除外できない場合があります。

「交通レイヤー」は地図上の相対交通流とインシデントの表示だけを切り替え、Route APIの計算条件には影響しません。ルート線はRoute APIの形状を10メートル間隔の点へ補間し、Snap to Roads APIで道路へ合わせて表示します。補正に失敗した区間は、Route APIが返した元の形状で表示します。

### 地点情報

1. 地図をクリックするか、検索結果の「地点情報」を押して対象座標を選びます。
2. 「地点情報」タブで「天気・タイムゾーンを取得」を押します。
3. 「雨・雪レーダーを地図に表示」を選ぶと、現在の降水域を半透明のタイルレイヤーで確認できます。表示される凡例で、雨・雪・凍結性降水・混合降水の種別と強度を判別できます。
4. 現在天気、気温、体感温度、湿度、風、タイムゾーン、現地時刻、UTCオフセット、日の出・日の入りを確認します。
5. IP GeolocationではIPv4またはIPv6を入力し、ISO国・地域コードを取得します。

### ルートの保存

1. [http-demo.html](http-demo.html)を`localhost`またはHTTPSで開きます。
2. 東京観光または東京湾岸のサンプルルートを選びます。
3. 「ルートを表示」でRoute APIの計算結果を確認します。
4. 保存名を入力して「現在のルートを保存」を押します。
5. 保存一覧の「読込・再計算」で地点を復元します。
6. 不要な保存ルートは「削除」で消去します。

保存先はブラウザの`localStorage`です。保存するのは名前、保存日時、各地点の名前と座標であり、計算済みのルート線や距離・所要時間は保存しません。「読込・再計算」を押すと、保存地点からRoute APIを再実行します。同じ端末・ブラウザ・オリジンでのみ利用でき、Azureへは保存されません。新しいものから最大20件を保持します。

## 機能と実現方法

| 要件 | デモファイル | 実現箇所 | 使用技術 |
| --- | --- | --- | --- |
| Render | `map-demo.html` / `http-demo.html` | 東京駅中心のベースマップ、ズーム、方位。スタイル切替は`map-demo.html`のみ | Azure Maps Web SDK v3 |
| Search | `map-demo.html` | 施設名・住所の検索、地図中心による検索バイアス | Azure Maps Search REST API `2026-01-01` |
| Search結果描画 | `map-demo.html` | 検索マーカー、Popup、カメラ移動 | Azure Maps Web SDK v3の`DataSource`、`SymbolLayer`、`Popup` |
| Route | `map-demo.html` / `http-demo.html` | GeoJSON POSTによる運転ルート。計算条件の選択は`map-demo.html`、`http-demo.html`は常に交通考慮の最速 | Azure Maps Route REST API `2025-01-01` |
| 訪問順最適化 | `map-demo.html` | 出発地・終点を固定した中間地点の並べ替え | Route APIの`optimizeWaypointOrder=true`と`optimizedWaypoints` |
| 道路条件 | `map-demo.html` | 高速道路、有料道路、フェリーの回避 | Route APIの`avoid`配列（`limitedAccessHighways`、`tollRoads`、`ferries`） |
| ルート描画 | `map-demo.html` / `http-demo.html` | Route APIの`RoutePath`を線として描画 | Azure Maps Web SDK v3の`DataSource`、`LineLayer` |
| 道路形状への補正 | `map-demo.html` | ルート形状を10m間隔へ補間し、80kmまたは4,500点単位で分割して道路へスナップ。失敗時は元形状へフォールバック | Azure Maps Snap to Roads REST API `2025-01-01` |
| Traffic | `map-demo.html` | 地図上の交通流とインシデント | Azure Maps Web SDK v3の`Map.setTraffic` |
| Trafficを考慮した経路 | `map-demo.html` / `http-demo.html` | `fastestWithTraffic`による最速ルート。`map-demo.html`では`fastestWithoutTraffic`へ切替可能 | Route APIの`optimizeRoute` |
| Weather | `map-demo.html` | 現在天気、気温、体感温度、湿度、風 | Azure Maps Weather REST API `1.1` |
| Weatherレイヤー | `map-demo.html` | 現在の雨・雪レーダーを半透明表示 | Azure Maps Render REST API `2024-04-01`、Web SDK v3の`TileLayer` |
| Time Zone | `map-demo.html` | タイムゾーン、現地時刻、UTCオフセット、日の出・日の入り | Azure Maps Time Zone REST API `1.0` |
| IP Geolocation | `map-demo.html` | 入力IPのISO国・地域コード | Azure Maps Geolocation REST API `1.0` |
| 端末の現在地 | `http-demo.html` | 現在位置の取得と地図移動 | ブラウザ標準の`navigator.geolocation` |
| 地点編集 | `map-demo.html` | 追加、削除、手動並べ替え、役割表示 | 独自HTMLとJavaScript |
| ルート保存 | `http-demo.html` | 名前付き保存、読込、削除 | ブラウザ標準の`localStorage` |
| UIと結果整形 | 両方 | レスポンシブパネルとエラー表示。タブ、距離・時間・交通遅延の表示は`map-demo.html` | 独自HTML、CSS、JavaScript |

Azure Maps Geolocationは端末の緯度・経度を返すAPIではありません。このデモでは、Azure Maps GeolocationをIPの国・地域判定に使用し、端末の現在地はブラウザ標準APIで別に取得しています。

## コード参照元

検索体験と地図描画は、Microsoft公式の[Interactive Search Quickstart](https://github.com/Azure-Samples/AzureMapsCodeSamples/blob/main/Samples/Tutorials/Interactive%20Search/Interactive%20Search%20Quickstart.html)を参照しています。

参照元から次のパターンを踏襲しています。

- Azure Maps Web SDK v3による地図初期化
- 検索結果専用の`DataSource`と`SymbolLayer`
- 複数の検索結果で再利用する`Popup`
- 3文字以上の入力とデバウンスによる自動検索
- 地図の中心を使った検索結果の地理的バイアス
- 検索結果一覧、地図上のマーカー、Popup、カメラの相互連動

このデモでは要件と現行APIに合わせて次の点を変更しています。

- 参照元のServices Module v2 `searchPOI`ではなく、Search REST API `2026-01-01`を使用
- 参照元のSASトークンサービスではなく、デモ用サブスクリプションキーを使用
- `innerHTML`やインライン`onclick`を使わず、DOM APIと`addEventListener`で結果を描画
- 地図、APIリクエスト、操作UIを日本語向けに設定
- 検索結果を複数地点ルートと地点情報へ接続

## ファイル構成

```text
map-demo.html   file://で動くAzure Maps統合デモ
http-demo.html  localhostまたはHTTPSで動く現在地・ルート保存デモ
route-app/      localhostまたはHTTPSで動く配送トラッキングデモ
README.md       セットアップ、操作方法、実現方式の説明
TROUBLESHOOTING.md  エラーや動作上の問題に対する確認事項
```

ビルドツールやnpmパッケージは使用していません。Azure Maps Web SDK v3はMicrosoftのCDNから読み込みます。

## API呼び出しと課金

検索、ルート計算、Snap to Roads、天気、タイムゾーン、IP Geolocationは、それぞれAzure Maps REST APIへのリクエストです。検索入力は3文字以上で350ミリ秒のデバウンスを行い、前の検索リクエストを`AbortController`で中止します。検索ボタンまたはEnterキーでは1文字以上から検索できます。

`map-demo.html`のルート計算はRoute APIの後に、ルートの長さと区間数に応じてSnap to Roads APIを複数回呼ぶ場合があります。操作回数とルート形状に応じてAzure Mapsのトランザクションが発生するため、デモ実施時はAzure Mapsアカウントの価格レベル、クォータ、利用状況を確認してください。

## トラブルシューティング

エラーや動作上の問題については、[TROUBLESHOOTING.md](TROUBLESHOOTING.md)を参照してください。
