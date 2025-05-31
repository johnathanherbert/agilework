"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { RobotAlert } from "@/types";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { ScrollArea } from '@/components/ui/scroll-area';

interface RobotStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: RobotAlert[];
}

export function RobotStatusModal({
  open,
  onOpenChange,
  alerts
}: RobotStatusModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Status dos Robôs</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {alerts.length === 0 ? (
              <Alert variant="success" className="flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                <span>Todos os robôs estão funcionando normalmente</span>
              </Alert>
            ) : (
              alerts.map((alert) => (
                <Alert
                  key={alert.id}
                  variant={
                    alert.alert_type === 'error' ? 'destructive' :
                    alert.alert_type === 'warning' ? 'warning' : 'default'
                  }
                  className="flex items-center"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <div className="flex-1">
                    <p>{alert.message}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {new Date(alert.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </Alert>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
