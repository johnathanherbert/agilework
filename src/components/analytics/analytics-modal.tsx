   "use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';

interface AnalyticsModalProps {
  children?: React.ReactNode;
}

export const AnalyticsModal = ({ children }: AnalyticsModalProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Análises
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Análises e Relatórios</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">NTs por Status</h3>
              <p className="text-sm text-muted-foreground">
                Distribuição de NTs por status de pagamento
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">NTs por Período</h3>
              <p className="text-sm text-muted-foreground">
                Evolução temporal das NTs criadas
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Itens Mais Comuns</h3>
              <p className="text-sm text-muted-foreground">
                Materiais mais solicitados nas NTs
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};