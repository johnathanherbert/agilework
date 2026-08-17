import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  Timestamp,
  increment,
  writeBatch,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentUserInfo } from './firestore-helpers';
import {
  Operator,
  LaborOccurrence,
  LaborOccurrenceType,
  OperatorTurma,
  ProductionTurno,
  VacationConflict,
  AbsenteeismStats,
  OperatorStatus,
} from '@/types';
import { getEscalaForDate, getEscalaForMonth, isEscaladoParaTrabalhar } from './escala-helpers';

export const OPERATORS_COLLECTION = 'operators';
export const LABOR_OCCURRENCES_COLLECTION = 'labor_occurrences';

// Converte Firestore Doc em Operator
const mapDocToOperator = (docId: string, data: any): Operator => ({
  id: docId,
  nome: data.nome || '',
  matricula: data.matricula || '',
  cargo: data.cargo || 'Operador de Produção',
  letra: data.letra || 'A',
  turno: Number(data.turno) as ProductionTurno || 1,
  saldoFolgasFlexiveis: Number(data.saldoFolgasFlexiveis) || 0,
  status: data.status || 'ativo',
  dataAdmissao: data.dataAdmissao || '',
  telefone: data.telefone || '',
  observacoes: data.observacoes || '',
  created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at || new Date().toISOString(),
  updated_at: data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : data.updated_at || new Date().toISOString(),
  created_by: data.created_by,
  created_by_name: data.created_by_name,
  updated_by: data.updated_by,
  updated_by_name: data.updated_by_name,
});

// Converte Firestore Doc em LaborOccurrence
const mapDocToOccurrence = (docId: string, data: any): LaborOccurrence => ({
  id: docId,
  operadorId: data.operadorId,
  operadorNome: data.operadorNome || '',
  operadorCargo: data.operadorCargo || '',
  operadorLetra: data.operadorLetra || 'A',
  turno: Number(data.turno) as ProductionTurno || 1,
  tipo: data.tipo as LaborOccurrenceType,
  dataInicio: data.dataInicio,
  dataFim: data.dataFim || data.dataInicio,
  dias: Number(data.dias) || 1,
  horasImpacto: data.horasImpacto !== undefined ? Number(data.horasImpacto) : 8 * (Number(data.dias) || 1),
  motivo: data.motivo || '',
  queixas: data.queixas || '',
  cid: data.cid || '',
  tipoFolgaFlexivel: data.tipoFolgaFlexivel,
  impactaAbsenteismo: data.impactaAbsenteismo !== undefined ? Boolean(data.impactaAbsenteismo) : (data.tipo === 'falta_injustificada' || data.tipo === 'falta_justificada' || data.tipo === 'atestado'),
  obsSupervisao: data.obsSupervisao || '',
  obsSupervisaoUpdatedAt: data.obsSupervisaoUpdatedAt?.toDate ? data.obsSupervisaoUpdatedAt.toDate().toISOString() : data.obsSupervisaoUpdatedAt || '',
  obsSupervisaoUpdatedBy: data.obsSupervisaoUpdatedBy || '',
  created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at || new Date().toISOString(),
  created_by: data.created_by,
  created_by_name: data.created_by_name,
  updated_at: data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : data.updated_at,
});

/* ==========================================================================
   CRUD DE OPERADORES
   ========================================================================== */

export type CreateOperatorInput = {
  nome: string;
  matricula: string;
  cargo: string;
  letra: OperatorTurma;
  turno: ProductionTurno;
  saldoFolgasFlexiveis?: number;
  status?: OperatorStatus;
  dataAdmissao?: string;
  telefone?: string;
  observacoes?: string;
};

export const createOperator = async (input: CreateOperatorInput): Promise<string> => {
  const collRef = collection(db, OPERATORS_COLLECTION);
  const now = Timestamp.now();
  const userInfo = await getCurrentUserInfo();

  const data: any = {
    nome: input.nome.trim(),
    matricula: input.matricula.trim(),
    cargo: input.cargo.trim(),
    letra: input.letra,
    turno: Number(input.turno),
    saldoFolgasFlexiveis: Number(input.saldoFolgasFlexiveis) || 0,
    status: input.status || 'ativo',
    dataAdmissao: input.dataAdmissao || '',
    telefone: input.telefone || '',
    observacoes: input.observacoes || '',
    created_at: now,
    updated_at: now,
  };

  if (userInfo) {
    data.created_by = userInfo.uid;
    data.created_by_name = userInfo.name;
    data.updated_by = userInfo.uid;
    data.updated_by_name = userInfo.name;
  }

  const docRef = await addDoc(collRef, data);
  console.log(`✅ Operador criado: ${input.nome} (ID: ${docRef.id})`);
  return docRef.id;
};

export type UpdateOperatorInput = Partial<{
  nome: string;
  matricula: string;
  cargo: string;
  letra: OperatorTurma;
  turno: ProductionTurno;
  saldoFolgasFlexiveis: number;
  status: OperatorStatus;
  dataAdmissao: string;
  telefone: string;
  observacoes: string;
}>;

export const updateOperator = async (operatorId: string, input: UpdateOperatorInput): Promise<void> => {
  const opRef = doc(db, OPERATORS_COLLECTION, operatorId);
  const now = Timestamp.now();
  const userInfo = await getCurrentUserInfo();

  const sanitizedInput = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );

  const updateData: any = {
    ...sanitizedInput,
    updated_at: now,
  };

  if (userInfo) {
    updateData.updated_by = userInfo.uid;
    updateData.updated_by_name = userInfo.name;
  }

  await updateDoc(opRef, updateData);
  console.log(`✅ Operador atualizado: ${operatorId}`);
};

