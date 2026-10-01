import { ProductionItem, ProductionTurno } from '@/types';

export const SHIFT_SCHEDULES = [
  { n: 3 as ProductionTurno, l: '3º Turno', ini: [-1, 23, 50], fim: [0, 7, 20], label: '3º Turno', short: '3º' },
  { n: 1 as ProductionTurno, l: '1º Turno', ini: [0, 7, 20], fim: [0, 15, 50], label: '1º Turno', short: '1º' },
  { n: 2 as ProductionTurno, l: '2º Turno', ini: [0, 15, 50], fim: [0, 23, 50], label: '2º Turno', short: '2º' },
] as const;

export const RITMO_TOLERANCIA_PCT = 15; // Pontos % abaixo do tempo decorrido para alertar ritmo

export interface ShiftPhase {
  k: 'done' | 'now' | 'next';
  l: 'Encerrado' | 'Em andamento' | 'Próximo';
  el?: number; // fração 0 a 1 decorrida
  leftMinutes?: number;
  toMinutes?: number;
}

export interface ItemStatusInfo {
  k: 'ok' | 'and' | 'nao' | 'pend' | 'prog';
  l: string;
}

export interface ProductionInsight {
  id: string;
  color: string;
  weight: number;
  title: string;
  desc: string;
  targetId: string;
  tag?: string;
  turno: ProductionTurno;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h${pad(min)}`;
}

export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getShiftDefinition(turno: ProductionTurno) {
  return SHIFT_SCHEDULES.find((s) => s.n === turno) || SHIFT_SCHEDULES[0];
}

/**
 * Calcula a data/hora de início ou fim de um turno considerando o dia de referência (hoje)
 */
export function getShiftDate(shift: typeof SHIFT_SCHEDULES[number], which: 'ini' | 'fim', baseDate: Date = new Date()): Date {
  const [dayOffset, hour, min] = shift[which];
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + dayOffset, hour, min, 0, 0);
  return d;
}

/**
 * Determina em qual fase o turno se encontra no momento atual
 */
export function getShiftPhase(turno: ProductionTurno, now: Date = new Date()): ShiftPhase {
  const shift = getShiftDefinition(turno);
  const iniDate = getShiftDate(shift, 'ini', now);
  const fimDate = getShiftDate(shift, 'fim', now);

  const t = now.getTime();
  const a = iniDate.getTime();
  const b = fimDate.getTime();

  if (t >= b) {
    return { k: 'done', l: 'Encerrado' };
  }
  if (t >= a) {
    const total = b - a;
    const elapsed = t - a;
    const el = Math.min(Math.max(elapsed / total, 0), 1);
    const leftMinutes = Math.max(0, Math.round((b - t) / 60000));
    return { k: 'now', l: 'Em andamento', el, leftMinutes };
  }

  const toMinutes = Math.max(0, Math.round((a - t) / 60000));
  return { k: 'next', l: 'Próximo', toMinutes };
}

/**
 * Identifica o turno atualmente em andamento (se houver)
 */
export function getCurrentActiveShift(now: Date = new Date()): typeof SHIFT_SCHEDULES[number] | null {
  for (const s of SHIFT_SCHEDULES) {
    const ph = getShiftPhase(s.n, now);
    if (ph.k === 'now') return s;
  }
  return null;
}

/**
 * Determina o status visual de um item de produção
 */
export function getItemStatus(item: ProductionItem, now: Date = new Date()): ItemStatusInfo {
  const ph = getShiftPhase(item.turno, now);

  if (item.prog > 0 && item.real >= item.prog) {
    return { k: 'ok', l: 'Concluída' };
  }
  if (ph.k === 'done') {
    const faltou = Math.max(0, item.prog - item.real);
    return { k: 'nao', l: `Não concluída · faltou ${faltou}` };
  }
  if (item.real > 0) {
    return { k: 'and', l: 'Em andamento' };
  }
  return ph.k === 'now' ? { k: 'pend', l: 'Pendente' } : { k: 'prog', l: 'Programada' };
}

/**
 * Gera nota de continuidade / reprogramação entre turnos para um item
 */
export function getCarryNote(item: ProductionItem, allItems: ProductionItem[], now: Date = new Date()): { text: string; type: 'warn' | 'info' } | null {
  if (item.tipo !== 'ordem') return null;

  const orderIndex = SHIFT_SCHEDULES.findIndex((s) => s.n === item.turno);
  if (orderIndex < 0) return null;

  // Verifica se veio com saldo do turno anterior
  if (orderIndex > 0) {
    const prevShift = SHIFT_SCHEDULES[orderIndex - 1];
    const prevItem = allItems.find(
      (y) => y.id !== item.id && y.tipo === 'ordem' && y.produto === item.produto && y.turno === prevShift.n && y.real < y.prog
    );
    if (prevItem) {
      return {
        text: `Saldo do ${prevShift.l}: fechou ${prevItem.real}/${prevItem.prog}`,
        type: 'warn',
      };
    }
  }

  // Verifica se este item não foi concluído e foi reprogramado no próximo turno
  if (orderIndex < SHIFT_SCHEDULES.length - 1) {
    const nextShift = SHIFT_SCHEDULES[orderIndex + 1];
    const nextItem = allItems.find(
      (y) => y.id !== item.id && y.tipo === 'ordem' && y.produto === item.produto && y.turno === nextShift.n
    );
    const ph = getShiftPhase(item.turno, now);
    if (nextItem && item.real < item.prog && ph.k === 'done') {
      return {
        text: `Reprogramada no ${nextShift.l}`,
        type: 'info',
      };
    }
  }

  return null;
}

/**
 * Estatísticas compiladas de um turno
 */
export function getShiftStats(turno: ProductionTurno, items: ProductionItem[]) {
  const os = items.filter((x) => x.turno === turno && x.tipo === 'ordem');
  const ps = items.filter((x) => x.turno === turno && (x.tipo === 'auto' || x.tipo === 'direta'));
  const u = os.filter((x) => x.via === 'UMIDA');
  const s = os.filter((x) => x.via === 'SECA');
  const pa = ps.filter((x) => x.tipo === 'auto');
  const pd = ps.filter((x) => x.tipo === 'direta');

  const prog = os.reduce((acc, c) => acc + c.prog, 0);
  const real = os.reduce((acc, c) => acc + c.real, 0);
  const pct = prog > 0 ? Math.round((real / prog) * 100) : 0;

  const uReal = u.reduce((acc, c) => acc + c.real, 0);
  const uProg = u.reduce((acc, c) => acc + c.prog, 0);

  const sReal = s.reduce((acc, c) => acc + c.real, 0);
  const sProg = s.reduce((acc, c) => acc + c.prog, 0);

  const pdpaReal = ps.reduce((acc, c) => acc + c.real, 0);
  const pdpaProg = ps.reduce((acc, c) => acc + c.prog, 0);
  const pdpaPct = pdpaProg > 0 ? Math.round((pdpaReal / pdpaProg) * 100) : 0;

  return {
    os,
    ps,
    prog,
    real,
    pct,
    u: [uReal, uProg] as [number, number],
    s: [sReal, sProg] as [number, number],
    pa: [pa.reduce((a, c) => a + c.real, 0), pa.reduce((a, c) => a + c.prog, 0)] as [number, number],
    pd: [pd.reduce((a, c) => a + c.real, 0), pd.reduce((a, c) => a + c.prog, 0)] as [number, number],
    pdpaTotal: [pdpaReal, pdpaProg] as [number, number],
    pdpaPct,
    lots: os.length,
  };
}

/**
 * Gera os pontos de atenção e inteligência operacional
 */
export function getProductionInsights(items: ProductionItem[], now: Date = new Date()): ProductionInsight[] {
  const list: ProductionInsight[] = [];

  SHIFT_SCHEDULES.forEach((s) => {
    const ph = getShiftPhase(s.n, now);
    const st = getShiftStats(s.n, items);

    // 1. Ritmo do turno atual
    if (ph.k === 'now' && st.prog > 0) {
      const el = Math.round((ph.el || 0) * 100);
      if (st.pct < el - RITMO_TOLERANCIA_PCT) {
        const need = st.prog - st.real;
        list.push({
          id: `ritmo-${s.n}`,
          color: 'var(--red)',
          weight: 3,
          title: `${s.l} abaixo do ritmo`,
          desc: `${st.pct}% realizado com ${el}% do turno decorrido · faltam ${need} ordens em ${formatDuration(ph.leftMinutes || 0)}`,
          targetId: `sh-${s.n}`,
          tag: s.l,
          turno: s.n,
        });
      }
    }

    // 2. Sem programação
    if (!st.lots && ph.k !== 'done') {
      list.push({
        id: `sem-prog-${s.n}`,
        color: 'var(--text-3)',
        weight: 1,
        title: `${s.l} sem ordens programadas`,
        desc: ph.k === 'next' ? `Começa em ${formatDuration(ph.toMinutes || 0)}` : 'Turno em andamento sem ordens',
        targetId: `sh-${s.n}`,
        tag: s.l,
        turno: s.n,
      });
    }

    // 3. Não concluídas em turno encerrado
    if (ph.k === 'done') {
      st.os
        .filter((x) => x.real < x.prog)
        .forEach((x) => {
          const shiftIdx = SHIFT_SCHEDULES.findIndex((z) => z.n === x.turno);
          const later = items.find(
            (y) =>
              y.id !== x.id &&
              y.tipo === 'ordem' &&
              y.produto === x.produto &&
              SHIFT_SCHEDULES.findIndex((z) => z.n === y.turno) > shiftIdx
          );
          const laterShift = later ? getShiftDefinition(later.turno) : null;
          list.push({
            id: `nao-conc-${x.id}`,
            color: later ? 'var(--amber)' : 'var(--red)',
            weight: later ? 2 : 3,
            title: `${x.produto} — ${s.l} fechou ${x.real}/${x.prog}`,
            desc: later
              ? `Saldo reprogramado no ${laterShift?.l} (${later.real}/${later.prog})`
              : `Saldo de ${x.prog - x.real} sem reprogramação`,
            targetId: `item-${x.id}`,
            tag: x.familia || x.codigoReceita || s.l,
            turno: s.n,
          });
        });
    }

    // 4. Sem máquina / família definida
    st.os
      .filter((x) => !x.familia && x.real < x.prog)
      .forEach((x) => {
        list.push({
          id: `sem-maq-${x.id}`,
          color: 'var(--amber)',
          weight: 2,
          title: `${x.produto} sem máquina/família definida`,
          desc: `${s.l} · ${x.via === 'UMIDA' ? 'via úmida' : 'via seca'}${x.lp ? ' · lote piloto' : ''}`,
          targetId: `item-${x.id}`,
          tag: s.l,
          turno: s.n,
        });
      });

    // 5. PD/PA sem ordem correspondente no turno
    if (ph.k !== 'done') {
      st.ps.forEach((x) => {
        const hasOrder = st.os.some((y) => y.produto === x.produto);
        if (!hasOrder) {
          list.push({
            id: `pdpa-sem-ordem-${x.id}`,
            color: 'var(--amber)',
            weight: 1,
            title: `${x.produto} em PD/PA sem ordem no turno`,
            desc: `${s.l} · ${x.tipo === 'auto' ? 'automática' : 'direta'}`,
            targetId: `item-${x.id}`,
            tag: s.l,
            turno: s.n,
          });
        }
      });
    }
  });

  return list.sort((a, b) => b.weight - a.weight);
}

/**
 * Gera texto formatado para copiar e colar no WhatsApp
 */
export function generateWhatsAppSummary(items: ProductionItem[], now: Date = new Date()): string {
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const diaSemana = DIAS[now.getDay()];
  const dataFmt = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}`;
  const horaFmt = formatTime(now);

