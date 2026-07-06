/**
 * Purpose: Settings screen — server URL, language, appearance, notification preferences.
 * Inputs: useSettings hook (SecureStore-backed serverUrl; MMKV for language/appearance);
 *   useAuth for the sign-out that follows a server URL change; navigation for back action.
 * Outputs: Persisted settings. Changing + saving the server URL signs the user out so the
 *   app re-authenticates against the new backend — this is what actually reinitializes the
 *   urql client (AuthenticatedApp builds it from useAuth's serverUrl+accessToken), not a
 *   cosmetic MMKV write.
 * Constraints: ≤300L. Language change = immediate; RTL (ar) prompts restart.
 *   Appearance change notified to ThemeProvider via route param callback.
 * SPORT: C-S3-T1
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Alert, Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useSettings, type AppLanguage, type AppAppearance } from '../hooks/useSettings';
import { useNotificationPrefs } from '../hooks/useNotificationPrefs';
import { useAuth } from '../hooks/useAuth';
import { useTheme, type ColorTokens } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const LANGUAGES: { code: AppLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
];

const APPEARANCES: { value: AppAppearance; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { serverUrl, setServerUrl, language, setLanguage, appearance, setAppearance } = useSettings();
  const { signOut } = useAuth();
  const { prefs, setMasterEnabled, setComments, setAssigned, setReminders } = useNotificationPrefs();
  const [urlDraft, setUrlDraft] = useState(serverUrl);
  const [urlStatus, setUrlStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [urlTouched, setUrlTouched] = useState(false);

  // serverUrl resolves asynchronously from SecureStore (starts as ''). Sync the
  // draft once it loads, but never clobber text the user has already started typing.
  useEffect(() => {
    if (!urlTouched && serverUrl) setUrlDraft(serverUrl);
  }, [serverUrl, urlTouched]);

  const testAndSaveUrl = useCallback(async () => {
    const url = urlDraft.trim().replace(/\/$/, '');
    if (!url) return;
    setUrlStatus('testing');
    try {
      const resp = await fetch(`${url}/healthz`, { method: 'GET' });
      if (resp.ok) {
        const changed = url !== serverUrl;
        setServerUrl(url);
        setUrlStatus('ok');
        if (changed) {
          // The urql client is built once from useAuth's serverUrl+accessToken
          // (AuthenticatedApp in app/index.tsx) — it does not watch for further
          // serverUrl changes. Signing out forces the auth gate to re-render
          // against the newly persisted server URL, which is what actually
          // reinitializes the GraphQL client rather than leaving this as a
          // cosmetic setting.
          Alert.alert(
            'Server changed',
            'You will be signed out to connect to the new server.',
            [{ text: 'OK', onPress: () => void signOut() }],
          );
        }
      } else {
        setUrlStatus('fail');
      }
    } catch {
      setUrlStatus('fail');
    }
  }, [urlDraft, serverUrl, setServerUrl, signOut]);

  const handleLanguageChange = useCallback((lang: AppLanguage) => {
    setLanguage(lang);
    if (lang === 'ar') {
      Alert.alert(
        'Restart required',
        'A restart is required to apply RTL changes.',
        [{ text: 'OK' }],
      );
    }
  }, [setLanguage]);

  const urlStatusColor =
    urlStatus === 'ok' ? colors.success :
    urlStatus === 'fail' ? colors.danger :
    colors.primary;
  const urlStatusLabel = urlStatus === 'testing' ? 'Testing…' : urlStatus === 'ok' ? '✓ Connected' : urlStatus === 'fail' ? '✗ Failed' : 'Test connection';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Connection */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Connection</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Server URL</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
            value={urlDraft}
            onChangeText={(t) => { setUrlDraft(t); setUrlStatus('idle'); }}
            placeholder="https://your-server.example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Server URL"
          />
          <TouchableOpacity
            style={[styles.testBtn, { borderColor: urlStatusColor }]}
            onPress={testAndSaveUrl}
            disabled={urlStatus === 'testing'}
            accessibilityLabel="Test connection"
            accessibilityRole="button"
          >
            <Text style={[styles.testBtnText, { color: urlStatusColor }]}>{urlStatusLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* Language */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Language</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.radioRow, { borderBottomColor: colors.borderSubtle }]}
              onPress={() => handleLanguageChange(lang.code)}
              accessibilityRole="radio"
              accessibilityState={{ checked: language === lang.code }}
              accessibilityLabel={lang.label}
            >
              <View style={[
                styles.radioCircle,
                { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
                language === lang.code && { borderColor: colors.primary, backgroundColor: colors.primary },
              ]} />
              <Text style={[
                styles.radioLabel,
                { color: colors.textSecondary },
                language === lang.code && { color: colors.text, fontWeight: '600' },
              ]}>{lang.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Appearance */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          {APPEARANCES.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.radioRow, { borderBottomColor: colors.borderSubtle }]}
              onPress={() => setAppearance(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: appearance === opt.value }}
              accessibilityLabel={opt.label}
            >
              <View style={[
                styles.radioCircle,
                { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
                appearance === opt.value && { borderColor: colors.primary, backgroundColor: colors.primary },
              ]} />
              <Text style={[
                styles.radioLabel,
                { color: colors.textSecondary },
                appearance === opt.value && { color: colors.text, fontWeight: '600' },
              ]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Notifications */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Notifications</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <ToggleRow colors={colors} label="All notifications" value={prefs.masterEnabled} onChange={setMasterEnabled} />
          <ToggleRow colors={colors} label="Comments on my tasks" value={prefs.comments} onChange={setComments} disabled={!prefs.masterEnabled} />
          <ToggleRow colors={colors} label="Tasks assigned to me" value={prefs.assigned} onChange={setAssigned} disabled={!prefs.masterEnabled} />
          <ToggleRow colors={colors} label="Task due reminders" value={prefs.reminders} onChange={setReminders} disabled={!prefs.masterEnabled} />
        </View>

        {/* Account */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <TouchableOpacity
            style={[styles.navRow, { borderBottomColor: colors.borderSubtle }]}
            onPress={() => navigation.navigate('Account')}
            accessibilityRole="button"
            accessibilityLabel="Account settings"
          >
            <Text style={[styles.navRowLabel, { color: colors.textSecondary }]}>Account &amp; Security</Text>
            <Text style={[styles.navRowChevron, { color: colors.textTertiary }]}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function ToggleRow({
  colors, label, value, onChange, disabled,
}: {
  colors: ColorTokens;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, { borderBottomColor: colors.borderSubtle }]}>
      <Text style={[styles.toggleLabel, { color: disabled ? colors.textTertiary : colors.textSecondary }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.primary }}
        thumbColor={Platform.OS === 'android' ? (value ? colors.primary : colors.surface) : undefined}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, borderBottomWidth: 1 },
  back: { fontSize: 16, width: 60 },
  title: { fontSize: 17, fontWeight: '700' },
  body: { padding: 16, gap: 4 },
  sectionHeader: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 8, marginStart: 4 },
  card: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 8 },
  testBtn: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 12 },
  testBtnText: { fontSize: 14, fontWeight: '600' },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, gap: 12 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  radioLabel: { fontSize: 15 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  toggleLabel: { fontSize: 15, flex: 1 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  navRowLabel: { fontSize: 15, flex: 1 },
  navRowChevron: { fontSize: 20 },
});