export const updateOperatorSaldoFolgas = async (
  operatorId: string,
  deltaDias: number,
  motivo?: string
): Promise<void> => {
  const opRef = doc(db, OPERATORS_COLLECTION, operatorId);
  const now = Timestamp.now();
  const userInfo = await getCurrentUserInfo();

  const updateData: any = {
    saldoFolgasFlexiveis: increment(deltaDias),
    updated_at: now,
  };

  if (userInfo) {
    updateData.updated_by = userInfo.uid;
    updateData.updated_by_name = userInfo.name;
  }

  await updateDoc(opRef, updateData);
  console.log(`✅ Saldo de folgas atualizado para operador ${operatorId}: delta ${deltaDias} (${motivo || 'Sem motivo'})`);
};

export const deleteOperator = async (operatorId: string): Promise<void> => {
  const opRef = doc(db, OPERATORS_COLLECTION, operatorId);
  await deleteDoc(opRef);
  console.log(`✅ Operador excluído: ${operatorId}`);
};

export const subscribeToOperators = (
  callback: (operators: Operator[]) => void,
  errorCallback?: (error: Error) => void
) => {
  const collRef = collection(db, OPERATORS_COLLECTION);
  const q = query(collRef, orderBy('nome', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const ops = snapshot.docs.map((docSnap) => mapDocToOperator(docSnap.id, docSnap.data()));
      callback(ops);
    },
    (error) => {
      console.error('❌ Erro na subscrição de operadores:', error);
      errorCallback?.(error);
    }
  );
};

