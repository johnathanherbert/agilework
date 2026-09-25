"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import Autocomplete from "@/components/solicitacoes/Autocomplete";
import TabelaPrincipal from "@/components/solicitacoes/TabelaPrincipal";
import DetalhamentoMateriais from "@/components/solicitacoes/DetalhamentoMateriais";
import ExcelUploader from "@/components/solicitacoes/ExcelUploader";
import Sap from "@/components/solicitacoes/Sap";
import ProtectedRoute from "@/components/auth/protected-route";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { RequestsProvider } from "@/contexts/RequestsContext";
import { 
  fetchListaTecnica, 
  loadAppState, 
  saveAppState, 
  clearAppState,
  fetchSapMaterialStock 
} from "@/lib/dashpesagem-api";
import { useFirebase } from "@/components/providers/firebase-provider";
import toast from "react-hot-toast";

import {
  PlusCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  TrashIcon,
  BeakerIcon,
  HashtagIcon,
  MagnifyingGlassIcon,
  CloudArrowUpIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

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
  const { user } = useFirebase();
  const userId = user?.email || user?.uid || "default_user";

  const [ordens, setOrdens] = useState<any[]>([]);
  const [ativo, setAtivo] = useState("");
  const [excipientes, setExcipientes] = useState<Record<string, any>>({});
  const [expandedExcipient, setExpandedExcipient] = useState<string | string[] | null>(null);
  const [selectedOrdem, setSelectedOrdem] = useState<any>(null);
  const [pesados, setPesados] = useState<Record<string, Record<string, boolean>>>({});
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
  const [openUploadDialog, setOpenUploadDialog] = useState(false);

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

  // Cálculo de excipientes agregados a partir das ordens
  const calcularExcipientes = useCallback(
    async (ordensAtuais: any[] = [], pesadosAtuais: Record<string, Record<string, boolean>> = {}) => {
      if (!ordensAtuais || ordensAtuais.length === 0) {
        setExcipientes({});
        return;
      }

      const newExcipientes: Record<string, any> = {};

      for (const ordem of ordensAtuais) {
        const data = await fetchListaTecnica({ codigo_receita: ordem.codigo });

        if (Array.isArray(data)) {
          data.forEach((item: any) => {
            const rawCode = String(item.codigo_materia_prima || item.materia_prima || "");
            const codigoExcipiente = rawCode.padStart(6, "0");
            const nomeExcipiente = item.Excipiente || item.descricao_materia_prima || "Excipiente";
            const quantidade = parseFloat(item.qtd_materia_prima || 0);

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
      let data: any[] = [];
      if (addMode === "codigo") {
        data = await fetchListaTecnica({ codigo_receita: ativo.trim() });
      } else {
        data = await fetchListaTecnica({ ativo: ativo.trim() });
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

      await calcularExcipientes(newOrdens, newPesados);
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

  const handleEditOrdem = async (ordem: any) => {
    setEditingOrdemDialog(ordem);

    try {
      const data = await fetchListaTecnica({ codigo_receita: ordem.codigo });
      if (Array.isArray(data)) {
        const ordemExcipientes = data.reduce((acc: any, item: any, index: number) => {
          const nomeExp = item.Excipiente || item.descricao_materia_prima;
          const uniqueKey = `${nomeExp}_${index}`;
          acc[uniqueKey] = {
            nome: nomeExp,
            quantidade: parseFloat(item.qtd_materia_prima || 0),
            pesado: pesados[nomeExp]?.[ordem.id] || false,
            isEspecial: EXCIPIENTES_ESPECIAIS.includes(nomeExp),
          };
          return acc;
        }, {});
        setEditingExcipientes(ordemExcipientes);
      }
    } catch (err) {
      console.error("Erro ao carregar excipientes para edição:", err);
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

      const numVal = value === "" ? 0 : parseFloat(value) || 0;
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
        handleMateriaisNaAreaChange(excipient, saldoTotal.toFixed(3));
        toast.success(`Saldo SAP atualizado: ${saldoTotal.toFixed(3)} kg`);
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
      let count = 0;
      for (const [excipient, data] of Object.entries(filteredExcipientes)) {
        if (data.codigo) {
          const sapData = await fetchSapMaterialStock(data.codigo);
          if (Array.isArray(sapData) && sapData.length > 0) {
            const saldoTotal = sapData.reduce(
              (sum: number, item: any) => sum + parseFloat(item.estoque_disponivel || 0),
              0
            );
            handleMateriaisNaAreaChange(excipient, saldoTotal.toFixed(3));
            count++;
          }
        }
      }
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

  const getFilteredAtivos = useCallback(() => {
    if (selectedOrdem) {
      return [selectedOrdem.nome];
    }
    return Array.from(new Set(ordens.map((o) => o.nome)));
  }, [selectedOrdem, ordens]);

  const getAtivoStatus = useCallback(
    (ativoNome: string) => {
      const excipientesDoAtivo = Object.entries(filteredExcipientes).filter(
        ([, data]: any) => data.ordens && data.ordens.some((ordem: any) => ordem.nome === ativoNome)
      );

      let totalNecessario = 0;
      let totalDisponivel = 0;

      excipientesDoAtivo.forEach(([excipient, data]: any) => {
        const ordensDoAtivo = data.ordens.filter((ordem: any) => ordem.nome === ativoNome);
        ordensDoAtivo.forEach((ordem: any) => {
          if (!ordem.pesado) {
            totalNecessario += ordem.quantidade;
            totalDisponivel += Math.min(materiaisNaArea[excipient] || 0, ordem.quantidade);
          }
        });
      });

      if (totalNecessario === 0) return "pesado";
      if (totalDisponivel >= totalNecessario) return "completo";
      if (totalDisponivel > 0) return "parcial";
      return "indisponivel";
    },
    [filteredExcipientes, materiaisNaArea]
  );

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

  return (
    <ProtectedRoute>
      <RequestsProvider>
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
          <Sidebar />

          <div className="flex-1 flex flex-col ml-[64px] transition-all duration-300 min-w-0">
            <Topbar />

            {/* Barra de Ações Rápidas Superior */}
            <div className="bg-white dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700/60 px-6 py-2.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <h1 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <BeakerIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Solicitações e Pesagem de MP
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  PostgreSQL Dashpesagem
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSapDialogOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                  <span>Consulta SAP</span>
                </button>

                <button
                  onClick={handleUpdateAllSAPValues}
                  className="px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 border border-green-200 dark:border-green-800 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                  <span>Atualizar Saldos</span>
                </button>

                <button
                  onClick={() => setOpenUploadDialog(true)}
                  className="px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <CloudArrowUpIcon className="w-3.5 h-3.5" />
                  <span>Upload Planilha SAP</span>
                </button>
              </div>
            </div>

            {/* Conteúdo Principal — Grid 3 Colunas como no PWA-Kastor */}
            <main className="flex-1 p-4 sm:p-5 overflow-y-auto">
              <div className="grid grid-cols-12 gap-5">
                {/* Coluna Esquerda: Nova Ordem + Lista de Ordens (3 colunas) */}
                <div className="col-span-12 lg:col-span-3 space-y-4">
                  {/* Card Estatísticas */}
                  <div className="bg-white dark:bg-gray-800/90 rounded-xl shadow-xs border border-gray-200/80 dark:border-gray-700/50 p-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Total Ordens</p>
                        <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{ordens.length}</p>
                      </div>
                      <div className="p-2.5 bg-green-50 dark:bg-green-900/30 rounded-lg">
                        <p className="text-[11px] font-medium text-green-600 dark:text-green-400">Pesadas</p>
                        <p className="text-xl font-bold text-green-700 dark:text-green-300">
                          {ordens.filter((o) => isOrdemPesada(o, pesados)).length}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Adicionar Ordem */}
                  <div className="bg-white dark:bg-gray-800/90 rounded-xl shadow-xs border border-gray-200/80 dark:border-gray-700/50 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center gap-2">
                      <PlusCircleIcon className="w-4 h-4" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">Nova Ordem de Produção</h3>
                    </div>

                    <div className="p-4 space-y-3">
                      {addMode === "codigo" ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={ativo}
                            onChange={(e) => setAtivo(e.target.value.replace(/\D/g, ""))}
                            onKeyPress={handleKeyPress}
                            ref={inputRef}
                            placeholder="Digite o código da receita (Ex: 701171)"
                            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono"
                          />
                        </div>
                      ) : (
                        <Autocomplete
                          value={ativo}
                          onChange={(val) => setAtivo(val)}
                          onKeyPress={handleKeyPress}
                          ref={inputRef}
                          placeholder="Digite o nome do ativo (Ex: AMOXICILINA)"
                        />
                      )}

                      {/* Auto Increment OP */}
                      {autoIncrementOP && (
                        <input
                          type="number"
                          value={initialOP}
                          onChange={(e) => setInitialOP(e.target.value)}
                          placeholder={`Próxima OP: ${lastOP + 1}`}
                          className="w-full px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs"
                        />
                      )}

                      {/* Botões do Formulário */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setAddMode(addMode === "codigo" ? "ativo" : "codigo");
                            setAtivo("");
                          }}
                          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border flex items-center justify-center gap-1 flex-1 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100"
                        >
                          {addMode === "codigo" ? <BeakerIcon className="w-3.5 h-3.5" /> : <HashtagIcon className="w-3.5 h-3.5" />}
                          <span>{addMode === "codigo" ? "Por Ativo" : "Por Código"}</span>
                        </button>

                        <button
                          onClick={() => setAutoIncrementOP(!autoIncrementOP)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1 ${
                            autoIncrementOP ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-600"
                          }`}
                        >
                          Auto OP
                        </button>

                        <button
                          onClick={handleAddOrdem}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <PlusCircleIcon className="w-4 h-4" />
                          <span>Adicionar</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Ordens Ativas e Pesadas */}
                  <div className="bg-white dark:bg-gray-800/90 rounded-xl shadow-xs border border-gray-200/80 dark:border-gray-700/50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        Ordens em Andamento ({ordens.length})
                      </span>
                      {selectedOrdem && (
                        <button
                          onClick={() => setSelectedOrdem(null)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Limpar filtro
                        </button>
                      )}
                    </div>

                    <div className="p-2 space-y-1.5 max-h-[calc(100vh-420px)] overflow-y-auto">
                      {ordens.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-6">Nenhuma ordem adicionada</p>
                      ) : (
                        ordens.map((ordem) => {
                          const isPesada = isOrdemPesada(ordem, pesados);
                          const isSelected = selectedOrdem?.id === ordem.id;

                          return (
                            <div
                              key={ordem.id}
                              onClick={() => handleOrdemClick(ordem)}
                              className={`group p-2.5 rounded-lg border cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-blue-50/80 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700"
                                  : isPesada
                                  ? "bg-green-50/50 border-green-200 dark:bg-green-900/20 dark:border-green-800/50"
                                  : "bg-gray-50 dark:bg-gray-700/40 border-gray-200/70 dark:border-gray-700/50 hover:bg-gray-100"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                                      {ordem.nome}
                                    </span>
                                    {isPesada && (
                                      <span className="text-[10px] font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 px-1.5 py-0.2 rounded">
                                        Pesada
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                    <span>OP: {ordem.op || "S/N"}</span>
                                    <span>•</span>
                                    <span>{Object.keys(ordem.excipientes || {}).length} excipientes</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                  {!ordem.op && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenOPModal(ordem.id);
                                      }}
                                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                      title="Adicionar OP"
                                    >
                                      <PlusCircleIcon className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditOrdem(ordem);
                                    }}
                                    className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Editar pesagem"
                                  >
                                    <PencilIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteOrdem(ordem.id);
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Remover ordem"
                                  >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Coluna Central: Tabela Principal de Matérias-Primas e Solicitações (6 colunas) */}
                <div className="col-span-12 lg:col-span-6">
                  <TabelaPrincipal
                    filteredExcipientes={filteredExcipientes}
                    materiaisNaArea={materiaisNaArea}
                    faltaSolicitar={faltaSolicitar}
                    inputValues={inputValues}
                    handleMateriaisNaAreaChange={handleMateriaisNaAreaChange}
                    handleDetailClick={() => {}}
                    handleToggleExpandExcipient={handleToggleExpandExcipient}
                    expandedExcipient={expandedExcipient}
                    allExpanded={false}
                    togglePesado={togglePesado}
                    calcularMovimentacaoTotal={() => 0}
                    getOrdensAtendidas={getOrdensAtendidas}
                    handleUpdateSAPValues={handleUpdateSAPValues}
                    handleUpdateAllSAPValues={handleUpdateAllSAPValues}
                    handleEditOrdem={handleEditOrdem}
                  />
                </div>

                {/* Coluna Direita: Detalhamento por Ativo e Status de Fabricação (3 colunas) */}
                <div className="col-span-12 lg:col-span-3">
                  <DetalhamentoMateriais
                    getFilteredAtivos={getFilteredAtivos}
                    getAtivoStatus={getAtivoStatus}
                    ordens={ordens}
                    filteredExcipientes={filteredExcipientes}
                    materiaisNaArea={materiaisNaArea}
                  />
                </div>
              </div>
            </main>
          </div>
        </div>

        {/* Modal de Consulta SAP */}
        <Sap open={sapDialogOpen} onClose={() => setSapDialogOpen(false)} user={user} />

        {/* Modal Upload Excel */}
        <ExcelUploader
          openUploadDialog={openUploadDialog}
          handleCloseUploadDialog={() => setOpenUploadDialog(false)}
          onDataUpdated={() => {
            handleUpdateAllSAPValues();
          }}
        />

        {/* Modal de Inserção de OP */}
        {opModalOpen && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
                Adicionar Número de OP
              </h3>
              <input
                type="text"
                value={newOP}
                onChange={(e) => setNewOP(e.target.value)}
                placeholder="Ex: 2213345"
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setOpModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveOP}
                  className="px-3.5 py-1.5 text-xs bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edição de Pesagens da Ordem */}
        {editingOrdemDialog && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
              <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">{editingOrdemDialog.nome}</h3>
                  <p className="text-xs text-blue-200">OP: {editingOrdemDialog.op || "Sem OP"}</p>
                </div>
                <button onClick={handleCloseEditDialog} className="text-white/80 hover:text-white">
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Marcar todos como pesados</span>
                  <input
                    type="checkbox"
                    checked={selectAllChecked}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                </div>

                <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                  {Object.entries(editingExcipientes).map(([key, data]: any) => (
                    <div
                      key={key}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                        data.pesado
                          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                          : "bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={data.pesado}
                          onChange={() => handleToggleExcipiente(key)}
                          className="w-4 h-4 rounded text-blue-600"
                        />
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{data.nome}</p>
                          <p className="text-[11px] text-gray-500">{data.quantidade.toFixed(3)} kg</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                <button
                  onClick={handleCloseEditDialog}
                  className="px-4 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEditDialog}
                  className="px-4 py-1.5 text-xs bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </RequestsProvider>
    </ProtectedRoute>
  );
}
