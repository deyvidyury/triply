import { useClerk, useUser } from '@clerk/expo';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? darkPalette : lightPalette;
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const greetingName =
    user?.firstName ??
    user?.fullName ??
    user?.primaryEmailAddress?.emailAddress ??
    'there';

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <View
            style={[styles.brandDot, { backgroundColor: palette.accent }]}
          />
          <Text style={[styles.brand, { color: palette.text }]}>Triply</Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          {!isLoaded ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <>
              <Text style={[styles.title, { color: palette.text }]}>
                Welcome, {greetingName}
              </Text>
              <Text style={[styles.subtitle, { color: palette.subtle }]}>
                You are signed in. This screen is protected by the Clerk session
                guard.
              </Text>
              <Text style={[styles.meta, { color: palette.placeholder }]}>
                User ID: {user?.id}
              </Text>
            </>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          style={({ pressed }) => [
            styles.signOutButton,
            { borderColor: palette.border, backgroundColor: palette.card },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.signOutText, { color: palette.text }]}>
            Sign out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const lightPalette = {
  background: '#EEF3F8',
  card: '#FFFFFF',
  text: '#101828',
  subtle: '#5A6472',
  border: '#D8E0EA',
  placeholder: '#8792A2',
  accent: '#208AEF',
};

const darkPalette = {
  background: '#080D16',
  card: '#111A28',
  text: '#F4F7FB',
  subtle: '#A2ADBD',
  border: '#233044',
  placeholder: '#728096',
  accent: '#5AA9F7',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: 20,
    justifyContent: 'center',
    gap: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  brand: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 24,
    gap: 10,
    minHeight: 160,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  meta: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  signOutButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