export const getOperators = async (): Promise<Operator[]> => {
  const collRef = collection(db, OPERATORS_COLLECTION);
  const q = query(collRef, orderBy('nome', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => mapDocToOperator(d.id, d.data()));
};

/* ==========================================================================
   IMPORTAÇÃO EM MASSA DE OPERADORES (TEMPORARIO.TXT / TSV / CSV)
   ========================================================================== */

export const TEMPORARIO_TXT_DEFAULT = `ID\tNOME \tFUNÇÃO\tLETRA\tTURNO
98439\tDIEGO GEORGE CAVALCANTE MARIAL\tLIDER PESAGEM\tA\t1
97214\tBENEDITO DAVI PEREIRA OLIVEIRA\tOPERADOR PESAGEM I\tA\t1
95421\tCASSIO TIAGO O SOUZA\tOPERADOR PESAGEM I\tA\t1
85220\tIURY GABRIEL RODRIGUES DE OLIV\tOPERADOR PESAGEM I\tA\t1
69857\tLUCAS SOARES DE SOUZA\tOPERADOR PESAGEM ESPECIALIZADO\tA\t1
52232\tWILLACE CRUZ DOS SANTOS\tLIDER PESAGEM\tB\t1
52244\tJULIO CESAR BARBOSA GONCALVES\tOPERADOR PESAGEM ESPECIALIZADO\tB\t1
96762\tVANDERSON FERREIRA PAIXAO\tOPERADOR PESAGEM I\tB\t1
79338\tLUAN ITALO SILVA\tOPERADOR PESAGEM I\tB\t1
81238\tMATHEUS HENRIQUE DE CASTRO FON\tOPERADOR PESAGEM I\tB\t1
95411\tWESLEY GUIMARÃES ALMEIDA\tOPERADOR PESAGEM I\tB\t1
45923\tGLEISON RODRIGUES DA SILVA\tOPERADOR PESAGEM ESPECIALIZADO\tC\t1
73302\tJOSILENO PEREIRA DE SOUZA\tOPERADOR PESAGEM II\tC\t1
100545\tULISSES SILVA VIEIRA\tAUXILIAR DE PRODUÇÃO\tC\t1
95438\tELIASAFE DA SILVA VALENTE\tOPERADOR PESAGEM I\tC\t1
95425\tLUCAS COSTA DA CRUZ DA SILVA\tOPERADOR PESAGEM I\tA\t1
73660\tRERISON BRUNO LESSA PINTO\tOPERADOR PESAGEM II\tC\t1
40895\tJERRY FALCAO DA COSTA\tLIDER PESAGEM\tD\t1
96819\tANTHONY EDUARDO LIMA DA SILVA\tOPERADOR PESAGEM I\tD\t1
100555\tEDUARDO BARROS\tAUXILIAR DE PRODUÇÃO\tD\t1
52224\tBRUNO ROSSI DA SILVA SOUZA\tOPERADOR PESAGEM ESPECIALIZADO\tD\t1
95435\tHAROLDO GAMA GUARIM JUNIOR\tOPERADOR PESAGEM I\tD\t1
97178\tGabriel da Silva Braz\tOPERADOR PESAGEM I\tA\t2
96776\tKARL LEWIS DE SOUZA ARAUJO\tOPERADOR PESAGEM I\tA\t2
93079\tLUCAS DA SILVA E SILVA\tOPERADOR PESAGEM I\tA\t2
44684\tMANOEL COSMO DA SILVA NETO\tOPERADOR PESAGEM II\tA\t2
64393\tROSINEI LIMA DE ALMEIDA\tOPERADOR PESAGEM ESPECIALIZADO\tA\t2
47487\tLENEKER JUNIOR DE C MARTINS\tLIDER PESAGEM\tB\t2
47403\tEMANUEL F DO NASCIMENTO\tOPERADOR PESAGEM ESPECIALIZADO\tB\t2
95418\tLucio do Nascimento Amazonas F\tOPERADOR PESAGEM I\tB\t2
64264\tRENISON DANIEL FERREIRA\tOPERADOR PESAGEM ESPECIALIZADO\tB\t2
47489\tALESSANDRO SIMAS GOMES\tLIDER PESAGEM\tC\t2
95430\tFelipe da Silva Ribeiro\tOPERADOR PESAGEM I\tC\t2
\tMARCOS FABIANO\tOPERADOR PESAGEM ESPECIALIZADO\tC\t2
93092\tJOAO HENRIQUE SANTO SOUSA\tOPERADOR PESAGEM I\tC\t2
89077\tROBERT BATISTA GOMES\tOPERADOR PESAGEM I\tC\t2
57369\tANDRE LUIZ SOUZA DE LIMA\tOPERADOR PESAGEM ESPECIALIZADO\tD\t2
82834\tDANIEL MARQUES DE FREITAS\tOPERADOR PESAGEM II\tD\t2
82960\tGILBERTO DE SOUZA FREIRE\tOPERADOR PESAGEM II\tD\t2
98669\tElirez Costa da silva\tLIDER PESAGEM\tD\t2
97050\tSamuel Cascaes da Silva\tOPERADOR PESAGEM I\tD\t2`;

/**
 * Converte texto TSV/CSV/Linhas em lista de CreateOperatorInput
 */
export function parseOperatorsFromText(rawText: string): {
  operators: CreateOperatorInput[];
  errors: string[];
} {
  const lines = rawText.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const operators: CreateOperatorInput[] = [];
  const errors: string[] = [];

  let fallbackIdCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Ignora linha de cabeçalho
    const lower = line.toLowerCase();
    if (lower.includes('id') && lower.includes('nome') && (lower.includes('função') || lower.includes('cargo') || lower.includes('letra'))) {
      continue;
    }

    // Tenta separar por Tabulação primeiro, senão por ponto e vírgula, senão por vírgula
    let parts: string[] = [];
    if (line.includes('\t')) {
      parts = line.split('\t').map((p) => p.trim());
    } else if (line.includes(';')) {
      parts = line.split(';').map((p) => p.trim());
    } else if (line.includes(',')) {
      parts = line.split(',').map((p) => p.trim());
    } else {
      // Separa por múltiplos espaços (>= 2 espaços)
      parts = line.split(/\s{2,}/).map((p) => p.trim());
    }

    if (parts.length < 3) {
      errors.push(`Linha ${i + 1} ignorada (formato inválido): "${line}"`);
      continue;
    }

    let matricula = parts[0] || '';
    let nome = parts[1] || '';
    let cargo = parts[2] || 'Operador de Produção';
    let letraRaw = (parts[3] || 'A').toUpperCase();
    let turnoRaw = parts[4] || '1';

    // Trata caso onde a matrícula estava em branco e os dados vieram deslocados
    if (!matricula && parts.length >= 4) {
      matricula = `TEMP-${String(fallbackIdCounter++).padStart(3, '0')}`;
    }

    // Se a primeira coluna não é número e parece um nome
    if (isNaN(Number(matricula)) && !parts[4] && parts.length === 4) {
      // Formato: NOME, CARGO, LETRA, TURNO
      nome = parts[0];
      cargo = parts[1];
      letraRaw = parts[2].toUpperCase();
      turnoRaw = parts[3];
      matricula = `TEMP-${String(fallbackIdCounter++).padStart(3, '0')}`;
    }

    // Normaliza Letra
    let letra: OperatorTurma = 'A';
    if (['A', 'B', 'C', 'D'].includes(letraRaw)) {
      letra = letraRaw as OperatorTurma;
    }

    // Normaliza Turno
    let turno: ProductionTurno = 1;
    const turnoNum = Number(turnoRaw);
    if (turnoNum === 1 || turnoNum === 2 || turnoNum === 3) {
      turno = turnoNum as ProductionTurno;
    }

    if (!nome) {
      errors.push(`Linha ${i + 1} sem nome válido: "${line}"`);
      continue;
    }

    operators.push({
      matricula: matricula || `OP-${String(fallbackIdCounter++).padStart(3, '0')}`,
      nome: nome,
      cargo: cargo || 'Operador de Produção',
      letra: letra,
      turno: turno,
      saldoFolgasFlexiveis: 0,
      status: 'ativo',
    });
  }

  return { operators, errors };
}

/**
 * Salva múltiplos operadores no Firestore em lote (Batch)
 */
export async function importOperatorsBatch(
  operatorsList: CreateOperatorInput[]
): Promise<{ importedCount: number; errors: string[] }> {
  if (operatorsList.length === 0) {
    return { importedCount: 0, errors: ['Nenhum operador para importar.'] };
  }

  const userInfo = await getCurrentUserInfo();
  const now = Timestamp.now();
  const collRef = collection(db, OPERATORS_COLLECTION);

  // Firestore aceita até 500 operações por batch
  const CHUNK_SIZE = 400;
  let importedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < operatorsList.length; i += CHUNK_SIZE) {
    const chunk = operatorsList.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((input) => {
      const docRef = doc(collRef);
      const data: any = {
        nome: input.nome.trim(),
        matricula: input.matricula.trim(),
        cargo: input.cargo.trim(),
        letra: input.letra,
        turno: Number(input.turno),
        saldoFolgasFlexiveis: Number(input.saldoFolgasFlexiveis) || 0,
        status: input.status || 'ativo',
        dataAdmissao: input.dataAdmissao || '',
        telefone: input.telefone || '',
        observacoes: input.observacoes || '',
        created_at: now,
        updated_at: now,
      };

      if (userInfo) {
        data.created_by = userInfo.uid;
        data.created_by_name = userInfo.name;
        data.updated_by = userInfo.uid;
        data.updated_by_name = userInfo.name;
      }

      batch.set(docRef, data);
      importedCount++;
    });

    try {
      await batch.commit();
      console.log(`✅ Lote de ${chunk.length} operadores importado com sucesso no Firestore.`);
    } catch (err: any) {
      console.error('❌ Erro ao comitar batch de operadores:', err);
      errors.push(`Erro ao salvar lote: ${err.message || err}`);
    }
  }

  return { importedCount, errors };
}

