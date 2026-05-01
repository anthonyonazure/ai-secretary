import { Link, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '../hooks/use-auth';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Platform admin',
  org_admin: 'Org admin',
  org_member: 'Member',
  org_viewer: 'Viewer',
};

const REGION_LABEL: Record<string, string> = {
  us: 'United States (us-east-1)',
  eu: 'European Union (eu-west-1)',
};

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: 'Settings', headerShown: true }} />
      <ScrollView className="flex-1 px-4 py-4">
        <Section title="Account">
          <Row label="Email" value={user?.email ?? 'Not signed in'} />
          <Row label="Name" value={user?.name ?? '—'} />
          <Row label="Role" value={user?.role ? (ROLE_LABEL[user.role] ?? user.role) : '—'} />
          <Row
            label="Region"
            value={user?.region ? (REGION_LABEL[user.region] ?? user.region) : '—'}
          />
          <Row label="MFA" value={user?.isMfaEnabled ? 'Enabled' : 'Not enabled'} />
        </Section>

        <Section title="Notifications">
          <Row label="Push notifications" value="On" />
          <Row label="Email digest" value="Off" />
          <Row label="Quiet hours" value="22:00 – 07:00" />
        </Section>

        <Section title="Recording">
          <Row label="Default density" value="Relaxed" />
          <Row label="Background uploads" value="Wi-Fi + cellular" />
          <Row label="Heartbeat" value="Every 30 s" />
        </Section>

        <Section title="Privacy">
          <Link href="/data-rights" asChild>
            <Pressable>
              <Row label="Data rights" value="Submit a DSAR request →" />
            </Pressable>
          </Link>
          <Row label="Delete account" value="Contact support →" />
        </Section>

        <Section title="About">
          <Row label="Version" value="0.0.0-dev" />
        </Section>

        {user ? (
          <Pressable
            onPress={() => {
              void logout();
            }}
            accessibilityRole="button"
            className="mt-4 items-center rounded-md border border-border bg-surface px-4 py-3"
            testID="settings-sign-out"
          >
            <Text className="font-semibold text-danger">Sign out</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        {title}
      </Text>
      <View className="rounded-md border border-border bg-surface">{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-row items-center justify-between border-border border-b px-4 py-3 last:border-b-0"
      testID={`settings-row-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <Text className="text-sm text-fg">{label}</Text>
      <Text className="text-sm text-fg-muted">{value}</Text>
    </View>
  );
}
