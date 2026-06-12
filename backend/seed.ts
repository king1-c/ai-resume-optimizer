import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error('错误: 请设置 ADMIN_USERNAME 和 ADMIN_PASSWORD 环境变量');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('错误: ADMIN_PASSWORD 长度至少为 8 位');
    process.exit(1);
  }

  const exists = await prisma.admin.findUnique({ where: { username } });
  if (exists) {
    console.log(`管理员 ${username} 已存在，跳过创建`);
    return;
  }

  const hash = await bcrypt.hash(password, 13);
  await prisma.admin.create({
    data: {
      username,
      password: hash,
      role: 'SUPER_ADMIN',
    },
  });
  console.log(`管理员 ${username} 创建成功`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
