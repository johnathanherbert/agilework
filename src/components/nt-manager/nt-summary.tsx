"use client";

interface NTSummaryCounts {
  open: number;
  openItems: number;
  late: number;
  pend: number;
  doneToday: number;
  paidToday: number;
}

interface NTSummaryProps {
  counts: NTSummaryCounts;
}

export function NTSummary({ counts }: NTSummaryProps) {
  return (
    <section className="summary">
      {/* NTs abertas */}
      <div>
        <label>NTs abertas</label>
        <strong>{counts.open}</strong>
        <small>{counts.openItems} itens</small>
      </div>

      {/* Em atraso */}
      <div className={counts.late > 0 ? 'bad' : ''}>
        <label>
          <i className="dot" style={{ background: 'var(--red)' }} />
          Em atraso
        </label>
        <strong>{counts.late}</strong>
        <small>&gt; 2h abertas</small>
      </div>

      {/* Itens pendentes */}
      <div>
        <label>
          <i className="dot" style={{ background: 'var(--amber)' }} />
          Itens pendentes
        </label>
        <strong>{counts.pend}</strong>
        <small>aguardando pesagem</small>
      </div>

      {/* Concluídas hoje */}
      <div>
        <label>
          <i className="dot" style={{ background: 'var(--green)' }} />
          Concluídas hoje
        </label>
        <strong>{counts.doneToday}</strong>
        <small>{counts.paidToday} itens pagos</small>
      </div>
    </section>
  );
}
