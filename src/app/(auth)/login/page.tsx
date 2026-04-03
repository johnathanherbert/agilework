   import { LoginForm } from "@/components/auth/login-form";
import { Clock } from "@/components/clock/clock";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | NT Management",
  description: "Login to access your NT Management dashboard",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FA] dark:bg-gray-900 p-4 relative">
      <div className="relative z-10 mb-8">
        <Clock className="text-center" showShift={true} />
      </div>
      <div className="relative z-10">
        <LoginForm />
      </div>
    </div>
  );
}