import * as fs from 'fs';
import * as path from 'path';

export function roleDir(workingDirectory: string, roleId: string): string {
  return path.join(workingDirectory, '.kmestre', 'roles', roleId);
}

export interface RoleFiles {
  roleId: string;
  roleName: string;
  rolePrompt: string;
  roleColor: string;
  workingDirectory: string;
}

export function writeRoleFiles(params: RoleFiles): void {
  const dir = roleDir(params.workingDirectory, params.roleId);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(
    path.join(dir, 'role.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        id: params.roleId,
        name: params.roleName,
        color: params.roleColor,
        prompt: params.rolePrompt,
      },
      null,
      2,
    ),
    'utf-8',
  );

  const body = [
    '<your_assigned_role>',
    params.rolePrompt,
    '',
    'Rode `kmestre list` para ver seus colegas conectados e notas compartilhadas.',
    'Rode `kmestre send <nome-ou-id> "<mensagem>"` para mandar uma demanda a um colega.',
    '</your_assigned_role>',
    '',
    '<working_directory>',
    'IMPORTANT: You were started in this directory to receive the above role assignment. The actual',
    'project you should be working on is located at:',
    params.workingDirectory,
    '</working_directory>',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(dir, 'AGENTS.md'), body, 'utf-8');
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), body, 'utf-8');
}