/// <reference types="node" />

const terminalId = process.env.MAESTRI_TERMINAL_ID;
const token = process.env.MAESTRI_TOKEN;
const api = process.env.MAESTRI_API || 'http://localhost:3001';

interface ListResponse {
  teammates: Array<{ id: string; name: string; roleName: string | null }>;
  notes: Array<{ filename: string }>;
}

async function main(): Promise<void> {
  const [, , cmd, ...args] = process.argv;

  if (!terminalId || !token) {
    console.error('maestri: este terminal nao esta registrado no orquestrador (variaveis de ambiente ausentes).');
    process.exitCode = 1;
    return;
  }

  if (cmd === 'list') {
    const res = await fetch(`${api}/api/orchestrator/list`, {
      headers: { 'X-Maestri-Token': token },
    });
    const data = (await res.json()) as ListResponse & { error?: string };
    if (!res.ok) {
      console.error(`maestri: erro (${res.status}) - ${data.error || 'falha desconhecida'}`);
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
      console.error('Uso: maestri send <alvo> <mensagem>');
      process.exitCode = 1;
      return;
    }

    const res = await fetch(`${api}/api/orchestrator/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Maestri-Token': token },
      body: JSON.stringify({ target, message }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      console.error(`maestri: erro (${res.status}) - ${data.error || 'falha desconhecida'}`);
      process.exitCode = 1;
      return;
    }

    console.log(`maestri: mensagem enviada para ${target}.`);
    return;
  }

  if (cmd === 'check') {
    const [target] = args;
    if (!target) {
      console.error('Uso: maestri check <alvo>');
      process.exitCode = 1;
      return;
    }

    const res = await fetch(`${api}/api/orchestrator/output?target=${encodeURIComponent(target)}`, {
      headers: { 'X-Maestri-Token': token },
    });
    const data = (await res.json()) as { output?: string; error?: string };
    if (!res.ok) {
      console.error(`maestri: erro (${res.status}) - ${data.error || 'falha desconhecida'}`);
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
        console.error('Uso: maestri note read <nome.md>');
        process.exitCode = 1;
        return;
      }
      const res = await fetch(`${api}/api/orchestrator/note?name=${encodeURIComponent(name)}`, {
        headers: { 'X-Maestri-Token': token },
      });
      const data = (await res.json()) as { content?: string; error?: string };
      if (!res.ok) {
        console.error(`maestri: erro (${res.status}) - ${data.error || 'falha desconhecida'}`);
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
        console.error('Uso: maestri note write <nome.md> "<conteudo>"');
        process.exitCode = 1;
        return;
      }
      const res = await fetch(`${api}/api/orchestrator/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Maestri-Token': token },
        body: JSON.stringify({ name, content }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        console.error(`maestri: erro (${res.status}) - ${data.error || 'falha desconhecida'}`);
        process.exitCode = 1;
        return;
      }
      console.log(`maestri: nota ${name} atualizada.`);
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
        headers: { 'Content-Type': 'application/json', 'X-Maestri-Token': token },
        body: JSON.stringify({ name, content }),
      });
      const data = (await res.json()) as { ok?: boolean; filename?: string; error?: string };
      if (!res.ok) {
        console.error(`maestri: erro (${res.status}) - ${data.error || 'falha desconhecida'}`);
        process.exitCode = 1;
        return;
      }
      console.log(`maestri: nota criada: ${data.filename}`);
      return;
    }

    console.error('Uso: maestri note read <nome.md> | maestri note write <nome.md> "<conteudo>" | maestri note create "<conteudo>" [--name "Nome"]');
    process.exitCode = 1;
    return;
  }

  console.error('Uso: maestri list | maestri send <alvo> <mensagem> | maestri check <alvo> | maestri note read|write|create ...');
  process.exitCode = 1;
}

main().catch(err => {
  console.error('maestri: erro inesperado -', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});