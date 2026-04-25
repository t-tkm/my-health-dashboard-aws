// Amplify configuration.
// Values are injected via Vite environment variables (VITE_*).
// In Amplify Hosting, set these as environment variables in the console.
// For local dev, create a .env.local file:
//
//   VITE_USER_POOL_ID=ap-northeast-1_xxxxxxxx
//   VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxx
//   VITE_COGNITO_DOMAIN=https://health-dashboard-123456789.auth.ap-northeast-1.amazoncognito.com
//   VITE_API_ENDPOINT=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod

const userPoolId       = import.meta.env.VITE_USER_POOL_ID       as string;
const userPoolClientId = import.meta.env.VITE_USER_POOL_CLIENT_ID as string;
const cognitoDomain    = import.meta.env.VITE_COGNITO_DOMAIN      as string;
const apiEndpoint      = import.meta.env.VITE_API_ENDPOINT        as string;
const redirectUrl      = window.location.origin;

export const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId,
      userPoolClientId,
      loginWith: {
        oauth: {
          domain: cognitoDomain.replace('https://', ''),
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn:  [redirectUrl],
          redirectSignOut: [redirectUrl],
          responseType: 'code' as const,
        },
      },
    },
  },
};

export { apiEndpoint };
