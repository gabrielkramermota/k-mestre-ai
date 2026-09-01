import * as fs from 'fs';
import * as path from 'path';

export function ensureCliShim(backendRoot: string): string {
  const shimDir = path.join(backendRoot, 'cli-shim');
  if (!fs.existsSync(shimDir)) fs.mkdirSync(shimDir, { recursive: true });

  const tsNodeBin = path.join(backendRoot, 'node_modules', 'ts-node', 'dist', 'bin.js');
  const cliSrc = path.join(backendRoot, 'src', 'cli', 'kmestre.ts');
  const shimPath = path.join(shimDir, 'kmestre.cmd');

  const content = `@echo off\r\nnode "${tsNodeBin}" --files "${cliSrc}" %*\r\n`;
  fs.writeFileSync(shimPath, content, 'utf-8');

  return shimDir;
}