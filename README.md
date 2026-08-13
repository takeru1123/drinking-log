# drinking-log

飲んだお酒を1タップで記録し、飲み過ぎ方向には煽らずに短いコメントを返すスマホ向けWebアプリです。

## V0.1 の内容

- 6種類のお酒ボタンと水ボタン
- 1タップで酒種と時刻を記録
- 水は履歴に残るが合計杯数には含めない
- 合計杯数、開始時刻、経過時間を表示
- 前回のお酒からの経過時間を表示
- 水を飲んだ回数を表示
- 酒種別杯数を表示
- 新しい順の履歴表示
- 飲み会終了時に過去ログとして保存
- 過去ログで杯数、水の回数、内訳を確認
- ブラウザの `localStorage` に保存
- 直前の記録を5秒間Undo可能
- OpenAI APIなしで動くローカルコメント
- Serverless/Worker経由のAIコメントAPIに対応

## 使い方

`index.html` をブラウザで開くと動きます。スマホで試す場合はGitHub Pagesなどの静的ホスティングに配置してください。

## GitHub Pages 公開手順

1. GitHubで `takeru1123/drinking-log` リポジトリを作成する
2. このフォルダの内容をリポジトリへPushする
3. GitHubの `Settings` → `Pages` を開く
4. `Build and deployment` のSourceを `Deploy from a branch` にする
5. Branchを `main`、フォルダを `/root` にして保存する

公開URLの例:

```text
https://takeru1123.github.io/drinking-log/
```

## AI API 追加時の注意

OpenAI APIキーはブラウザ側のJavaScriptに直接埋め込まないでください。本番でAIコメントを使う場合は、ブラウザから自前のバックエンドまたはServerless Functionへ送信し、サーバー側の環境変数でAPIキーを管理します。

記録処理は、必ず以下の順序を守ります。

1. お酒ボタンをタップ
2. 端末へ飲酒記録を保存
3. 画面更新
4. AIへコメント要求
5. コメントを表示

AI通信に失敗しても、飲酒記録は失われない設計にします。

## AIコメントAPI

`api/openai-comment-worker.js` にCloudflare Worker用のサンプルがあります。OpenAI APIキーはWorker側の環境変数 `OPENAI_API_KEY` に設定します。

GitHub Pages側にはAPIキーを置きません。
