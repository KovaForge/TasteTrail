import { ImportScreen } from "@/components/import-screen";
import { requireSession } from "@/lib/session";
import { listUserWorkspaces } from "@tastetrail/server";

export default async function ImportPage() {
  const session = await requireSession();
  const workspaces = await listUserWorkspaces(session.user.id);
  const workspaceId = workspaces[0]?.id ?? "";
  return <ImportScreen workspaceId={workspaceId} />;
}
