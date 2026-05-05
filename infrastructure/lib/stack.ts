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

    // ------------------------------------------------------------------ Domain config
    // CUSTOM_DOMAIN=your-subdomain.your-domain.com で独自ドメインを指定する（必須）
    const customDomain = process.env.CUSTOM_DOMAIN;
    if (!customDomain) {
      throw new Error('環境変数 CUSTOM_DOMAIN を設定してください（例: your-subdomain.your-domain.com）');
    }
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

    const mainBranch = new amplify.CfnBranch(this, 'MainBranch', {
      appId: amplifyApp.attrAppId,
      branchName: 'main',
      enableAutoBuild: true,
    });

    // Cognito callback URLs: localhost + custom domain + Amplify default domain (if provided)
    const callbackUrls = ['http://localhost:5173', `https://${customDomain}`];

    // Optional: Custom domain — enable by setting CUSTOM_DOMAIN=<subdomain>.<rootdomain>
    // (e.g. CUSTOM_DOMAIN=your-subdomain.your-domain.com cdk deploy)
    // Requires manual CNAME records in the Route53 hosted zone (can be a different AWS account).
    if (customDomain) {
      const domainParts = customDomain.split('.');
      const prefix      = domainParts[0];
      const rootDomain  = domainParts.slice(1).join('.');
      const cfnDomain = new amplify.CfnDomain(this, 'AmplifyCustomDomain', {
        appId:    amplifyApp.attrAppId,
        domainName: rootDomain,
        subDomainSettings: [{ branchName: 'main', prefix }],
        enableAutoSubDomain: false,
      });
      cfnDomain.addDependency(mainBranch);
    }

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
      ALLOWED_ORIGINS: cdk.Fn.join(',', callbackUrls),
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

    // ------------------------------------------------------------------ Cognito auth triggers
    const fnPreAuth  = makeFn('PreAuth',  'lambda/auth_pre.handler',  'Cognito Pre-Authentication: log login attempts');
    const fnPostAuth = makeFn('PostAuth', 'lambda/auth_post.handler', 'Cognito Post-Authentication: log login successes');

    userPool.addTrigger(cognito.UserPoolOperation.PRE_AUTHENTICATION,  fnPreAuth);
    userPool.addTrigger(cognito.UserPoolOperation.POST_AUTHENTICATION, fnPostAuth);

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

    // ------------------------------------------------------------------ Lambda log groups (set retention on existing groups)
    // LogRetention uses a Custom Resource to update retention without recreating existing log groups.
    const lambdaNames = ['data', 'entry', 'export', 'importcsv', 'preauth', 'postauth'];
    lambdaNames.forEach(name =>
      new logs.LogRetention(this, `LambdaLogRetention-${name}`, {
        logGroupName: `/aws/lambda/health-dashboard-${name}`,
        retention: logs.RetentionDays.THREE_MONTHS,
      }),
    );

    // ------------------------------------------------------------------ CloudWatch Logs Insights saved queries
    new logs.QueryDefinition(this, 'QueryApiAccess', {
      queryDefinitionName: 'health-dashboard/api-access',
      logGroups: [apiAccessLogGroup],
      queryString: new logs.QueryString({
        fields: ['@timestamp', 'httpMethod', 'resourcePath', 'status', 'responseLength', 'ip'],
        filterStatements: ['status != 0'],
        sort: '@timestamp desc',
        limit: 200,
      }),
    });

    new logs.QueryDefinition(this, 'QueryLambdaAccess', {
      queryDefinitionName: 'health-dashboard/lambda-access',
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

    const authLogGroups = [
      logs.LogGroup.fromLogGroupName(this, 'LgAuthPre',  '/aws/lambda/health-dashboard-preauth'),
      logs.LogGroup.fromLogGroupName(this, 'LgAuthPost', '/aws/lambda/health-dashboard-postauth'),
    ];

    new logs.QueryDefinition(this, 'QueryAuthEvents', {
      queryDefinitionName: 'health-dashboard/auth-events',
      logGroups: authLogGroups,
      queryString: new logs.QueryString({
        fields: ['@timestamp', 'type', 'username', 'userId', 'email', 'newDeviceUsed'],
        sort: '@timestamp desc',
        limit: 200,
      }),
    });

    new logs.CfnQueryDefinition(this, 'QueryAuthAttemptStats', {
      name: 'health-dashboard/auth-attempt-stats',
      logGroupNames: [
        '/aws/lambda/health-dashboard-preauth',
        '/aws/lambda/health-dashboard-postauth',
      ],
      queryString: [
        'fields @timestamp, username, @log',
        '| filter type = "login_attempt" or type = "login_success"',
        '| stats count(*) as events by username, @log, bin(5m)',
        '| filter @log like "preauth"',
        '| sort bin desc',
      ].join('\n'),
    });

    new logs.QueryDefinition(this, 'QueryAuthSuccesses', {
      queryDefinitionName: 'health-dashboard/auth-successes',
      logGroups: [logs.LogGroup.fromLogGroupName(this, 'LgAuthPostSucc', '/aws/lambda/health-dashboard-postauth')],
      queryString: new logs.QueryString({
        fields: ['@timestamp', 'username', 'userId', 'email', 'newDeviceUsed'],
        filterStatements: ['type = "login_success"'],
        sort: '@timestamp desc',
        limit: 200,
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
      value: `https://${customDomain}`,
      description: 'Custom domain URL - accessible after DNS CNAME is set (see README)',
    });
    new cdk.CfnOutput(this, 'CustomDomainDnsSetup', {
      value: `Check Amplify console > Domain management for required CNAME records, then add to Route53`,
      description: `DNS setup required for custom domain (${customDomain}) - see README`,
    });
    new cdk.CfnOutput(this, 'ApiEndpoint',      { value: api.url,                        exportName: 'ApiEndpoint' });
    new cdk.CfnOutput(this, 'UserPoolId',       { value: userPool.userPoolId,             exportName: 'UserPoolId' });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId, exportName: 'UserPoolClientId' });
    new cdk.CfnOutput(this, 'CognitoDomain',    { value: cognitoDomainUrl,                exportName: 'CognitoDomain' });
    new cdk.CfnOutput(this, 'ApiAccessLogGroupName',  { value: apiAccessLogGroup.logGroupName,  description: 'API Gateway access log group' });
    new cdk.CfnOutput(this, 'LambdaLogGroupPrefix', { value: '/aws/lambda/health-dashboard-*', description: 'Lambda log group prefix (CloudWatch Logs)' });
    new cdk.CfnOutput(this, 'AmplifyAccessLogs', {
      value: `https://console.aws.amazon.com/amplify/home#/apps/${amplifyApp.attrAppId}/accesslogs`,
      description: 'Amplify access logs (download from Amplify console)',
    });
  }
}
