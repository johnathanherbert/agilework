"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-center">
      <h2 className="text-3xl font-black text-foreground mb-2">Algo deu errado!</h2>
      <p className="text-sm text-muted-foreground mb-6">Ocorreu um erro ao carregar a página.</p>
      <Button onClick={() => reset()} className="rounded-xl font-bold">
        Tentar novamente
      </Button>
    </div>
  );
}
