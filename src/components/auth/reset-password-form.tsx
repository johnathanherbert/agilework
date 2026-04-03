"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirebase } from '@/components/providers/firebase-provider';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';

const formSchema = z
  .object({
    password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
    confirmPassword: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof formSchema>;

export const ResetPasswordForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  
  const { confirmReset } = useFirebase();
  const [isLoading, setIsLoading] = useState(false);
  const [successMode, setSuccessMode] = useState(false);

  // Redireciona de volta para login se alguém acessar a rota sem o código de segurança do e-mail.
  useEffect(() => {
    if (!oobCode) {
      toast.error('Código de autorização inválido ou expirado.');
      router.push('/login');
    }
  }, [oobCode, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!oobCode) return;
    
    setIsLoading(true);
    
    try {
      const { error, success } = await confirmReset(oobCode, data.password);
      
      if (error) {
        let errorMsg = 'Falha ao redefinir a senha.';
        const code = error.code;
        if (code === 'auth/expired-action-code') {
          errorMsg = 'Este link expirou. Solicite um novo pelo aplicativo.';
        } else if (code === 'auth/invalid-action-code') {
          errorMsg = 'Este link é inválido ou a senha já foi alterada.';
        } else if (code === 'auth/weak-password') {
          errorMsg = 'A senha é muito fraca. Tente misturar letras e números.';
        }
        toast.error(errorMsg);
        return;
      }
      
      if (success) {
        setSuccessMode(true);
        toast.success('Senha atualizada com sucesso!');
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } catch (error) {
      console.error('Unexpected error', error);
      toast.error('Ocorreu um erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!oobCode) return null; // Evita renderização de ghost frame antes do redirect

  return (
    <div className="w-full max-w-md">
      <div className="p-8 space-y-8 bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/70">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          
          <div>
            <h1 className="text-3xl font-black text-foreground">
              Nova Senha
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm font-medium">
              {successMode 
                ? "Sua senha foi redefinida com sucesso. Redirecionando..."
                : "Digite uma senha forte para recuperar a sua conta."
              }
            </p>
          </div>
        </div>

        {!successMode ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Nova Senha
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
                  {errors.password.message}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Confirmar Nova Senha
              </label>
              <input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-300 font-medium"
                disabled={isLoading}
                placeholder="••••••••"
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>        
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl px-6 py-3 bg-primary text-primary-foreground font-bold text-base tracking-wide shadow-sm hover:bg-primary/90 transition-colors duration-200 disabled:opacity-60"
            >
              <span className="flex items-center justify-center gap-2">
                {isLoading ? 'Salvando...' : 'Redefinir Senha e Entrar'}
              </span>
            </button>
          </form>
        ) : (
          <div className="flex justify-center pb-4">
             <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-4 border-emerald-50 dark:border-emerald-900/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
