# Dependencies

ライブラリのバージョン・用途詳細は [technology-stack.md](technology-stack.md) を参照。
本ファイルは**依存関係グラフ**（内部構造・AWSサービス間）を管理する。

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
src/App.tsx          -> useHealthData, apiFetch, filterData, types, components
src/useHealthData.ts -> apiFetch, types
src/apiFetch         -> aws-config.ts

backend/lambda/data.py       -> data_processor.py, common.py
backend/lambda/entry.py      -> data_processor.py, common.py
backend/lambda/export.py     -> data_processor.py, common.py
backend/lambda/import_csv.py -> data_processor.py, common.py

infrastructure/bin/app.ts -> infrastructure/lib/stack.ts
```

**data_processor.py**: 全 Lambda から参照。DynamoDB CRUD + HealthData 集計ロジックの一元化。  
**common.py**: 全 Lambda から参照。CORS・認証ユーティリティの共通化。

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
API Gateway     -> Cognito (JWT 検証)
API Gateway     -> Lambda x4 (invoke)
Lambda x4       -> DynamoDB (boto3 SDK)
CDK Stack       -> Amplify (VITE_* 環境変数注入)
```

**注意**: Amplify URL が CDK デプロイ前に不明なため、Cognito callbackUrls への追加は2ステップデプロイが必要（循環依存回避）。
