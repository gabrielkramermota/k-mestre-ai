export const API_BASE = '/api/vault';
export const API_ROOT = '/api';

// Todo fetch precisa mandar o cookie de sessao. `fetchJson` centraliza isso e
// trata 401 de forma consistente (o chamador decide o que fazer com o erro).
async function fetchJson(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, credentials: 'include' });
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<void> {
  const res = await fetchJson(`${API_ROOT}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).error || 'Login falhou');
  }
}

export async function logout(): Promise<void> {
  await fetchJson(`${API_ROOT}/auth/logout`, { method: 'POST' });
}

export async function me(): Promise<{ id: string; username: string } | null> {
  const res = await fetchJson(`${API_ROOT}/auth/me`);
  if (!res.ok) return null;
  return res.json();
}

export async function changeAccount(
  currentPassword: string,
  newUsername: string,
  newPassword: string,
): Promise<{ username: string }> {
  const res = await fetchJson(`${API_ROOT}/auth/account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentPassword,
      newUsername: newUsername || undefined,
      newPassword: newPassword || undefined,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).error || 'Falha ao atualizar conta');
  }
  return res.json();
}

// ── Vault ──────────────────────────────────────────────────────────────────────

export async function fetchFiles(): Promise<string[]> {
  const res = await fetchJson(`${API_BASE}/files`);
  if (!res.ok) throw new Error('Failed to fetch files');
  return res.json();
}

export async function readFile(filename: string): Promise<string> {
  const res = await fetchJson(`${API_BASE}/files/${encodeURIComponent(filename)}`);
  if (!res.ok) {
    if (res.status === 404) return '';
    throw new Error('Failed to read file');
  }
  return res.text();
}

export async function saveFile(filename: string, content: string): Promise<void> {
  await fetchJson(`${API_BASE}/files/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

// ── Layout (workspace-aware) ───────────────────────────────────────────────────

export async function getLayout(workspace = 'default'): Promise<any> {
  const qs = workspace !== 'default' ? `?workspace=${encodeURIComponent(workspace)}` : '';
  const res = await fetchJson(`${API_ROOT}/layout${qs}`);
  if (!res.ok) throw new Error('Failed to fetch layout');
  return res.json();
}

export async function saveLayout(layout: any, workspace = 'default'): Promise<void> {
  const qs = workspace !== 'default' ? `?workspace=${encodeURIComponent(workspace)}` : '';
  await fetchJson(`${API_ROOT}/layout${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(layout),
  });
}

// ── Workspaces ─────────────────────────────────────────────────────────────────

export async function getWorkspaces(): Promise<string[]> {
  const res = await fetchJson(`${API_ROOT}/workspaces`);
  if (!res.ok) throw new Error('Failed to fetch workspaces');
  return res.json();
}

export async function deleteWorkspace(name: string): Promise<void> {
  await fetchJson(`${API_ROOT}/workspace/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

// ── File tree ──────────────────────────────────────────────────────────────────

export async function getWorkspaceTree(): Promise<any> {
  const res = await fetchJson(`${API_ROOT}/workspace/tree`);
  if (!res.ok) throw new Error('Failed to fetch tree');
  return res.json();
}

// ── Terminals ──────────────────────────────────────────────────────────────────

export async function deleteTerminal(terminalId: string): Promise<void> {
  await fetchJson(`${API_ROOT}/terminals/${encodeURIComponent(terminalId)}`, { method: 'DELETE' });
}

export async function pickFolder(): Promise<string | null> {
  const res = await fetchJson(`${API_ROOT}/pick-folder`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.path ?? null;
}

export async function updateTerminalAgent(
  terminalId: string,
  data: {
    label: string;
    shell: 'powershell' | 'cmd';
    aiCommand?: string;
    workingDirectory: string;
    isMaestro: boolean;
    roleName?: string;
    rolePrompt?: string;
  },
): Promise<void> {
  const res = await fetchJson(`${API_ROOT}/terminals/${encodeURIComponent(terminalId)}/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update agent files');
}

// ── Legacy ─────────────────────────────────────────────────────────────────────

export async function runAgent(inputFile: string, outputFile: string, systemPrompt: string): Promise<any> {
  const res = await fetchJson(`${API_ROOT}/run-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputFile, outputFile, systemPrompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Failed to run agent');
  }
  return res.json();
}