/* ==========================================================================
   CRUD DE OCORRÊNCIAS (FALTAS, ATESTADOS, FOLGAS FLEXÍVEIS, FÉRIAS)
   ========================================================================== */

export type CreateLaborOccurrenceInput = {
  operadorId: string;
  operadorNome: string;
  operadorCargo: string;
  operadorLetra: OperatorTurma;
  turno: ProductionTurno;
  tipo: LaborOccurrenceType;
  dataInicio: string;
  dataFim?: string;
  dias: number;
  horasImpacto?: number;
  minutosAtraso?: number;
  motivo?: string;
  queixas?: string; // Queixas/sintomas do operador
  cid?: string;
  tipoFolgaFlexivel?: 'concessao' | 'debito';
};

export const createLaborOccurrence = async (input: CreateLaborOccurrenceInput): Promise<string> => {
  const collRef = collection(db, LABOR_OCCURRENCES_COLLECTION);
  const now = Timestamp.now();
  const userInfo = await getCurrentUserInfo();

  const dataFim = input.dataFim || input.dataInicio;
  const dias = Math.max(1, Number(input.dias) || 1);
  const horasImpacto = input.horasImpacto !== undefined ? Number(input.horasImpacto) : dias * 8;

  // Impacto em absenteísmo: Faltas, Atestados e Atrasos contam no absenteísmo
  const impactaAbsenteismo =
    input.tipo === 'falta_injustificada' ||
    input.tipo === 'falta_justificada' ||
    input.tipo === 'atestado' ||
    input.tipo === 'atraso';

  const data: any = {
    operadorId: input.operadorId,
    operadorNome: input.operadorNome,
    operadorCargo: input.operadorCargo,
    operadorLetra: input.operadorLetra,
    turno: Number(input.turno),
    tipo: input.tipo,
    dataInicio: input.dataInicio,
    dataFim: dataFim,
    dias: dias,
    horasImpacto: horasImpacto,
    minutosAtraso: input.minutosAtraso || 0,
    motivo: input.motivo || '',
    queixas: input.queixas || '',
    cid: input.cid || '',
    impactaAbsenteismo: impactaAbsenteismo,
    created_at: now,
    updated_at: now,
  };

  if (input.tipo === 'folga_flexivel' && input.tipoFolgaFlexivel) {
    data.tipoFolgaFlexivel = input.tipoFolgaFlexivel;
  }

  if (userInfo) {
    data.created_by = userInfo.uid;
    data.created_by_name = userInfo.name;
    data.updated_by = userInfo.uid;
    data.updated_by_name = userInfo.name;
  }

  const docRef = await addDoc(collRef, data);
  console.log(`✅ Ocorrência criada para ${input.operadorNome}: ${input.tipo} (ID: ${docRef.id})`);

  // Se for movimentação de folga flexível, ajusta automaticamente o saldo do operador
  if (input.tipo === 'folga_flexivel') {
    if (input.tipoFolgaFlexivel === 'concessao') {
      // Concessão de folga flexível: soma créditos ao saldo
      await updateOperatorSaldoFolgas(input.operadorId, dias, `Concessão de folga flexível (+${dias}d)`);
    } else if (input.tipoFolgaFlexivel === 'debito') {
      // Débito de folga flexível (gozo de folga): desconta do saldo
      await updateOperatorSaldoFolgas(input.operadorId, -dias, `Gozo de folga flexível (-${dias}d)`);
    }
  }

  return docRef.id;
};

