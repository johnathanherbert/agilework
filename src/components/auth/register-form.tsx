"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/components/providers/firebase-provider';
import toast from 'react-hot-toast';
import Link from 'next/link';

const formSchema = z
  .object({
    firstName: z.string().min(2, { message: 'Mínimo de 2 caracteres.' }),
    lastName: z.string().min(2, { message: 'Mínimo de 2 caracteres.' }),
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
  const { signUp } = useFirebase();
  const [isLoading, setIsLoading] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const formatTitleCase = (str: string) => {
    return str
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    
    try {
      const formattedFirstName = formatTitleCase(data.firstName);
      const formattedLastName = formatTitleCase(data.lastName);
      const formattedName = `${formattedFirstName} ${formattedLastName}`;
      const { error, success } = await signUp(data.email, data.password, formattedName);
      
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
    <div className="w-full max-w-md">
      <div className="p-8 space-y-8 bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700/70">
        {/* Header com ícone */}
        <div className="text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          
          <div>
            <h1 className="text-3xl font-black text-foreground">
              Criar Conta
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm font-medium">
              Registre-se para começar a usar o sistema
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="firstName" className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Nome
              </label>
              <input
                id="firstName"
                type="text"
                {...register('firstName')}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-300 font-medium"
                disabled={isLoading}
                placeholder="Ex: João"
              />
              {errors.firstName && (
                <p className="text-sm text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Sobrenome
              </label>
              <input
                id="lastName"
                type="text"
                {...register('lastName')}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-300 font-medium"
                disabled={isLoading}
                placeholder="Ex: Silva"
              />
              {errors.lastName && (
                <p className="text-sm text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-300 font-medium"
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
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-300 font-medium"
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
          
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Confirmar Senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword')}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-300 font-medium"
              disabled={isLoading}
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
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
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Registrando...
                </span>
              ) : 'Criar Conta'}
            </span>
          </button>
        </form>
        
        <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            Já tem uma conta?{' '}
            <Link 
              href="/login" 
              className="text-primary font-bold hover:opacity-80 transition-all duration-300"
            >
              Faça login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};