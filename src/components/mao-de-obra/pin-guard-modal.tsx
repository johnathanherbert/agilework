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
        overlayClassName="bg-black/75 backdrop-blur-md"
        className={cn(
          "max-w-[420px] p-0 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] shadow-2xl overflow-hidden",
          isShaking && "animate-shake"
        )}
        // Previne fechar clicando fora ou com ESC
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header Industrial */}
        <div className="flex items-start justify-between p-5 border-b border-[var(--border)]">
          <div>
            <div className="flex items-center gap-2">
              {needsCreation ? (
                <KeyRound className="w-4 h-4 text-[var(--accent)]" />
              ) : (
                <Lock className="w-4 h-4 text-[var(--amber)]" />
              )}
              <h2 className="text-[15px] font-semibold text-[var(--text)]">
                {needsCreation ? "Criar PIN de Segurança" : "Acesso Protegido por PIN"}
              </h2>
            </div>
            <p className="text-xs text-[var(--text-3)] mt-1">
              {needsCreation
                ? `Olá, ${userData?.name || "Colaborador"}! Defina um PIN de 4 a 6 dígitos para o módulo de Mão de Obra.`
                : `Módulo protegido. Digite seu PIN de 4 a 6 dígitos para continuar.`}
            </p>
          </div>
        </div>

        {/* Corpo do Formulário */}
        <div className="p-5 space-y-4">
          {needsCreation ? (
            /* Fluxo 1: Criação de Novo PIN */
            <form onSubmit={handleCreatePin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-3)] block">
                  Novo PIN (4 a 6 dígitos numéricos)
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="••••"
                    value={newPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setNewPin(val);
                      setErrorMsg("");
                    }}
                    className="h-10 w-full text-center font-mono text-xl font-bold tracking-[0.3em] bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)] pr-9"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-3)] block">
                  Confirmar Novo PIN
                </label>
                <input
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
                  className="h-10 w-full text-center font-mono text-xl font-bold tracking-[0.3em] bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-[var(--radius)] bg-[var(--red)]/10 border border-[var(--red)]/30 flex items-center gap-2 text-xs font-medium text-[var(--red)]">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={saving || !newPin || newPin.length < 4}
                className="w-full h-9 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center justify-center gap-2"
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
              </button>
            </form>
          ) : (
            /* Fluxo 2: Digitação do PIN Cadastrado */
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-3)] block text-center">
                  Digite seu PIN de 4 a 6 dígitos
                </label>
                <div className="relative">
                  <input
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
                    className="h-12 w-full text-center font-mono text-2xl font-bold tracking-[0.35em] bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] outline-none focus:border-[var(--accent)] pr-9"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-[var(--radius)] bg-[var(--red)]/10 border border-[var(--red)]/30 flex items-center gap-2 text-xs font-medium text-[var(--red)]">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!pinInput || pinInput.length < 4}
                className="w-full h-9 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <span>Desbloquear Mão de Obra</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {/* Dica sobre esquecimento do PIN */}
              <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border)] text-center">
                <p className="text-[11px] text-[var(--text-3)] leading-relaxed">
                  Esqueceu seu PIN? Solicite o reset ao <strong className="text-[var(--text)]">Administrador</strong> na aba de Usuários para cadastrar um novo.
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Rodapé Industrial */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-2)]">
          <button
            type="button"
            onClick={handleExit}
            className="h-7 px-2.5 rounded-[var(--radius)] text-xs text-[var(--text-3)] hover:text-[var(--text)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair para Dashboard
          </button>

          {isAdmin && !needsCreation && (
            <button
              type="button"
              onClick={handleBypassAdmin}
              className="h-7 px-2.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
              Acesso Admin
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
