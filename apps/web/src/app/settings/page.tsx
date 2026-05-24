import { SettingsScreen } from "@/components/settings-screen";
import { requireSession } from "@/lib/session";
import { listRecentDebugLogs } from "@tastetrail/server";

export default async function SettingsPage() {
  const session = await requireSession();
  const logs = await listRecentDebugLogs(session.user.id, null);
  return <SettingsScreen initialLogs={logs} />;
}
