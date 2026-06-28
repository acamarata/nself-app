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
import { useTheme, type ColorTokens } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

type ExportStatus = 'idle' | 'loading' | 'done' | 'error';

// MFA toggle is display-only in this screen; deep config lives in a dedicated modal.
const MFA_PLACEHOLDER = false;

export function AccountScreen({ navigation }: Props) {
  const { colors } = useTheme();
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Account</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Security */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Security</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <NavRow colors={colors} label="Change email" onPress={() => navigation.navigate('ChangeEmail')} />
          <NavRow colors={colors} label="Change password" onPress={() => navigation.navigate('ChangePassword')} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Two-factor authentication</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{mfaEnabled ? 'Enabled' : 'Disabled'}</Text>
            </View>
            <Switch
              value={mfaEnabled}
              onValueChange={() => {
                // MFA setup flow will be wired up in a follow-on ticket (MFA modal)
              }}
              trackColor={{ true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? (mfaEnabled ? colors.primary : colors.surface) : undefined}
              accessibilityLabel="Two-factor authentication"
            />
          </View>
        </View>

        {/* Sessions */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Sessions</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <NavRow colors={colors} label="Active sessions" onPress={() => navigation.navigate('Sessions')} />
        </View>

        {/* Data */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Data</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <TouchableOpacity
            style={styles.dataRow}
            onPress={handleDataExport}
            disabled={exportStatus === 'loading' || exportStatus === 'done'}
            accessibilityLabel="Export my data"
            accessibilityRole="button"
          >
            <View style={styles.dataInfo}>
              <Text style={[styles.rowLabel, { color: exportStatus === 'done' ? colors.textSecondary : colors.text }]}>
                Export my data
              </Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                {exportStatus === 'done'
                  ? 'Request received — check your email'
                  : 'Receive a copy of all your tasks and lists'}
              </Text>
              {exportStatus === 'error' && exportError ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>{exportError}</Text>
              ) : null}
            </View>
            {exportStatus === 'loading' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : exportStatus === 'done' ? (
              <Text style={[styles.doneCheck, { color: colors.success }]}>✓</Text>
            ) : (
              <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Legal */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Legal</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <NavRow colors={colors} label="Privacy policy"        onPress={() => openUrl('https://nself.org/privacy')} />
          <NavRow colors={colors} label="Terms of service"      onPress={() => openUrl('https://nself.org/terms')} />
          <NavRow colors={colors} label="Acceptable use policy" onPress={() => openUrl('https://nself.org/aup')} last />
        </View>

        {/* Danger zone */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Danger zone</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <TouchableOpacity
            style={styles.deleteRow}
            onPress={() => navigation.navigate('DeleteAccount')}
            accessibilityLabel="Delete account"
            accessibilityRole="button"
          >
            <Text style={[styles.deleteLabel, { color: colors.danger }]}>Delete account</Text>
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

function NavRow({ colors, label, onPress, last }: { colors: ColorTokens; label: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.navRow, { borderBottomColor: colors.borderSubtle }, last && styles.navRowLast]}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, borderBottomWidth: 1 },
  back:          { fontSize: 16, width: 60 },
  title:         { fontSize: 17, fontWeight: '700' },
  body:          { padding: 16, gap: 4 },
  sectionHeader: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 8, marginStart: 4 },
  card:          { borderRadius: 12, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  navRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1 },
  navRowLast:    { borderBottomWidth: 0 },
  toggleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  toggleInfo:    { flex: 1 },
  dataRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  dataInfo:      { flex: 1, gap: 2 },
  deleteRow:     { paddingVertical: 14 },
  rowLabel:      { fontSize: 15 },
  rowSub:        { fontSize: 12, marginTop: 2 },
  chevron:       { fontSize: 20 },
  doneCheck:     { fontSize: 16, fontWeight: '700' },
  deleteLabel:   { fontSize: 15, fontWeight: '600' },
  errorText:     { fontSize: 12, marginTop: 4 },
});
