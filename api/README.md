# AI comment API

GitHub PagesにOpenAI APIキーは置けないため、AIコメントは別のServerless/Workerで動かします。

## Cloudflare Workerで使う場合

1. Cloudflare Workersで新しいWorkerを作成する
2. `openai-comment-worker.js` の内容を貼り付ける
3. Workerの環境変数に `OPENAI_API_KEY` を設定する
4. 任意で `OPENAI_MODEL` を設定する。未設定なら `gpt-5-nano`
5. Workerをデプロイする
6. 公開されたWorker URLを、アプリのURLに `aiEndpoint` として付けて一度開く

例:

```text
https://takeru1123.github.io/drinking-log/?aiEndpoint=https%3A%2F%2Fexample.example.workers.dev
```

一度開くと、端末の `localStorage` に保存され、次回から通常URLでもAIコメントAPIを呼びます。

API通信に失敗した場合は、これまで通りローカルコメントを表示します。
