   import { RegisterForm } from "@/components/auth/register-form";
import { Clock } from "@/components/clock/clock";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register | NT Management",
  description: "Create a new account for NT Management system",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-green-500/10 dark:bg-green-400/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-400/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 mb-8">
        <Clock className="text-center" showShift={true} />
      </div>
      <div className="relative z-10">
        <RegisterForm />
      </div>
    </div>
  );
}