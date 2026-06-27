/**
 * Purpose: Settings screen — server URL, language, appearance, notification preferences.
 * Inputs: useSettings hook (MMKV-backed); navigation for back action.
 * Outputs: Persisted settings; urql client reinit on server URL change.
 * Constraints: ≤300L. Language change = immediate; RTL (ar) prompts restart.
 *   Appearance change notified to ThemeProvider via route param callback.
 * SPORT: C-S3-T1
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Alert, Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useSettings, type AppLanguage, type AppAppearance } from '../hooks/useSettings';
import { useNotificationPrefs } from '../hooks/useNotificationPrefs';

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
  const { serverUrl, setServerUrl, language, setLanguage, appearance, setAppearance } = useSettings();
  const { prefs, setMasterEnabled, setComments, setAssigned, setReminders } = useNotificationPrefs();
  const [urlDraft, setUrlDraft] = useState(serverUrl);
  const [urlStatus, setUrlStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

  const testAndSaveUrl = useCallback(async () => {
    const url = urlDraft.trim().replace(/\/$/, '');
    if (!url) return;
    setUrlStatus('testing');
    try {
      const resp = await fetch(`${url}/healthz`, { method: 'GET' });
      if (resp.ok) {
        setServerUrl(url);
        setUrlStatus('ok');
      } else {
        setUrlStatus('fail');
      }
    } catch {
      setUrlStatus('fail');
    }
  }, [urlDraft, setServerUrl]);

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

  const urlStatusColor = urlStatus === 'ok' ? '#10B981' : urlStatus === 'fail' ? '#EF4444' : '#6366F1';
  const urlStatusLabel = urlStatus === 'testing' ? 'Testing…' : urlStatus === 'ok' ? '✓ Connected' : urlStatus === 'fail' ? '✗ Failed' : 'Test connection';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Connection */}
        <Text style={styles.sectionHeader}>Connection</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
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
        <Text style={styles.sectionHeader}>Language</Text>
        <View style={styles.card}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.radioRow, language === lang.code && styles.radioRowSelected]}
              onPress={() => handleLanguageChange(lang.code)}
              accessibilityRole="radio"
              accessibilityState={{ checked: language === lang.code }}
              accessibilityLabel={lang.label}
            >
              <View style={[styles.radioCircle, language === lang.code && styles.radioCircleSelected]} />
              <Text style={[styles.radioLabel, language === lang.code && styles.radioLabelSelected]}>{lang.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Appearance */}
        <Text style={styles.sectionHeader}>Appearance</Text>
        <View style={styles.card}>
          {APPEARANCES.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.radioRow, appearance === opt.value && styles.radioRowSelected]}
              onPress={() => setAppearance(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: appearance === opt.value }}
              accessibilityLabel={opt.label}
            >
              <View style={[styles.radioCircle, appearance === opt.value && styles.radioCircleSelected]} />
              <Text style={[styles.radioLabel, appearance === opt.value && styles.radioLabelSelected]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Notifications */}
        <Text style={styles.sectionHeader}>Notifications</Text>
        <View style={styles.card}>
          <ToggleRow label="All notifications" value={prefs.masterEnabled} onChange={setMasterEnabled} />
          <ToggleRow label="Comments on my tasks" value={prefs.comments} onChange={setComments} disabled={!prefs.masterEnabled} />
          <ToggleRow label="Tasks assigned to me" value={prefs.assigned} onChange={setAssigned} disabled={!prefs.masterEnabled} />
          <ToggleRow label="Task due reminders" value={prefs.reminders} onChange={setReminders} disabled={!prefs.masterEnabled} />
        </View>
      </ScrollView>
    </View>
  );
}

function ToggleRow({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, disabled && styles.toggleLabelDisabled]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: '#6366F1' }}
        thumbColor={Platform.OS === 'android' ? (value ? '#6366F1' : '#F4F4F5') : undefined}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back: { fontSize: 16, color: '#6366F1', width: 60 },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  body: { padding: 16, gap: 4 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 8, marginStart: 4 },
  card: { backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 8 },
  testBtn: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 12 },
  testBtnText: { fontSize: 14, fontWeight: '600' },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  radioRowSelected: { /* no extra style */ },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: '#FFF' },
  radioCircleSelected: { borderColor: '#6366F1', backgroundColor: '#6366F1' },
  radioLabel: { fontSize: 15, color: '#374151' },
  radioLabelSelected: { color: '#111827', fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  toggleLabel: { fontSize: 15, color: '#374151', flex: 1 },
  toggleLabelDisabled: { color: '#9CA3AF' },
});
