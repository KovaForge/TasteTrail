import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/session";

export default async function HomePage() {
  const session = await getSessionOrNull();
  redirect(session?.user ? "/restaurants" : "/sign-in");
}
