/**
 * Purpose: Profile screen — shows account info and sign-out action.
 * Inputs: useAuth hook for email + signOut; serverUrl from useSettings; Constants.expoConfig.version.
 * Outputs: Displays user info; signOut navigates to Login.
 * Constraints: ≤150L. Avatar is initials-based (no image upload).
 * SPORT: C-S3-T2
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useTheme, type ColorTokens } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

function getInitials(email: string | null): string {
  if (!email) return '?';
  const parts = email.split('@')[0]?.split(/[._-]/) ?? [];
  return (parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || email[0]?.toUpperCase()) ?? '?';
}

export function ProfileScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { accessToken, signOut } = useAuth();
  const { serverUrl } = useSettings();

  // Decode email from JWT payload (base64 middle segment)
  const email = React.useMemo(() => {
    if (!accessToken) return null;
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1] ?? '')) as { email?: string; sub?: string };
      return payload.email ?? payload.sub ?? null;
    } catch { return null; }
  }, [accessToken]);

  const version = Constants.expoConfig?.version ?? '—';
  const initials = getInitials(email);

  const handleSignOut = () =>
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); } },
    ]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]} accessibilityRole="image" accessibilityLabel={`Avatar for ${email ?? 'user'}`}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {email ? <Text style={[styles.email, { color: colors.textSecondary }]}>{email}</Text> : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <Row colors={colors} label="Email" value={email ?? '—'} />
          <Row colors={colors} label="Server URL" value={serverUrl || '—'} />
          <Row colors={colors} label="Version" value={`v${version}`} />
        </View>

        <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: colors.dangerSubtle }]} onPress={handleSignOut} accessibilityLabel="Sign out" accessibilityRole="button">
          <Text style={[styles.signOutText, { color: colors.danger }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Row({ colors, label, value }: { colors: ColorTokens; label: string; value: string }) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.borderSubtle }]}>
      <Text style={[styles.rowLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, borderBottomWidth: 1 },
  back: { fontSize: 16, width: 60 },
  title: { fontSize: 17, fontWeight: '700' },
  body: { padding: 24, alignItems: 'center', gap: 16 },
  avatarWrap: { alignItems: 'center', gap: 12, marginBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, fontWeight: '700', color: '#FFF' },
  email: { fontSize: 15, fontWeight: '500' },
  card: { width: '100%', borderRadius: 12, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 8 },
  rowLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  rowValue: { fontSize: 14, flex: 2, textAlign: 'right' },
  signOutBtn: { borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  signOutText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