  const ordens = items.filter((x) => x.tipo === 'ordem');
  const pdpa = items.filter((x) => x.tipo === 'auto' || x.tipo === 'direta');

  const totalReal = ordens.reduce((a, c) => a + c.real, 0);
  const totalProg = ordens.reduce((a, c) => a + c.prog, 0);
  const totalPct = totalProg > 0 ? Math.round((totalReal / totalProg) * 100) : 0;

  const pdpaReal = pdpa.reduce((a, c) => a + c.real, 0);
  const pdpaProg = pdpa.reduce((a, c) => a + c.prog, 0);
  const pdpaPct = pdpaProg > 0 ? Math.round((pdpaReal / pdpaProg) * 100) : 0;

  const uReal = ordens.filter((x) => x.via === 'UMIDA').reduce((a, c) => a + c.real, 0);
  const uProg = ordens.filter((x) => x.via === 'UMIDA').reduce((a, c) => a + c.prog, 0);
  const sReal = ordens.filter((x) => x.via === 'SECA').reduce((a, c) => a + c.real, 0);
  const sProg = ordens.filter((x) => x.via === 'SECA').reduce((a, c) => a + c.prog, 0);

  const L: string[] = [];
  L.push(`*Painel de Produção · Pesagem*`);
  L.push(`${diaSemana}, ${dataFmt} · atualizado às ${horaFmt}`);
  L.push('');
  L.push(`*Ordens entregues no dia:* ${totalReal}/${totalProg} (${totalPct}%)`);
  L.push(`*PD/PA entregues no dia:* ${pdpaReal}/${pdpaProg} (${pdpaPct}%)`);
  L.push(`Úmida ${uReal}/${uProg} · Seca ${sReal}/${sProg}`);

