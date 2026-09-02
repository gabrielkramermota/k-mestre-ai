import * as fs from 'node:fs';

export function assertWorkingDirectory(cwd: string): void {
  if (cwd.includes('\uFFFD')) throw new Error(`Diretorio de trabalho contem caractere invalido: ${cwd}`);
  if (!fs.existsSync(cwd)) throw new Error(`Diretorio de trabalho nao existe: ${cwd}`);
  if (!fs.statSync(cwd).isDirectory()) throw new Error(`Caminho de trabalho nao e um diretorio: ${cwd}`);
}
