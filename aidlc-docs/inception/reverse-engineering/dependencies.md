# Dependencies

## Internal Dependencies

```mermaid
graph TD
    subgraph Frontend["フロントエンド (src/)"]
        App["App.tsx"]
        useHealthData["useHealthData.ts"]
        apiFetch["apiFetch()"]
        filterData["filterData.ts"]
        types["types.ts (HealthData)"]
        awsConfig["aws-config.ts"]
        components["Components\n(StatCard/WeightChart/etc)"]
    end

    subgraph Backend["バックエンド (backend/)"]
        data_py["lambda/data.py"]
        entry_py["lambda/entry.py"]
        export_py["lambda/export.py"]
        import_py["lambda/import_csv.py"]
        data_processor["data_processor.py"]
        common["common.py"]
    end

    subgraph Infra["インフラ (infrastructure/)"]
        stack["lib/stack.ts"]
        appTs["bin/app.ts"]
    end

    App --> useHealthData
    App --> apiFetch
    App --> filterData
    App --> types
    App --> components
    useHealthData --> apiFetch
    useHealthData --> types
    apiFetch --> awsConfig

    data_py --> data_processor
    data_py --> common
    entry_py --> data_processor
    entry_py --> common
    export_py --> data_processor
    export_py --> common
    import_py --> data_processor
    import_py --> common

    appTs --> stack
```

Text Alternative:
```
src/App.tsx -> useHealthData, apiFetch, filterData, types, components
src/hooks/useHealthData.ts -> apiFetch, types
src/utils/apiFetch -> aws-config.ts

backend/lambda/data.py -> data_processor.py, common.py
backend/lambda/entry.py -> data_processor.py, common.py
backend/lambda/export.py -> data_processor.py, common.py
backend/lambda/import_csv.py -> data_processor.py, common.py

infrastructure/bin/app.ts -> infrastructure/lib/stack.ts
```

### data_processor.py は backend/ 配下の全 Lambda から参照
- **Type**: Compile-time (Python import)
- **Reason**: DynamoDB CRUD と HealthData 集計ロジックを一元化

### common.py は backend/ 配下の全 Lambda から参照
- **Type**: Compile-time (Python import)
- **Reason**: CORS・認証ユーティリティの共通化

## External Dependencies

### フロントエンド

| ライブラリ | バージョン | 目的 | ライセンス |
|---|---|---|---|
| react | ^18.3.1 | UI フレームワーク | MIT |
| react-dom | ^18.3.1 | DOM レンダリング | MIT |
| aws-amplify | ^6.14 | Cognito 認証 + API クライアント | Apache-2.0 |
| @aws-amplify/ui-react | ^6.6 | Authenticator UI コンポーネント | Apache-2.0 |
| recharts | ^2.13.3 | グラフライブラリ | MIT |
| vite | ^6.0.1 | ビルドツール (devDependency) | MIT |
| typescript | ^5.6.3 | 型チェック (devDependency) | Apache-2.0 |
| @vitejs/plugin-react | ^4.3.3 | Vite React プラグイン (devDependency) | MIT |

### バックエンド (Lambda)

| ライブラリ | バージョン | 目的 | ライセンス |
|---|---|---|---|
| boto3 | >=1.35 | AWS SDK for Python (DynamoDB アクセス) | Apache-2.0 |
| pandas | >=2.2 | データフレーム処理・CSV パース・線形回帰 | BSD-3-Clause |
| numpy | >=2.0 | 数値計算（polyfit・rolling 計算） | BSD-3-Clause |

**注意**: pandas / numpy は C 拡張を含むため、CDK デプロイ時に Docker（SAM ビルドイメージ）でビルドする必要がある。Lambda アーキテクチャが ARM_64 のため Apple Silicon Mac 上で直接ビルド可能。

### インフラ (CDK)

| ライブラリ | バージョン | 目的 | ライセンス |
|---|---|---|---|
| aws-cdk-lib | (latest) | CDK コンストラクトライブラリ | Apache-2.0 |
| constructs | (latest) | CDK Construct ベースクラス | Apache-2.0 |

## AWS サービス依存関係

```mermaid
graph LR
    Amplify["Amplify Hosting"] -->|"callbackUrl 参照"| Cognito["Cognito User Pool"]
    APIGW["API Gateway"] -->|"JWT 検証"| Cognito
    Lambda["Lambda x4"] -->|"DynamoDB SDK"| DynamoDB["DynamoDB"]
    APIGW -->|"Lambda invoke"| Lambda
    CDK["CDK Stack"] -->|"環境変数注入"| Amplify
```

Text Alternative:
```
Amplify Hosting -> Cognito (callbackUrl)
API Gateway -> Cognito (JWT検証)
API Gateway -> Lambda x4 (invoke)
Lambda x4 -> DynamoDB (SDK)
CDK -> Amplify (VITE_* 環境変数注入)
```

**注意事項**: Amplify URL が CDK デプロイ前は不明なため、Cognito callbackUrls への追加は2ステップデプロイが必要（循環依存回避）。
