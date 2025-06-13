"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/providers/supabase-provider';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import Link from 'next/link';

const formSchema = z
  .object({
    email: z.string().email({ message: 'Email inválido.' }),
    password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
    confirmPassword: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof formSchema>;

export const RegisterForm = () => {
  const router = useRouter();
  const { signUp } = useSupabase();
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
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    
    try {
      const { error, success } = await signUp(data.email, data.password);
      
      if (error) {
        toast.error('Falha no registro. Tente novamente.');
        console.error('Registration error:', error);
        return;
      }
      
      if (success) {
        toast.success('Registro realizado com sucesso!');
        router.push('/login');
      }
    } catch (error) {
      console.error('Unexpected error during registration', error);
      toast.error('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-950 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          Criar Conta
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
          Registre-se para começar a usar o sistema
        </p>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
        
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Confirmar Senha
          </label>
          <input
            id="confirmPassword"
            type="password"
            {...register('confirmPassword')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-50 placeholder-gray-500 dark:placeholder-gray-400"
            disabled={isLoading}
            placeholder="••••••••"
          />
          {errors.confirmPassword && (
            <p className="text-sm text-red-500 dark:text-red-400">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
          <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Registrando...' : 'Registrar'}
        </Button>
      </form>
      
      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Já tem uma conta?{' '}
          <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
            Faça login
          </Link>
        </p>
      </div>
    </div>
  );
};