/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 10);
  const admin = await prisma.user.upsert({
    where: { loginId: "admin" },
    update: {},
    create: { loginId: "admin", name: "管理者", role: "ADMIN", passwordHash: await hash("admin1234") },
  });
  console.log("seed: users ok", admin.loginId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
