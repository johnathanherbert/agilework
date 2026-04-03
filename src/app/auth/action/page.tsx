import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Clock } from "@/components/clock/clock";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Redefinir Senha | EMS Novamed",
  description: "Redefina sua senha de acesso",
};

export default function AuthActionPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FA] dark:bg-gray-900 p-4 relative">
      <div className="relative z-10 mb-8">
        <Clock className="text-center" showShift={true} />
      </div>
      <div className="relative z-10">
        <Suspense fallback={<div className="w-96 h-96 bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-gray-200 animate-pulse flex items-center justify-center font-bold text-gray-500">Autenticando...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
