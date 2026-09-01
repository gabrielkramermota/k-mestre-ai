import 'dotenv/config';
import { prisma, migrate } from '../db';
import { hashPassword } from '../auth';

function parseArgs(argv: string[]): { username?: string; password?: string } {
  const args: { username?: string; password?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--username') args.username = argv[++i];
    if (argv[i] === '--password') args.password = argv[++i];
  }
  return args;
}

async function main() {
  const { username, password } = parseArgs(process.argv.slice(2));

  if (!username || !password) {
    console.error('Uso: npm run create-user -- --username <nome> --password <senha>');
    process.exit(1);
  }

  await migrate();

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({ data: { username, passwordHash } });
    console.log(`Usuario criado: ${username} (id: ${user.id})`);
  } catch (err: any) {
    if (err.code === 'P2002') {
      console.error(`Usuario "${username}" ja existe.`);
    } else {
      console.error('Falha ao criar usuario:', err.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
