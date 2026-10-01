"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirebase } from '@/components/providers/firebase-provider';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, Mail, ArrowRight, CheckCircle, AlertCircle, Sparkles, User, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email({ message: 'E-mail corporativo inválido.' }),
  password: z.string().min(6, { message: 'A senha deve conter no mínimo 6 caracteres.' }),
});

const registerSchema = z.object({
  name: z.string().min(3, { message: 'Informe seu nome completo.' }),
  email: z.string().email({ message: 'E-mail corporativo inválido.' }),
  password: z.string().min(6, { message: 'A senha deve ter no mínimo 6 caracteres.' }),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

type AuthMode = 'login' | 'forgot' | 'register';

export const LoginForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, resetPassword, user } = useFirebase();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  // Relógio e turno em tempo real
  const [timeStr, setTimeStr] = useState('--:--:--');
  const [dateStr, setDateStr] = useState('');
  const [currentShift, setCurrentShift] = useState<{
    id: number;
    label: string;
    range: string;
    progress: number;
    elapsed: string;
    remaining: string;
  }>({
    id: 1,
    label: '1º turno',
    range: '07:20 – 15:50',
    progress: 50,
    elapsed: '4h transcorridas',
    remaining: '4h restantes',
  });

  // Atualizador de Relógio e Turnos
  useEffect(() => {
    const updateMetrics = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();

      setTimeStr(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      );

      try {
        const fullDate = now.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
        setDateStr(fullDate);
      } catch (e) {
        setDateStr('Hoje');
      }

      // Cálculo de Turnos (1º: 07:20-15:50, 2º: 15:50-23:50, 3º: 23:50-07:20)
      const currentMinutes = h * 60 + m;
      let shiftId = 1;
      let label = '1º turno';
      let range = '07:20 – 15:50';
      let startMinutes = 7 * 60 + 20; // 440
      let totalShiftMin = 510; // 8h30m = 510 min

      if (currentMinutes >= 7 * 60 + 20 && currentMinutes < 15 * 60 + 50) {
        shiftId = 1;
        label = '1º turno';
        range = '07:20 – 15:50';
        startMinutes = 7 * 60 + 20;
        totalShiftMin = 510;
      } else if (currentMinutes >= 15 * 60 + 50 && currentMinutes < 23 * 60 + 50) {
        shiftId = 2;
        label = '2º turno';
        range = '15:50 – 23:50';
        startMinutes = 15 * 60 + 50;
        totalShiftMin = 480; // 8h = 480 min
      } else {
        shiftId = 3;
        label = '3º turno';
        range = '23:50 – 07:20';
        startMinutes = 23 * 60 + 50;
        totalShiftMin = 450; // 7h30m = 450 min
      }

      let elapsedMin = currentMinutes >= startMinutes ? currentMinutes - startMinutes : (currentMinutes + 24 * 60) - startMinutes;
      const progress = Math.min(100, Math.max(0, Math.round((elapsedMin / totalShiftMin) * 100)));
      const leftMin = Math.max(0, totalShiftMin - elapsedMin);

      const elHours = Math.floor(elapsedMin / 60);
      const elMins = elapsedMin % 60;
      const remHours = Math.floor(leftMin / 60);
      const remMins = leftMin % 60;

      setCurrentShift({
        id: shiftId,
        label,
        range,
        progress,
        elapsed: `${elHours}h ${elMins}m transcorridas`,
        remaining: `${remHours}h ${remMins}m restantes`,
      });
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 1000);
    return () => clearInterval(interval);
  }, []);

  // Forms
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
    setValue: setLoginValue,
    getValues: getLoginValues,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const {
    register: registerReg,
    handleSubmit: handleRegSubmit,
    formState: { errors: regErrors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  // Lembrar e-mail salvo
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('agilework_remembered_email');
      if (savedEmail) {
        setLoginValue('email', savedEmail);
      }
    } catch (e) {}
  }, [setLoginValue]);

  // Se já logado, redirecionar
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const onLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setAlertMessage(null);

    try {
      localStorage.setItem('agilework_remembered_email', data.email);
      const { error } = await signIn(data.email, data.password);

      if (error) {
        let msg = 'E-mail ou senha incorretos.';
        if (error.code === 'auth/user-disabled') {
          msg = 'Esta conta foi desativada pelo administrador.';
        } else if (error.code === 'auth/too-many-requests') {
          msg = 'Muitas tentativas falhas. Aguarde um instante.';
        }
        setAlertMessage({ text: msg, type: 'error' });
        toast.error(msg);
        return;
      }

      toast.success('Autenticado com sucesso!');
      router.push('/dashboard');
    } catch (err) {
      setAlertMessage({ text: 'Falha inesperada ao conectar.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const onRegister = async (data: RegisterFormData) => {
    setIsLoading(true);
    setAlertMessage(null);

    try {
      const { error } = await signUp(data.email, data.password, data.name);
      if (error) {
        let msg = 'Erro ao solicitar cadastro. Verifique os dados.';
        if (error.code === 'auth/email-already-in-use') {
          msg = 'Este e-mail já está cadastrado.';
        }
        setAlertMessage({ text: msg, type: 'error' });
        toast.error(msg);
        return;
      }

      toast.success('Solicitação enviada com sucesso! Aguarde ativação.');
      setAlertMessage({
        text: 'Conta criada! Você já pode acessar com suas credenciais.',
        type: 'success',
      });
      setMode('login');
    } catch (err) {
      setAlertMessage({ text: 'Erro ao processar solicitação.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const onForgotPassword = async () => {
    const email = getLoginValues('email');
    if (!email || !email.includes('@')) {
      toast.error('Informe um e-mail válido para redefinição.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        toast.error('Falha ao enviar e-mail de recuperação.');
      } else {
        toast.success(`Link de redefinição enviado para ${email}!`);
        setAlertMessage({
          text: `Enviamos as instruções de redefinição para ${email}. Verifique sua caixa de entrada.`,
          type: 'success',
        });
      }
    } catch (e) {
      toast.error('Erro na solicitação.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] bg-[var(--bg)] text-[var(--text)] select-none">
      {/* ================= PAINEL ESQUERDO: TELEMETRIA & TURNO ================= */}
      <section className="hidden lg:flex flex-col justify-between bg-[var(--surface)] border-r border-[var(--border)] p-10 relative overflow-hidden">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[7px] bg-[var(--text)] text-[var(--bg)] grid place-items-center font-bold text-sm shadow-sm">
            A
          </div>
          <div>
            <b className="block text-sm font-semibold tracking-tight text-[var(--text)]">
              AgileWork
            </b>
            <small className="block text-xs text-[var(--text-3)] font-medium">
              Gestão de NTs e Nivelamento · Pesagem
            </small>
          </div>
        </div>

        {/* Hero Central: Relógio & Status do Turno */}
        <div className="my-auto max-w-lg">
          {/* Relógio Monospace Grande */}
          <div className="font-mono text-6xl font-medium tracking-tight text-[var(--text)] tabular-nums">
            {timeStr}
          </div>

          <div className="mt-3 text-base text-[var(--text-2)] font-medium capitalize">
            {dateStr}
          </div>

          {/* Card de Acompanhamento do Turno */}
          <div className="mt-8 pt-6 border-t border-[var(--border)]">
            <div className="flex justify-between items-baseline mb-2.5">
              <b className="text-sm font-semibold text-[var(--text)]">
                {currentShift.label}
              </b>
              <span className="font-mono text-xs text-[var(--text-3)]">
                {currentShift.range}
              </span>
            </div>

            {/* Barra de Progresso do Turno */}
            <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                style={{ width: `${currentShift.progress}%` }}
              />
            </div>

            <div className="flex justify-between mt-2 text-xs text-[var(--text-3)] font-mono">
              <span>{currentShift.elapsed}</span>
              <span>{currentShift.remaining}</span>
            </div>

            {/* Três Turnos */}
            <div className="grid grid-cols-3 mt-5 border border-[var(--border)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface-2)]">
              <div className={cn("p-2.5 border-r border-[var(--border)] text-xs", currentShift.id === 1 && "bg-[var(--accent-weak)] text-[var(--text)] font-semibold")}>
                <b className="block text-[11px] font-medium text-[var(--text-2)] mb-0.5">1º Turno</b>
                <span className="text-[10px] text-[var(--text-3)] font-mono">07:20 – 15:50</span>
              </div>
              <div className={cn("p-2.5 border-r border-[var(--border)] text-xs", currentShift.id === 2 && "bg-[var(--accent-weak)] text-[var(--text)] font-semibold")}>
                <b className="block text-[11px] font-medium text-[var(--text-2)] mb-0.5">2º Turno</b>
                <span className="text-[10px] text-[var(--text-3)] font-mono">15:50 – 23:50</span>
              </div>
              <div className={cn("p-2.5 text-xs", currentShift.id === 3 && "bg-[var(--accent-weak)] text-[var(--text)] font-semibold")}>
                <b className="block text-[11px] font-medium text-[var(--text-2)] mb-0.5">3º Turno</b>
                <span className="text-[10px] text-[var(--text-3)] font-mono">23:50 – 07:20</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé do Painel */}
        <div className="flex justify-between items-center text-xs text-[var(--text-3)] font-medium">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
            Infraestrutura Operando Normalmente
          </span>
          <span className="font-mono">Novamed · Grupo EMS</span>
        </div>
      </section>

      {/* ================= PAINEL DIREITO: FORMULÁRIOS ================= */}
      <section className="flex flex-col justify-between p-6 sm:p-10 relative">
        {/* Top Actions: Theme Switcher */}
        <div className="flex justify-end items-center">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 rounded-[6px] grid place-items-center text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
            title="Alternar tema"
          >
            {mounted ? (
              theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />
            ) : (
              <span className="w-4 h-4 block" />
            )}
          </button>
        </div>

        <div className="my-auto w-full max-w-[340px] mx-auto">
          {/* Header Mobile */}
          <div className="lg:hidden flex items-center justify-between mb-8 pb-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[6px] bg-[var(--text)] text-[var(--bg)] grid place-items-center font-bold text-xs">
                A
              </div>
              <div>
                <b className="text-xs font-bold text-[var(--text)]">AgileWork</b>
                <small className="block text-[10px] text-[var(--text-3)]">Pesagem</small>
              </div>
            </div>
            <div className="font-mono text-xs text-[var(--text-2)]">{timeStr}</div>
          </div>

          {/* ALERTA DE FEEDBACK */}
          {alertMessage && (
            <div className={cn(
              "flex gap-2.5 items-start p-3 rounded-[var(--radius)] text-xs mb-4 border leading-relaxed",
              alertMessage.type === 'error'
                ? "bg-[rgba(229,72,77,0.08)] border-[var(--red)] text-[var(--text)]"
                : "bg-[rgba(63,182,139,0.08)] border-[var(--green)] text-[var(--text)]"
            )}>
              {alertMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-[var(--red)] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-4 h-4 text-[var(--green)] shrink-0 mt-0.5" />
              )}
              <span>{alertMessage.text}</span>
            </div>
          )}

          {/* VISTA 1: ENTRAR (LOGIN) */}
          {mode === 'login' && (
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
                Entrar
              </h1>
              <p className="text-xs text-[var(--text-3)] mt-1 mb-5">
                Acesse para gerenciar notas técnicas e a produção da pesagem.
              </p>

                <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[var(--text-2)]">
                      E-mail corporativo
                    </label>
                    <input
                      type="email"
                      {...registerLogin('email')}
                      placeholder="nome@ems.com.br"
                      disabled={isLoading}
                      className="w-full h-9 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-weak)] transition-all"
                    />
                    {loginErrors.email && (
                      <p className="text-[11px] text-[var(--red)]">{loginErrors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <label className="block text-xs font-medium text-[var(--text-2)]">
                        Senha
                      </label>
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-[11px] text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        Esqueci minha senha
                      </button>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        {...registerLogin('password')}
                        placeholder="••••••••"
                        disabled={isLoading}
                        className="w-full h-9 px-3 pr-9 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-weak)] transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
                        title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {loginErrors.password && (
                      <p className="text-[11px] text-[var(--red)]">{loginErrors.password.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-9 mt-2 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] font-medium text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isLoading ? (
                      <span className="w-3.5 h-3.5 border-2 border-current border-r-transparent rounded-full animate-spin" />
                    ) : (
                      'Entrar no Sistema'
                    )}
                  </button>
                </form>

              <div className="mt-6 pt-5 border-t border-[var(--border)] text-center text-xs text-[var(--text-3)]">
                Não tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-[var(--accent)] font-medium hover:underline cursor-pointer ml-1"
                >
                  Solicitar acesso
                </button>
              </div>
            </div>
          )}

          {/* VISTA 2: ESQUECI A SENHA */}
          {mode === 'forgot' && (
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
                Redefinir senha
              </h1>
              <p className="text-xs text-[var(--text-3)] mt-1 mb-5">
                Informe seu e-mail corporativo. Enviaremos um link seguro para criar uma nova senha.
              </p>

              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[var(--text-2)]">
                    E-mail cadastrado
                  </label>
                  <input
                    type="email"
                    {...registerLogin('email')}
                    placeholder="nome@ems.com.br"
                    disabled={isLoading}
                    className="w-full h-9 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] transition-all"
                  />
                </div>

                <button
                  type="button"
                  onClick={onForgotPassword}
                  disabled={isLoading}
                  className="w-full h-9 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] font-medium text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-current border-r-transparent rounded-full animate-spin" />
                  ) : (
                    'Enviar link de redefinição'
                  )}
                </button>
              </div>

              <div className="mt-6 pt-5 border-t border-[var(--border)] text-center text-xs text-[var(--text-3)]">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-[var(--accent)] font-medium hover:underline cursor-pointer"
                >
                  Voltar para o login
                </button>
              </div>
            </div>
          )}

          {/* VISTA 3: SOLICITAR ACESSO / CADASTRO */}
          {mode === 'register' && (
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
                Solicitar acesso
              </h1>
              <p className="text-xs text-[var(--text-3)] mt-1 mb-5">
                Preencha seus dados para requisitar cadastro operacional.
              </p>

              <form onSubmit={handleRegSubmit(onRegister)} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[var(--text-2)]">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    {...registerReg('name')}
                    placeholder="Ex: João da Silva"
                    disabled={isLoading}
                    className="w-full h-9 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-all"
                  />
                  {regErrors.name && (
                    <p className="text-[11px] text-[var(--red)]">{regErrors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[var(--text-2)]">
                    E-mail corporativo
                  </label>
                  <input
                    type="email"
                    {...registerReg('email')}
                    placeholder="nome@ems.com.br"
                    disabled={isLoading}
                    className="w-full h-9 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-all"
                  />
                  {regErrors.email && (
                    <p className="text-[11px] text-[var(--red)]">{regErrors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[var(--text-2)]">
                    Senha de acesso
                  </label>
                  <input
                    type="password"
                    {...registerReg('password')}
                    placeholder="Mínimo 6 caracteres"
                    disabled={isLoading}
                    className="w-full h-9 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-all font-mono"
                  />
                  {regErrors.password && (
                    <p className="text-[11px] text-[var(--red)]">{regErrors.password.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-9 mt-2 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] font-medium text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-current border-r-transparent rounded-full animate-spin" />
                  ) : (
                    'Enviar solicitação'
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-[var(--border)] text-center text-xs text-[var(--text-3)]">
                Já possui conta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-[var(--accent)] font-medium hover:underline cursor-pointer ml-1"
                >
                  Fazer login
                </button>
              </div>
            </div>
          )}

          {/* Legal disclaimer */}
          <p className="text-[11px] text-[var(--text-3)] text-center mt-6">
            Uso restrito a colaboradores autorizados. Acessos são registrados para auditoria.
          </p>
        </div>

        {/* Rodapé Direita */}
        <div className="text-center lg:text-right text-[11px] text-[var(--text-3)] font-mono">
          AgileWork v3.0
        </div>
      </section>
    </div>
  );
};