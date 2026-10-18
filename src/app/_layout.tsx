import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  // Adds more context data to events (IP address, cookies, user, etc.)
  sendDefaultPii: true,
  // Capture 100% of transactions in development, sample in production.
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  // Send logs to Sentry alongside errors.
  enableLogs: true,
  // Record 10% of sessions and 100% of sessions with errors.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration(),
  ],
});

function getPublishableKey() {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error('Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env file');
  }
  return key;
}

const publishableKey = getPublishableKey();

function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <Stack screenOptions={{ headerShown: false }} />
    </ClerkProvider>
  );
}

export default Sentry.wrap(RootLayout);