export const updateLaborOccurrence = async (
  occurrenceId: string,
  input: Partial<CreateLaborOccurrenceInput>,
  previousOccurrence?: LaborOccurrence
): Promise<void> => {
  const occRef = doc(db, LABOR_OCCURRENCES_COLLECTION, occurrenceId);
  const now = Timestamp.now();
  const userInfo = await getCurrentUserInfo();

  const sanitizedInput = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );

  const updateData: any = {
    ...sanitizedInput,
    updated_at: now,
  };

  if (input.tipo !== undefined) {
    updateData.impactaAbsenteismo =
      input.tipo === 'falta_injustificada' ||
      input.tipo === 'falta_justificada' ||
      input.tipo === 'atestado' ||
      input.tipo === 'atraso';
  }

  if (userInfo) {
    updateData.updated_by = userInfo.uid;
    updateData.updated_by_name = userInfo.name;
  }

  await updateDoc(occRef, updateData);
  console.log(`✅ Ocorrência atualizada: ${occurrenceId}`);

  // Reconciliação do saldo de folgas flexíveis caso tenha sido editada
  if (previousOccurrence) {
    const prevTipo = previousOccurrence.tipo;
    const prevDias = previousOccurrence.dias || 1;
    const prevTipoFolga = previousOccurrence.tipoFolgaFlexivel;

    const newTipo = input.tipo || prevTipo;
    const newDias = input.dias !== undefined ? input.dias : prevDias;
    const newTipoFolga = input.tipoFolgaFlexivel || prevTipoFolga;
    const operadorId = input.operadorId || previousOccurrence.operadorId;

    // Se a anterior era folga flexível, calcula a reversão
    let deltaReversao = 0;
    if (prevTipo === 'folga_flexivel') {
      if (prevTipoFolga === 'concessao') deltaReversao -= prevDias;
      else if (prevTipoFolga === 'debito') deltaReversao += prevDias;
    }

    // Se a nova é folga flexível, calcula a nova aplicação
    let deltaNovo = 0;
    if (newTipo === 'folga_flexivel') {
      if (newTipoFolga === 'concessao') deltaNovo += newDias;
      else if (newTipoFolga === 'debito') deltaNovo -= newDias;
    }

    const netDelta = deltaReversao + deltaNovo;
    if (netDelta !== 0) {
      await updateOperatorSaldoFolgas(
        operadorId,
        netDelta,
        `Ajuste por edição de ocorrência (${netDelta > 0 ? `+${netDelta}` : netDelta}d)`
      );
    }
  }
};

export const deleteLaborOccurrence = async (occurrence: LaborOccurrence): Promise<void> => {
  const occRef = doc(db, LABOR_OCCURRENCES_COLLECTION, occurrence.id);
  await deleteDoc(occRef);

  // Se for exclusão de folga flexível, reverte a movimentação de saldo
  if (occurrence.tipo === 'folga_flexivel') {
    if (occurrence.tipoFolgaFlexivel === 'concessao') {
      await updateOperatorSaldoFolgas(occurrence.operadorId, -occurrence.dias, 'Reversão de concessão de folga');
    } else if (occurrence.tipoFolgaFlexivel === 'debito') {
      await updateOperatorSaldoFolgas(occurrence.operadorId, occurrence.dias, 'Reversão de gozo de folga');
    }
  }

  console.log(`✅ Ocorrência excluída: ${occurrence.id}`);
};

/**
 * Atualiza as observações/tratativas da supervisão em uma ocorrência.
 * Apenas atualiza o campo obsSupervisao sem afetar os demais campos.
 */
export const updateOccurrenceSupervisaoObs = async (
  occurrenceId: string,
  obsSupervisao: string
): Promise<void> => {
  const occRef = doc(db, LABOR_OCCURRENCES_COLLECTION, occurrenceId);
  const now = Timestamp.now();
  const userInfo = await getCurrentUserInfo();

  const updateData: any = {
    obsSupervisao: obsSupervisao.trim(),
    obsSupervisaoUpdatedAt: now,
  };

  if (userInfo) {
    updateData.obsSupervisaoUpdatedBy = userInfo.name;
  }

  await updateDoc(occRef, updateData);
  console.log(`✅ Obs. da supervisão atualizada na ocorrência: ${occurrenceId}`);
};


export const subscribeToLaborOccurrences = (
  callback: (occurrences: LaborOccurrence[]) => void,
  errorCallback?: (error: Error) => void
) => {
  const collRef = collection(db, LABOR_OCCURRENCES_COLLECTION);
  const q = query(collRef, orderBy('dataInicio', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const occs = snapshot.docs.map((docSnap) => mapDocToOccurrence(docSnap.id, docSnap.data()));
      callback(occs);
    },
    (error) => {
      console.error('❌ Erro na subscrição de ocorrências de mão de obra:', error);
      errorCallback?.(error);
    }
  );
};

/* ==========================================================================
   DETECÇÃO INTELIGENTE DE CONFLITOS DE FÉRIAS
   ========================================================================== */

/**
 * Analisa a lista de operadores e ocorrências de férias e detecta:
 * 1. Conflito de Mesmo Cargo no Mesmo Turno (ex: 2 Pesadores de férias no mesmo dia)
 * 2. Conflito por Mesma Letra/Turma no Mesmo Turno (> 1 operador da mesma letra de férias simultâneas)
 * 3. Conflito de Capacidade (> 25% da equipe do turno de férias no mesmo período)
 */
