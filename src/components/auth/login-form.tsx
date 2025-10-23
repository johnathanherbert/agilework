   "use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/components/providers/firebase-provider';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import Link from 'next/link';

const formSchema = z.object({
  email: z.string().email({ message: 'Email inválido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

type FormData = z.infer<typeof formSchema>;

export const LoginForm = () => {
  const router = useRouter();
  const { signIn } = useFirebase();
  const [isLoading, setIsLoading] = useState(false);
  
  const {
    register,
    handleSubmit,
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
        toast.error('Falha no login. Verifique seu email e senha.');
        console.error('Login error:', error);
        return;
      }
      
      if (success) {
        toast.success('Login realizado com sucesso!');
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Unexpected error during login', error);
      toast.error('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };  return (
    <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-950 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          Login
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
          Entre para gerenciar suas Notas Técnicas
        </p>
      </div>      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            {...register('email')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-50 placeholder-gray-500 dark:placeholder-gray-400"
            disabled={isLoading}
            placeholder="seu@email.com"
          />
          {errors.email && (
            <p className="text-sm text-red-500 dark:text-red-400">
              {errors.email.message}
            </p>
          )}
        </div>
        
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Senha
          </label>
          <input
            id="password"
            type="password"
            {...register('password')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-50 placeholder-gray-500 dark:placeholder-gray-400"
            disabled={isLoading}
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="text-sm text-red-500 dark:text-red-400">
              {errors.password.message}
            </p>
          )}
        </div>        
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
      
      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Não tem uma conta?{' '}
          <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:underline">
            Registre-se
          </Link>
        </p>
      </div>
    </div>
  );
};