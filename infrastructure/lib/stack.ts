import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class HealthDashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('環境変数 GITHUB_TOKEN を設定してください（GitHub Personal Access Token）');
    }

    // ------------------------------------------------------------------ DynamoDB
    const table = new dynamodb.Table(this, 'HealthEntries', {
      tableName: 'health-entries',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'date',   type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ------------------------------------------------------------------ Amplify App
    // GitHub Token は cdk deploy 前に export GITHUB_TOKEN=<PAT> で設定する
    const amplifyApp = new amplify.CfnApp(this, 'AmplifyApp', {
      name: 'health-dashboard',
      repository: 'https://github.com/t-tkm/my-health-dashboard-aws',
      oauthToken: githubToken,
      buildSpec: [
        'version: 1',
        'frontend:',
        '  phases:',
        '    preBuild:',
        '      commands:',
        '        - npm ci',
        '    build:',
        '      commands:',
        '        - npm run build',
        '  artifacts:',
        '    baseDirectory: dist',
        '    files:',
        "      - '**/*'",
        '  cache:',
        '    paths:',
        "      - node_modules/**/*",
      ].join('\n'),
      customRules: [
        // SPA rewrite: serve index.html for all non-file routes
        {
          source: '</^[^.]+$|\\.((?!css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webmanifest).)([^.]+$)/>',
          target: '/index.html',
          status: '200',
        },
      ],
    });

    new amplify.CfnBranch(this, 'MainBranch', {
      appId: amplifyApp.attrAppId,
      branchName: 'main',
      enableAutoBuild: true,
    });

    // Amplify のデフォルトドメイン: main.<appId>.amplifyapp.com
    // ※ attrDefaultDomain を Cognito callbackUrls に使うと API GW → UserPoolClient → AmplifyApp →
    //   api.url → API GW の循環依存が発生するため、AMPLIFY_DOMAIN 環境変数で2ステップ更新する。
    //   Step1: cdk deploy（AMPLIFY_DOMAIN 未設定） → AmplifyAppUrl 出力を確認
    //   Step2: AMPLIFY_DOMAIN=<出力値> cdk deploy → callbackUrls に追加
    const amplifyDomain  = process.env.AMPLIFY_DOMAIN;
    const amplifyUrl     = amplifyDomain ? `https://${amplifyDomain}` : null;
    const callbackUrls   = ['http://localhost:5173', ...(amplifyUrl ? [amplifyUrl] : [])];

    // ------------------------------------------------------------------ Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'health-dashboard-users',
      // セルフサインアップを無効化（管理者のみがユーザーを作成できる）
      // Cognito コンソール → ユーザープール → サインアップエクスペリエンス で ON/OFF 可能。
      // ただし cdk deploy を実行すると、ここの設定値で上書きされる。
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Social IdP — OAuth credentials must be obtained from each provider's developer console.
    // Uncomment and fill in secrets after `cdk deploy` (initial deploy without IdPs first):
    //
    // const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'Google', {
    //   userPool,
    //   clientId: process.env.GOOGLE_CLIENT_ID!,
    //   clientSecretValue: cdk.SecretValue.unsafePlainText(process.env.GOOGLE_CLIENT_SECRET!),
    //   scopes: ['email', 'profile', 'openid'],
    //   attributeMapping: {
    //     email:      cognito.ProviderAttribute.GOOGLE_EMAIL,
    //     givenName:  cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
    //     familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
    //   },
    // });
    //
    // const facebookProvider = new cognito.UserPoolIdentityProviderFacebook(this, 'Facebook', {
    //   userPool,
    //   clientId: process.env.FACEBOOK_APP_ID!,
    //   clientSecret: process.env.FACEBOOK_APP_SECRET!,
    //   scopes: ['email', 'public_profile'],
    //   attributeMapping: { email: cognito.ProviderAttribute.FACEBOOK_EMAIL },
    // });
    //
    // const appleProvider = new cognito.UserPoolIdentityProviderApple(this, 'Apple', {
    //   userPool,
    //   clientId: process.env.APPLE_SERVICE_ID!,
    //   teamId: process.env.APPLE_TEAM_ID!,
    //   keyId: process.env.APPLE_KEY_ID!,
    //   privateKey: process.env.APPLE_PRIVATE_KEY!,
    //   scopes: ['email', 'name'],
    //   attributeMapping: { email: cognito.ProviderAttribute.APPLE_EMAIL },
    // });
    //
    // const amazonProvider = new cognito.UserPoolIdentityProviderAmazon(this, 'Amazon', {
    //   userPool,
    //   clientId: process.env.AMAZON_CLIENT_ID!,
    //   clientSecret: process.env.AMAZON_CLIENT_SECRET!,
    //   scopes: ['profile', 'postal_code'],
    //   attributeMapping: { email: cognito.ProviderAttribute.AMAZON_EMAIL },
    // });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: 'health-dashboard-web',
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls,
        logoutUrls: callbackUrls,
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        // cognito.UserPoolClientIdentityProvider.GOOGLE,
        // cognito.UserPoolClientIdentityProvider.FACEBOOK,
        // cognito.UserPoolClientIdentityProvider.APPLE,
        // cognito.UserPoolClientIdentityProvider.AMAZON,
      ],
      authFlows: { userSrp: true },
    });

    new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool,
      cognitoDomain: {
        domainPrefix: `health-dashboard-${this.account}`,
      },
    });

    // ------------------------------------------------------------------ Lambda
    const cognitoDomainUrl = `https://health-dashboard-${this.account}.auth.${this.region}.amazoncognito.com`;

    const lambdaEnv: Record<string, string> = {
      TABLE_NAME:      table.tableName,
      ALLOWED_ORIGINS: callbackUrls.join(','),
    };

    const backendDir = path.join(__dirname, '../../backend');

    const bundling: cdk.BundlingOptions = {
      image: lambda.Runtime.PYTHON_3_12.bundlingImage,
      platform: 'linux/arm64',  // ARM_64 Lambda 向けの wheels を取得するために必要
      command: [
        'bash', '-c',
        'pip install -r requirements.txt -t /asset-output && cp -r . /asset-output',
      ],
    };

    const makeFn = (id: string, handler: string, description: string) =>
      new lambda.Function(this, id, {
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambda.Architecture.ARM_64,
        code: lambda.Code.fromAsset(backendDir, { bundling }),
        handler,
        functionName: `health-dashboard-${id.toLowerCase()}`,
        description,
        timeout: cdk.Duration.seconds(30),
        environment: lambdaEnv,
      });

    const fnData   = makeFn('Data',      'lambda/data.handler',       'GET /api/data');
    const fnEntry  = makeFn('Entry',     'lambda/entry.handler',      'POST/DELETE /api/entry');
    const fnExport = makeFn('Export',    'lambda/export.handler',     'GET /api/export');
    const fnImport = makeFn('ImportCsv', 'lambda/import_csv.handler', 'POST /api/import');

    [fnData, fnEntry, fnExport, fnImport].forEach(fn => table.grantReadWriteData(fn));

    // ------------------------------------------------------------------ API Gateway access logs
    // API Gateway needs an account-level IAM role to write to CloudWatch Logs.
    const apiGwCwRole = new iam.Role(this, 'ApiGwCloudWatchRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs'),
      ],
    });
    new apigw.CfnAccount(this, 'ApiGwAccount', {
      cloudWatchRoleArn: apiGwCwRole.roleArn,
    });

    const apiAccessLogGroup = new logs.LogGroup(this, 'ApiAccessLogGroup', {
      logGroupName: '/aws/apigateway/health-dashboard-access',
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ------------------------------------------------------------------ Lambda log groups (explicit retention)
    const lambdaNames = ['data', 'entry', 'export', 'importcsv'];
    lambdaNames.forEach(name =>
      new logs.LogGroup(this, `LambdaLogGroup-${name}`, {
        logGroupName: `/aws/lambda/health-dashboard-${name}`,
        retention: logs.RetentionDays.THREE_MONTHS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    );

    // ------------------------------------------------------------------ CloudWatch Logs Insights saved queries
    new logs.QueryDefinition(this, 'QueryApiAccess', {
      queryDefinitionName: 'health-dashboard/api-access-summary',
      logGroups: [apiAccessLogGroup],
      queryString: new logs.QueryString({
        fields: ['@timestamp', 'httpMethod', 'resourcePath', 'status', 'responseLength', 'ip'],
        filterStatements: ['status != 0'],
        sort: '@timestamp desc',
        limit: 200,
      }),
    });

    new logs.QueryDefinition(this, 'QueryLambdaAccess', {
      queryDefinitionName: 'health-dashboard/lambda-access-log',
      logGroups: lambdaNames.map((_, i) =>
        logs.LogGroup.fromLogGroupName(this, `LgRef-${i}`, `/aws/lambda/health-dashboard-${lambdaNames[i]}`),
      ),
      queryString: new logs.QueryString({
        fields: ['@timestamp', 'method', 'path', 'userId', 'status', 'durationMs'],
        filterStatements: ['type = "access"'],
        sort: '@timestamp desc',
        limit: 200,
      }),
    });

    new logs.QueryDefinition(this, 'QueryLambdaErrors', {
      queryDefinitionName: 'health-dashboard/lambda-errors',
      logGroups: lambdaNames.map((_, i) =>
        logs.LogGroup.fromLogGroupName(this, `LgErrRef-${i}`, `/aws/lambda/health-dashboard-${lambdaNames[i]}`),
      ),
      queryString: new logs.QueryString({
        fields: ['@timestamp', 'method', 'path', 'userId', 'error', 'durationMs'],
        filterStatements: ['type = "error"'],
        sort: '@timestamp desc',
        limit: 100,
      }),
    });

    // ------------------------------------------------------------------ API Gateway
    const api = new apigw.RestApi(this, 'Api', {
      restApiName: 'health-dashboard-api',
      deployOptions: {
        accessLogDestination: new apigw.LogGroupLogDestination(apiAccessLogGroup),
        accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        metricsEnabled: true,
        loggingLevel: apigw.MethodLoggingLevel.ERROR,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [userPool],
    });

    const auth: apigw.MethodOptions = {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    };

    const apiRoot = api.root.addResource('api');
    apiRoot.addResource('data').addMethod('GET', new apigw.LambdaIntegration(fnData), auth);

    const entry = apiRoot.addResource('entry');
    entry.addMethod('POST',   new apigw.LambdaIntegration(fnEntry), auth);
    entry.addMethod('DELETE', new apigw.LambdaIntegration(fnEntry), auth);

    apiRoot.addResource('export').addMethod('GET',  new apigw.LambdaIntegration(fnExport), auth);
    apiRoot.addResource('import').addMethod('POST', new apigw.LambdaIntegration(fnImport), auth);

    // Amplify 環境変数を CDK outputs から自動設定（循環依存を避けるため AmplifyApp → Api の一方向のみ）
    amplifyApp.environmentVariables = [
      { name: 'VITE_USER_POOL_ID',       value: userPool.userPoolId },
      { name: 'VITE_USER_POOL_CLIENT_ID', value: userPoolClient.userPoolClientId },
      { name: 'VITE_COGNITO_DOMAIN',      value: cognitoDomainUrl },
      { name: 'VITE_API_ENDPOINT',        value: api.url },
    ];

    // ------------------------------------------------------------------ Outputs
    new cdk.CfnOutput(this, 'AmplifyAppUrl', {
      value: `https://main.${amplifyApp.attrDefaultDomain}`,
      description: 'Step2: export AMPLIFY_DOMAIN=main.<appId>.amplifyapp.com && cdk deploy',
    });
    new cdk.CfnOutput(this, 'ApiEndpoint',      { value: api.url,                        exportName: 'ApiEndpoint' });
    new cdk.CfnOutput(this, 'UserPoolId',       { value: userPool.userPoolId,             exportName: 'UserPoolId' });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId, exportName: 'UserPoolClientId' });
    new cdk.CfnOutput(this, 'CognitoDomain',    { value: cognitoDomainUrl,                exportName: 'CognitoDomain' });
    new cdk.CfnOutput(this, 'ApiAccessLogGroup',  { value: apiAccessLogGroup.logGroupName,  description: 'API Gateway access log group' });
    new cdk.CfnOutput(this, 'LambdaLogGroupPrefix', { value: '/aws/lambda/health-dashboard-*', description: 'Lambda log group prefix (CloudWatch Logs)' });
    new cdk.CfnOutput(this, 'AmplifyAccessLogs', {
      value: `https://console.aws.amazon.com/amplify/home#/apps/${amplifyApp.attrAppId}/accesslogs`,
      description: 'Amplify access logs (download from Amplify console)',
    });
  }
}
