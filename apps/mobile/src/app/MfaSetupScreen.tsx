/**
 * Purpose: Enable or disable TOTP two-factor authentication.
 * Inputs: route.params.isEnabled; useAccountMutations.enableMfa / disableMfa.
 * Outputs: Calls enableMfa('totp') to get secret+qrCodeUrl; calls disableMfa(otp)
 *   to remove MFA; navigates back on success with an Alert confirmation.
 * Constraints: ≤220L. Free plugins only. No QR image — shows copyable secret key.
 * SPORT: P5-J-mfa-setup-screen
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Clipboard,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useAccountMutations } from '../hooks/useAccount';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MfaSetup'>;

type EnableStep = 'info' | 'secret' | 'done';

export function MfaSetupScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { isEnabled } = route.params;
  const { enableMfa, disableMfa } = useAccountMutations();

  // ---------- ENABLE flow state ----------
  const [step, setStep]           = useState<EnableStep>('info');
  const [secret, setSecret]       = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading]     = useState(false);

  // ---------- DISABLE flow state ----------
  const [otp, setOtp]             = useState('');

  const handleBeginSetup = useCallback(async () => {
    setLoading(true);
    try {
      const result = await enableMfa('totp');
      setSecret(result.secret);
      setQrCodeUrl(result.qrCodeUrl);
      setStep('secret');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not start MFA setup');
    } finally {
      setLoading(false);
    }
  }, [enableMfa]);

  const handleDoneEnable = useCallback(() => {
    Alert.alert('Two-factor authentication enabled', 'Your account is now protected with TOTP.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }, [navigation]);

  const handleCopySecret = useCallback(() => {
    Clipboard.setString(secret);
    Alert.alert('Copied', 'Secret key copied to clipboard.');
  }, [secret]);

  const handleDisable = useCallback(async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    try {
      await disableMfa(otp);
      Alert.alert('2FA disabled', 'Two-factor authentication has been removed.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not disable 2FA');
    } finally {
      setLoading(false);
    }
  }, [otp, disableMfa, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Two-factor auth</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {isEnabled ? (
          /* ---- DISABLE FLOW ---- */
          <>
            <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={styles.cardIcon}>🔐</Text>
              <Text style={[styles.cardTitle, { color: colors.text }]}>2FA is currently enabled</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Enter the 6-digit code from your authenticator app to remove two-factor authentication.</Text>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Authenticator code</Text>
            <TextInput
              style={[styles.otpInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
              value={otp}
              onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="6-digit authenticator code"
            />
            <TouchableOpacity
              style={[styles.dangerBtn, { backgroundColor: colors.danger }, (loading || otp.length !== 6) && styles.btnDisabled]}
              onPress={handleDisable}
              disabled={loading || otp.length !== 6}
              accessibilityLabel="Disable two-factor authentication"
              accessibilityRole="button"
            >
              {loading ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={[styles.dangerBtnText, { color: colors.textOnPrimary }]}>Disable 2FA</Text>}
            </TouchableOpacity>
          </>
        ) : step === 'info' ? (
          /* ---- ENABLE: Step 1 — info ---- */
          <>
            <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={styles.cardIcon}>🛡️</Text>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Set up two-factor authentication</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Add an extra layer of security. You'll need an authenticator app (Google Authenticator, Authy, etc.) to generate login codes.</Text>
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }, loading && styles.btnDisabled]}
              onPress={handleBeginSetup}
              disabled={loading}
              accessibilityLabel="Begin two-factor authentication setup"
              accessibilityRole="button"
            >
              {loading ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={[styles.primaryBtnText, { color: colors.textOnPrimary }]}>Begin setup</Text>}
            </TouchableOpacity>
          </>
        ) : (
          /* ---- ENABLE: Step 2 — secret + QR URL ---- */
          <>
            <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Scan this key in your authenticator app</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Tap "Add account" in your authenticator, then enter the key below manually or scan the QR code URL.</Text>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Secret key</Text>
            <View style={styles.secretRow}>
              <TextInput style={[styles.secretInput, { flex: 1, backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]} value={secret} editable={false} selectTextOnFocus accessibilityLabel="TOTP secret key" />
              <TouchableOpacity style={[styles.copyBtn, { backgroundColor: colors.primarySubtle }]} onPress={handleCopySecret} accessibilityLabel="Copy secret key" accessibilityRole="button">
                <Text style={[styles.copyBtnText, { color: colors.primary }]}>Copy key</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>QR code URL</Text>
            <Text style={[styles.qrUrl, { color: colors.textSecondary, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} selectable>{qrCodeUrl}</Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleDoneEnable} accessibilityLabel="Done, finish MFA setup" accessibilityRole="button">
              <Text style={[styles.primaryBtnText, { color: colors.textOnPrimary }]}>Done</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, borderBottomWidth: 1 },
  back:           { fontSize: 16, width: 60 },
  title:          { fontSize: 17, fontWeight: '700' },
  body:           { padding: 16, gap: 14 },
  card:           { borderRadius: 12, padding: 20, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardIcon:       { fontSize: 40 },
  cardTitle:      { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  cardSub:        { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  fieldLabel:     { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: -6 },
  secretRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secretInput:    { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: 'monospace' },
  copyBtn:        { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 },
  copyBtnText:    { fontSize: 13, fontWeight: '600' },
  qrUrl:          { fontSize: 11, borderRadius: 10, borderWidth: 1, padding: 12, lineHeight: 17 },
  otpInput:       { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 24, fontWeight: '700', textAlign: 'center', letterSpacing: 8 },
  primaryBtn:     { borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '700' },
  dangerBtn:      { borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  dangerBtnText:  { fontSize: 15, fontWeight: '700' },
  btnDisabled:    { opacity: 0.5 },
});
