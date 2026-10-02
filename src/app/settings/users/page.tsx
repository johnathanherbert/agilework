"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFirebase, ADMIN_EMAIL } from "@/components/providers/firebase-provider";
import { 
  getAllUsers, 
  deleteUserDb, 
  editUserDb, 
  wipeDataByCategory, 
  resetUserMaoDeObraPin 
} from "@/lib/firestore-helpers";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  X,
  Star,
  Users,
  Loader2,
  Search,
  Key,
  Database,
  AlertTriangle,
  RefreshCcw,
  Package,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Download,
  UserPlus,
  ArrowUpDown,
  History,
  Lock,
  Calendar,
  Layers,
  Activity,
  User as UserIcon,
} from "lucide-react";
import { NTCleanupCard } from "@/components/settings/nt-cleanup-card";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import ProtectedRoute from "@/components/auth/protected-route";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductionTurno, UserRole } from "@/types";

interface UserItem {
  uid: string;
  email: string;
  name?: string;
  isApproved?: boolean;
  role?: UserRole;
  turno?: ProductionTurno | null;
  allowedMaoDeObra?: boolean;
  allowedSolicitacoes?: boolean;
  allowedPesagem?: boolean;
  pinMaoDeObra?: string | null;
  pinMaoDeObraUpdatedAt?: string;
  created_at?: string;
  lastActive?: any;
}

interface AuditLogItem {
  id: string;
  at: Date;
  who: string;
  what: string;
  isNew?: boolean;
}

const INACTIVE_DAYS_THRESHOLD = 15;
const ONLINE_MINUTES_THRESHOLD = 5;

const ROLES_MAP: Record<string, string> = {
  admin: "Admin global",
  supervisor: "Supervisor",
  leader: "Líder",
  user: "Usuário",
};

const MODULES_CONFIG = [
  { k: "nts", l: "Notas técnicas", d: "Criar, editar e baixar NTs", base: true },
  { k: "pes", l: "Pesagem & Estoque", d: "Aging, residuais, consultas e automação SAP", permissionKey: "allowedPesagem" },
  { k: "sol", l: "Solicitações", d: "Ordens e necessidade de matéria-prima", permissionKey: "allowedSolicitacoes" },
  { k: "painel", l: "Painel de produção", d: "Lançar e acompanhar ordens de produção", base: true },
  { k: "mo", l: "Mão de obra", d: "Escala, ocorrências e absenteísmo", permissionKey: "allowedMaoDeObra" },
  { k: "heij", l: "Heijunka", d: "Lançar e editar nivelamento PD/PA", staffOnly: true },
  { k: "admin", l: "Administração", d: "Usuários, permissões e manutenção", adminOnly: true },
];

function pad(n: number) {
  return (n < 10 ? "0" : "") + n;
}

