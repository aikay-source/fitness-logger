import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SessionLogger from "./SessionLogger";

export default async function NewSessionPage() {
  const session = await getServerSession(authOptions);
  const coachId = session!.user.id;

  const clients = await prisma.client.findMany({
    where: { coachId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, sessionsRemaining: true },
  });

  return <SessionLogger clients={clients} />;
}
