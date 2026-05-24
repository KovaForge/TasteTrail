import { redirect } from "next/navigation";
import { SignInPanel } from "@/components/sign-in-panel";
import { getSessionOrNull } from "@/lib/session";

export default async function SignInPage() {
  const session = await getSessionOrNull();
  if (session?.user) {
    redirect("/restaurants");
  }
  return <SignInPanel />;
}
