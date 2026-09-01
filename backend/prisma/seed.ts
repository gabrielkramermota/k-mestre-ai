import 'dotenv/config';
import { prisma, migrate } from '../src/db';
import { hashPassword } from '../src/auth';

const SEED_USERNAME = 'admin';
const SEED_PASSWORD = 'admin';

async function main() {
  await migrate();
  const existing = await prisma.user.findUnique({ where: { username: SEED_USERNAME } });
  if (existing) {
    console.log(`Usuario seed "${SEED_USERNAME}" ja existe, nada a fazer.`);
    return;
  }

  const passwordHash = await hashPassword(SEED_PASSWORD);
  await prisma.user.create({ data: { username: SEED_USERNAME, passwordHash } });
  console.log(`Usuario seed criado: ${SEED_USERNAME} / ${SEED_PASSWORD}`);
  console.log('IMPORTANTE: troque essa senha ou crie seu proprio usuario com "npm run create-user".');
}

main()
  .catch(err => {
    console.error('Falha ao rodar o seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
