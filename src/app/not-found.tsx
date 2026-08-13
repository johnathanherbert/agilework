"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-center">
      <h2 className="text-4xl font-black text-foreground mb-2">404</h2>
      <p className="text-sm text-muted-foreground mb-6">Página não encontrada</p>
      <Link href="/dashboard">
        <Button className="rounded-xl font-bold">Voltar ao Início</Button>
      </Link>
    </div>
  );
}
