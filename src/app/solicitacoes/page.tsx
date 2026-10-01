"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import Autocomplete from "@/components/solicitacoes/Autocomplete";
import TabelaPrincipal from "@/components/solicitacoes/TabelaPrincipal";
import PullProductionDialog from "@/components/solicitacoes/PullProductionDialog";
import Sap from "@/components/solicitacoes/Sap";
import ProtectedRoute from "@/components/auth/protected-route";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { 
  fetchListaTecnica, 
  loadAppState, 
  saveAppState, 
  clearAppState,
  fetchSapMaterialStock 
} from "@/lib/dashpesagem-api";
import { subscribeToNTs } from "@/lib/firestore-helpers";
import { useFirebase, ADMIN_EMAIL } from "@/components/providers/firebase-provider";
import toast from "react-hot-toast";
import { formatNumber, parseBrazilianNumber, matchNTItemWithExcipient } from "@/lib/utils";
import { NT, NTItem, ExcipienteNTInfo, PendingNTItemDetail } from "@/types";

import {
  PlusCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  TrashIcon,
  BeakerIcon,
  HashtagIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { Factory, Shield } from "lucide-react";

const EXCIPIENTES_ESPECIAIS = [
  "LACTOSE (200)",
  "LACTOSE (50/70)",
  "AMIDO DE MILHO PREGELATINIZADO",
  "CELULOSE MIC (TIPO200)",
  "CELULOSE MIC.(TIPO102)",
  "FOSF.CAL.DIB.(COMPDIRETA)",
  "AMIDO",
  "CELULOSE+LACTOSE",
];

export default function SolicitacoesPage() {
  const { user, userData, loading: authLoading } = useFirebase();
  const router = useRouter();
  const userId = user?.email || user?.uid || "default_user";

  const isAdmin = userData?.email === ADMIN_EMAIL || userData?.role === 'admin';
  const isSupervisor = userData?.role === 'supervisor';
  const isAuthorized = Boolean(userData?.allowedSolicitacoes);
  const canAccess = isAdmin || isSupervisor || isAuthorized;

  const [ordens, setOrdens] = useState<any[]>([]);
  const [ativo, setAtivo] = useState("");
  const [excipientes, setExcipientes] = useState<Record<string, any>>({});
  const [expandedExcipient, setExpandedExcipient] = useState<string | string[] | null>(null);
  const [selectedOrdem, setSelectedOrdem] = useState<any>(null);
  const [pesados, setPesados] = useState<Record<string, Record<string, boolean>>>({});
  const [nts, setNts] = useState<NT[]>([]);
  const [isLoading, setIsLoading] = useState(true);


  // Estados dos modais de edição
  const [editingOrdemDialog, setEditingOrdemDialog] = useState<any>(null);
  const [editingExcipientes, setEditingExcipientes] = useState<Record<string, any>>({});
  const [selectAllChecked, setSelectAllChecked] = useState(false);

  // OP increment
  const [autoIncrementOP, setAutoIncrementOP] = useState(false);
  const [lastOP, setLastOP] = useState(2213345);
  const [initialOP, setInitialOP] = useState("");

  const [addMode, setAddMode] = useState<"codigo" | "ativo">("codigo");

  const [materiaisNaArea, setMateriaisNaArea] = useState<Record<string, number>>({});
  const [faltaSolicitar, setFaltaSolicitar] = useState<Record<string, string>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const inputRef = useRef<HTMLInputElement>(null);

  const [sapDialogOpen, setSapDialogOpen] = useState(false);
  const [pullProductionOpen, setPullProductionOpen] = useState(false);
  const [importingProduction, setImportingProduction] = useState(false);

  const [opModalOpen, setOpModalOpen] = useState(false);
  const [newOP, setNewOP] = useState("");
  const [selectedOrdemId, setSelectedOrdemId] = useState<string | null>(null);

  const [sugestoes, setSugestoes] = useState<string[]>([]);

  // Carregar estado salvo do usuário no PostgreSQL
  const loadState = useCallback(async (uId: string) => {
    try {
      setIsLoading(true);
      const res = await loadAppState(uId);
      if (res && res.state) {
        const {
          ordens: sOrdens,
          excipientes: sExcipientes,
          expandedExcipient: sExpanded,
          selectedOrdem: sSelected,
          pesados: sPesados,
          materiaisNaArea: sMateriais,
          inputValues: sInputs,
          lastOP: sLastOP,
          autoIncrementOP: sAutoOP
        } = res.state;

        setOrdens(sOrdens || []);
        setExcipientes(sExcipientes || {});
        setExpandedExcipient(sExpanded || null);
        setSelectedOrdem(sSelected || null);
        setPesados(sPesados || {});
        setMateriaisNaArea(sMateriais || {});
        setInputValues(sInputs || {});
        if (sLastOP) setLastOP(sLastOP);
        if (sAutoOP !== undefined) setAutoIncrementOP(sAutoOP);
      } else {
        // Fallback para localStorage
        const stored = localStorage.getItem(`appState_${uId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setOrdens(parsed.ordens || []);
          setExcipientes(parsed.excipientes || {});
          setExpandedExcipient(parsed.expandedExcipient || null);
          setSelectedOrdem(parsed.selectedOrdem || null);
          setPesados(parsed.pesados || {});
          setMateriaisNaArea(parsed.materiaisNaArea || {});
          setInputValues(parsed.inputValues || {});
        }
      }
    } catch (err) {
      console.error("Erro ao carregar app_state:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState(userId);
  }, [userId, loadState]);

  // Escutar NTs em tempo real do Firestore
  useEffect(() => {
    const unsubscribe = subscribeToNTs(
      (ntsData) => {
        setNts(ntsData);
      },
      (error) => {
        console.error("Erro ao sincronizar NTs em tempo real:", error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Salvar estado no PostgreSQL

  const saveState = useCallback(
    async (uId: string) => {
      const stateToSave = {
        ordens,
        excipientes,
        expandedExcipient,
        selectedOrdem,
        pesados,
        materiaisNaArea,
        inputValues,
        lastOP,
        autoIncrementOP,
      };

      try {
        localStorage.setItem(`appState_${uId}`, JSON.stringify(stateToSave));
        await saveAppState(uId, stateToSave);
      } catch (err) {
        console.error("Erro ao salvar app_state:", err);
      }
    },
    [ordens, excipientes, expandedExcipient, selectedOrdem, pesados, materiaisNaArea, inputValues, lastOP, autoIncrementOP]
  );

  useEffect(() => {
    if (!isLoading) {
      const timeout = setTimeout(() => {
        saveState(userId);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [ordens, excipientes, pesados, materiaisNaArea, inputValues, isLoading, saveState, userId]);

  // Cálculo síncrono e instantâneo de excipientes agregados a partir das ordens em memória
  const calcularExcipientes = useCallback(
    (ordensAtuais: any[] = [], pesadosAtuais: Record<string, Record<string, boolean>> = {}) => {
      if (!ordensAtuais || ordensAtuais.length === 0) {
        setExcipientes({});
        return;
      }

      const newExcipientes: Record<string, any> = {};

      for (const ordem of ordensAtuais) {
        if (ordem.excipientes && typeof ordem.excipientes === "object") {
          Object.entries(ordem.excipientes).forEach(([nomeExcipiente, info]: [string, any]) => {
            const rawCode = String(info.codigo || "");
            const codigoExcipiente = rawCode ? rawCode.padStart(6, "0") : "";
            const quantidade = parseFloat(info.quantidade || 0);

            if (!newExcipientes[nomeExcipiente]) {
              newExcipientes[nomeExcipiente] = {
                total: 0,
                ordens: [],
                codigo: codigoExcipiente,
              };
            }

            const isPesado = pesadosAtuais[nomeExcipiente]?.[ordem.id] || false;

            if (!isPesado) {
              newExcipientes[nomeExcipiente].total += quantidade;
            }

            newExcipientes[nomeExcipiente].ordens.push({
              id: ordem.id,
              codigo: ordem.codigo,
              quantidade: quantidade,
              nome: ordem.nome,
              op: ordem.op,
              pesado: isPesado,
            });
          });
        }
      }

      Object.keys(newExcipientes).forEach((key) => {
        newExcipientes[key].total = Number(newExcipientes[key].total.toFixed(3));
      });

      setExcipientes(newExcipientes);
    },
    []
  );

  // Adicionar Ordem
  const handleAddOrdem = async () => {
    if (!ativo.trim()) return;

    try {
      let rawInput = ativo.trim();
      if (rawInput.toUpperCase().endsWith('I')) {
        rawInput = rawInput.slice(0, -1).trim();
      }

      let data: any[] = [];
      if (addMode === "codigo") {
        data = await fetchListaTecnica({ codigo_receita: rawInput });
      } else {
        data = await fetchListaTecnica({ ativo: rawInput });
      }

      if (!data || data.length === 0) {
        toast.error(addMode === "codigo" ? "Código da receita não encontrado na Lista Técnica" : "Ativo não encontrado");
        return;
      }

      const primeiroRegistro = data[0];
      const codigo = primeiroRegistro.Codigo_Receita || primeiroRegistro.semi_acabado;
      const nome = primeiroRegistro.Ativo || primeiroRegistro.descricao_semi_acabado;

      let op: any = null;
      if (autoIncrementOP) {
        op = initialOP ? parseInt(initialOP) : lastOP ? lastOP + 1 : 2213345;
        setLastOP(op);
        setInitialOP("");
      }

      const novaOrdem = {
        id: uuidv4(),
        codigo,
        nome,
        op: op ? String(op) : null,
        excipientes: data.reduce((acc: any, item: any) => {
          const nomeExp = item.Excipiente || item.descricao_materia_prima;
          acc[nomeExp] = {
            quantidade: parseFloat(item.qtd_materia_prima || 0),
            codigo: item.codigo_materia_prima || item.materia_prima,
          };
          return acc;
        }, {}),
      };

      const newOrdens = [...ordens, novaOrdem];
      setOrdens(newOrdens);

      const newPesados = { ...pesados };
      data.forEach((item: any) => {
        const nomeExp = item.Excipiente || item.descricao_materia_prima;
        if (!newPesados[nomeExp]) {
          newPesados[nomeExp] = {};
        }
        newPesados[nomeExp][novaOrdem.id] = false;
      });
      setPesados(newPesados);

      calcularExcipientes(newOrdens, newPesados);
      setAtivo("");
      toast.success(`Ordem ${nome} adicionada!`);

      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (err) {
      console.error("Erro ao adicionar ordem:", err);
      toast.error("Erro ao buscar dados da receita");
    }
  };

  // Importar múltiplos itens do Painel de Produção
  const handleImportProductionItems = async (
    itemsToImport: { codigoReceita: string; produto: string; prog: number; op?: string }[]
  ) => {
    try {
      setImportingProduction(true);
      const novasOrdensCriadas: any[] = [];
      const updatedPesados = { ...pesados };
      let sucessos = 0;
      let falhas = 0;

      const results = await Promise.all(
        itemsToImport.map(async (item) => {
          let cleanCode = (item.codigoReceita || item.produto || '').trim();
          if (cleanCode.toUpperCase().endsWith('I')) {
            cleanCode = cleanCode.slice(0, -1).trim();
          }

          let data = await fetchListaTecnica({ codigo_receita: cleanCode });
          if (!data || data.length === 0) {
            data = await fetchListaTecnica({ ativo: item.produto });
          }

          return { item, cleanCode, data };
        })
      );

      for (const { item, cleanCode, data } of results) {
        if (data && data.length > 0) {
          const primeiroRegistro = data[0];
          const codigo = primeiroRegistro.Codigo_Receita || primeiroRegistro.semi_acabado || cleanCode;
          const nome = primeiroRegistro.Ativo || primeiroRegistro.descricao_semi_acabado || item.produto;

          const numLotes = Math.max(1, Math.round(item.prog || 1));
          for (let i = 0; i < numLotes; i++) {
            const ordemId = uuidv4();
            const novaOrdem = {
              id: ordemId,
              codigo,
              nome: numLotes > 1 ? `${nome} (Lote ${i + 1}/${numLotes})` : nome,
              op: item.op || null,
              excipientes: data.reduce((acc: any, row: any) => {
                const nomeExp = row.Excipiente || row.descricao_materia_prima;
                acc[nomeExp] = {
                  quantidade: parseFloat(row.qtd_materia_prima || 0),
                  codigo: row.codigo_materia_prima || row.materia_prima,
                };
                return acc;
              }, {}),
            };

            novasOrdensCriadas.push(novaOrdem);

            data.forEach((row: any) => {
              const nomeExp = row.Excipiente || row.descricao_materia_prima;
              if (!updatedPesados[nomeExp]) {
                updatedPesados[nomeExp] = {};
              }
              updatedPesados[nomeExp][ordemId] = false;
            });
          }
          sucessos++;
        } else {
          console.warn(`Receita não encontrada para ${item.produto} (cód: ${cleanCode})`);
          falhas++;
        }
      }

      if (novasOrdensCriadas.length > 0) {
        const combinedOrdens = [...ordens, ...novasOrdensCriadas];
        setOrdens(combinedOrdens);
        setPesados(updatedPesados);
        calcularExcipientes(combinedOrdens, updatedPesados);
        toast.success(`${novasOrdensCriadas.length} ordens de produção importadas com sucesso!`);
      } else {
        toast.error("Nenhuma receita correspondente foi encontrada na Lista Técnica.");
      }

      if (falhas > 0) {
        toast.error(`${falhas} produto(s) não foram localizados na Lista Técnica.`);
      }
    } catch (err) {
      console.error("Erro ao importar do painel de produção:", err);
      toast.error("Erro ao importar itens de produção.");
    } finally {
      setImportingProduction(false);
    }
  };

  const handleDeleteOrdem = (ordemId: string) => {
    const updated = ordens.filter((o) => o.id !== ordemId);
    setOrdens(updated);

    const newPesados = { ...pesados };
    Object.keys(newPesados).forEach((excipient) => {
      if (newPesados[excipient]?.[ordemId] !== undefined) {
        delete newPesados[excipient][ordemId];
      }
    });
    setPesados(newPesados);

    if (selectedOrdem && selectedOrdem.id === ordemId) {
      setSelectedOrdem(null);
    }

    calcularExcipientes(updated, newPesados);
    toast.success("Ordem removida");
  };

  const handleEditOrdem = (ordem: any) => {
    setEditingOrdemDialog(ordem);

    if (ordem.excipientes && typeof ordem.excipientes === "object") {
      const ordemExcipientes = Object.entries(ordem.excipientes).reduce(
        (acc: any, [nomeExp, info]: [string, any], index: number) => {
          const uniqueKey = `${nomeExp}_${index}`;
          acc[uniqueKey] = {
            nome: nomeExp,
            quantidade: parseFloat(info.quantidade || 0),
            pesado: pesados[nomeExp]?.[ordem.id] || false,
            isEspecial: EXCIPIENTES_ESPECIAIS.includes(nomeExp),
          };
          return acc;
        },
        {}
      );
      setEditingExcipientes(ordemExcipientes);
    } else {
      setEditingExcipientes({});
    }
  };

  const handleCloseEditDialog = () => {
    setEditingOrdemDialog(null);
    setEditingExcipientes({});
    setSelectAllChecked(false);
  };

  const handleToggleExcipiente = (key: string) => {
    setEditingExcipientes((prev) => ({
      ...prev,
      [key]: { ...prev[key], pesado: !prev[key].pesado },
    }));
  };

  const handleSelectAll = () => {
    const nextVal = !selectAllChecked;
    setSelectAllChecked(nextVal);
    setEditingExcipientes((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, data]) => [k, { ...data, pesado: nextVal }])
      )
    );
  };

  const handleSaveEditDialog = () => {
    const newPesados = { ...pesados };
    Object.values(editingExcipientes).forEach((data: any) => {
      const excipient = data.nome;
      if (!newPesados[excipient]) newPesados[excipient] = {};
      newPesados[excipient][editingOrdemDialog.id] = data.pesado;
    });
    setPesados(newPesados);
    calcularExcipientes(ordens, newPesados);
    handleCloseEditDialog();
    toast.success("Pesagens atualizadas!");
  };

  const togglePesado = (excipient: string, ordemId: string) => {
    setPesados((prev) => {
      const newPesados = {
        ...prev,
        [excipient]: {
          ...prev[excipient],
          [ordemId]: !prev[excipient]?.[ordemId],
        },
      };
      calcularExcipientes(ordens, newPesados);
      return newPesados;
    });
  };

  const handleToggleExpandExcipient = (excipient: string) => {
    setExpandedExcipient(expandedExcipient === excipient ? null : excipient);
  };

  const handleMateriaisNaAreaChange = useCallback(
    (excipient: string, value: string) => {
      setInputValues((prev) => ({
        ...prev,
        [excipient]: value,
      }));

      const numVal = value === "" ? 0 : parseBrazilianNumber(value);
      setMateriaisNaArea((prev) => ({
        ...prev,
        [excipient]: numVal,
      }));
    },
    []
  );

  const handleUpdateSAPValues = async (excipient: string, codigo: string) => {
    if (!codigo) return;
    try {
      const data = await fetchSapMaterialStock(codigo);
      if (Array.isArray(data) && data.length > 0) {
        const saldoTotal = data.reduce(
          (sum: number, item: any) => sum + parseFloat(item.estoque_disponivel || 0),
          0
        );
        handleMateriaisNaAreaChange(excipient, formatNumber(saldoTotal, 3));
        toast.success(`Saldo SAP atualizado: ${formatNumber(saldoTotal, 3)} kg`);
      } else {
        toast.error("Nenhum estoque encontrado para este código no SAP");
      }
    } catch (err) {
      console.error("Erro ao buscar dados do SAP:", err);
      toast.error("Erro ao sincronizar com SAP");
    }
  };

  const handleUpdateAllSAPValues = async () => {
    try {
      const entries = Object.entries(filteredExcipientes).filter(([, data]) => Boolean(data.codigo));
      if (entries.length === 0) {
        toast("Nenhuma matéria-prima para sincronizar com SAP.", { icon: "ℹ️" });
        return;
      }

      let count = 0;
      await Promise.all(
        entries.map(async ([excipient, data]) => {
          try {
            const sapData = await fetchSapMaterialStock(data.codigo);
            if (Array.isArray(sapData) && sapData.length > 0) {
              const saldoTotal = sapData.reduce(
                (sum: number, item: any) => sum + parseFloat(item.estoque_disponivel || 0),
                0
              );
              handleMateriaisNaAreaChange(excipient, formatNumber(saldoTotal, 3));
              count++;
            }
          } catch (e) {
            console.warn(`Erro ao buscar saldo SAP para ${excipient}:`, e);
          }
        })
      );

      toast.success(`${count} matérias-primas atualizadas com sucesso pelo SAP!`);
    } catch (err) {
      console.error("Erro ao sincronizar tudo com SAP:", err);
      toast.error("Erro ao sincronizar com SAP");
    }
  };

  const handleOrdemClick = (ordem: any) => {
    if (selectedOrdem && selectedOrdem.id === ordem.id) {
      setSelectedOrdem(null);
      calcularExcipientes(ordens, pesados);
    } else {
      setSelectedOrdem(ordem);
    }
  };

  const handleOpenOPModal = (ordemId: string) => {
    setSelectedOrdemId(ordemId);
    setNewOP("");
    setOpModalOpen(true);
  };

  const handleSaveOP = () => {
    if (!newOP.trim()) return;
    setOrdens((prev) =>
      prev.map((o) => (o.id === selectedOrdemId ? { ...o, op: newOP.trim() } : o))
    );
    setOpModalOpen(false);
    setNewOP("");
    setSelectedOrdemId(null);
    toast.success("OP vinculada com sucesso!");
  };

  const isOrdemPesada = (ordem: any, pesadosObj: Record<string, Record<string, boolean>>) => {
    if (!ordem || !ordem.excipientes || !pesadosObj) return false;
    return Object.keys(ordem.excipientes).every(
      (excipiente) => pesadosObj[excipiente]?.[ordem.id]
    );
  };

  const filteredExcipientes = useMemo(() => {
    let filtered = { ...excipientes };
    if (selectedOrdem) {
      filtered = Object.keys(selectedOrdem.excipientes || {}).reduce(
        (acc: any, excipiente: string) => {
          if (excipientes[excipiente]) {
            acc[excipiente] = excipientes[excipiente];
          }
          return acc;
        },
        {}
      );
    }
    return filtered;
  }, [excipientes, selectedOrdem]);

  // Cálculo das quantidades solicitadas nas NTs pendentes agrupadas por matéria-prima
  const ntsPendentesPorExcipiente = useMemo<Record<string, ExcipienteNTInfo>>(() => {
    const result: Record<string, ExcipienteNTInfo> = {};

    Object.keys(filteredExcipientes).forEach((excipient) => {
      result[excipient] = { total: 0, items: [] };
    });

    if (!nts || nts.length === 0) return result;

    // Coletar itens com status diferente de 'Pago'
    const pendingItemsWithNT: Array<{ nt: NT; item: NTItem }> = [];
    nts.forEach((nt) => {
      if (nt.items && Array.isArray(nt.items)) {
        nt.items.forEach((item) => {
          if (item.status !== "Pago") {
            pendingItemsWithNT.push({ nt, item });
          }
        });
      }
    });

    Object.entries(filteredExcipientes).forEach(([excipientName, excipientData]: [string, any]) => {
      const matchingItems: PendingNTItemDetail[] = [];
      let totalQty = 0;

      pendingItemsWithNT.forEach(({ nt, item }) => {
        const isMatch = matchNTItemWithExcipient(
          item.code,
          item.description,
          excipientData.codigo,
          excipientName
        );

        if (isMatch) {
          const qty = parseBrazilianNumber(item.quantity);
          totalQty += qty;
          matchingItems.push({
            ntId: nt.id,
            ntNumber: nt.nt_number,
            itemId: item.id,
            code: item.code,
            description: item.description,
            quantity: qty,
            rawQuantity: item.quantity,
            status: item.status,
            createdDate: item.created_date || nt.created_date,
            createdTime: item.created_time || nt.created_time,
            batch: item.batch,
          });
        }
      });

      result[excipientName] = {
        total: Number(totalQty.toFixed(3)),
        items: matchingItems,
      };
    });

    return result;
  }, [filteredExcipientes, nts]);

  // Lista global de todos os itens pendentes e itens fora da necessidade
  const { allPendingNTItems, outsideNeedNTItems, totalPendingNTsCount } = useMemo(() => {
    const allItems: PendingNTItemDetail[] = [];
    const pendingNTIds = new Set<string>();

    if (nts && nts.length > 0) {
      nts.forEach((nt) => {
        if (nt.items && Array.isArray(nt.items)) {
          nt.items.forEach((item) => {
            if (item.status !== "Pago") {
              pendingNTIds.add(nt.id);
              const qty = parseBrazilianNumber(item.quantity);
              allItems.push({
                ntId: nt.id,
                ntNumber: nt.nt_number,
                itemId: item.id,
                code: item.code,
                description: item.description,
                quantity: qty,
                rawQuantity: item.quantity,
                status: item.status,
                createdDate: item.created_date || nt.created_date,
                createdTime: item.created_time || nt.created_time,
                batch: item.batch,
              });
            }
          });
        }
      });
    }

    // Itens fora da necessidade: itens pendentes que não pertencem a nenhuma matéria-prima da lista de ordens
    const outsideItems = allItems.filter((item) => {
      const matchesAnyExcipient = Object.entries(filteredExcipientes).some(
        ([excipientName, excipientData]: [string, any]) =>
          matchNTItemWithExcipient(
            item.code,
            item.description,
            excipientData.codigo,
            excipientName
          )
      );
      return !matchesAnyExcipient;
    });

    return {
      allPendingNTItems: allItems,
      outsideNeedNTItems: outsideItems,
      totalPendingNTsCount: pendingNTIds.size,
    };
  }, [nts, filteredExcipientes]);


  const getOrdensAtendidas = useCallback(

    (excipient: string) => {
      if (!filteredExcipientes[excipient]) {
        return { ordensAtendidas: [], ordensNaoAtendidas: [] };
      }

      const naArea = materiaisNaArea[excipient] || 0;
      let quantidadeRestante = naArea;
      const ordensAtendidas: any[] = [];
      const ordensNaoAtendidas: any[] = [];

      const ordensOrdenadas = [...(filteredExcipientes[excipient].ordens || [])];

      ordensOrdenadas.forEach((ordem) => {
        if (ordem.pesado) {
          ordensAtendidas.push(ordem);
        } else if (quantidadeRestante >= ordem.quantidade) {
          ordensAtendidas.push(ordem);
          quantidadeRestante -= ordem.quantidade;
        } else {
          ordensNaoAtendidas.push(ordem);
        }
      });

      return { ordensAtendidas, ordensNaoAtendidas };
    },
    [filteredExcipientes, materiaisNaArea]
  );

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleAddOrdem();
    }
  };

  // Loading de autenticação
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg)]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-[var(--accent)]" />
      </div>
    );
  }

  // Acesso negado para usuários sem liberação de perfil
  if (!canAccess) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen bg-[var(--bg)] text-[var(--text)]">
          <Sidebar />
          <div className="flex-1 flex flex-col pl-[52px] min-w-0 h-screen overflow-hidden">
            <Topbar />
            <main className="flex-1 p-6 flex items-center justify-center">
              <div className="max-w-md w-full p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-[var(--text)]">Acesso Restrito</h2>
                <p className="text-xs text-[var(--text-3)]">
                  Este módulo de Solicitações está disponível apenas com liberação de perfil pela administração ou supervisão.
                </p>
                <Button onClick={() => router.push('/dashboard')} className="w-full font-bold rounded-xl">
                  Voltar ao Dashboard
                </Button>
              </div>
            </main>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col pl-[52px] min-w-0 h-screen overflow-hidden">
          <Topbar />

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr] min-h-0 overflow-hidden">
            {/* Coluna de Ordens (300px) */}
            <aside className="border-r border-[var(--border)] bg-[var(--surface)] flex flex-col min-h-0 shrink-0">
              {/* Formulário Nova Ordem */}
              <div className="p-4 border-b border-[var(--border)]">
                <label className="block text-xs text-[var(--text-3)] mb-1.5 font-medium" htmlFor="recipeInput">
                  Nova ordem de produção
                </label>
                <div className="relative">
                  {addMode === "codigo" ? (
                    <input
                      id="recipeInput"
                      type="text"
                      inputMode="numeric"
                      value={ativo}
                      onChange={(e) => setAtivo(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={handleKeyPress}
                      ref={inputRef}
                      placeholder="Código da receita (ex.: 701171)"
                      className="h-8 w-full px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] font-mono text-[12.5px] outline-none focus:border-[var(--accent)] text-[var(--text)] placeholder:text-[var(--text-3)] transition-colors"
                    />
                  ) : (
                    <Autocomplete
                      value={ativo}
                      onChange={(val) => setAtivo(val)}
                      onKeyPress={handleKeyPress}
                      ref={inputRef}
                      placeholder="Digite o nome do ativo"
                    />
                  )}
                </div>

                {/* Campo Próxima OP se Auto OP ativo */}
                {autoIncrementOP && (
                  <div className="mt-2">
                    <input
                      type="number"
                      value={initialOP}
                      onChange={(e) => setInitialOP(e.target.value)}
                      placeholder={`Próxima OP: ${lastOP + 1}`}
                      className="h-7 w-full px-2.5 border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] font-mono text-xs outline-none focus:border-[var(--accent)] text-[var(--text)] placeholder:text-[var(--text-3)]"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mt-2.5">
                  <label className="flex items-center gap-2 text-xs text-[var(--text-2)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoIncrementOP}
                      onChange={(e) => setAutoIncrementOP(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-[26px] h-[15px] rounded-full bg-[var(--border-strong)] peer-checked:bg-[var(--accent)] relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-[11px] after:h-[11px] after:rounded-full after:bg-[var(--text-2)] peer-checked:after:bg-white peer-checked:after:left-[13px] after:transition-all" />
                    <span>Auto OP</span>
                  </label>

                  <button
                    onClick={handleAddOrdem}
                    className="h-7 px-3 rounded-[var(--radius)] bg-[var(--text)] text-[var(--bg)] font-medium text-xs flex items-center gap-1 hover:opacity-90 transition-opacity"
                  >
                    <PlusCircleIcon className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>

              {/* Cabeçalho da Lista de Ordens */}
              <div className="flex items-baseline justify-between p-3 px-4 pb-2 border-b border-[var(--border)]/50">
                <div>
                  <h2 className="text-xs font-semibold text-[var(--text)]">Ordens em andamento</h2>
                  <div className="text-[11px] text-[var(--text-3)] mt-0.5">
                    {ordens.length} {ordens.length === 1 ? "ordem" : "ordens"} • {ordens.filter((o) => isOrdemPesada(o, pesados)).length} pesadas
                  </div>
                </div>
                {selectedOrdem && (
                  <button
                    onClick={() => setSelectedOrdem(null)}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>

              {/* Lista de Ordens */}
              <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                {ordens.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[var(--text-3)]">
                    Nenhuma ordem em andamento.
                  </div>
                ) : (
                  ordens.map((ordem) => {
                    const isPesada = isOrdemPesada(ordem, pesados);
                    const isSelected = selectedOrdem?.id === ordem.id;
                    const excipientesCount = Object.keys(ordem.excipientes || {}).length;

                    return (
                      <div
                        key={ordem.id}
                        onClick={() => handleOrdemClick(ordem)}
                        className={`group flex items-center justify-between p-2.5 px-4 cursor-pointer transition-colors border-l-2 ${
                          isSelected
                            ? "bg-[var(--accent-weak)] border-[var(--accent)]"
                            : isPesada
                            ? "border-transparent hover:bg-[var(--hover)] opacity-70"
                            : "border-transparent hover:bg-[var(--hover)]"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className={`font-medium text-xs truncate ${isPesada ? "line-through text-[var(--text-3)]" : "text-[var(--text)]"}`}>
                            {ordem.nome}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-3)]">
                            <span className="font-mono">{ordem.op ? `OP: ${ordem.op}` : "S/N"}</span>
                            <span>•</span>
                            <span>{excipientesCount} {excipientesCount === 1 ? "item" : "itens"}</span>
                            {isPesada && (
                              <span className="text-[10px] text-emerald-400 font-medium ml-1">
                                Pesada
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hover Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!ordem.op && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenOPModal(ordem.id);
                              }}
                              className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--border)] hover:text-[var(--accent)]"
                              title="Adicionar OP"
                            >
                              <HashtagIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditOrdem(ordem);
                            }}
                            className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                            title="Editar pesagens da ordem"
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteOrdem(ordem.id);
                            }}
                            className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--border)] hover:text-[var(--red)]"
                            title="Remover ordem"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Conteúdo Principal (Direita) */}
            <main className="flex-1 overflow-y-auto p-5 sm:p-6 min-w-0 bg-[var(--bg)]">
              <TabelaPrincipal
                filteredExcipientes={filteredExcipientes}
                materiaisNaArea={materiaisNaArea}
                faltaSolicitar={faltaSolicitar}
                inputValues={inputValues}
                ntsPendentesPorExcipiente={ntsPendentesPorExcipiente}
                allPendingNTItems={allPendingNTItems}
                outsideNeedNTItems={outsideNeedNTItems}
                totalPendingNTsCount={totalPendingNTsCount}
                selectedOrdem={selectedOrdem}
                onClearSelectedOrdem={() => setSelectedOrdem(null)}
                handleMateriaisNaAreaChange={handleMateriaisNaAreaChange}
                handleToggleExpandExcipient={handleToggleExpandExcipient}
                expandedExcipient={expandedExcipient}
                togglePesado={togglePesado}
                handleUpdateSAPValues={handleUpdateSAPValues}
                handleUpdateAllSAPValues={handleUpdateAllSAPValues}
                handleEditOrdem={handleEditOrdem}
                onOpenSap={() => setSapDialogOpen(true)}
                onOpenPullProduction={() => setPullProductionOpen(true)}
              />
            </main>
          </div>
        </div>

        {/* Modal de Consulta SAP */}
        <Sap open={sapDialogOpen} onClose={() => setSapDialogOpen(false)} user={user} />

        {/* Modal Puxar Produção */}
        <PullProductionDialog
          open={pullProductionOpen}
          onClose={() => setPullProductionOpen(false)}
          onImport={handleImportProductionItems}
          isLoading={importingProduction}
        />

        {/* Modal de Inserção de OP */}
        {opModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg max-w-sm w-full p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <h3 className="text-sm font-semibold text-[var(--text)] mb-3">
                Adicionar Número de OP
              </h3>
              <input
                type="text"
                value={newOP}
                onChange={(e) => setNewOP(e.target.value)}
                placeholder="Ex: 2213345"
                className="w-full h-8 px-2.5 text-xs bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--radius)] text-[var(--text)] font-mono mb-4 outline-none focus:border-[var(--accent)]"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setOpModalOpen(false)}
                  className="h-7 px-3 text-xs text-[var(--text-3)] hover:text-[var(--text)] rounded border border-[var(--border-strong)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveOP}
                  className="h-7 px-3 text-xs bg-[var(--text)] text-[var(--bg)] font-medium rounded hover:opacity-90 transition-opacity"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edição de Pesagens da Ordem */}
        {editingOrdemDialog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text)]">{editingOrdemDialog.nome}</h3>
                  <p className="text-xs text-[var(--text-3)] font-mono">OP: {editingOrdemDialog.op || "Sem OP"}</p>
                </div>
                <button
                  onClick={handleCloseEditDialog}
                  className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)]"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between p-2 rounded bg-[var(--surface-2)] border border-[var(--border)]">
                  <span className="text-xs font-medium text-[var(--text-2)]">Marcar todos como pesados</span>
                  <input
                    type="checkbox"
                    checked={selectAllChecked}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                  />
                </div>

                <div className="max-h-[45vh] overflow-y-auto space-y-1.5 divide-y divide-[var(--border)]">
                  {Object.entries(editingExcipientes).map(([key, data]: any) => (
                    <div
                      key={key}
                      className="flex items-center justify-between pt-1.5 first:pt-0 text-xs"
                    >
                      <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={data.pesado}
                          onChange={() => handleToggleExcipiente(key)}
                          className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                        />
                        <span className={`font-medium ${data.pesado ? "line-through text-[var(--text-3)]" : "text-[var(--text)]"}`}>
                          {data.nome}
                        </span>
                      </label>
                      <span className="font-mono text-[11px] text-[var(--text-3)]">
                        {formatNumber(data.quantidade, 3)} kg
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 px-4 bg-[var(--surface-2)] border-t border-[var(--border)] flex justify-end gap-2">
                <button
                  onClick={handleCloseEditDialog}
                  className="h-7 px-3 text-xs text-[var(--text-3)] hover:text-[var(--text)] rounded border border-[var(--border-strong)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEditDialog}
                  className="h-7 px-3 text-xs bg-[var(--text)] text-[var(--bg)] font-medium rounded hover:opacity-90 transition-opacity"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