export function detectVacationConflicts(
  operators: Operator[],
  occurrences: LaborOccurrence[]
): VacationConflict[] {
  const conflicts: VacationConflict[] = [];
  const vacations = occurrences.filter((o) => o.tipo === 'ferias');

  if (vacations.length < 2) return [];

  // Mapeia operadores ativos
  const opMap = new Map<string, Operator>();
  operators.forEach((op) => opMap.set(op.id, op));

  // Função auxiliar para verificar sobreposição entre 2 intervalos [startA, endA] e [startB, endB]
  const isOverlapping = (startA: string, endA: string, startB: string, endB: string) => {
    return startA <= endB && startB <= endA;
  };

  // Calcula a intersecção de datas entre 2 períodos
  const getOverlapRange = (startA: string, endA: string, startB: string, endB: string) => {
    const start = startA > startB ? startA : startB;
    const end = endA < endB ? endA : endB;
    return { start, end };
  };

  const processedPairs = new Set<string>();

  // 1. Conflito por Cargo e Turno
  for (let i = 0; i < vacations.length; i++) {
    for (let j = i + 1; j < vacations.length; j++) {
      const vacA = vacations[i];
      const vacB = vacations[j];

      // Mesmo operador não gera conflito com si próprio
      if (vacA.operadorId === vacB.operadorId) continue;

      // Mesmo turno
      if (vacA.turno === vacB.turno) {
        if (isOverlapping(vacA.dataInicio, vacA.dataFim, vacB.dataInicio, vacB.dataFim)) {
          const pairKey = [vacA.operadorId, vacB.operadorId].sort().join('-') + `-${vacA.dataInicio}-${vacB.dataInicio}`;
          if (processedPairs.has(pairKey)) continue;
          processedPairs.add(pairKey);

          const { start, end } = getOverlapRange(vacA.dataInicio, vacA.dataFim, vacB.dataInicio, vacB.dataFim);

          const opA = opMap.get(vacA.operadorId);
          const opB = opMap.get(vacB.operadorId);

          const cargoA = (opA?.cargo || vacA.operadorCargo).toLowerCase();
          const cargoB = (opB?.cargo || vacB.operadorCargo).toLowerCase();

          // Conflito de mesmo cargo crítico
          if (cargoA === cargoB) {
            conflicts.push({
              id: `conflict-cargo-${pairKey}`,
              tipo: 'cargo',
              severidade: 'alta',
              titulo: `Conflito de Cargo: ${vacA.operadorCargo}`,
              descricao: `Os operadores ${vacA.operadorNome} e ${vacB.operadorNome} possuem o mesmo cargo (${vacA.operadorCargo}) no Turno ${vacA.turno} e estão com férias sobrepostas entre ${start} e ${end}.`,
              dataInicio: start,
              dataFim: end,
              turno: vacA.turno,
              operadores: [
                { id: vacA.operadorId, nome: vacA.operadorNome, cargo: vacA.operadorCargo, letra: vacA.operadorLetra },
                { id: vacB.operadorId, nome: vacB.operadorNome, cargo: vacB.operadorCargo, letra: vacB.operadorLetra },
              ],
            });
          } else if (vacA.operadorLetra === vacB.operadorLetra) {
            // Conflito de mesma letra no mesmo turno
            conflicts.push({
              id: `conflict-letra-${pairKey}`,
              tipo: 'letra',
              severidade: 'media',
              titulo: `Conflito de Turma/Letra: Letra ${vacA.operadorLetra}`,
              descricao: `Dois operadores da Turma ${vacA.operadorLetra} (${vacA.operadorNome} e ${vacB.operadorNome}) do Turno ${vacA.turno} estão de férias simultâneas no período de ${start} a ${end}.`,
              dataInicio: start,
              dataFim: end,
              turno: vacA.turno,
              operadores: [
                { id: vacA.operadorId, nome: vacA.operadorNome, cargo: vacA.operadorCargo, letra: vacA.operadorLetra },
                { id: vacB.operadorId, nome: vacB.operadorNome, cargo: vacB.operadorCargo, letra: vacB.operadorLetra },
              ],
            });
          }
        }
      }
    }
  }

  return conflicts;
}

/* ==========================================================================
   CÁLCULO DE ABSENTEÍSMO & INDICADORES (KPIs)
   ========================================================================== */

/**
 * Calcula o índice e estatísticas de absenteísmo para um mês/ano específico
 */
