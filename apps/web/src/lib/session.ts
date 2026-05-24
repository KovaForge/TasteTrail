import { auth } from "@tastetrail/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function getSessionOrNull() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireSession() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    redirect("/sign-in");
  }
  return session;
}
