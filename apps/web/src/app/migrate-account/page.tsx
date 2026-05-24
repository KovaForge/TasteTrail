import { MigrateAccountScreen } from "@/components/migrate-account-screen";
import { requireSession } from "@/lib/session";

export default async function MigrateAccountPage() {
  await requireSession();
  return <MigrateAccountScreen />;
}
