import { hashPassword } from './src/utils/password.js';
import { prisma } from './src/config/database.js';

// 密码从环境变量或命令行参数读取，禁止硬编码
const newPassword = process.env.RESET_PASSWORD || process.argv[2];
if (!newPassword) {
  console.error('Usage: RESET_PASSWORD=xxx node reset-test-password.js');
  console.error('   or: node reset-test-password.js <new-password>');
  process.exit(1);
}
const hashedPassword = await hashPassword(newPassword);

const user = await prisma.user.findFirst({
  where: { username: 'test' },
  select: { id: true, username: true },
});

if (!user) {
  console.log('User "test" not found');
  process.exit(1);
}

await prisma.user.update({
  where: { id: user.id },
  data: { password: hashedPassword },
});

console.log(`Password for user "${user.username}" (id: ${user.id}) reset to: ${newPassword}`);

await prisma.$disconnect();
process.exit(0);
