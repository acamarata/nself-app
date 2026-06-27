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

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

function getInitials(email: string | null): string {
  if (!email) return '?';
  const parts = email.split('@')[0]?.split(/[._-]/) ?? [];
  return (parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || email[0]?.toUpperCase()) ?? '?';
}

export function ProfileScreen({ navigation }: Props) {
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar} accessibilityRole="image" accessibilityLabel={`Avatar for ${email ?? 'user'}`}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {email ? <Text style={styles.email}>{email}</Text> : null}
        </View>

        <View style={styles.card}>
          <Row label="Email" value={email ?? '—'} />
          <Row label="Server URL" value={serverUrl || '—'} />
          <Row label="Version" value={`v${version}`} />
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} accessibilityLabel="Sign out" accessibilityRole="button">
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back: { fontSize: 16, color: '#6366F1', width: 60 },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  body: { padding: 24, alignItems: 'center', gap: 16 },
  avatarWrap: { alignItems: 'center', gap: 12, marginBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, fontWeight: '700', color: '#FFF' },
  email: { fontSize: 15, color: '#374151', fontWeight: '500' },
  card: { width: '100%', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 8 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280', flex: 1 },
  rowValue: { fontSize: 14, color: '#111827', flex: 2, textAlign: 'right' },
  signOutBtn: { backgroundColor: '#FEE2E2', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  signOutText: { color: '#DC2626', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
