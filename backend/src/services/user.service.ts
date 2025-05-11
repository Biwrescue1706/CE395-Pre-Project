import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function saveUserIfNotExists(userId: string) {
  const existingUser = await prisma.user.findUnique({ where: { userId } });
  if (!existingUser) {
    await prisma.user.create({ data: { userId } });
    console.log(`✅ เก็บ userId ใหม่: ${userId}`);
  }
}

export async function getAllUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany();
  return users.map((u) => u.userId);
}
