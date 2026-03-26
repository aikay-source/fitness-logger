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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // Validate name if provided
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return new NextResponse("Name must be a non-empty string", { status: 400 });
    }
    body.name = body.name.trim().slice(0, 100);
  }

  // Verify ownership
  const existing = await prisma.client.findFirst({
    where: { id, coachId: session.user.id },
  });
  if (!existing) return new NextResponse("Not found", { status: 404 });

  const updated = await prisma.client.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: String(body.name) }),
      ...(body.phone !== undefined && { phone: body.phone ? String(body.phone) : null }),
      ...(body.totalSessionsPurchased !== undefined && {
        totalSessionsPurchased: Math.max(0, Math.min(9999, Number(body.totalSessionsPurchased) || 0)),
      }),
      ...(body.sessionsRemaining !== undefined && {
        sessionsRemaining: Math.max(0, Math.min(9999, Number(body.sessionsRemaining) || 0)),
      }),
      ...(body.active !== undefined && { active: Boolean(body.active) }),
      ...(body.unpaidSessions !== undefined && {
        unpaidSessions: Math.max(0, Math.min(9999, Number(body.unpaidSessions) || 0)),
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
