import { PrismaClient } from '@prisma/client';
// Зміна форми імпорту для підтримки ESM/CommonJS:
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function run() {
  // Виклик безпосередньо через дефолтний або безпечний резолв:
  const bcrypt = (bcryptjs as any).default || bcryptjs;
  const hashedPassword = await bcrypt.hash('SyntheticPassword123!', 10);

  const user = await prisma.user.upsert({
    where: { email: 'privacy.test@synthetic-example.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'privacy.test@synthetic-example.com',
      username: 'privacy_tester_42',
      password: hashedPassword,
      bio: 'Synthetic test account for GDPR verification',
      image: null,
      demo: true,
    },
  });

  console.log('✓ Synthetic test user successfully created/updated:');
  console.log({ id: user.id, email: user.email, username: user.username });
}

run()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });