   import { LoginForm } from "@/components/auth/login-form";
import { Clock } from "@/components/clock/clock";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | NT Management",
  description: "Login to access your NT Management dashboard",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-400/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 dark:bg-purple-400/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 mb-8">
        <Clock className="text-center" showShift={true} />
      </div>
      <div className="relative z-10">
        <LoginForm />
      </div>
    </div>
  );
}