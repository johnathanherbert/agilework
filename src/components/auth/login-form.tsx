   "use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/components/providers/firebase-provider';
import toast from 'react-hot-toast';
import Link from 'next/link';

const formSchema = z.object({
  email: z.string().email({ message: 'Email inválido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

type FormData = z.infer<typeof formSchema>;

export const LoginForm = () => {
  const router = useRouter();
  const { signIn, resetPassword } = useFirebase();
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    
    try {
      const { error, success } = await signIn(data.email, data.password);
      
      if (error) {
        let errorMsg = 'Falha no login. Verifique seu email e senha.';
        const code = error.code;
        
        switch (code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorMsg = 'E-mail ou senha incorretos.';
            break;
          case 'auth/too-many-requests':
            errorMsg = 'Muitas tentativas falhas. Tente novamente mais tarde.';
            break;
          case 'auth/user-disabled':
            errorMsg = 'Esta conta foi desativada pelo administrador.';
            break;
        }

        toast.error(errorMsg);
        console.error('Login error:', error);
        return;
      }

        toast.success('Login realizado com sucesso!');
        router.push('/dashboard');
    } catch (error) {
      console.error('Unexpected error during login', error);
      toast.error('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const emailStr = getValues('email');
    if (!emailStr || !emailStr.includes('@')) {
      toast.error('Por favor, preencha um e-mail válido no campo acima para recuperar a senha.');
      return;
    }

    setIsResetting(true);
    try {
      const { error, success } = await resetPassword(emailStr);
      if (error) {
        toast.error('Ocorreu um erro ao enviar o link de proteção. Verifique o servidor.');
      } else if (success) {
        toast.success(`Link de recuperação enviado para ${emailStr}! Cheque sua caixa de entrada.`);
      }
    } catch (e) {
      toast.error('Erro na solicitação de recuperação.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="p-8 space-y-8 bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/70">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          
          <div>
            <h1 className="text-3xl font-black text-foreground">
              Bem-vindo!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm font-medium">
              Entre para gerenciar suas Notas Técnicas
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-300 font-medium"
              disabled={isLoading}
              placeholder="seu@email.com"
            />
            {errors.email && (
              <p className="text-sm text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {errors.email.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Senha
            </label>
            <input
              id="password"
              type="password"
              {...register('password')}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-300 font-medium"
              disabled={isLoading}
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-sm text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {errors.password.message}
              </p>
            )}
          </div>        
          
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={isLoading || isResetting}
              className="text-sm font-bold text-gray-500 hover:text-primary transition-colors disabled:opacity-50"
            >
              {isResetting ? "Processando envio..." : "Esqueci minha senha"}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl px-6 py-3 bg-primary text-primary-foreground font-bold text-base tracking-wide shadow-sm hover:bg-primary/90 transition-colors duration-200 disabled:opacity-60"
          >
            <span className="flex items-center justify-center gap-2">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Entrando...
                </span>
              ) : 'Entrar'}
            </span>
          </button>
        </form>
        
        <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            Não tem uma conta?{' '}
            <Link 
              href="/register" 
              className="text-primary font-bold hover:opacity-80 transition-all duration-300"
            >
              Registre-se aqui
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};