"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function saveReminderSettings(
  reminderTime: string | null,
  reminderEnabled: boolean
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { reminderTime, reminderEnabled },
  });
}
