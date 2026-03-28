import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const coachId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: coachId },
    select: {
      name: true,
      email: true,
      reminderTime: true,
      reminderEnabled: true,
      _count: { select: { pushSubscriptions: true } },
    },
  });

  return (
    <SettingsClient
      name={user?.name ?? ""}
      email={user?.email ?? ""}
      reminderTime={user?.reminderTime ?? "08:00"}
      reminderEnabled={user?.reminderEnabled ?? true}
      hasPushSubscription={(user?._count.pushSubscriptions ?? 0) > 0}
    />
  );
}
