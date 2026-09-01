import { useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff, Users, Link2, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { login } from '../api';
import './login-page.css';

interface LoginPageProps {
  onSuccess: () => void;
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success(`Que bom te ver de novo, ${username}! Sua mesa está pronta.`);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-brand">
        <div className="login-brand-inner">
          <img src="/logo.png" alt="K-Mestre AI" className="login-brand-logo" />
          <h1>
            Monte sua equipe de agentes, <span>no mesmo canvas</span>
          </h1>
          <p>
            O K-Mestre AI é uma mesa de trabalho visual onde você conecta agentes de IA,
            terminais e notas. Você é o líder: o <strong>Maestro</strong> recebe o objetivo
            do projeto e repassa as demandas para cada especialista — engenheiro, designer,
            QA, planejador. No final, tudo pronto para você visualizar.
          </p>

          <div className="login-features">
            <div className="login-feature">
              <Users size={18} />
              <span>Vários agentes com papéis (roles) conversando entre si</span>
            </div>
            <div className="login-feature">
              <Link2 size={18} />
              <span>Conecte terminais e orquestre as entregas em tempo real</span>
            </div>
            <div className="login-feature">
              <StickyNote size={18} />
              <span>Notas compartilhadas mantêm o contexto de toda a equipe</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-side">
        <form onSubmit={handleSubmit} className="login-card">
          <div className="login-card-heading">
            <h2>Bem-vindo de volta</h2>
            <p>Entre para acessar sua mesa de trabalho</p>
          </div>

          <div className="login-field">
            <label htmlFor="login-username">Usuário</label>
            <input
              id="login-username"
              type="text"
              placeholder="Seu usuário"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="login-input"
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Senha</label>
            <div className="login-input-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Sua senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                className={`login-input login-input-with-icon`}
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit"
            disabled={loading || !username || !password}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="login-hint">
            Primeiro acesso? Use <code>admin</code> / <code>admin</code>
          </div>
        </form>
      </div>
    </div>
  );
}