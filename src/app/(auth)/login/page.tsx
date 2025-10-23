   import { LoginForm } from "@/components/auth/login-form";
import { Clock } from "@/components/clock/clock";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | NT Management",
  description: "Login to access your NT Management dashboard",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 dark:from-blue-900 dark:via-indigo-950 dark:to-purple-950 p-4 relative overflow-hidden">
      {/* Background decoration - UI 2.0 */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Blur circles animados */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400/30 dark:bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-purple-400/30 dark:bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-indigo-400/30 dark:bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]"></div>
      </div>
      
      <div className="relative z-10 mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <Clock className="text-center" showShift={true} />
      </div>
      <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '200ms' }}>
        <LoginForm />
      </div>
    </div>
  );
}