  SHIFT_SCHEDULES.forEach((s) => {
    const st = getShiftStats(s.n, items);
    const ph = getShiftPhase(s.n, now);
    L.push('');
    L.push(`*${s.l}* · ${ph.l.toLowerCase()}`);
    if (!st.lots && !st.ps.length) {
      L.push('Sem ordens programadas');
      return;
    }
    L.push(`Ordens ${st.real}/${st.prog} (${st.pct}%) · PD/PA ${st.pdpaTotal[0]}/${st.pdpaTotal[1]} (${st.pdpaPct}%)`);
    L.push(`Úmida ${st.u[0]}/${st.u[1]} · Seca ${st.s[0]}/${st.s[1]}`);

    if (ph.k === 'now' && st.prog > 0) {
      const el = Math.round((ph.el || 0) * 100);
      if (st.pct < el - RITMO_TOLERANCIA_PCT) {
        L.push(`⚠️ Abaixo do ritmo: ${st.pct}% feito com ${el}% do turno decorrido`);
      }
    }

    st.os
      .filter((x) => getItemStatus(x, now).k === 'nao')
      .forEach((x) => {
        const shiftIdx = SHIFT_SCHEDULES.findIndex((z) => z.n === x.turno);
        const nx = items.find(
          (y) =>
            y.id !== x.id &&
            y.tipo === 'ordem' &&
            y.produto === x.produto &&
            SHIFT_SCHEDULES.findIndex((z) => z.n === y.turno) > shiftIdx
        );
        const nextShift = nx ? getShiftDefinition(nx.turno) : null;
        L.push(`⚠️ ${x.produto} fechou ${x.real}/${x.prog}${nx ? ` → reprogramada no ${nextShift?.l}` : ' → sem reprogramação'}`);
      });

    st.os
      .filter((x) => !x.familia && x.real < x.prog)
      .forEach((x) => {
        L.push(`⚠️ ${x.produto} sem máquina/família definida`);
      });
  });

  return L.join('\n');
}