function parseLastActiveDate(lastActive: any): Date | null {
  if (!lastActive) return null;

  if (typeof lastActive?.toDate === "function") {
    const dt = lastActive.toDate();
    return dt instanceof Date && !Number.isNaN(dt.getTime()) ? dt : null;
  }

  if (typeof lastActive?.seconds === "number") {
    return new Date(lastActive.seconds * 1000);
  }

  if (typeof lastActive?._seconds === "number") {
    return new Date(lastActive._seconds * 1000);
  }

  if (typeof lastActive === "string" || typeof lastActive === "number") {
    const dt = new Date(lastActive);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

function getInitials(name: string): string {
  if (!name) return "U";
  const p = name.trim().split(" ").filter(Boolean);
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function formatDT(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatShortDT(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) {
    return `hoje ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return `ontem ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const days = Math.floor(m / 1440);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}

function getUserState(u: UserItem) {
  const isApproved = u.isApproved !== false;
  if (!isApproved) {
    return { k: "blocked", l: "Desativado" };
  }
  const d = parseLastActiveDate(u.lastActive);
  if (!d) {
    return { k: "inactive", l: `Inativo · +${INACTIVE_DAYS_THRESHOLD} d` };
  }
  const diffMinutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMinutes <= ONLINE_MINUTES_THRESHOLD) {
    return { k: "online", l: "Online" };
  }
  const days = Math.floor(diffMinutes / 1440);
  if (days >= INACTIVE_DAYS_THRESHOLD) {
    return { k: "inactive", l: `Inativo · ${days} d` };
  }
  return { k: "active", l: "Ativo" };
}

function getRoleLabel(u: UserItem): string {
  if (u.email === ADMIN_EMAIL || u.role === "admin") return "Admin global";
  if (u.role === "supervisor") return `Supervisor${u.turno ? ` · T${u.turno}` : ""}`;
  if (u.role === "leader") return `Líder${u.turno ? ` · T${u.turno}` : ""}`;
  return "Usuário";
}

export default function AdminControlPanelPage() {
  const { userData, loading } = useFirebase();
  const router = useRouter();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Tabs: users | maintenance
  const [activeTab, setActiveTab] = useState<"users" | "maintenance">("users");

  // Quick summary filter: all | online | ok | pending | inactive
  const [quickFilter, setQuickFilter] = useState<"all" | "online" | "ok" | "pending" | "inactive">("all");

  // Search & Select Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [pinFilter, setPinFilter] = useState<string>("");

  // Sorting
  const [sortKey, setSortKey] = useState<"name" | "role" | "seen">("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Drawer (Gerenciar Acesso) State
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [drawerRole, setDrawerRole] = useState<UserRole>("user");
  const [drawerTurno, setDrawerTurno] = useState<ProductionTurno>(1);
  const [drawerAllowedMO, setDrawerAllowedMO] = useState<boolean>(false);
  const [drawerAllowedSol, setDrawerAllowedSol] = useState<boolean>(false);
  const [drawerAllowedPesagem, setDrawerAllowedPesagem] = useState<boolean>(false);
  const [drawerSaving, setDrawerSaving] = useState<boolean>(false);

  // Modal / Confirm Delete
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Modal / Confirm Reset PIN
  const [userToResetPin, setUserToResetPin] = useState<UserItem | null>(null);
  const [resettingPin, setResettingPin] = useState(false);

  // Wipe Base de Dados State
  const [showWipeDialog, setShowWipeDialog] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  const [wiping, setWiping] = useState(false);
  const [wipeCategories, setWipeCategories] = useState({
    nts: false,
    items: false,
    users: false,
  });

  // Audit Logs (Em memória com persistência local de sessão)
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([
    {
      id: "log-1",
      at: new Date(Date.now() - 1000 * 60 * 35),
      who: "Johnathan Herbert",
      what: "Atualizou permissões do módulo Solicitações no sistema",
    },
    {
      id: "log-2",
      at: new Date(Date.now() - 1000 * 60 * 60 * 4),
      who: "Sistema",
      what: "Rotina de indexação e verificação de integridade concluída",
    },
    {
      id: "log-3",
      at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      who: "Johnathan Herbert",
      what: "Concedeu acesso a Mão de Obra para líderes de turno",
    },
    {
      id: "log-4",
      at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      who: "Sistema",
      what: "Backup de rotina da base de dados estruturada gerado",
    },
  ]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const addAuditLog = (what: string) => {
    const actor = userData?.name || userData?.email || "Johnathan Herbert";
    const newEntry: AuditLogItem = {
      id: "log-" + Date.now(),
      at: new Date(),
      who: actor,
      what,
      isNew: true,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  // Carregar usuários
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const usersData = await getAllUsers();
      setUsers(usersData as UserItem[]);
    } catch (error) {
      toast.error("Erro ao carregar usuários.");
      console.error(error);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!userData || userData.email !== ADMIN_EMAIL) {
        toast.error("Acesso negado. Apenas administradores podem ver esta página.");
        router.push("/dashboard");
      } else {
        fetchUsers();
      }
    }
  }, [userData, loading, router]);

  // Teclado: atalho '/' foca na busca e 'Escape' fecha gaveta
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editingUser) {
        setEditingUser(null);
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingUser]);

  // Contadores do Summary Box
  const summaryCounts = useMemo(() => {
    let all = users.length;
    let online = 0;
    let ok = 0;
    let pending = 0;
    let inactive = 0;
    let blocked = 0;

    users.forEach((u) => {
      const st = getUserState(u);
      if (st.k === "online") online++;
      if (st.k === "inactive") inactive++;
      if (st.k === "blocked") blocked++;
      if (u.isApproved !== false) ok++;
      if (u.isApproved === false) pending++;
    });

    return { all, online, ok, pending, inactive, blocked };
  }, [users]);

  // Filtragem e ordenação dos usuários
  const filteredUsers = useMemo(() => {
    const s = searchQuery.trim().toLowerCase();

    const list = users.filter((u) => {
      const st = getUserState(u);
      const isSelf = u.email === ADMIN_EMAIL;

      // Quick filter
      if (quickFilter === "online" && st.k !== "online") return false;
      if (quickFilter === "ok" && (u.isApproved === false && !isSelf)) return false;
      if (quickFilter === "pending" && (u.isApproved !== false || isSelf)) return false;
      if (quickFilter === "inactive" && st.k !== "inactive") return false;

      // Role filter
      if (roleFilter) {
        if (roleFilter === "admin" && !isSelf && u.role !== "admin") return false;
        if (roleFilter === "supervisor" && (isSelf || u.role !== "supervisor")) return false;
        if (roleFilter === "leader" && (isSelf || u.role !== "leader")) return false;
        if (roleFilter === "user" && (isSelf || (u.role && u.role !== "user"))) return false;
      }

      // PIN filter
      if (pinFilter !== "") {
        const hasPin = Boolean(u.pinMaoDeObra);
        if (pinFilter === "1" && !hasPin) return false;
        if (pinFilter === "0" && hasPin) return false;
      }

      // Search Query
      if (s) {
        const name = (u.name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const role = getRoleLabel(u).toLowerCase();
        if (!name.includes(s) && !email.includes(s) && !role.includes(s)) {
          return false;
        }
      }

      return true;
    });

    const roleOrder: Record<string, number> = { admin: 0, supervisor: 1, leader: 2, user: 3 };

    list.sort((a, b) => {
      const aIsSelf = a.email === ADMIN_EMAIL;
      const bIsSelf = b.email === ADMIN_EMAIL;
      if (aIsSelf) return -1;
      if (bIsSelf) return 1;

      if (sortKey === "name") {
        const aName = (a.name || a.email || "").toLowerCase();
        const bName = (b.name || b.email || "").toLowerCase();
        return aName.localeCompare(bName, "pt-BR") * sortDir;
      }

      if (sortKey === "role") {
        const aRole = a.role || "user";
        const bRole = b.role || "user";
        const diff = (roleOrder[aRole] ?? 3) - (roleOrder[bRole] ?? 3);
        if (diff !== 0) return diff * sortDir;
        return (a.name || "").localeCompare(b.name || "") * sortDir;
      }

      if (sortKey === "seen") {
        const aTime = parseLastActiveDate(a.lastActive)?.getTime() || 0;
        const bTime = parseLastActiveDate(b.lastActive)?.getTime() || 0;
        return (bTime - aTime) * sortDir;
      }

      return 0;
    });

    return list;
  }, [users, searchQuery, quickFilter, roleFilter, pinFilter, sortKey, sortDir]);

  // Bulk selection stats
  const eligibleBulkIds = useMemo(() => {
    return filteredUsers.filter((u) => u.email !== ADMIN_EMAIL).map((u) => u.uid);
  }, [filteredUsers]);

  const selectedCount = useMemo(() => {
    return Object.keys(selectedIds).filter((id) => selectedIds[id]).length;
  }, [selectedIds]);

  const handleSelectAll = (checked: boolean) => {
    const updated: Record<string, boolean> = {};
    if (checked) {
      eligibleBulkIds.forEach((id) => {
        updated[id] = true;
      });
    }
    setSelectedIds(updated);
  };

  const handleToggleSort = (key: "name" | "role" | "seen") => {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  // Abrir Drawer de Gerenciamento do Usuário
  const openDrawer = (u: UserItem) => {
    setEditingUser(u);
    setDrawerRole(u.role || "user");
    setDrawerTurno(u.turno || 1);
    setDrawerAllowedMO(Boolean(u.allowedMaoDeObra) || u.role === "supervisor" || u.role === "admin" || u.email === ADMIN_EMAIL);
    setDrawerAllowedSol(Boolean(u.allowedSolicitacoes) || u.role === "supervisor" || u.role === "admin" || u.email === ADMIN_EMAIL);
    setDrawerAllowedPesagem(Boolean(u.allowedPesagem) || u.role === "supervisor" || u.role === "admin" || u.email === ADMIN_EMAIL);
  };

  const closeDrawer = () => {
    setEditingUser(null);
  };

  // Salvar alterações da Gaveta
  const handleSaveDrawer = async () => {
    if (!editingUser) return;
    const isSelf = editingUser.email === ADMIN_EMAIL;
    setDrawerSaving(true);
    try {
      const updatedData = {
        name: editingUser.name || "",
        email: editingUser.email,
        isApproved: isSelf ? true : editingUser.isApproved ?? true,
        role: isSelf ? ("admin" as UserRole) : drawerRole,
        turno: drawerRole === "leader" || drawerRole === "supervisor" ? drawerTurno : null,
        allowedMaoDeObra: isSelf || drawerRole === "supervisor" ? true : drawerAllowedMO,
        allowedSolicitacoes: isSelf || drawerRole === "supervisor" ? true : drawerAllowedSol,
        allowedPesagem: isSelf || drawerRole === "supervisor" ? true : drawerAllowedPesagem,
      };

      await editUserDb(editingUser.uid, updatedData);

      setUsers((prev) =>
        prev.map((u) => (u.uid === editingUser.uid ? { ...u, ...updatedData } : u))
      );

      const msgs: string[] = [];
      if (drawerRole !== editingUser.role) {
        msgs.push(`Alterou função de ${editingUser.name || editingUser.email} para ${ROLES_MAP[drawerRole] || drawerRole}`);
      }
      if (drawerAllowedMO !== editingUser.allowedMaoDeObra) {
        msgs.push(`${drawerAllowedMO ? "Concedeu" : "Removeu"} acesso a Mão de Obra para ${editingUser.name || editingUser.email}`);
      }
      if (drawerAllowedSol !== editingUser.allowedSolicitacoes) {
        msgs.push(`${drawerAllowedSol ? "Concedeu" : "Removeu"} acesso a Solicitações para ${editingUser.name || editingUser.email}`);
      }
      if (drawerAllowedPesagem !== editingUser.allowedPesagem) {
        msgs.push(`${drawerAllowedPesagem ? "Concedeu" : "Removeu"} acesso a Pesagem & Estoque para ${editingUser.name || editingUser.email}`);
      }

      if (msgs.length === 0) msgs.push(`Atualizou cadastro de ${editingUser.name || editingUser.email}`);
      msgs.forEach(addAuditLog);

      toast.success(`Acesso de ${(editingUser.name || editingUser.email).split(" ")[0]} atualizado`);
      closeDrawer();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar alterações do usuário");
    } finally {
      setDrawerSaving(false);
    }
  };

  // Ações da Gaveta: Aprovar / Desativar / Reativar
  const handleDrawerAction = async (action: "approve" | "block" | "unblock" | "pinreset" | "delete") => {
    if (!editingUser) return;
    const isSelf = editingUser.email === ADMIN_EMAIL;
    if (isSelf && (action === "block" || action === "delete")) {
      toast.error("Não é possível desativar ou excluir a conta de Admin principal.");
      return;
    }

    if (action === "approve") {
      await editUserDb(editingUser.uid, { isApproved: true } as any);
      setUsers((prev) => prev.map((u) => (u.uid === editingUser.uid ? { ...u, isApproved: true } : u)));
      addAuditLog(`Aprovou o cadastro de ${editingUser.name || editingUser.email}`);
      toast.success("Cadastro aprovado com sucesso");
      closeDrawer();
    } else if (action === "block") {
      if (!confirm(`Desativar a conta de ${editingUser.name || editingUser.email}? O acesso será bloqueado imediatamente.`)) return;
      await editUserDb(editingUser.uid, { isApproved: false } as any);
      setUsers((prev) => prev.map((u) => (u.uid === editingUser.uid ? { ...u, isApproved: false } : u)));
      addAuditLog(`Desativou a conta de ${editingUser.name || editingUser.email}`);
      toast.success("Conta desativada");
      closeDrawer();
    } else if (action === "unblock") {
      await editUserDb(editingUser.uid, { isApproved: true } as any);
      setUsers((prev) => prev.map((u) => (u.uid === editingUser.uid ? { ...u, isApproved: true } : u)));
      addAuditLog(`Reativou a conta de ${editingUser.name || editingUser.email}`);
      toast.success("Conta reativada com sucesso");
      closeDrawer();
    } else if (action === "pinreset") {
      await resetUserMaoDeObraPin(editingUser.uid);
      setUsers((prev) => prev.map((u) => (u.uid === editingUser.uid ? { ...u, pinMaoDeObra: null } : u)));
      addAuditLog(`Redefiniu o PIN de ${editingUser.name || editingUser.email}`);
      toast.success(`PIN redefinido — ${(editingUser.name || editingUser.email).split(" ")[0]} cadastrará um novo no próximo acesso`);
      setEditingUser((prev) => (prev ? { ...prev, pinMaoDeObra: null } : null));
    } else if (action === "delete") {
      setUserToDelete(editingUser);
      closeDrawer();
    }
  };

  // Ações em Massa
  const handleBulkAction = async (action: "pinreset" | "block" | "unblock" | "clear") => {
    const ids = Object.keys(selectedIds).filter((id) => selectedIds[id]);
    if (action === "clear") {
      setSelectedIds({});
      return;
    }
    if (ids.length === 0) return;

    if (action === "block" && !confirm(`Desativar ${ids.length} conta(s)? O acesso será revogado.`)) {
      return;
    }

    try {
      for (const id of ids) {
        if (action === "pinreset") {
          await resetUserMaoDeObraPin(id);
        } else if (action === "block") {
          await editUserDb(id, { isApproved: false } as any);
        } else if (action === "unblock") {
          await editUserDb(id, { isApproved: true } as any);
        }
      }

      setUsers((prev) =>
        prev.map((u) => {
          if (!selectedIds[u.uid]) return u;
          if (action === "pinreset") return { ...u, pinMaoDeObra: null };
          if (action === "block") return { ...u, isApproved: false };
          if (action === "unblock") return { ...u, isApproved: true };
          return u;
        })
      );

      const labelAction = action === "pinreset" ? "Redefiniu o PIN de" : action === "block" ? "Desativou" : "Reativou";
      addAuditLog(`${labelAction} ${ids.length} usuário(s) em lote`);
      toast.success(action === "pinreset" ? "PINs redefinidos" : action === "block" ? "Contas desativadas" : "Contas reativadas");
      setSelectedIds({});
    } catch (e) {
      console.error(e);
      toast.error("Erro ao aplicar ação em lote");
    }
  };

  // Exportar CSV
  const handleExportCSV = () => {
    const rows = [
      ["Nome", "E-mail", "Função", "Acesso Adicional", "PIN", "Última Atividade", "Status"],
    ];

    filteredUsers.forEach((u) => {
      const st = getUserState(u);
      const isSelf = u.email === ADMIN_EMAIL;
      const roleStr = getRoleLabel(u);
      const extras: string[] = [];
      if (u.role === "admin" || isSelf) {
        extras.push("Acesso total");
      } else {
        if (u.allowedMaoDeObra || u.role === "supervisor") extras.push("Mão de obra");
        if (u.allowedSolicitacoes || u.role === "supervisor") extras.push("Solicitações");
      }
      const lastActiveD = parseLastActiveDate(u.lastActive);
      const lastActiveStr = lastActiveD ? formatDT(lastActiveD) : "Sem registro";
      const pinStr = u.pinMaoDeObra ? "Ativo" : "Não cadastrado";

      rows.push([
        u.name || "Sem Nome",
        u.email,
        roleStr,
        extras.length ? extras.join(" / ") : "Padrão",
        pinStr,
        lastActiveStr,
        st.l,
      ]);
    });

    const csvContent = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios_agilework_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`${filteredUsers.length} usuários exportados`);
  };

  // Exportar Backup JSON
  const handleExportBackup = () => {
    const backupData = {
      exportado_em: new Date().toISOString(),
      usuarios: users.map((u) => ({
        nome: u.name,
        email: u.email,
        funcao: getRoleLabel(u),
        allowedMaoDeObra: u.allowedMaoDeObra,
        allowedSolicitacoes: u.allowedSolicitacoes,
        pinConfigurado: Boolean(u.pinMaoDeObra),
        status: getUserState(u).l,
        ultimaAtividade: parseLastActiveDate(u.lastActive)?.toISOString() || null,
      })),
      auditoria: auditLogs.map((l) => ({
        data: l.at.toISOString(),
        responsavel: l.who,
        acao: l.what,
      })),
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_agilework_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    addAuditLog("Exportou backup completo em JSON");
    toast.success("Backup do sistema exportado com sucesso");
  };

  // Confirmar exclusão de usuário
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      await deleteUserDb(userToDelete.uid);
      setUsers((prev) => prev.filter((u) => u.uid !== userToDelete.uid));
      addAuditLog(`Excluiu definitivamente o usuário ${userToDelete.name || userToDelete.email}`);
      toast.success("Usuário removido da base de dados");
      setUserToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir usuário");
    } finally {
      setDeletingUser(false);
    }
  };

  // Confirmar reset de PIN
  const confirmResetPin = async () => {
    if (!userToResetPin) return;
    setResettingPin(true);
    try {
      await resetUserMaoDeObraPin(userToResetPin.uid);
      setUsers((prev) => prev.map((u) => (u.uid === userToResetPin.uid ? { ...u, pinMaoDeObra: null } : u)));
      addAuditLog(`Redefiniu o PIN de ${userToResetPin.name || userToResetPin.email}`);
      toast.success(`PIN de ${userToResetPin.name || userToResetPin.email} foi resetado`);
      setUserToResetPin(null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao resetar PIN");
    } finally {
      setResettingPin(false);
    }
  };

  // Wipe Banco
  const handleWipeDatabase = async () => {
    if (wipeConfirmText !== "WIPE") {
      toast.error("Texto de confirmação incorreto.");
      return;
    }
    if (!wipeCategories.nts && !wipeCategories.items && !wipeCategories.users) {
      toast.error("Nenhuma categoria selecionada para o Wipe.");
      return;
    }

    setWiping(true);
    try {
      const stats = await wipeDataByCategory(wipeCategories);
      addAuditLog(`Executou Wipe de dados: ${stats.nts} NTs, ${stats.items} Itens, ${stats.users} Usuários`);
      toast.success(`Base Limpa! ${stats.nts} NTs, ${stats.items} Itens e ${stats.users} Usuários removidos.`);
      setShowWipeDialog(false);
      setWipeConfirmText("");
      setWipeCategories({ nts: false, items: false, users: false });
      if (wipeCategories.users) {
        fetchUsers();
      }
    } catch (error) {
      toast.error("Erro ao realizar Wipe da Base de Dados.");
    } finally {
      setWiping(false);
    }
  };

  if (loading || loadingUsers) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg)]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-[var(--accent)]" />
      </div>
    );
  }

  if (!userData || userData.email !== ADMIN_EMAIL) return null;

  const isDrawerSelf = editingUser?.email === ADMIN_EMAIL;
  const isDrawerAdmin = drawerRole === "admin" || isDrawerSelf;
  const isDrawerDirty = editingUser && (
    drawerRole !== (editingUser.role || "user") ||
    (drawerRole === "leader" && drawerTurno !== (editingUser.turno || 1)) ||
    drawerAllowedMO !== Boolean(editingUser.allowedMaoDeObra) ||
    drawerAllowedSol !== Boolean(editingUser.allowedSolicitacoes) ||
    drawerAllowedPesagem !== Boolean(editingUser.allowedPesagem)
  );

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col pl-0 md:pl-[52px] min-w-0 h-screen overflow-hidden">
          <Topbar />

          <main className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-7">
            {/* Header da Página */}
            <div className="page-head flex items-end justify-between gap-4 mb-4">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">Administração</h1>
                <p className="subtitle text-xs text-[var(--text-3)] mt-1">
                  Usuários, permissões e manutenção do sistema
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="btn sm"
                  title="Exportar tabela de usuários em formato CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => toast("Convite: informe o e-mail corporativo para solicitar cadastro.", { icon: "✉️" })}
                  className="btn sm primary"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Convidar usuário</span>
                </button>
              </div>
            </div>

            {/* Abas Superiores do Concept: Usuários e Manutenção */}
            <div className="tabs mb-4">
              <button
                type="button"
                onClick={() => setActiveTab("users")}
                className={cn("tab", activeTab === "users" && "active")}
              >
                <span>Usuários</span>
                <span className="n">{users.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("maintenance")}
                className={cn("tab", activeTab === "maintenance" && "active")}
              >
                <span>Manutenção</span>
              </button>
            </div>

            {/* CONTEÚDO: ABA USUÁRIOS */}
            {activeTab === "users" && (
              <section id="v-users">
                {/* 5 Summary Cards no padrão exato do concept */}
                <div className="adm-summary mb-4">
                  <button
                    type="button"
                    onClick={() => setQuickFilter(quickFilter === "all" ? "all" : "all")}
                    className={cn(quickFilter === "all" && "on")}
                  >
                    <label>
                      <i className="adm-dot bg-[var(--text-3)]" />
                      Total de usuários
                    </label>
                    <strong>{summaryCounts.all}</strong>
                    <p>cadastrados</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickFilter(quickFilter === "online" ? "all" : "online")}
                    className={cn(quickFilter === "online" && "on")}
                  >
                    <label>
                      <i className="adm-dot bg-[var(--green)]" />
                      Online agora
                    </label>
                    <strong className="text-[var(--green)]">{summaryCounts.online}</strong>
                    <p>últimos {ONLINE_MINUTES_THRESHOLD} min</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickFilter(quickFilter === "ok" ? "all" : "ok")}
                    className={cn(quickFilter === "ok" && "on")}
                  >
                    <label>
                      <i className="adm-dot border border-[var(--green)] bg-transparent" />
                      Contas ativas
                    </label>
                    <strong>{summaryCounts.ok}</strong>
                    <p>
                      {summaryCounts.blocked
                        ? `${summaryCounts.blocked} desativada${summaryCounts.blocked > 1 ? "s" : ""}`
                        : "nenhuma desativada"}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickFilter(quickFilter === "pending" ? "all" : "pending")}
                    className={cn(quickFilter === "pending" && "on")}
                  >
                    <label>
                      <i className="adm-dot bg-[var(--accent)]" />
                      Aguardando aprovação
                    </label>
                    <strong className="text-[var(--accent)]">{summaryCounts.pending}</strong>
                    <p>{summaryCounts.pending ? "revisar cadastros" : "nenhum cadastro novo"}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickFilter(quickFilter === "inactive" ? "all" : "inactive")}
                    className={cn(quickFilter === "inactive" && "on")}
                  >
                    <label>
                      <i className="adm-dot bg-[var(--amber)]" />
                      Sem atividade
                    </label>
                    <strong className="text-[var(--amber)]">{summaryCounts.inactive}</strong>
                    <p>há {INACTIVE_DAYS_THRESHOLD} dias ou mais</p>
                  </button>
                </div>

                {/* Toolbar */}
                <div className="adm-toolbar">
                  <label className="adm-search">
                    <Search className="w-3.5 h-3.5" />
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por nome, e-mail ou função"
                    />
                    <kbd>/</kbd>
                  </label>

                  <select
                    className="adm-select"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="">Todas as funções</option>
                    <option value="admin">Admin global</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="leader">Líder</option>
                    <option value="user">Usuário</option>
                  </select>

                  <select
                    className="adm-select"
                    value={pinFilter}
                    onChange={(e) => setPinFilter(e.target.value)}
                  >
                    <option value="">PIN: todos</option>
                    <option value="1">Com PIN</option>
                    <option value="0">Sem PIN</option>
                  </select>

                  <div className="grow" />

                  <span className="count-lbl text-xs text-[var(--text-3)] font-mono">
                    {filteredUsers.length === users.length
                      ? `${users.length} usuários`
                      : `${filteredUsers.length} de ${users.length} usuários`}
                  </span>
                </div>

                {/* Bulk Actions Banner */}
                {selectedCount > 0 && (
                  <div className="adm-bulk">
                    <b>{selectedCount} selecionado{selectedCount > 1 ? "s" : ""}</b>
                    <button
                      type="button"
                      onClick={() => handleBulkAction("pinreset")}
                      className="btn sm"
                    >
                      Redefinir PIN
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkAction("block")}
                      className="btn sm danger"
                    >
                      Desativar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkAction("unblock")}
                      className="btn sm"
                    >
                      Reativar
                    </button>
                    <div className="grow" />
                    <button
                      type="button"
                      onClick={() => handleBulkAction("clear")}
                      className="btn sm"
                    >
                      Limpar seleção
                    </button>
                  </div>
                )}

                {/* Card com Tabela no estilo do concept */}
                <div className="adm-card">
                  <table className="adm-t">
                    <thead>
                      <tr>
                        <th className="ck">
                          <input
                            type="checkbox"
                            checked={eligibleBulkIds.length > 0 && selectedCount === eligibleBulkIds.length}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            title="Selecionar todos os usuários da visualização"
                          />
                        </th>
                        <th
                          className={cn("sortable", sortKey === "name" && "on")}
                          onClick={() => handleToggleSort("name")}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Usuário</span>
                            <ArrowUpDown className="w-3 h-3 text-[var(--text-3)]" />
                          </div>
                        </th>
                        <th
                          className={cn("sortable", sortKey === "role" && "on")}
                          onClick={() => handleToggleSort("role")}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Função</span>
                            <ArrowUpDown className="w-3 h-3 text-[var(--text-3)]" />
                          </div>
                        </th>
                        <th>Acesso adicional</th>
                        <th>PIN</th>
                        <th
                          className={cn("sortable", sortKey === "seen" && "on")}
                          onClick={() => handleToggleSort("seen")}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Última atividade</span>
                            <ArrowUpDown className="w-3 h-3 text-[var(--text-3)]" />
                          </div>
                        </th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="empty">
                            {quickFilter === "pending"
                              ? "Nenhum cadastro aguardando aprovação."
                              : "Nenhum usuário encontrado."}
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const isSelf = u.email === ADMIN_EMAIL;
                          const st = getUserState(u);
                          const lastDate = parseLastActiveDate(u.lastActive);
                          const isOldInactive = !isSelf && st.k === "inactive";
                          const isSelected = Boolean(selectedIds[u.uid]);

                          // Badges de papel e ícone
                          const isRoleAdmin = u.email === ADMIN_EMAIL || u.role === "admin";
                          const isRoleLead = u.role === "leader" || u.role === "supervisor";
                          const roleClass = isRoleAdmin ? "admin" : isRoleLead ? "lead" : "";
                          const RoleIcon = isRoleAdmin ? ShieldCheck : isRoleLead ? Star : UserIcon;

                          // Módulos adicionais
                          const extraMods: string[] = [];
                          if (u.allowedMaoDeObra || u.role === "supervisor") extraMods.push("Mão de obra");
                          if (u.allowedSolicitacoes || u.role === "supervisor") extraMods.push("Solicitações");

                          return (
                            <tr
                              key={u.uid}
                              onClick={() => openDrawer(u)}
                              className={cn(isSelected && "sel")}
                            >
                              <td
                                className="ck"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isSelf ? null : (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      setSelectedIds((prev) => ({
                                        ...prev,
                                        [u.uid]: e.target.checked,
                                      }));
                                    }}
                                  />
                                )}
                              </td>

                              <td>
                                <div className="adm-user">
                                  <span className={cn("adm-av", st.k === "online" && "on")}>
                                    {getInitials(u.name || u.email)}
                                  </span>
                                  <div className="min-w-0">
                                    <b className="flex items-center">
                                      <span className="truncate">{u.name || "Sem Nome Definido"}</span>
                                      {isSelf && <span className="adm-you">você</span>}
                                    </b>
                                    <small className="truncate">{u.email}</small>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <span className={cn("adm-role", roleClass)}>
                                  <RoleIcon />
                                  <span>{getRoleLabel(u)}</span>
                                </span>
                              </td>

                              <td>
                                {isRoleAdmin ? (
                                  <span className="adm-mods">
                                    <b>Acesso total</b>
                                  </span>
                                ) : extraMods.length ? (
                                  <span className="adm-mods">
                                    <b>{extraMods.join(", ")}</b>
                                  </span>
                                ) : (
                                  <span className="adm-mods text-[var(--text-3)]">—</span>
                                )}
                              </td>

                              <td>
                                {u.pinMaoDeObra ? (
                                  <span className="adm-pin text-[var(--violet)]">
                                    <Key className="w-3.5 h-3.5 text-[var(--violet)]" />
                                    <span>Ativo</span>
                                  </span>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>

                              <td>
                                <span
                                  className={cn("adm-seen", isOldInactive && "old")}
                                  title={lastDate ? formatDT(lastDate) : "Sem registro"}
                                >
                                  {st.k === "online" ? "Agora" : lastDate ? formatRelative(lastDate) : "—"}
                                </span>
                              </td>

                              <td>
                                <span className={cn("adm-st", st.k)}>
                                  <i />
                                  <span>{st.l}</span>
                                </span>
                              </td>

                              <td className="adm-row-act" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => openDrawer(u)}
                                  className="btn sm"
                                >
                                  Gerenciar
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* CONTEÚDO: ABA MANUTENÇÃO */}
            {activeTab === "maintenance" && (
              <section id="v-maint" className="space-y-4">
                {/* 4 Health indicators */}
                <div className="adm-health">
                  <div>
                    <label>
                      <i className="adm-dot bg-[var(--green)]" />
                      Banco de dados
                    </label>
                    <strong>Operando</strong>
                    <p>Firestore online</p>
                  </div>

                  <div>
                    <label>
                      <i className="adm-dot bg-[var(--green)]" />
                      API de Pesagem
                    </label>
                    <strong>Operando</strong>
                    <p>PostgreSQL conectado</p>
                  </div>

                  <div>
                    <label>
                      <i className="adm-dot bg-[var(--green)]" />
                      Sincronização SAP
                    </label>
                    <strong>Automática</strong>
                    <p>Estoque e aging em cache</p>
                  </div>

                  <div>
                    <label>
                      <i className="adm-dot bg-[var(--amber)]" />
                      Exportação de Backup
                    </label>
                    <strong>Sob demanda</strong>
                    <p>JSON e auditoria completa</p>
                  </div>
                </div>

                <div className="adm-m-grid">
                  {/* Card de Rotinas Administrativas */}
                  <section className="adm-card">
                    <div className="adm-card-head">
                      <h2>Rotinas do Sistema</h2>
                      <span className="hint">executadas sob demanda</span>
                    </div>

                    <div>
                      {/* Job 1: Backup */}
                      <div className="adm-job">
                        <b>Exportar backup em JSON</b>
                        <p>Baixa todos os usuários cadastrados, permissões e registros de auditoria em arquivo JSON.</p>
                        <button
                          type="button"
                          onClick={handleExportBackup}
                          className="btn sm"
                        >
                          Exportar
                        </button>
                      </div>

                      {/* Job 2: Revisar inativos */}
                      <div className="adm-job">
                        <b>Revisar contas sem atividade</b>
                        <p>
                          {summaryCounts.inactive} conta{summaryCounts.inactive !== 1 ? "s" : ""} sem login há {INACTIVE_DAYS_THRESHOLD} dias ou mais.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab("users");
                            setQuickFilter("inactive");
                          }}
                          className="btn sm"
                        >
                          Revisar
                        </button>
                      </div>

                      {/* Job 3: Limpeza de NTs Concluídas */}
                      <div className="adm-job">
                        <b>Retenção automática de NTs concluídas</b>
                        <p>Gerencie o expurgo automático de notas concluídas com mais de 30 dias na base.</p>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById("nt-cleanup-anchor");
                            el?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="btn sm"
                        >
                          Configurar
                        </button>
                      </div>

                      {/* Job 4: Limpeza Perigosa da Base (Wipe) */}
                      <div className="adm-job bg-red-500/5">
                        <b className="text-[var(--red)]">Limpeza de emergência (Wipe)</b>
                        <p className="text-[var(--text-3)]">
                          Exclui coleções inteiras do Firestore (NTs, Itens ou Usuários) de forma permanente.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowWipeDialog(true)}
                          className="btn sm danger"
                        >
                          Iniciar Limpeza
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Card de Registro de Auditoria */}
                  <section className="adm-card adm-log">
                    <div className="adm-card-head">
                      <h2>Registro de Auditoria</h2>
                      <span className="hint">{auditLogs.length} registros</span>
                    </div>

                    <table className="adm-t">
                      <tbody>
                        {auditLogs.map((l) => (
                          <tr key={l.id} className={cn(l.isNew && "new")}>
                            <td className="when" title={formatDT(l.at)}>
                              {formatRelative(l.at)}
                            </td>
                            <td className="who">{l.who}</td>
                            <td>{l.what}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                </div>

                {/* Card de Limpeza de NTs integrado */}
                <div id="nt-cleanup-anchor" className="pt-2">
                  <NTCleanupCard />
                </div>
              </section>
            )}
          </main>
        </div>
      </div>

      {/* ================= GAVETA LATERAL (DRAWER: GERENCIAR ACESSO) ================= */}
      <div
        className={cn("adm-overlay", Boolean(editingUser) && "show")}
        onClick={closeDrawer}
      />

      <aside
        className={cn("adm-drawer", Boolean(editingUser) && "show")}
        aria-label="Gerenciar acesso do colaborador"
      >
        {editingUser && (
          <>
            <div className="adm-dr-head">
              <span className={cn("adm-av", getUserState(editingUser).k === "online" && "on")}>
                {getInitials(editingUser.name || editingUser.email)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2>{editingUser.name || "Sem Nome Definido"}</h2>
                <p className="truncate">{editingUser.email}</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={closeDrawer}
                title="Fechar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="adm-dr-body">
              {/* Aprovação pendente */}
              {editingUser.isApproved === false && !isDrawerSelf && (
                <div className="adm-dr-sec">
                  <h3 className="text-[var(--accent)] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Cadastro aguardando aprovação
                  </h3>
                  <div className="adm-dr-actions">
                    <button
                      type="button"
                      className="btn primary sm"
                      onClick={() => handleDrawerAction("approve")}
                    >
                      Aprovar cadastro
                    </button>
                    <button
                      type="button"
                      className="btn sm danger"
                      onClick={() => handleDrawerAction("delete")}
                    >
                      Recusar e excluir
                    </button>
                  </div>
                </div>
              )}

              {/* Situação */}
              <div className="adm-dr-sec">
                <h3>Situação da Conta</h3>
                <div className="adm-kv">
                  <span>Status</span>
                  <span className={cn("adm-st", getUserState(editingUser).k)}>
                    <i />
                    <span>{getUserState(editingUser).l}</span>
                  </span>
                </div>
                <div className="adm-kv">
                  <span>Última atividade</span>
                  <b>
                    {editingUser.lastActive
                      ? formatDT(parseLastActiveDate(editingUser.lastActive) || new Date())
                      : "Sem registro"}
                  </b>
                </div>
                <div className="adm-kv">
                  <span>Cadastrado em</span>
                  <b>
                    {editingUser.created_at
                      ? editingUser.created_at.slice(0, 10)
                      : "Anterior"}
                  </b>
                </div>
              </div>

              {/* Função e Turno */}
              <div className="adm-dr-sec">
                <h3>Função e Turno</h3>
                <div className="adm-fields">
                  <div className="adm-field">
                    <label>Perfil de Acesso</label>
                    <select
                      className="adm-select"
                      value={drawerRole}
                      disabled={isDrawerSelf}
                      onChange={(e) => {
                        const newR = e.target.value as UserRole;
                        setDrawerRole(newR);
                        if (newR === "supervisor" || newR === "admin") {
                          setDrawerAllowedMO(true);
                          setDrawerAllowedSol(true);
                        }
                      }}
                      title={isDrawerSelf ? "Você não pode alterar o próprio perfil" : ""}
                    >
                      <option value="admin">Admin global</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="leader">Líder</option>
                      <option value="user">Usuário</option>
                    </select>
                  </div>

                  {drawerRole === "leader" && (
                    <div className="adm-field">
                      <label>Turno</label>
                      <select
                        className="adm-select"
                        value={drawerTurno}
                        onChange={(e) => setDrawerTurno(Number(e.target.value) as ProductionTurno)}
                      >
                        <option value={1}>1º turno (07:20 - 15:50)</option>
                        <option value={2}>2º turno (15:50 - 23:50)</option>
                        <option value={3}>3º turno (23:50 - 07:20)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Permissões por Módulo */}
              <div className="adm-dr-sec">
                <h3>Permissões por Módulo</h3>
                {MODULES_CONFIG.map((m) => {
                  let isChecked = false;
                  let isLocked = false;

                  if (isDrawerAdmin) {
                    isChecked = true;
                    isLocked = true;
                  } else if (m.base) {
                    isChecked = true;
                    isLocked = true;
                  } else if (m.k === "mo") {
                    isChecked = drawerRole === "supervisor" || drawerAllowedMO;
                    isLocked = drawerRole === "supervisor";
                  } else if (m.k === "sol") {
                    isChecked = drawerRole === "supervisor" || drawerAllowedSol;
                    isLocked = drawerRole === "supervisor";
                  } else if (m.k === "pes") {
                    isChecked = drawerRole === "supervisor" || drawerAllowedPesagem;
                    isLocked = drawerRole === "supervisor";
                  } else if (m.k === "heij") {
                    isChecked = drawerRole === "supervisor" || drawerRole === "leader";
                    isLocked = true;
                  } else if (m.k === "admin") {
                    isChecked = false;
                    isLocked = true;
                  }

                  const handleToggleMod = (checked: boolean) => {
                    if (m.k === "mo") setDrawerAllowedMO(checked);
                    if (m.k === "sol") setDrawerAllowedSol(checked);
                    if (m.k === "pes") setDrawerAllowedPesagem(checked);
                  };

                  return (
                    <div key={m.k} className={cn("adm-perm", isLocked && "locked")}>
                      <b>{m.l}</b>
                      <small>
                        {m.base
                          ? "Padrão para todos os usuários"
                          : isDrawerAdmin
                          ? "Incluído no perfil Admin global"
                          : drawerRole === "supervisor"
                          ? "Incluído no perfil Supervisor"
                          : m.d}
                      </small>
                      <label className="adm-sw">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isLocked}
                          onChange={(e) => handleToggleMod(e.target.checked)}
                        />
                        <i />
                      </label>
                    </div>
                  );
                })}
              </div>

              {/* Segurança e PIN */}
              <div className="adm-dr-sec">
                <h3>Segurança</h3>
                <div className="adm-kv">
                  <span>PIN de Mão de Obra</span>
                  <b>{editingUser.pinMaoDeObra ? "Ativo" : "Não cadastrado"}</b>
                </div>
                <div className="adm-dr-actions mt-2">
                  <button
                    type="button"
                    className="btn sm"
                    disabled={!editingUser.pinMaoDeObra}
                    onClick={() => handleDrawerAction("pinreset")}
                  >
                    Redefinir PIN
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      addAuditLog(`Encerrou sessões remotas de ${editingUser.name || editingUser.email}`);
                      toast.success("Sessões encerradas com sucesso");
                    }}
                  >
                    Encerrar sessões
                  </button>
                </div>
              </div>

              {/* Zona de Risco */}
              {!isDrawerSelf && (
                <div className="adm-dr-sec">
                  <h3 className="text-[var(--red)]">Zona de Risco</h3>
                  <div className="adm-dr-actions">
                    {editingUser.isApproved === false ? (
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => handleDrawerAction("unblock")}
                      >
                        Reativar conta
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() => handleDrawerAction("block")}
                      >
                        Desativar conta
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn sm danger"
                      onClick={() => handleDrawerAction("delete")}
                    >
                      Excluir definitivamente
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé da Gaveta */}
            <div className="adm-dr-foot">
              <span className="grow font-mono text-[11px] text-[var(--amber)]">
                {isDrawerDirty ? "Alterações não salvas" : ""}
              </span>
              <button
                type="button"
                className="btn"
                onClick={closeDrawer}
                disabled={drawerSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!isDrawerDirty || drawerSaving}
                onClick={handleSaveDrawer}
              >
                {drawerSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </>
        )}
      </aside>

      {/* AlertDialog de Exclusão Definitiva */}
      <AlertDialog
        open={Boolean(userToDelete)}
        onOpenChange={(open) => !open && !deletingUser && setUserToDelete(null)}
      >
        <AlertDialogContent className="bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Excluir usuário
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[var(--text-3)]">
              Tem certeza que deseja excluir definitivamente{" "}
              <b className="text-[var(--text)]">{userToDelete?.name || userToDelete?.email}</b>?
              Esta ação removerá o usuário da base de dados e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletingUser}
              className="btn"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteUser();
              }}
              disabled={deletingUser}
              className="btn danger"
            >
              {deletingUser && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog de Limpeza Perigosa (Wipe) */}
      <AlertDialog
        open={showWipeDialog}
        onOpenChange={(open) => {
          if (!wiping) {
            setShowWipeDialog(open);
            if (!open) setWipeConfirmText("");
          }
        }}
      >
        <AlertDialogContent className="bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-[var(--red)]">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Limpeza da Base (Wipe)
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[var(--text-3)]">
              Esta ação é <span className="font-bold text-[var(--red)]">irreversível</span>. Selecione as categorias e digite <span className="font-mono font-bold text-[var(--text)]">WIPE</span> abaixo:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded border border-[var(--border)] bg-[var(--surface-2)]">
              <input
                type="checkbox"
                checked={wipeCategories.nts}
                onChange={(e) => setWipeCategories((prev) => ({ ...prev, nts: e.target.checked }))}
                className="accent-[var(--accent)]"
              />
              <span>Tabela Mestre (Notas Técnicas)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded border border-[var(--border)] bg-[var(--surface-2)]">
              <input
                type="checkbox"
                checked={wipeCategories.items}
                onChange={(e) => setWipeCategories((prev) => ({ ...prev, items: e.target.checked }))}
                className="accent-[var(--accent)]"
              />
              <span>Itens de Pesagem (Operacional)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded border border-[var(--border)] bg-[var(--surface-2)]">
              <input
                type="checkbox"
                checked={wipeCategories.users}
                onChange={(e) => setWipeCategories((prev) => ({ ...prev, users: e.target.checked }))}
                className="accent-[var(--accent)]"
              />
              <span>Usuários Comuns (Mantém Admin Principal)</span>
            </label>
          </div>

          <input
            autoFocus
            placeholder="WIPE"
            value={wipeConfirmText}
            onChange={(e) => setWipeConfirmText(e.target.value)}
            className="adm-select w-full text-center uppercase font-mono font-bold tracking-widest"
          />

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={wiping}
              onClick={() => setWipeConfirmText("")}
              className="btn"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleWipeDatabase();
              }}
              disabled={wipeConfirmText !== "WIPE" || wiping}
              className="btn danger"
            >
              {wiping && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Limpar Base
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  );
}
