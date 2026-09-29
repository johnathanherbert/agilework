import { LoginForm } from "@/components/auth/login-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar · AgileWork",
  description: "Acesse o sistema de gerenciamento de NTs e produção da pesagem",
};

export default function LoginPage() {
  return <LoginForm />;
}