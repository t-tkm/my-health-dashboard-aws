# Code Quality Assessment

## Test Coverage

- **Overall**: Poor / None（テストコードは存在しない）
- **Unit Tests**: なし（pytest / Jest 未導入）
- **Integration Tests**: なし
- **E2E Tests**: なし

## Code Quality Indicators

- **Linting**: 未設定（ESLint / Ruff / flake8 等の設定ファイルなし）
- **Code Style**: 概ね一貫。Python は標準的な PEP8 スタイル。TypeScript は関数コンポーネント + カスタムフックパターンを一貫して採用。
- **Documentation**: Fair（README / ARCHITECTURE.md が充実しているが、コードコメントは最小限）

## Technical Debt

1. **テストゼロ**: pytest / Jest のどちらも未導入。Lambda ハンドラー・data_processor.py・React コンポーネントいずれもテストなし。保守リスク高。
2. **amplify.yml の二重管理**: `amplify.yml`（リポジトリルート）と `infrastructure/lib/stack.ts` の `buildSpec` 文字列が同じ内容を二重管理している。どちらを正とするか明確でない。
3. **pandas/numpy 依存**: `compute()` が pandas に強く依存しており、Lambda Layer 化や軽量化が難しい。DynamoDB 無料枠の制約下では問題ないが、大規模データ時にタイムアウト（30秒）リスクがある。
4. **CORS allowOrigins: \***: API Gateway の CORS 設定が `allowOrigins: Cors.ALL_ORIGINS`。個人利用では問題ないが、将来的に複数ユーザー展開する場合はオリジン制限を検討すべき。
5. **Linter 未設定**: ESLint・Ruff・型チェック等の自動静的解析が CI に組み込まれていない。
6. **CDK の removalPolicy: DESTROY**: DynamoDB と Cognito の `removalPolicy` が `DESTROY`。誤ってスタックを削除するとデータが全損する。本番環境では `RETAIN` に変更を検討。
7. **SNS IdP がコメントアウト**: Google / Apple / Facebook / Amazon の IdP 設定がコメントアウト状態。有効化手順は README に記載あるが、コード上で明示的なフラグ管理がない。

## Patterns and Anti-patterns

### Good Patterns
- **Single Table Design（DynamoDB）**: userId をパーティションキー、date をソートキーとするシンプルな設計でマルチユーザーを実現。
- **Custom Hook（useHealthData）**: API 通信・ローディング・エラー状態を単一カスタムフックに集約し、コンポーネントを薄く保持。
- **data_processor の集約**: DynamoDB の CRUD と集計ロジック（compute）を1ファイルに集め、全 Lambda ハンドラーから再利用。
- **Target Carry-Forward**: 目安値（cal_target 等）を前日から自動引き継ぐことで UX を向上。
- **ARM_64 Lambda**: Apple Silicon 開発環境と Lambda 実行環境を ARM_64 に揃え、Docker ビルドのクロスコンパイル問題を回避。
- **IaC（CDK）**: 全 AWS リソースを CDK で管理し、再現性・構成変更の追跡を確保。

### Anti-patterns
- **テストなし**: ビジネスロジック（compute / put_entry / filterData 等）への単体テスト欠如。リグレッション検知ができない。
- **amplify.yml 二重管理**: ビルド設定が `amplify.yml` と `stack.ts:buildSpec` の2ヶ所に存在し、不整合のリスクがある。
- **Linter CI なし**: コード品質チェックが開発者の手動確認に依存。

## Security Observations

- Cognito JWT Authorizer による API 保護は適切に実装されている。
- userId が Cognito sub（UUID）に紐付いており、ユーザー間のデータ分離は正しく設計されている。
- セルフサインアップが無効（`selfSignUpEnabled: false`）で管理者管理のユーザーのみ利用可能。
- `.env.local` は `.gitignore` で除外されており、シークレットのコミットリスクは低い。
- CORS の `allowOrigins: *` は改善余地あり（個人利用であれば許容範囲）。
