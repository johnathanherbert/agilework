import { LoginForm } from "@/components/auth/login-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solicitar Acesso · AgileWork",
  description: "Solicite acesso ao sistema de gerenciamento operacional",
};

export default function RegisterPage() {
  return <LoginForm />;
}