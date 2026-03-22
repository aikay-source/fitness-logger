import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import OfflineSyncProvider from "@/components/OfflineSyncProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-svh flex-col">
      <OfflineSyncProvider />
      <main className="flex-1 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
