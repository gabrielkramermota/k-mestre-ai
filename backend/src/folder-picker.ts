import { execFileSync } from 'node:child_process';

export function decodeFolderSelection(output: string): string | null {
  const encodedPath = output.trim();
  return encodedPath ? Buffer.from(encodedPath, 'base64').toString('utf8') : null;
}

export function pickFolder(): string | null {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    "$dialog.Description = 'Escolha o diretorio de trabalho'",
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
    '  $bytes = [System.Text.Encoding]::UTF8.GetBytes($dialog.SelectedPath)',
    '  Write-Output ([Convert]::ToBase64String($bytes))',
    '}',
  ].join('\n');

  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'ascii',
    timeout: 120_000,
  });
  return decodeFolderSelection(output);
}
