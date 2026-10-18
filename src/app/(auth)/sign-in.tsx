import { useSignIn, useSignUp } from '@clerk/expo';
import type { SetActiveNavigate } from '@clerk/expo/types';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Step = 'credentials' | 'verify-email' | 'second-factor';

const MIN_PASSWORD_LENGTH = 15;

type SecondFactor = 'email_code' | 'phone_code' | 'totp' | 'backup_code';

type ClerkLikeError = {
  code?: string;
  message?: string;
  longMessage?: string;
  errors?: { code?: string; message?: string; longMessage?: string }[];
};

function firstClerkError(error: unknown) {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as ClerkLikeError;
  return candidate.errors?.[0] ?? candidate;
}

const navigateAfterAuth: SetActiveNavigate = ({ decorateUrl }) => {
  const url = decorateUrl('/');

  if (Platform.OS === 'web') {
    if (url.startsWith('http')) {
      window.location.href = url;
      return;
    }
    router.replace('/');
    return;
  }

  router.replace('/');
};

export default function SignInScreen() {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? darkPalette : lightPalette;

  const {
    signIn,
    errors: signInErrors,
    fetchStatus: signInStatus,
  } = useSignIn();
  const {
    signUp,
    errors: signUpErrors,
    fetchStatus: signUpStatus,
  } = useSignUp();

  const [step, setStep] = useState<Step>('credentials');
  const [secondFactor, setSecondFactor] = useState<SecondFactor>('email_code');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isBusy = signInStatus === 'fetching' || signUpStatus === 'fetching';
  const passwordTooShort =
    password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const canSubmitCredentials =
    email.trim().length > 0 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    !isBusy;
  const canSubmitCode = code.trim().length > 0 && !isBusy;

  const applyError = (error: unknown) => {
    const parsed = firstClerkError(error);
    setMessage(
      parsed?.longMessage ??
        parsed?.message ??
        'Something went wrong. Try again.',
    );
  };

  const finishSignIn = async () => {
    const { error } = await signIn.finalize({ navigate: navigateAfterAuth });
    if (error) applyError(error);
  };

  const prepareSecondFactor = async () => {
    const factors = signIn.supportedSecondFactors ?? [];
    const emailCode = factors.find(
      (factor) => factor.strategy === 'email_code',
    );
    const phoneCode = factors.find(
      (factor) => factor.strategy === 'phone_code',
    );
    const totp = factors.find((factor) => factor.strategy === 'totp');
    const backupCode = factors.find(
      (factor) => factor.strategy === 'backup_code',
    );

    if (emailCode) {
      const { error } = await signIn.mfa.sendEmailCode();
      if (error) {
        applyError(error);
        return;
      }
      setSecondFactor('email_code');
      setNotice('We sent a verification code to your email.');
      setStep('second-factor');
      return;
    }

    if (phoneCode) {
      const { error } = await signIn.mfa.sendPhoneCode();
      if (error) {
        applyError(error);
        return;
      }
      setSecondFactor('phone_code');
      setNotice('We sent a verification code to your phone.');
      setStep('second-factor');
      return;
    }

    if (totp) {
      setSecondFactor('totp');
      setNotice('Enter the code from your authenticator app.');
      setStep('second-factor');
      return;
    }

    if (backupCode) {
      setSecondFactor('backup_code');
      setNotice('Enter one of your backup codes.');
      setStep('second-factor');
      return;
    }

    setMessage(
      'This account needs a verification method that is not supported yet.',
    );
  };

  const handleCredentials = async () => {
    setMessage(null);
    setNotice(null);

    const identifier = email.trim();
    const signInResult = await signIn.password({ identifier, password });

    if (signInResult.error) {
      const errorCode = firstClerkError(signInResult.error)?.code;

      if (errorCode !== 'form_identifier_not_found') {
        applyError(signInResult.error);
        return;
      }

      const signUpResult = await signUp.password({
        emailAddress: identifier,
        password,
      });
      if (signUpResult.error) {
        applyError(signUpResult.error);
        return;
      }

      if (signUp.status === 'complete') {
        const { error } = await signUp.finalize({
          navigate: navigateAfterAuth,
        });
        if (error) applyError(error);
        return;
      }

      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        applyError(sendError);
        return;
      }

      setNotice(`We sent a verification code to ${identifier}.`);
      setStep('verify-email');
      return;
    }

    if (signIn.status === 'complete') {
      await finishSignIn();
      return;
    }

    if (
      signIn.status === 'needs_second_factor' ||
      signIn.status === 'needs_client_trust'
    ) {
      await prepareSecondFactor();
      return;
    }

    setMessage(
      'This account needs another sign-in step that is not supported yet.',
    );
  };

  const handleVerifyEmail = async () => {
    setMessage(null);

    const { error } = await signUp.verifications.verifyEmailCode({
      code: code.trim(),
    });
    if (error) {
      applyError(error);
      return;
    }

    if (signUp.status === 'complete') {
      const { error: finalizeError } = await signUp.finalize({
        navigate: navigateAfterAuth,
      });
      if (finalizeError) applyError(finalizeError);
      return;
    }

    setMessage(
      'Your email is verified, but this account still needs more information.',
    );
  };

  const handleVerifySecondFactor = async () => {
    setMessage(null);
    const value = code.trim();

    const result =
      secondFactor === 'email_code'
        ? await signIn.mfa.verifyEmailCode({ code: value })
        : secondFactor === 'phone_code'
          ? await signIn.mfa.verifyPhoneCode({ code: value })
          : secondFactor === 'totp'
            ? await signIn.mfa.verifyTOTP({ code: value })
            : await signIn.mfa.verifyBackupCode({ code: value });

    if (result.error) {
      applyError(result.error);
      return;
    }

    if (signIn.status === 'complete') {
      await finishSignIn();
      return;
    }

    setMessage(
      'That code was accepted, but the sign-in still needs another step.',
    );
  };

  const handleResend = async () => {
    setMessage(null);

    const result =
      step === 'verify-email'
        ? await signUp.verifications.sendEmailCode()
        : secondFactor === 'email_code'
          ? await signIn.mfa.sendEmailCode()
          : await signIn.mfa.sendPhoneCode();

    if (result.error) {
      applyError(result.error);
      return;
    }

    setNotice('A new code is on its way.');
  };

  const handleStartOver = async () => {
    await signIn.reset();
    await signUp.reset();
    setCode('');
    setNotice(null);
    setMessage(null);
    setStep('credentials');
  };

  const fieldErrors =
    step === 'credentials'
      ? {
          identifier:
            signInErrors.fields.identifier ?? signUpErrors.fields.emailAddress,
          password:
            signInErrors.fields.password ?? signUpErrors.fields.password,
        }
      : {
          identifier: null,
          password: null,
        };

  const codeError =
    step === 'verify-email'
      ? (signUpErrors.fields.code ?? signUpErrors.fields.captcha)
      : (signInErrors.fields.code ?? signInErrors.fields.identifier);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.brandRow}>
              <View
                style={[styles.brandDot, { backgroundColor: palette.accent }]}
              />
              <Text style={[styles.brand, { color: palette.text }]}>
                Triply
              </Text>
            </View>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                },
              ]}
            >
              {step === 'credentials' ? (
                <>
                  <Text style={[styles.title, { color: palette.text }]}>
                    Sign in or create an account
                  </Text>
                  <Text style={[styles.subtitle, { color: palette.subtle }]}>
                    Enter your email and password. If you are new, we will
                    create your account.
                  </Text>

                  <Text style={[styles.label, { color: palette.subtle }]}>
                    Email
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.input,
                        borderColor: fieldErrors.identifier
                          ? palette.danger
                          : palette.border,
                        color: palette.text,
                      },
                    ]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={palette.placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    inputMode="email"
                    editable={!isBusy}
                  />
                  {fieldErrors.identifier ? (
                    <Text
                      style={[styles.fieldError, { color: palette.danger }]}
                    >
                      {fieldErrors.identifier.message}
                    </Text>
                  ) : null}

                  <Text style={[styles.label, { color: palette.subtle }]}>
                    Password
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.input,
                        borderColor: fieldErrors.password
                          ? palette.danger
                          : palette.border,
                        color: palette.text,
                      },
                    ]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Your password"
                    placeholderTextColor={palette.placeholder}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    textContentType="password"
                    editable={!isBusy}
                    onSubmitEditing={() => {
                      if (canSubmitCredentials) void handleCredentials();
                    }}
                  />
                  {fieldErrors.password ? (
                    <Text
                      style={[styles.fieldError, { color: palette.danger }]}
                    >
                      {fieldErrors.password.message}
                    </Text>
                  ) : (
                    <Text style={[styles.hint, { color: palette.placeholder }]}>
                      {passwordTooShort
                        ? `${MIN_PASSWORD_LENGTH - password.length} more characters needed`
                        : `At least ${MIN_PASSWORD_LENGTH} characters`}
                    </Text>
                  )}

                  <Pressable
                    accessibilityRole="button"
                    disabled={!canSubmitCredentials}
                    onPress={() => void handleCredentials()}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: palette.accent },
                      (!canSubmitCredentials || pressed) && styles.buttonDimmed,
                    ]}
                  >
                    {isBusy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.buttonText}>Continue</Text>
                    )}
                  </Pressable>

                  <View nativeID="clerk-captcha" />
                </>
              ) : null}

              {step === 'verify-email' ? (
                <>
                  <Text style={[styles.title, { color: palette.text }]}>
                    Check your email
                  </Text>
                  <Text style={[styles.subtitle, { color: palette.subtle }]}>
                    Enter the verification code we sent to {email.trim()}.
                  </Text>

                  <Text style={[styles.label, { color: palette.subtle }]}>
                    Verification code
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.input,
                        borderColor: codeError
                          ? palette.danger
                          : palette.border,
                        color: palette.text,
                      },
                    ]}
                    value={code}
                    onChangeText={setCode}
                    placeholder="123456"
                    placeholderTextColor={palette.placeholder}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    editable={!isBusy}
                    onSubmitEditing={() => {
                      if (canSubmitCode) void handleVerifyEmail();
                    }}
                  />
                  {codeError ? (
                    <Text
                      style={[styles.fieldError, { color: palette.danger }]}
                    >
                      {codeError.message}
                    </Text>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    disabled={!canSubmitCode}
                    onPress={() => void handleVerifyEmail()}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: palette.accent },
                      (!canSubmitCode || pressed) && styles.buttonDimmed,
                    ]}
                  >
                    {isBusy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.buttonText}>Verify email</Text>
                    )}
                  </Pressable>

                  <View style={styles.linkRow}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isBusy}
                      onPress={() => void handleResend()}
                    >
                      <Text style={[styles.link, { color: palette.accent }]}>
                        Resend code
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isBusy}
                      onPress={() => void handleStartOver()}
                    >
                      <Text style={[styles.link, { color: palette.subtle }]}>
                        Use a different email
                      </Text>
                    </Pressable>
                  </View>

                  <View nativeID="clerk-captcha" />
                </>
              ) : null}

              {step === 'second-factor' ? (
                <>
                  <Text style={[styles.title, { color: palette.text }]}>
                    Verify it is you
                  </Text>
                  <Text style={[styles.subtitle, { color: palette.subtle }]}>
                    {secondFactor === 'totp'
                      ? 'Enter the code from your authenticator app.'
                      : secondFactor === 'backup_code'
                        ? 'Enter one of your backup codes.'
                        : 'Enter the verification code we just sent you.'}
                  </Text>

                  <Text style={[styles.label, { color: palette.subtle }]}>
                    Code
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.input,
                        borderColor: codeError
                          ? palette.danger
                          : palette.border,
                        color: palette.text,
                      },
                    ]}
                    value={code}
                    onChangeText={setCode}
                    placeholder={
                      secondFactor === 'backup_code' ? 'Backup code' : '123456'
                    }
                    placeholderTextColor={palette.placeholder}
                    keyboardType={
                      secondFactor === 'backup_code' ? 'default' : 'number-pad'
                    }
                    autoCapitalize="none"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    editable={!isBusy}
                    onSubmitEditing={() => {
                      if (canSubmitCode) void handleVerifySecondFactor();
                    }}
                  />
                  {codeError ? (
                    <Text
                      style={[styles.fieldError, { color: palette.danger }]}
                    >
                      {codeError.message}
                    </Text>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    disabled={!canSubmitCode}
                    onPress={() => void handleVerifySecondFactor()}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: palette.accent },
                      (!canSubmitCode || pressed) && styles.buttonDimmed,
                    ]}
                  >
                    {isBusy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.buttonText}>Verify</Text>
                    )}
                  </Pressable>

                  <View style={styles.linkRow}>
                    {secondFactor === 'email_code' ||
                    secondFactor === 'phone_code' ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => void handleResend()}
                      >
                        <Text style={[styles.link, { color: palette.accent }]}>
                          Resend code
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      disabled={isBusy}
                      onPress={() => void handleStartOver()}
                    >
                      <Text style={[styles.link, { color: palette.subtle }]}>
                        Start over
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {notice ? (
                <Text
                  style={[styles.notice, { color: palette.subtle }]}
                  accessibilityLiveRegion="polite"
                >
                  {notice}
                </Text>
              ) : null}

              {message ? (
                <Text
                  style={[styles.message, { color: palette.danger }]}
                  accessibilityLiveRegion="assertive"
                >
                  {message}
                </Text>
              ) : null}
            </View>

            <Text style={[styles.footnote, { color: palette.placeholder }]}>
              Protected by Clerk.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const lightPalette = {
  background: '#EEF3F8',
  card: '#FFFFFF',
  text: '#101828',
  subtle: '#5A6472',
  border: '#D8E0EA',
  input: '#FFFFFF',
  placeholder: '#8792A2',
  accent: '#208AEF',
  danger: '#C22B2B',
};

const darkPalette = {
  background: '#080D16',
  card: '#111A28',
  text: '#F4F7FB',
  subtle: '#A2ADBD',
  border: '#233044',
  input: '#0C1421',
  placeholder: '#728096',
  accent: '#5AA9F7',
  danger: '#FF8A8A',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
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
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 11,
    fontSize: 16,
  },
  fieldError: {
    fontSize: 13,
    lineHeight: 18,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDimmed: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  linkRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
  notice: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
  },
  message: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  footnote: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 12,
  },
});
