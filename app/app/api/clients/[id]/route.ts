import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Verify ownership
  const existing = await prisma.client.findFirst({
    where: { id, coachId: session.user.id },
  });
  if (!existing) return new NextResponse("Not found", { status: 404 });

  const updated = await prisma.client.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.phone !== undefined && { phone: body.phone || null }),
      ...(body.totalSessionsPurchased !== undefined && {
        totalSessionsPurchased: Math.max(
          0,
          Number(body.totalSessionsPurchased)
        ),
      }),
      ...(body.sessionsRemaining !== undefined && {
        sessionsRemaining: Math.max(0, Number(body.sessionsRemaining)),
      }),
      ...(body.active !== undefined && { active: body.active }),
      ...(body.unpaidSessions !== undefined && {
        unpaidSessions: Math.max(0, Number(body.unpaidSessions)),
      }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  const existing = await prisma.client.findFirst({
    where: { id, coachId: session.user.id },
  });
  if (!existing) return new NextResponse("Not found", { status: 404 });

  await prisma.client.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
