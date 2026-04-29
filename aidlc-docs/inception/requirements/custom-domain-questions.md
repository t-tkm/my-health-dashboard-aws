# Custom Domain Feature — Clarifying Questions

カスタムドメインのオプション機能追加について確認します。
各質問の `[Answer]:` タグの後に選択肢の文字を記入してください。

---

## Question 1
カスタムドメインはどのように有効化しますか？

A) 環境変数（例: `CUSTOM_DOMAIN=your-subdomain.your-domain.com cdk deploy`）で有効化
B) CDK context パラメーター（`cdk deploy -c customDomain=your-subdomain.your-domain.com`）で有効化
C) `cdk.json` の設定値として定義（コードに直接埋め込む）
D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 2
カスタムドメイン有効化時、Cognito の callbackUrls はどう扱いますか？

A) カスタムドメイン URL のみを使用（Amplify デフォルトドメインを callbackUrls から除外）
B) カスタムドメイン URL と Amplify デフォルトドメイン URL の両方を callbackUrls に含める
C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 3
デプロイ後の DNS 設定手順はどう案内しますか？

A) `cdk deploy` の Outputs に CNAME レコード追加手順の説明を表示する
B) README や別ドキュメントに手順を記載する
C) CDK Output に Amplify コンソールの URL を出力し、そこから確認する
D) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 4 (Extensions)
このフィーチャーにセキュリティ拡張ルールを適用しますか？

A) Yes — セキュリティルールをブロッキング制約として適用（本番グレードの場合推奨）
B) No — セキュリティルールをスキップ（PoC・プロトタイプ向け）
C) Other (please describe after [Answer]: tag below)

[Answer]: A
