/// <reference types="node" />

const terminalId = process.env.KMESTRE_TERMINAL_ID;
const token = process.env.KMESTRE_TOKEN;
const api = process.env.KMESTRE_API || 'http://localhost:3001';

interface ListResponse {
  teammates: Array<{ id: string; name: string; roleName: string | null }>;
  notes: Array<{ filename: string }>;
}

async function main(): Promise<void> {
  const [, , cmd, ...args] = process.argv;

  if (!terminalId || !token) {
    console.error('kmestre: este terminal nao esta registrado no orquestrador (variaveis de ambiente ausentes).');
    process.exitCode = 1;
    return;
  }

  if (cmd === 'list') {
    const res = await fetch(`${api}/api/orchestrator/list`, {
      headers: { 'X-Kmestre-Token': token },
    });
    const data = (await res.json()) as ListResponse & { error?: string };
    if (!res.ok) {
      console.error(`kmestre: erro (${res.status}) - ${data.error || 'falha desconhecida'}`);
      process.exitCode = 1;
      return;
    }

    console.log('Colegas conectados:');
    if (!data.teammates.length) console.log('  (nenhum)');
    for (const t of data.teammates) {
      console.log(`  - ${t.roleName || t.name || t.id} (id: ${t.id})`);
    }
    console.log('Notas compartilhadas:');
    if (!data.notes.length) console.log('  (nenhuma)');
    for (const n of data.notes) {
      console.log(`  - ${n.filename}`);
    }
    return;
  }

  if (cmd === 'send') {
    const [target, ...msgParts] = args;
    const message = msgParts.join(' ');
    if (!target || !message) {
      console.error('Uso: kmestre send <alvo> <mensagem>');
      process.exitCode = 1;
      return;
    }

    const res = await fetch(`${api}/api/orchestrator/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kmestre-Token': token },
      body: JSON.stringify({ target, message }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      console.error(`kmestre: erro (${res.status}) - ${data.error || 'falha desconhecida'}`);
      process.exitCode = 1;
      return;
    }

    console.log(`kmestre: mensagem enviada para ${target}.`);
    return;
  }

  if (cmd === 'check') {
    const [target] = args;
    if (!target) {
      console.error('Uso: kmestre check <alvo>');
      process.exitCode = 1;
      return;
    }

    const res = await fetch(`${api}/api/orchestrator/output?target=${encodeURIComponent(target)}`, {
      headers: { 'X-Kmestre-Token': token },
    });
    const data = (await res.json()) as { output?: string; error?: string };
    if (!res.ok) {
      console.error(`kmestre: erro (${res.status}) - ${data.error || 'falha desconhecida'}`);
      process.exitCode = 1;
      return;
    }

    console.log(data.output || '(sem saida ainda)');
    return;
  }

  if (cmd === 'note') {
    const [sub, ...rest] = args;

    if (sub === 'read') {
      const [name] = rest;
      if (!name) {
        console.error('Uso: kmestre note read <nome.md>');
        process.exitCode = 1;
        return;
      }
      const res = await fetch(`${api}/api/orchestrator/note?name=${encodeURIComponent(name)}`, {
        headers: { 'X-Kmestre-Token': token },
      });
      const data = (await res.json()) as { content?: string; error?: string };
      if (!res.ok) {
        console.error(`kmestre: erro (${res.status}) - ${data.error || 'falha desconhecida'}`);
        process.exitCode = 1;
        return;
      }
      console.log(data.content || '(nota vazia)');
      return;
    }

    if (sub === 'write') {
      const [name, ...contentParts] = rest;
      const content = contentParts.join(' ');
      if (!name) {
        console.error('Uso: kmestre note write <nome.md> "<conteudo>"');
        process.exitCode = 1;
        return;
      }
      const res = await fetch(`${api}/api/orchestrator/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Kmestre-Token': token },
        body: JSON.stringify({ name, content }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        console.error(`kmestre: erro (${res.status}) - ${data.error || 'falha desconhecida'}`);
        process.exitCode = 1;
        return;
      }
      console.log(`kmestre: nota ${name} atualizada.`);
      return;
    }

    if (sub === 'create') {
      let name: string | undefined;
      const contentParts: string[] = [];
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--name') {
          name = rest[++i];
        } else {
          contentParts.push(rest[i]);
        }
      }
      const content = contentParts.join(' ');
      const res = await fetch(`${api}/api/orchestrator/note/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Kmestre-Token': token },
        body: JSON.stringify({ name, content }),
      });
      const data = (await res.json()) as { ok?: boolean; filename?: string; error?: string };
      if (!res.ok) {
        console.error(`kmestre: erro (${res.status}) - ${data.error || 'falha desconhecida'}`);
        process.exitCode = 1;
        return;
      }
      console.log(`kmestre: nota criada: ${data.filename}`);
      return;
    }

    console.error('Uso: kmestre note read <nome.md> | kmestre note write <nome.md> "<conteudo>" | kmestre note create "<conteudo>" [--name "Nome"]');
    process.exitCode = 1;
    return;
  }

  if (cmd === 'spawn') {
    let name: string | undefined;
    let role: string | undefined;
    let aiCmd: string | undefined;
    let dir: string | undefined;
    let color: string | undefined;
    const positional: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--role') { role = args[++i]; }
      else if (args[i] === '--cmd') { aiCmd = args[++i]; }
      else if (args[i] === '--dir') { dir = args[++i]; }
      else if (args[i] === '--color') { color = args[++i]; }
      else { positional.push(args[i]); }
    }
    name = positional.join(' ');
    if (!name) {
      console.error('Uso: kmestre spawn "Nome" [--role "<prompt do papel>"] [--cmd claude|codex|opencode] [--dir "C:\\caminho"] [--color "#hex"]');
      process.exitCode = 1;
      return;
    }

    const res = await fetch(`${api}/api/orchestrator/spawn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kmestre-Token': token },
      body: JSON.stringify({ name, role, cmd: aiCmd, dir, color }),
    });
    const data = (await res.json()) as { ok?: boolean; terminalId?: string; name?: string; error?: string };
    if (!res.ok) {
      console.error(`kmestre: erro (${res.status}) - ${data.error || 'falha desconhecida'}`);
      process.exitCode = 1;
      return;
    }

    console.log(`kmestre: terminal "${data.name}" criado (id: ${data.terminalId}).`);
    return;
  }

  console.error('Uso: kmestre list | kmestre send <alvo> <mensagem> | kmestre check <alvo> | kmestre spawn "Nome" [--role ...] [--color "#hex"] | kmestre note read|write|create ...');
  process.exitCode = 1;
}

main().catch(err => {
  console.error('kmestre: erro inesperado -', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});