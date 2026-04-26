import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as amplify from 'aws-cdk-lib/aws-amplify';
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
    });

    new amplify.CfnBranch(this, 'MainBranch', {
      appId: amplifyApp.attrAppId,
      branchName: 'main',
      enableAutoBuild: true,
    });

    // Amplify のデフォルトドメイン: main.<appId>.amplifyapp.com
    const amplifyUrl = `https://main.${amplifyApp.attrDefaultDomain}`;

    // ------------------------------------------------------------------ Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'health-dashboard-users',
      selfSignUpEnabled: true,
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
        callbackUrls: ['http://localhost:5173', amplifyUrl],
        logoutUrls:   ['http://localhost:5173', amplifyUrl],
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
      ALLOWED_ORIGINS: ['http://localhost:5173', amplifyUrl].join(','),
    };

    const backendDir = path.join(__dirname, '../../backend');

    const bundling: cdk.BundlingOptions = {
      image: lambda.Runtime.PYTHON_3_12.bundlingImage,
      command: [
        'bash', '-c',
        'pip install -r requirements.txt -t /asset-output && cp -r . /asset-output',
      ],
    };

    const makeFn = (id: string, handler: string, description: string) =>
      new lambda.Function(this, id, {
        runtime: lambda.Runtime.PYTHON_3_12,
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

    // ------------------------------------------------------------------ API Gateway
    const api = new apigw.RestApi(this, 'Api', {
      restApiName: 'health-dashboard-api',
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
        allowCredentials: true,
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

    // ------------------------------------------------------------------ Amplify 環境変数（CDK outputs を参照）
    amplifyApp.environmentVariables = [
      { name: 'VITE_USER_POOL_ID',       value: userPool.userPoolId },
      { name: 'VITE_USER_POOL_CLIENT_ID', value: userPoolClient.userPoolClientId },
      { name: 'VITE_COGNITO_DOMAIN',      value: cognitoDomainUrl },
      { name: 'VITE_API_ENDPOINT',        value: api.url },
    ];

    // ------------------------------------------------------------------ Outputs
    new cdk.CfnOutput(this, 'AmplifyAppUrl',    { value: amplifyUrl });
    new cdk.CfnOutput(this, 'ApiEndpoint',      { value: api.url,                        exportName: 'ApiEndpoint' });
    new cdk.CfnOutput(this, 'UserPoolId',       { value: userPool.userPoolId,             exportName: 'UserPoolId' });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId, exportName: 'UserPoolClientId' });
    new cdk.CfnOutput(this, 'CognitoDomain',    { value: cognitoDomainUrl,                exportName: 'CognitoDomain' });
  }
}
