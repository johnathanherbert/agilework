"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Lock,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  ArrowRight,
  LogOut,
  RotateCcw,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useFirebase, ADMIN_EMAIL } from "@/components/providers/firebase-provider";
import { setUserMaoDeObraPin } from "@/lib/firestore-helpers";
import { cn } from "@/lib/utils";

interface PinGuardModalProps {
  onUnlock: () => void;
  isUnlocked: boolean;
}

export function PinGuardModal({ onUnlock, isUnlocked }: PinGuardModalProps) {
  const { userData, refreshUserData } = useFirebase();
  const router = useRouter();

  const [pinInput, setPinInput] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Determina se o usuário precisa criar um PIN (primeiro acesso ou após reset do ADM)
  const needsCreation = !userData?.pinMaoDeObra;
  const isAdmin = userData?.email === ADMIN_EMAIL || userData?.role === 'admin';

  // Foca no input quando o modal abrir
  useEffect(() => {
    if (!isUnlocked) {
      setErrorMsg("");
      setPinInput("");
      setNewPin("");
      setConfirmPin("");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isUnlocked, needsCreation]);

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
  };

  // Desbloqueio com PIN existente
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!pinInput.trim()) {
      triggerError("Por favor, digite o seu PIN de segurança.");
      return;
    }

    if (pinInput.trim() === userData?.pinMaoDeObra) {
      toast.success("Mão de Obra desbloqueada!", { id: "pin-unlock", icon: "🔓" });
      onUnlock();
    } else {
      triggerError("PIN incorreto. Verifique os dígitos e tente novamente.");
      setPinInput("");
      inputRef.current?.focus();
    }
  };

  // Criação de novo PIN (primeiro acesso ou pós-reset)
  const handleCreatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const cleanNewPin = newPin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!cleanNewPin || !/^\d{4,6}$/.test(cleanNewPin)) {
      triggerError("O PIN deve conter entre 4 e 6 dígitos numéricos.");
      return;
    }

    if (cleanNewPin !== cleanConfirm) {
      triggerError("A confirmação do PIN não confere com o novo PIN.");
      return;
    }

    if (!userData?.uid) {
      triggerError("Usuário não identificado.");
      return;
    }

    setSaving(true);
    try {
      await setUserMaoDeObraPin(userData.uid, cleanNewPin);
      await refreshUserData();
      toast.success("PIN de segurança cadastrado com sucesso!", { icon: "🔒" });
      onUnlock();
    } catch (err) {
      console.error("Erro ao salvar PIN:", err);
      triggerError("Erro ao salvar o PIN. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleBypassAdmin = () => {
    if (isAdmin) {
      toast.success("Acesso liberado como Administrador.", { icon: "🛡️" });
      onUnlock();
    }
  };

  const handleExit = () => {
    router.push("/dashboard");
  };

  if (isUnlocked) return null;

  return (
    <Dialog open={!isUnlocked} onOpenChange={() => {}}>
      <DialogContent
        className={cn(
          "max-w-md p-0 gap-0 rounded-3xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden bg-white dark:bg-slate-950",
          isShaking && "animate-shake"
        )}
        // Previne fechar clicando fora ou com ESC
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header Visual Gradiente */}
        <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-slate-900 text-white p-6 text-center relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mx-auto mb-3 shadow-lg backdrop-blur-xs">
            {needsCreation ? (
              <KeyRound className="w-7 h-7 text-violet-200 animate-pulse" />
            ) : (
              <Lock className="w-7 h-7 text-violet-200" />
            )}
          </div>

          <DialogHeader className="text-center">
            <DialogTitle className="text-xl font-black text-white text-center">
              {needsCreation ? "Criar PIN de Segurança" : "Acesso Protegido por PIN"}
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-violet-200/90 font-medium mt-1 max-w-xs mx-auto">
            {needsCreation
              ? `Olá, ${userData?.name || "Colaborador"}! Defina um PIN de 4 a 6 dígitos para o módulo de Mão de Obra.`
              : `Módulo de Mão de Obra protegido. Digite seu PIN de 4 a 6 dígitos para continuar.`}
          </p>
        </div>

        {/* Corpo do Formulário */}
        <div className="p-6 space-y-5">
          {needsCreation ? (
            /* Fluxo 1: Criação de Novo PIN */
            <form onSubmit={handleCreatePin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block uppercase tracking-wider">
                  Novo PIN (4 a 6 dígitos numéricos)
                </label>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Ex: 1234"
                    value={newPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setNewPin(val);
                      setErrorMsg("");
                    }}
                    className="h-12 text-center text-xl font-black tracking-widest bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block uppercase tracking-wider">
                  Confirmar Novo PIN
                </label>
                <Input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Repita o mesmo PIN"
                  value={confirmPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setConfirmPin(val);
                    setErrorMsg("");
                  }}
                  className="h-12 text-center text-xl font-black tracking-widest bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={saving || !newPin || newPin.length < 4}
                className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white font-black text-sm rounded-xl gap-2 shadow-lg shadow-violet-500/20"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando PIN...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Cadastrar PIN & Acessar
                  </>
                )}
              </Button>
            </form>
          ) : (
            /* Fluxo 2: Digitação do PIN Cadastrado */
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block text-center uppercase tracking-wider">
                  Digite seu PIN de 4 a 6 dígitos
                </label>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="••••"
                    value={pinInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setPinInput(val);
                      setErrorMsg("");
                    }}
                    className="h-14 text-center text-2xl font-black tracking-widest bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={!pinInput || pinInput.length < 4}
                className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white font-black text-sm rounded-xl gap-2 shadow-lg shadow-violet-500/20"
              >
                Desbloquear Mão de Obra
                <ArrowRight className="w-4 h-4" />
              </Button>

              {/* Dica sobre esquecimento do PIN */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Esqueceu seu PIN? Solicite o reset ao <strong className="text-foreground">Administrador</strong> na aba de Acessos para cadastrar um novo.
                </p>
              </div>
            </form>
          )}

          {/* Ações Secundárias */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleExit}
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair para Dashboard
            </Button>

            {isAdmin && !needsCreation && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBypassAdmin}
                className="text-xs text-violet-600 dark:text-violet-400 font-bold hover:bg-violet-50 dark:hover:bg-violet-950/40 gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Acesso Admin
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
