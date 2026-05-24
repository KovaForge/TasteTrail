import Link from "next/link";

export function AppNav() {
  return (
    <nav className="app-nav">
      <Link href="/restaurants">Restaurants</Link>
      <Link href="/import">Import</Link>
      <Link href="/settings">Settings</Link>
      <Link href="/migrate-account">Migrate Account</Link>
    </nav>
  );
}
