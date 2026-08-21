"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Star,
  Users,
  Key,
  Lock,
  Save,
  Trash2,
  Clock,
  Calendar,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import { ADMIN_EMAIL } from "@/components/providers/firebase-provider";
import { ProductionTurno, UserRole } from "@/types";
import { cn } from "@/lib/utils";

export interface UserItemModalData {
  uid: string;
  email: string;
  name?: string;
  isApproved?: boolean;
  role?: UserRole;
  turno?: ProductionTurno | null;
  allowedMaoDeObra?: boolean;
  pinMaoDeObra?: string | null;
  pinMaoDeObraUpdatedAt?: string;
  created_at?: string;
  lastActive?: any;
}

interface UserManageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserItemModalData | null;
  onSave: (uid: string, data: {
    name: string;
    isApproved: boolean;
    role: UserRole;
    turno: ProductionTurno | null;
    allowedMaoDeObra: boolean;
  }) => Promise<void>;
  onResetPin: (user: UserItemModalData) => void;
  onDeleteUser: (user: UserItemModalData) => void;
}

export function UserManageModal({
  open,
  onOpenChange,
  user,
  onSave,
  onResetPin,
  onDeleteUser,
}: UserManageModalProps) {
  const [name, setName] = useState("");
  const [isApproved, setIsApproved] = useState(false);
  const [role, setRole] = useState<UserRole>("user");
  const [turno, setTurno] = useState<ProductionTurno | null>(null);
  const [allowedMaoDeObra, setAllowedMaoDeObra] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setIsApproved(user.isApproved ?? false);
      setRole(user.role || "user");
      setTurno(user.turno ?? null);
      setAllowedMaoDeObra(user.allowedMaoDeObra ?? (user.role === "supervisor" || user.role === "admin"));
    }
  }, [user]);

  if (!user) return null;

  const isAdmin = user.email === ADMIN_EMAIL;
  const displayName = user.name || "Sem Nome Definido";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "U";

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("O nome de exibição não pode ficar vazio.");
      return;
    }

    setSaving(true);
    try {
      await onSave(user.uid, {
        name: name.trim(),
        isApproved: isAdmin ? true : isApproved,
        role: isAdmin ? "admin" : role,
        turno: (role === "leader" || role === "supervisor") ? turno : null,
        allowedMaoDeObra: isAdmin ? true : (role === "supervisor" ? true : allowedMaoDeObra),
      });
      toast.success("Acessos e perfil atualizados com sucesso!");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar alterações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 rounded-3xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col bg-white dark:bg-slate-950">
        {/* Header com Avatar e Identificação do Usuário */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 border-b border-white/10 shrink-0">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-violet-600 flex items-center justify-center text-white text-base font-black shadow-md shrink-0 border-2 border-white/20">
                  {initials}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base font-black text-white flex items-center gap-2 truncate">
                    <span>{displayName}</span>
                    {isAdmin && (
                      <Badge className="bg-primary/20 text-primary-foreground border-primary/30 text-[10px] font-bold">
                        Admin Global
                      </Badge>
                    )}
                  </DialogTitle>
                  <p className="text-xs text-slate-300 font-medium truncate mt-0.5">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Corpo com Scroll */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Seção 1: Dados do Perfil */}
          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              Identificação & Status da Conta
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Nome de Exibição</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do colaborador..."
                  className="h-10 text-sm font-semibold bg-white dark:bg-slate-950"
                  disabled={isAdmin}
                />
              </div>

              {!isAdmin && (
                <div className="sm:col-span-2 pt-1">
                  <label className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                    isApproved
                      ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40"
                      : "bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40"
                  )}>
                    <div className="flex items-center gap-2.5">
                      {isApproved ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                      )}
                      <div>
                        <span className="text-xs font-black text-foreground block">
                          {isApproved ? "Conta Ativa e Aprovada" : "Acesso Revogado / Bloqueado"}
                        </span>
                        <span className="text-[11px] text-muted-foreground block">
                          {isApproved ? "O usuário tem permissão para fazer login no sistema." : "O usuário está impedido de acessar o sistema."}
                        </span>
                      </div>
                    </div>
                    <Checkbox
                      checked={isApproved}
                      onCheckedChange={(checked) => setIsApproved(checked === true)}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Seção 2: Função, Turno e Mão de Obra */}
          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-violet-600" />
              Função & Módulos Permitidos
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Cargo / Perfil</Label>
                <Select
                  value={role}
                  onValueChange={(val) => {
                    const newRole = val as UserRole;
                    setRole(newRole);
                    if (newRole === 'supervisor' || newRole === 'admin') {
                      setAllowedMaoDeObra(true);
                    }
                  }}
                  disabled={isAdmin}
                >
                  <SelectTrigger className="h-10 text-xs font-bold bg-white dark:bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário (Padrão)</SelectItem>
                    <SelectItem value="leader">Líder de Produção</SelectItem>
                    <SelectItem value="supervisor">Supervisor Geral</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(role === 'leader' || role === 'supervisor') && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase text-muted-foreground">Turno de Atuação</Label>
                  <Select
                    value={turno ? String(turno) : 'none'}
                    onValueChange={(val) => setTurno(val === 'none' ? null : (Number(val) as ProductionTurno))}
                  >
                    <SelectTrigger className="h-10 text-xs font-bold bg-white dark:bg-slate-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Turno 1 (07:20 – 15:50)</SelectItem>
                      <SelectItem value="2">Turno 2 (15:50 – 23:45)</SelectItem>
                      <SelectItem value="3">Turno 3 (23:45 – 07:20)</SelectItem>
                      <SelectItem value="none">Todos os Turnos / Geral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Permissão Mão de Obra */}
              {!isAdmin && role !== 'supervisor' && (
                <div className="sm:col-span-2 pt-1">
                  <label className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                    allowedMaoDeObra
                      ? "bg-primary/5 border-primary/30"
                      : "bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                  )}>
                    <div className="flex items-center gap-2.5">
                      <Users className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <span className="text-xs font-black text-foreground block">
                          Módulo Mão de Obra & Escala
                        </span>
                        <span className="text-[11px] text-muted-foreground block">
                          Permite consultar operadores, escala e lançar faltas/atestados no seu turno.
                        </span>
                      </div>
                    </div>
                    <Checkbox
                      checked={allowedMaoDeObra}
                      onCheckedChange={(checked) => setAllowedMaoDeObra(checked === true)}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Seção 3: Segurança & PIN de Mão de Obra */}
          <div className="p-4 rounded-2xl border border-violet-200/80 dark:border-violet-900/40 bg-violet-50/40 dark:bg-violet-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-violet-950 dark:text-violet-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                PIN de Segurança de Mão de Obra
              </h4>

              {user.pinMaoDeObra ? (
                <Badge className="bg-violet-600 text-white text-[10px] font-black gap-1">
                  <Key className="w-3 h-3" />
                  PIN Cadastrado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] font-bold text-slate-500 border-slate-300 dark:border-slate-700">
                  Sem PIN
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {user.pinMaoDeObra
                ? "Este usuário possui um PIN numérico configurado para desbloqueio do módulo de Mão de Obra."
                : "Este usuário ainda não possui um PIN cadastrado. O sistema solicitará a criação de um PIN no primeiro acesso a Mão de Obra."}
            </p>

            {user.pinMaoDeObra && (
              <div className="pt-1 flex items-center justify-between gap-3">
                <span className="text-[11px] text-muted-foreground">
                  {user.pinMaoDeObraUpdatedAt
                    ? `Atualizado em ${new Date(user.pinMaoDeObraUpdatedAt).toLocaleDateString('pt-BR')}`
                    : 'PIN ativo'}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onResetPin(user)}
                  className="h-8 text-xs font-bold gap-1.5 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-950/50"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-violet-600" />
                  Resetar PIN
                </Button>
              </div>
            )}
          </div>

          {/* Seção 4: Zona de Risco (Exclusão) */}
          {!isAdmin && (
            <div className="p-4 rounded-2xl border border-red-200/80 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-red-700 dark:text-red-400">Excluir Conta do Usuário</p>
                <p className="text-[11px] text-muted-foreground">
                  Remove permanentemente este usuário da base de dados.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDeleteUser(user)}
                className="h-8 text-xs font-bold text-red-600 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0 gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </Button>
            </div>
          )}
        </form>

        {/* Rodapé de Ações */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 text-xs font-bold rounded-xl"
            disabled={saving}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleFormSubmit}
            disabled={saving}
            className="h-9 text-xs font-bold gap-1.5 bg-primary text-white rounded-xl shadow-xs"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
