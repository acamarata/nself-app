/**
 * Purpose: Account settings screen — security, sessions, data export, legal, danger zone.
 * Inputs: Navigation (back + child screen links); useAccountMutations for data export.
 * Outputs: Navigates to ChangeEmail, ChangePassword, Sessions, DeleteAccount;
 *   triggers data export via Hasura action; opens legal URLs in system browser.
 * Constraints: ≤300L. Free plugins only. No direct table writes.
 * SPORT: P5-J-account-screen
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Linking, ActivityIndicator, Switch, Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useAccountMutations } from '../hooks/useAccount';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

type ExportStatus = 'idle' | 'loading' | 'done' | 'error';

// MFA toggle is display-only in this screen; deep config lives in a dedicated modal.
const MFA_PLACEHOLDER = false;

export function AccountScreen({ navigation }: Props) {
  const { requestDataExport } = useAccountMutations();
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [exportError, setExportError] = useState<string | null>(null);
  const [mfaEnabled] = useState(MFA_PLACEHOLDER);

  const handleDataExport = useCallback(async () => {
    if (exportStatus === 'loading' || exportStatus === 'done') return;
    setExportStatus('loading');
    setExportError(null);
    try {
      await requestDataExport();
      setExportStatus('done');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export request failed');
      setExportStatus('error');
    }
  }, [exportStatus, requestDataExport]);

  const openUrl = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {
      // Silently ignore — browser unavailable is a device-level edge case
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Account</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Security */}
        <Text style={styles.sectionHeader}>Security</Text>
        <View style={styles.card}>
          <NavRow label="Change email" onPress={() => navigation.navigate('ChangeEmail')} />
          <NavRow label="Change password" onPress={() => navigation.navigate('ChangePassword')} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.rowLabel}>Two-factor authentication</Text>
              <Text style={styles.rowSub}>{mfaEnabled ? 'Enabled' : 'Disabled'}</Text>
            </View>
            <Switch
              value={mfaEnabled}
              onValueChange={() => {
                // MFA setup flow will be wired up in a follow-on ticket (MFA modal)
              }}
              trackColor={{ true: '#6366F1' }}
              thumbColor={Platform.OS === 'android' ? (mfaEnabled ? '#6366F1' : '#F4F4F5') : undefined}
              accessibilityLabel="Two-factor authentication"
            />
          </View>
        </View>

        {/* Sessions */}
        <Text style={styles.sectionHeader}>Sessions</Text>
        <View style={styles.card}>
          <NavRow label="Active sessions" onPress={() => navigation.navigate('Sessions')} />
        </View>

        {/* Data */}
        <Text style={styles.sectionHeader}>Data</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.dataRow}
            onPress={handleDataExport}
            disabled={exportStatus === 'loading' || exportStatus === 'done'}
            accessibilityLabel="Export my data"
            accessibilityRole="button"
          >
            <View style={styles.dataInfo}>
              <Text style={[styles.rowLabel, exportStatus === 'done' && styles.rowLabelMuted]}>
                Export my data
              </Text>
              <Text style={styles.rowSub}>
                {exportStatus === 'done'
                  ? 'Request received — check your email'
                  : 'Receive a copy of all your tasks and lists'}
              </Text>
              {exportStatus === 'error' && exportError ? (
                <Text style={styles.errorText}>{exportError}</Text>
              ) : null}
            </View>
            {exportStatus === 'loading' ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : exportStatus === 'done' ? (
              <Text style={styles.doneCheck}>✓</Text>
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Legal */}
        <Text style={styles.sectionHeader}>Legal</Text>
        <View style={styles.card}>
          <NavRow label="Privacy policy"       onPress={() => openUrl('https://nself.org/privacy')} />
          <NavRow label="Terms of service"     onPress={() => openUrl('https://nself.org/terms')} />
          <NavRow label="Acceptable use policy" onPress={() => openUrl('https://nself.org/aup')} last />
        </View>

        {/* Danger zone */}
        <Text style={styles.sectionHeader}>Danger zone</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.deleteRow}
            onPress={() => navigation.navigate('DeleteAccount')}
            accessibilityLabel="Delete account"
            accessibilityRole="button"
          >
            <Text style={styles.deleteLabel}>Delete account</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NavRow({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.navRow, last && styles.navRowLast]}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F9FAFB' },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back:           { fontSize: 16, color: '#6366F1', width: 60 },
  title:          { fontSize: 17, fontWeight: '700', color: '#111827' },
  body:           { padding: 16, gap: 4 },
  sectionHeader:  { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 8, marginStart: 4 },
  card:           { backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  navRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  navRowLast:     { borderBottomWidth: 0 },
  toggleRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  toggleInfo:     { flex: 1 },
  dataRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  dataInfo:       { flex: 1, gap: 2 },
  deleteRow:      { paddingVertical: 14 },
  rowLabel:       { fontSize: 15, color: '#111827' },
  rowLabelMuted:  { color: '#6B7280' },
  rowSub:         { fontSize: 12, color: '#6B7280', marginTop: 2 },
  chevron:        { fontSize: 20, color: '#9CA3AF' },
  doneCheck:      { fontSize: 16, color: '#10B981', fontWeight: '700' },
  deleteLabel:    { fontSize: 15, color: '#DC2626', fontWeight: '600' },
  errorText:      { fontSize: 12, color: '#DC2626', marginTop: 4 },
});
