   import { RegisterForm } from "@/components/auth/register-form";
import { Clock } from "@/components/clock/clock";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register | NT Management",
  description: "Create a new account for NT Management system",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="mb-8">
        <Clock className="text-center" showShift={true} />
      </div>
      <RegisterForm />
    </div>
  );
}