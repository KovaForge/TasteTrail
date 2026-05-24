import { RestaurantsScreen } from "@/components/restaurants-screen";
import { requireSession } from "@/lib/session";
import { listRestaurants, listUserWorkspaces } from "@tastetrail/server";

export default async function RestaurantsPage() {
  const session = await requireSession();
  const workspaces = await listUserWorkspaces(session.user.id);
  const restaurants = await listRestaurants(session.user.id, workspaces[0]?.id ?? null);
  return <RestaurantsScreen initialWorkspaces={workspaces} initialRestaurants={restaurants} />;
}