export function calculateAbsenteeismStats(
  operators: Operator[],
  occurrences: LaborOccurrence[],
  year: number,
  month: number, // 1-12
  turnoFilter?: ProductionTurno
): AbsenteeismStats {
  const filteredOperators = operators.filter((op) => {
    if (op.status === 'inativo') return false;
    if (turnoFilter && op.turno !== turnoFilter) return false;
    return true;
  });

  const totalOperadores = filteredOperators.length;
  if (totalOperadores === 0) {
    return {
      totalOperadores: 0,
      diasHomemProgramados: 0,
      horasHomemProgramadas: 0,
      diasPerdidosFaltasInjustificadas: 0,
      diasPerdidosFaltasJustificadas: 0,
      diasPerdidosAtestados: 0,
      totalDiasPerdidos: 0,
      totalHorasPerdidas: 0,
      taxaAbsenteismo: 0,
      taxaAtestados: 0,
      taxaFaltas: 0,
      taxaFolgasFlexiveis: 0,
      diasFolgasFlexiveis: 0,
      diasFerias: 0,
    };
  }

  // Dias do mês na escala de 2026
  const monthDays = getEscalaForMonth(year, month);

  // Calcula os dias de trabalho programados para cada operador segundo sua Letra (quem não folga, trabalha)
  let totalDiasHomemProgramados = 0;

  filteredOperators.forEach((op) => {
    const diasTrabalhoOperador = monthDays.filter((d) => d.turma_escalada !== op.letra).length;
    totalDiasHomemProgramados += (diasTrabalhoOperador || 22); // fallback padrão de ~21-22 dias de trabalho no mês
  });

  const horasHomemProgramadas = totalDiasHomemProgramados * 8;

  // Mapeia operadores ativados para lookup rápido de letra
  const opMap = new Map<string, Operator>();
  filteredOperators.forEach((op) => opMap.set(op.id, op));

  let diasFaltasInjustificadas = 0;
  let diasFaltasJustificadas = 0;
  let diasAtestados = 0;
  let diasFolgasFlexiveis = 0;
  let diasFerias = 0;

  // Itera por cada ocorrência e conta dia por dia (apenas nos dias de trabalho do operador no mês)
  occurrences.forEach((occ) => {
    const op = opMap.get(occ.operadorId);
    if (!op) return;
    if (turnoFilter && occ.turno !== turnoFilter) return;

    const start = new Date(occ.dataInicio + 'T12:00:00Z');
    const end = new Date((occ.dataFim || occ.dataInicio) + 'T12:00:00Z');
    const cur = new Date(start);

    while (cur <= end) {
      const curYear = cur.getUTCFullYear();
      const curMonth = cur.getUTCMonth() + 1;

      // Conta somente se a data pertencer ao mês/ano analisado
      if (curYear === year && curMonth === month) {
        const dateStr = cur.toISOString().split('T')[0];
        // Respeita a escala: se o operador estiver em folga de escala neste dia específico, não conta como ausência de trabalho
        if (isEscaladoParaTrabalhar(op.letra, dateStr)) {
          switch (occ.tipo) {
            case 'falta_injustificada':
              diasFaltasInjustificadas++;
              break;
            case 'falta_justificada':
              diasFaltasJustificadas++;
              break;
            case 'atestado':
              diasAtestados++;
              break;
            case 'folga_flexivel':
              if (occ.tipoFolgaFlexivel === 'debito') {
                diasFolgasFlexiveis++;
              }
              break;
            case 'ferias':
              diasFerias++;
              break;
          }
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
  });

  const totalDiasPerdidos = diasFaltasInjustificadas + diasFaltasJustificadas + diasAtestados;
  const totalHorasPerdidas = totalDiasPerdidos * 8;

  // Taxa de absenteísmo = (Dias Perdidos Faltas + Atestados) / Dias Homem Programados * 100
  const taxaAbsenteismo = totalDiasHomemProgramados > 0
    ? Number(((totalDiasPerdidos / totalDiasHomemProgramados) * 100).toFixed(2))
    : 0;

  const taxaAtestados = totalDiasHomemProgramados > 0
    ? Number(((diasAtestados / totalDiasHomemProgramados) * 100).toFixed(2))
    : 0;

  const taxaFaltas = totalDiasHomemProgramados > 0
    ? Number((((diasFaltasInjustificadas + diasFaltasJustificadas) / totalDiasHomemProgramados) * 100).toFixed(2))
    : 0;

  const taxaFolgasFlexiveis = totalDiasHomemProgramados > 0
    ? Number(((diasFolgasFlexiveis / totalDiasHomemProgramados) * 100).toFixed(2))
    : 0;

  return {
    totalOperadores,
    diasHomemProgramados: totalDiasHomemProgramados,
    horasHomemProgramadas,
    diasPerdidosFaltasInjustificadas: diasFaltasInjustificadas,
    diasPerdidosFaltasJustificadas: diasFaltasJustificadas,
    diasPerdidosAtestados: diasAtestados,
    totalDiasPerdidos,
    totalHorasPerdidas,
    taxaAbsenteismo,
    taxaAtestados,
    taxaFaltas,
    taxaFolgasFlexiveis,
    diasFolgasFlexiveis,
    diasFerias,
  };
}

/**
 * Retorna série histórica de 12 meses do ano para gráficos
 */
export function getMonthlyAbsenteeismHistory(
  operators: Operator[],
  occurrences: LaborOccurrence[],
  year: number = 2026,
  turnoFilter?: ProductionTurno
) {
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];

  return months.map((mesNome, idx) => {
    const monthNumber = idx + 1;
    const stats = calculateAbsenteeismStats(operators, occurrences, year, monthNumber, turnoFilter);

    return {
      mes: mesNome,
      mesNum: monthNumber,
      taxaAbsenteismo: stats.taxaAbsenteismo,
      taxaAtestados: stats.taxaAtestados,
      taxaFaltas: stats.taxaFaltas,
      diasPerdidos: stats.totalDiasPerdidos,
      horasPerdidas: stats.totalHorasPerdidas,
      meta: 2.5, // Meta padrão de excelência de 2.5% de absenteísmo na indústria
    };
  });
}

/**
 * Retorna comparação entre Turno 1, Turno 2 e Turno 3
 */
export function getTurnoAbsenteeismComparison(
  operators: Operator[],
  occurrences: LaborOccurrence[],
  year: number,
  month: number
) {
  const turnos: ProductionTurno[] = [1, 2, 3];
  const turnoLabels: Record<ProductionTurno, string> = {
    1: 'Turno 1 (Manhã)',
    2: 'Turno 2 (Tarde)',
    3: 'Turno 3 (Noite)',
  };

  return turnos.map((t) => {
    const stats = calculateAbsenteeismStats(operators, occurrences, year, month, t);
    return {
      turno: t,
      nome: turnoLabels[t],
      totalOperadores: stats.totalOperadores,
      taxaAbsenteismo: stats.taxaAbsenteismo,
      taxaAtestados: stats.taxaAtestados,
      taxaFaltas: stats.taxaFaltas,
      diasPerdidos: stats.totalDiasPerdidos,
      saldoFolgasTotal: operators
        .filter((op) => op.turno === t && op.status === 'ativo')
        .reduce((sum, op) => sum + op.saldoFolgasFlexiveis, 0),
    };
  });
}

/* ==========================================================================
   STATUS DE PRESENÇA DIÁRIA
   ========================================================================== */

export type DailyOperatorStatus = {
  operator: Operator;
  escaladoNaEscala: boolean; // se a letra do operador é a turma escalada no dia
  statusHoje: 'presente' | 'folga_escala' | 'folga_flexivel' | 'atestado' | 'falta_injustificada' | 'falta_justificada' | 'ferias' | 'afastado' | 'inativo';
  statusLabel: string;
  ocorrenciaHoje?: LaborOccurrence | null;
  corStatus: string;
};

export function getDailyPresenceSummary(
  dateStr: string,
  operators: Operator[],
  occurrences: LaborOccurrence[]
): {
  total: number;
  escalados: number;
  presentes: number;
  ausentes: number;
  faltas: number;
  atestados: number;
  folgasFlexiveis: number;
  ferias: number;
  folgasEscala: number;
  operadoresStatus: DailyOperatorStatus[];
} {
  const escalaDia = getEscalaForDate(dateStr);
  const turmaDoDia = escalaDia ? escalaDia.turma_escalada : 'A';

  let escaladosCount = 0;
  let presentesCount = 0;
  let faltasCount = 0;
  let atestadosCount = 0;
  let folgasFlexiveisCount = 0;
  let feriasCount = 0;
  let folgasEscalaCount = 0;

  const operadoresStatus: DailyOperatorStatus[] = operators.map((op) => {
    if (op.status === 'inativo') {
      return {
        operator: op,
        escaladoNaEscala: false,
        statusHoje: 'inativo',
        statusLabel: 'Inativo',
        ocorrenciaHoje: null,
        corStatus: 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400',
      };
    }

    if (op.status === 'afastado') {
      return {
        operator: op,
        escaladoNaEscala: false,
        statusHoje: 'afastado',
        statusLabel: 'Afastado (INSS)',
        ocorrenciaHoje: null,
        corStatus: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300',
      };
    }

    const estaEmFolgaDeEscala = op.letra === turmaDoDia;
    const escalado = !estaEmFolgaDeEscala;

    // Busca se há alguma ocorrência ativa na data para este operador
    const occAtiva = occurrences.find(
      (occ) =>
        occ.operadorId === op.id &&
        dateStr >= occ.dataInicio &&
        dateStr <= (occ.dataFim || occ.dataInicio)
    );

    // Se o operador está em dia de folga de escala normal (letra do dia):
    // Férias se mantém como Férias. Porém faltas, atestados ou folgas flexíveis em dia que o operador JÁ ESTÁ DE FOLGA DE ESCALA não contam como ausência de trabalho.
    if (estaEmFolgaDeEscala && occAtiva?.tipo !== 'ferias') {
      folgasEscalaCount++;
      return {
        operator: op,
        escaladoNaEscala: false,
        statusHoje: 'folga_escala',
        statusLabel: `Folga de Escala (Letra ${op.letra})`,
        ocorrenciaHoje: occAtiva || null,
        corStatus: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400',
      };
    }

    if (escalado) {
      escaladosCount++;
    }

    if (occAtiva) {
      if (occAtiva.tipo === 'ferias') {
        feriasCount++;
        return {
          operator: op,
          escaladoNaEscala: escalado,
          statusHoje: 'ferias',
          statusLabel: 'Férias',
          ocorrenciaHoje: occAtiva,
          corStatus: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300',
        };
      }

      if (occAtiva.tipo === 'atestado') {
        atestadosCount++;
        return {
          operator: op,
          escaladoNaEscala: escalado,
          statusHoje: 'atestado',
          statusLabel: `Atestado${occAtiva.cid ? ` (${occAtiva.cid})` : ''}`,
          ocorrenciaHoje: occAtiva,
          corStatus: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300',
        };
      }

      if (occAtiva.tipo === 'falta_injustificada') {
        faltasCount++;
        return {
          operator: op,
          escaladoNaEscala: escalado,
          statusHoje: 'falta_injustificada',
          statusLabel: 'Falta Injustificada',
          ocorrenciaHoje: occAtiva,
          corStatus: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300',
        };
      }

      if (occAtiva.tipo === 'falta_justificada') {
        faltasCount++;
        return {
          operator: op,
          escaladoNaEscala: escalado,
          statusHoje: 'falta_justificada',
          statusLabel: 'Falta Justificada',
          ocorrenciaHoje: occAtiva,
          corStatus: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
        };
      }

      if (occAtiva.tipo === 'folga_flexivel' && occAtiva.tipoFolgaFlexivel === 'debito') {
        folgasFlexiveisCount++;
        return {
          operator: op,
          escaladoNaEscala: escalado,
          statusHoje: 'folga_flexivel',
          statusLabel: 'Folga Flexível',
          ocorrenciaHoje: occAtiva,
          corStatus: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300',
        };
      }
    }

    if (escalado) {
      presentesCount++;
      return {
        operator: op,
        escaladoNaEscala: true,
        statusHoje: 'presente',
        statusLabel: 'Presente (Escalado)',
        ocorrenciaHoje: null,
        corStatus: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
      };
    } else {
      folgasEscalaCount++;
      return {
        operator: op,
        escaladoNaEscala: false,
        statusHoje: 'folga_escala',
        statusLabel: `Folga de Escala (Letra ${op.letra})`,
        ocorrenciaHoje: null,
        corStatus: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400',
      };
    }
  });

  const total = operators.filter((o) => o.status === 'ativo').length;
  const ausentes = faltasCount + atestadosCount + folgasFlexiveisCount + feriasCount;

  return {
    total,
    escalados: escaladosCount,
    presentes: presentesCount,
    ausentes,
    faltas: faltasCount,
    atestados: atestadosCount,
    folgasFlexiveis: folgasFlexiveisCount,
    ferias: feriasCount,
    folgasEscala: folgasEscalaCount,
    operadoresStatus,
  };
}
