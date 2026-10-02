'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  AgingData,
  RemessaData,
  ConfiguracaoResiduais,
  AgingTableRow,
  NivelResidual,
  LoteInvestigacao,
} from '@/types/aging';
import { copyToClipboard, cn } from '@/lib/utils';
import { isMaterialEspecial } from '@/lib/materiais-especiais';
import {
  triggerSapAutomation,
  checkSapAutomationStatus,
  addLoteInvestigacao,
  removeLoteInvestigacao,
} from '@/lib/dashpesagem-api';
import {
  Search,
  Filter,
  Columns,
  Lock,
  Unlock,
  Copy,
  ArrowRightLeft,
  AlertTriangle,
  X,
  Package,
  Loader2,
  Play,
  RefreshCw,
  Undo2,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  GripVertical,
  Layers,
  ChevronUp,
  ArrowDown,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';

// -------------------------------------------------------------
// VBScript Generators & SAP Automation Helpers
// -------------------------------------------------------------

export interface DevolverVolumeItem {
  id: string;
  quantidade: string;
  volume: string;
}

export function generateDevolverZwm296Vbs(
  material: string,
  lote: string,
  volumes: Array<{ quantidade: string; volume?: string }>
): string {
  if (volumes.length === 0) return '';

  const mat = material.trim();
  const lot = lote.trim();

  const vbsHeader = `If Not IsObject(application) Then
   Set SapGuiAuto  = GetObject("SAPGUI")
   Set application = SapGuiAuto.GetScriptingEngine
End If
If Not IsObject(connection) Then
   Set connection = application.Children(0)
End If
If Not IsObject(session) Then
   Set session    = connection.Children(0)
End If
If IsObject(WScript) Then
   WScript.ConnectObject session,     "on"
   WScript.ConnectObject application, "on"
End If
session.findById("wnd[0]").maximize
session.findById("wnd[0]/tbar[0]/okcd").text = "/nzwm296"
session.findById("wnd[0]").sendVKey 0
session.findById("wnd[0]/usr/btnCTR_CREATE").press
session.findById("wnd[0]/usr/ctxtLTAK-BWLVS").text = "996"
session.findById("wnd[0]/usr/ctxtT001L-LGORT").text = "pes"
session.findById("wnd[0]/usr/ctxtT001W-WERKS").text = "600"
session.findById("wnd[0]/usr/ctxtT301-LGTYP").text = "pes"
session.findById("wnd[0]/usr/ctxtLTBK-VLPLA").text = "pesagem"
session.findById("wnd[0]/usr/txtW_DEP_DEPOSITO").text = "alm"
session.findById("wnd[0]/usr/txtLTAP-LETYP").text = "e1"
`;

  const matnrLines = volumes
    .map((_, idx) => `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-MATNR[0,${idx}]").text = "${mat}"`)
    .join('\n');

  const chargLines = volumes
    .map((_, idx) => `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/ctxtT_ZWMTB296I-CHARG[1,${idx}]").text = "${lot}"`)
    .join('\n');

  const mengeLines = volumes
    .map((v, idx) => {
      const qtdStr = (v.quantidade || '').trim().replace('.', ',');
      return `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-MENGE[2,${idx}]").text = "${qtdStr}"`;
    })
    .join('\n');

  const mengeVolLines = volumes
    .map((v, idx) => {
      const volStr = (v.volume || '1').trim();
      return `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-MENGE_VOL[4,${idx}]").text = "${volStr}"`;
    })
    .join('\n');

  const palletLines = volumes
    .map((_, idx) => `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-PALLET[5,${idx}]").text = "1"`)
    .join('\n');

  const lastIdx = volumes.length - 1;
  const vbsFooter = `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-PALLET[5,${lastIdx}]").setFocus
session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-PALLET[5,${lastIdx}]").caretPosition = 1
session.findById("wnd[0]/tbar[1]/btn[13]").press
session.findById("wnd[0]/tbar[0]/okcd").text = "/n"
session.findById("wnd[0]").sendVKey 0
`;

  return [
    vbsHeader,
    matnrLines,
    chargLines,
    mengeLines,
    mengeVolLines,
    palletLines,
    vbsFooter,
  ].filter(Boolean).join('\n');
}

export interface BloquearItemParam {
  material: string;
  lote: string;
  quantidade: string;
  unidade: string;
  depositoOrigem?: string;
  descricao?: string;
}

export interface MoverItemParam {
  material: string;
  lote: string;
  quantidade: string;
  unidade: string;
  depositoOrigem: string;
  descricao?: string;
}

export interface MoverRoute {
  id: string;
  tipo: string;
  posicao: string;
  label: string;
  description: string;
}

export const PREDEFINED_MOVER_ROUTES: MoverRoute[] = [
  { id: 'pes_pesagem', tipo: 'pes', posicao: 'pesagem', label: 'PES PESAGEM', description: 'Depósito PES / Posição PESAGEM' },
  { id: '999_ajuste', tipo: '999', posicao: 'ajuste', label: '999 AJUSTE', description: 'Depósito 999 / Posição AJUSTE' },
  { id: '999_aju_saida', tipo: '999', posicao: 'aju-saida', label: '999 AJU-SAIDA', description: 'Depósito 999 / Posição AJU-SAIDA' },
  { id: '922_tr_zone', tipo: '922', posicao: 'tr-zone', label: '922 TR-ZONE', description: 'Área 922 / Posição TR-ZONE' },
];

export function generateMoverLt10Vbs(
  items: MoverItemParam[],
  route: { tipo: string; posicao: string }
): string {
  if (items.length === 0) return '';

  const vbsHeader = `If Not IsObject(application) Then
   Set SapGuiAuto  = GetObject("SAPGUI")
   Set application = SapGuiAuto.GetScriptingEngine
End If
If Not IsObject(connection) Then
   Set connection = application.Children(0)
End If
If Not IsObject(session) Then
   Set session    = connection.Children(0)
End If
If IsObject(WScript) Then
   WScript.ConnectObject session,     "on"
   WScript.ConnectObject application, "on"
End If
session.findById("wnd[0]").maximize`;

  const destLgtyp = (route.tipo || 'pes').trim().toLowerCase();
  const destLgpla = (route.posicao || 'pesagem').trim().toLowerCase();

  const itemBlocks = items.map((item, idx) => {
    const lote = item.lote.trim();
    const depOrigem = (item.depositoOrigem || 'pes').trim().toLowerCase();
    const qtd = item.quantidade.trim().replace('.', ',');

    return `' --- Item ${idx + 1}: Lote ${lote} | Qtd ${qtd} | Origem: ${depOrigem.toUpperCase()} -> Destino: ${destLgtyp.toUpperCase()}/${destLgpla.toUpperCase()} ---
session.findById("wnd[0]/tbar[0]/okcd").text = "/nlt10"
session.findById("wnd[0]").sendVKey 0
session.findById("wnd[0]/usr/ctxtS1_LGNUM").text = "wnm"
session.findById("wnd[0]/usr/ctxtS1_LGTYP-LOW").text = "***"
session.findById("wnd[0]/usr/ctxtS1_LGTYP-LOW").setFocus
session.findById("wnd[0]/usr/ctxtS1_LGTYP-LOW").caretPosition = 3
session.findById("wnd[0]/tbar[1]/btn[16]").press
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").expandNode "         48"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").selectNode "         53"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").topNode = "         48"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").doubleClickNode "         53"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/ssubSUBSCREEN_CONTAINER:SAPLSSEL:1106/txt%%DYN001-LOW").text = "${lote}"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/ssubSUBSCREEN_CONTAINER:SAPLSSEL:1106/txt%%DYN001-LOW").setFocus
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/ssubSUBSCREEN_CONTAINER:SAPLSSEL:1106/txt%%DYN001-LOW").caretPosition = 7
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").unselectNode "         53"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").selectNode "         97"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").topNode = "         97"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").doubleClickNode "         97"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/ssubSUBSCREEN_CONTAINER:SAPLSSEL:1106/ctxt%%DYN002-LOW").text = "${depOrigem}"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/ssubSUBSCREEN_CONTAINER:SAPLSSEL:1106/ctxt%%DYN002-LOW").setFocus
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/ssubSUBSCREEN_CONTAINER:SAPLSSEL:1106/ctxt%%DYN002-LOW").caretPosition = 3
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").unselectNode "         97"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").selectNode "         82"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").topNode = "         82"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/cntlSUB_CONTAINER/shellcont/shellcont/shell/shellcont[1]/shell").doubleClickNode "         82"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/ssubSUBSCREEN_CONTAINER:SAPLSSEL:1106/txt%%DYN002-LOW").text = "${qtd}"
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/ssubSUBSCREEN_CONTAINER:SAPLSSEL:1106/txt%%DYN002-LOW").setFocus
session.findById("wnd[0]/usr/ssub%_SUBSCREEN_%_SUB%_CONTAINER:SAPLSSEL:2001/ssubSUBSCREEN_CONTAINER2:SAPLSSEL:2000/ssubSUBSCREEN_CONTAINER:SAPLSSEL:1106/txt%%DYN002-LOW").caretPosition = 5
session.findById("wnd[0]/tbar[1]/btn[8]").press
session.findById("wnd[0]/usr/lbl[2,6]").setFocus
session.findById("wnd[0]/usr/lbl[2,6]").caretPosition = 2
session.findById("wnd[0]").sendVKey 2
session.findById("wnd[0]/tbar[1]/btn[48]").press
session.findById("wnd[1]/usr/chkRL03T-SQUIT").selected = true
session.findById("wnd[1]/usr/ctxtLAGP-LGTYP").text = "${destLgtyp}"
session.findById("wnd[1]/usr/ctxtLAGP-LGPLA").text = "${destLgpla}"
session.findById("wnd[1]/usr/chkRL03T-SQUIT").setFocus
session.findById("wnd[1]/tbar[0]/btn[0]").press
session.findById("wnd[0]/tbar[0]/okcd").text = "/n"
session.findById("wnd[0]").sendVKey 0`;
  });

  return [vbsHeader, ...itemBlocks].join('\n');
}

export type MacroActionType = 'bloquear_migo' | 'desbloquear_migo' | 'mover_lt10' | 'mover_ajuste' | 'atualizar_db' | 'devolver';

export interface MacroActionItem {
  id: string;
  actionType: MacroActionType;
  routeId?: string;
  customTipo?: string;
  customPosicao?: string;
}

export const AVAILABLE_MACROS: Array<{
  type: MacroActionType;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    type: 'bloquear_migo',
    label: 'Bloquear no SAP (MIGO Y84)',
    shortLabel: 'Bloquear MIGO',
    description: 'Executa /nmigo (Y84) com scroll e confirmação de OT (/nlt06)',
  },
  {
    type: 'desbloquear_migo',
    label: 'Desbloquear no SAP (MIGO Y83)',
    shortLabel: 'Desbloquear MIGO',
    description: 'Executa /nmigo (Y83) para liberar saldo bloqueado (sem motivo 9000)',
  },
  {
    type: 'mover_lt10',
    label: 'Mover no SAP (/nlt10)',
    shortLabel: 'Mover (/nlt10)',
    description: 'Transfere itens por lote/qtd via /nlt10 para rota pré-definida',
  },
  {
    type: 'mover_ajuste',
    label: 'Mover/Ajuste em Massa (movermigo)',
    shortLabel: 'Mover/Ajuste (S)',
    description: 'Transfere saldo bloqueado S de PES para 999/AJUSTE via /nlt10',
  },
  {
    type: 'atualizar_db',
    label: 'Atualizar Banco de Dados',
    shortLabel: 'Atualizar DB',
    description: 'Extrai relatório do SAP e sincroniza com o banco de dados',
  },
  {
    type: 'devolver',
    label: 'Devolver ao Almoxarifado',
    shortLabel: 'Devolver (/nzwm296)',
    description: 'Executa ordem de devolução via /nzwm296',
  },
];

export function generateBloquearMigoVbs(items: BloquearItemParam[]): string {
  if (items.length === 0) return '';

  const vbsHeader = `If Not IsObject(application) Then
   Set SapGuiAuto  = GetObject("SAPGUI")
   Set application = SapGuiAuto.GetScriptingEngine
End If
If Not IsObject(connection) Then
   Set connection = application.Children(0)
End If
If Not IsObject(session) Then
   Set session    = connection.Children(0)
End If
If IsObject(WScript) Then
   WScript.ConnectObject session,     "on"
   WScript.ConnectObject application, "on"
End If
session.findById("wnd[0]").maximize
session.findById("wnd[0]/tbar[0]/okcd").text = "/nmigo"
session.findById("wnd[0]").sendVKey 0
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_FIRSTLINE:SAPLMIGO:0011/ctxtGODEFAULT_TV-BWART").text = "y84"
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_FIRSTLINE:SAPLMIGO:0011/ctxtGODEFAULT_TV-BWART").setFocus
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_FIRSTLINE:SAPLMIGO:0011/ctxtGODEFAULT_TV-BWART").caretPosition = 3
session.findById("wnd[0]").sendVKey 0`;

  // Preenche dados dos itens indexando diretamente por linha na tabela [coluna, linha]
  const maktxLines = items.map((item, idx) => {
    const mat = item.material.trim();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,${idx}]").text = "${mat}"`;
  }).join('\n');

  const erfmgLines = items.map((item, idx) => {
    const qtd = item.quantidade.trim().replace('.', ',');
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/txtGOITEM-ERFMG[3,${idx}]").text = "${qtd}"`;
  }).join('\n');

  const erfmeLines = items.map((item, idx) => {
    const unit = (item.unidade.trim() || 'KG').toUpperCase();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-ERFME[5,${idx}]").text = "${unit}"`;
  }).join('\n');

  const lgobeLines = items.map((_, idx) => {
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-LGOBE[12,${idx}]").text = "PES"`;
  }).join('\n');

  const name1Lines = items.map((_, idx) => {
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-NAME1[9,${idx}]").text = "600"`;
  }).join('\n');

  const umlgobeLines = items.map((_, idx) => {
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-UMLGOBE[14,${idx}]").text = "PES"`;
  }).join('\n');

  const grundLines = items.map((_, idx) => {
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-GRUND[15,${idx}]").text = "9000"`;
  }).join('\n');

  // Validação da grade
  const validateGrid = `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,0]").setFocus
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,0]").caretPosition = 0
session.findById("wnd[0]").sendVKey 0`;

  // Preenche lotes (CHARG)
  const chargLines = items.map((item, idx) => {
    const lote = item.lote.trim();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-CHARG[2,${idx}]").text = "${lote}"`;
  }).join('\n');

  // Conclusão e gravação
  const vbsFooter = `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-CHARG[2,0]").setFocus
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-CHARG[2,0]").caretPosition = 0
session.findById("wnd[0]/tbar[1]/btn[7]").press
session.findById("wnd[0]/tbar[1]/btn[23]").press
session.findById("wnd[0]/tbar[0]/okcd").text = "/nlt06"
session.findById("wnd[0]").sendVKey 0
session.findById("wnd[0]").sendVKey 0
session.findById("wnd[0]/tbar[1]/btn[44]").press
session.findById("wnd[0]/tbar[0]/okcd").text = "/n"
session.findById("wnd[0]").sendVKey 0`;

  return [
    vbsHeader,
    maktxLines,
    erfmgLines,
    erfmeLines,
    lgobeLines,
    name1Lines,
    umlgobeLines,
    grundLines,
    validateGrid,
    chargLines,
    vbsFooter,
  ].filter(Boolean).join('\n');
}

export function generateDesbloquearMigoVbs(items: BloquearItemParam[]): string {
  if (items.length === 0) return '';

  const vbsHeader = `If Not IsObject(application) Then
   Set SapGuiAuto  = GetObject("SAPGUI")
   Set application = SapGuiAuto.GetScriptingEngine
End If
If Not IsObject(connection) Then
   Set connection = application.Children(0)
End If
If Not IsObject(session) Then
   Set session    = connection.Children(0)
End If
If IsObject(WScript) Then
   WScript.ConnectObject session,     "on"
   WScript.ConnectObject application, "on"
End If
session.findById("wnd[0]").maximize
session.findById("wnd[0]/tbar[0]/okcd").text = "/nmigo"
session.findById("wnd[0]").sendVKey 0
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_FIRSTLINE:SAPLMIGO:0011/ctxtGODEFAULT_TV-BWART").text = "y83"
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_FIRSTLINE:SAPLMIGO:0011/ctxtGODEFAULT_TV-BWART").setFocus
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_FIRSTLINE:SAPLMIGO:0011/ctxtGODEFAULT_TV-BWART").caretPosition = 3
session.findById("wnd[0]").sendVKey 0`;

  // Preenche dados dos itens indexando diretamente por linha na tabela [coluna, linha] (SEM o campo GRUND 9000)
  const maktxLines = items.map((item, idx) => {
    const mat = item.material.trim();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,${idx}]").text = "${mat}"`;
  }).join('\n');

  const erfmgLines = items.map((item, idx) => {
    const qtd = item.quantidade.trim().replace('.', ',');
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/txtGOITEM-ERFMG[3,${idx}]").text = "${qtd}"`;
  }).join('\n');

  const erfmeLines = items.map((item, idx) => {
    const unit = (item.unidade.trim() || 'KG').toUpperCase();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-ERFME[5,${idx}]").text = "${unit}"`;
  }).join('\n');

  const lgobeLines = items.map((_, idx) => {
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-LGOBE[12,${idx}]").text = "PES"`;
  }).join('\n');

  const name1Lines = items.map((_, idx) => {
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-NAME1[9,${idx}]").text = "600"`;
  }).join('\n');

  const umlgobeLines = items.map((_, idx) => {
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-UMLGOBE[14,${idx}]").text = "PES"`;
  }).join('\n');

  // Validação da grade
  const validateGrid = `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,0]").setFocus
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,0]").caretPosition = 0
session.findById("wnd[0]").sendVKey 0`;

  // Preenche lotes (CHARG)
  const chargLines = items.map((item, idx) => {
    const lote = item.lote.trim();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-CHARG[2,${idx}]").text = "${lote}"`;
  }).join('\n');

  // Conclusão e gravação
  const vbsFooter = `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-CHARG[2,0]").setFocus
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-CHARG[2,0]").caretPosition = 0
session.findById("wnd[0]/tbar[1]/btn[7]").press
session.findById("wnd[0]/tbar[1]/btn[23]").press
session.findById("wnd[0]/tbar[0]/okcd").text = "/nlt06"
session.findById("wnd[0]").sendVKey 0
session.findById("wnd[0]").sendVKey 0
session.findById("wnd[0]/tbar[1]/btn[44]").press
session.findById("wnd[0]/tbar[0]/okcd").text = "/n"
session.findById("wnd[0]").sendVKey 0`;

  return [
    vbsHeader,
    maktxLines,
    erfmgLines,
    erfmeLines,
    lgobeLines,
    name1Lines,
    umlgobeLines,
    validateGrid,
    chargLines,
    vbsFooter,
  ].filter(Boolean).join('\n');
}

// -------------------------------------------------------------
// Column Definitions & Types
// -------------------------------------------------------------

export interface ColumnDefConfig {
  k: string;
  l: string;
  s?: boolean; // sortable
  f: 'txt' | 'sel' | 'num'; // filter type
  on: boolean; // default visible
  r?: boolean; // align right
}

const DEFAULT_COLS: ColumnDefConfig[] = [
  { k: 'material', l: 'Material', s: true, f: 'txt', on: true },
  { k: 'texto_breve_material', l: 'Descrição', s: true, f: 'txt', on: true },
  { k: 'lote', l: 'Lote', s: true, f: 'txt', on: true },
  { k: 'centro', l: 'Centro', s: true, f: 'sel', on: false },
  { k: 'deposito', l: 'Depósito', s: true, f: 'sel', on: false },
  { k: 'tipo_deposito', l: 'Tipo dep.', s: true, f: 'sel', on: true },
  { k: 'posicao_deposito', l: 'Posição', s: true, f: 'sel', on: true },
  { k: 'estoque_disponivel', l: 'Quantidade', s: true, f: 'num', on: true, r: true },
  { k: 'unidade_medida', l: 'UMB', s: true, f: 'sel', on: false },
  { k: 'valor_unitario', l: 'Val. unit.', s: true, f: 'num', on: true, r: true },
  { k: 'valor_total', l: 'Val. total', s: true, f: 'num', on: true, r: true },
  { k: 'dias_aging', l: 'Aging', s: true, f: 'num', on: true, r: true },
  { k: 'status_aging', l: 'Status', s: true, f: 'sel', on: true },
  { k: 'ultimo_movimento', l: 'Últ. mov.', s: true, f: 'txt', on: true },
  { k: 'tipo_estoque', l: 'Tipo est.', s: true, f: 'sel', on: true },
  { k: 'remessas', l: 'Remessas', s: true, f: 'num', on: true, r: true },
];

export interface EnrichedResidualRow extends AgingData {
  id_row: string;
  valor_unitario: number;
  valor_total: number;
  remessas: number;
  status_crit: 'ok' | 'al' | 'cr';
  status_label: string;
  is_res: boolean;
  res_nivel: 'v' | 'a' | 'r' | null;
  is_inf: boolean;
  is_cfa: boolean;
  is_controlado: boolean;
  is_investigacao: boolean;
  is_blocked?: boolean;
}

export interface ResiduaisViewProps {
  agingData: AgingData[];
  allData?: AgingData[];
  valores?: Record<string, number>;
  remessas?: RemessaData[];
  configResiduais?: ConfiguracaoResiduais;
  onNavigateToRemessas?: (material: string) => void;
  lotesInvestigacao?: LoteInvestigacao[];
  onInvestigacaoChange?: () => void;
  currentUserEmail?: string;
  selectedCriticality?: string | null;
  onCriticalityChange?: (crit: string | null) => void;
  onAtualizarDb?: () => void;
  isAtualizandoDb?: boolean;
}

export function ResiduaisView({
  agingData,
  allData,
  valores = {},
  remessas = [],
  configResiduais,
  onNavigateToRemessas,
  lotesInvestigacao = [],
  onInvestigacaoChange,
  currentUserEmail,
  selectedCriticality,
  onCriticalityChange,
  onAtualizarDb,
  isAtualizandoDb,
}: ResiduaisViewProps) {
  const [cols, setCols] = useState<ColumnDefConfig[]>(DEFAULT_COLS);
  const [colsPopOpen, setColsPopOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, any>>({});
  const [sortField, setSortField] = useState<string>('material');
  const [sortDir, setSortDir] = useState<number>(1);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [blockedMap, setBlockedMap] = useState<Record<string, boolean>>({});
  const [analysisMode, setAnalysisMode] = useState(false);
  const [resNivelFilter, setResNivelFilter] = useState<'all' | 'v' | 'a' | 'r'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const lastSelectedRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modais de SAP
  const [devolverOpen, setDevolverOpen] = useState(false);
  const [devolverMaterial, setDevolverMaterial] = useState('');
  const [devolverDescricao, setDevolverDescricao] = useState('');
  const [devolverLote, setDevolverLote] = useState('');
  const [devolverUnidade, setDevolverUnidade] = useState('KG');
  const [devolverSaldoTotal, setDevolverSaldoTotal] = useState<number>(0);
  const [devolverVolumes, setDevolverVolumes] = useState<DevolverVolumeItem[]>([
    { id: '1', quantidade: '', volume: '1' },
  ]);
  const [isDevolverRunning, setIsDevolverRunning] = useState(false);

  const [moverModalOpen, setMoverModalOpen] = useState(false);
  const [moverItems, setMoverItems] = useState<MoverItemParam[]>([]);
  const [selectedMoverRoute, setSelectedMoverRoute] = useState<string>('pes_pesagem');
  const [moverModalMode, setMoverModalMode] = useState<'route' | 'bulk_ajuste'>('route');
  const [isMoverRunning, setIsMoverRunning] = useState(false);

  const [bloquearMigoOpen, setBloquearMigoOpen] = useState(false);
  const [bloquearSelectedItems, setBloquearSelectedItems] = useState<BloquearItemParam[]>([]);
  const [isBloquearMigoRunning, setIsBloquearMigoRunning] = useState(false);
  const [macroPipeline, setMacroPipeline] = useState<MacroActionItem[]>([
    { id: 'step-1', actionType: 'bloquear_migo' },
  ]);
  const [draggedMacroIndex, setDraggedMacroIndex] = useState<number | null>(null);
  const [isApplyingInvestigacao, setIsApplyingInvestigacao] = useState(false);

  // Atalho '/' para focar a busca
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
      if (e.key === 'Escape') {
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeFiltersCount = useMemo(() => {
    return Object.values(columnFilters).filter((v) =>
      typeof v === 'object' && v !== null ? (v.min || v.max) : Boolean(v)
    ).length;
  }, [columnFilters]);

  const diasAlerta = configResiduais?.dias_alerta ?? 7;
  const diasCritico = configResiduais?.dias_critico ?? 15;
  const limiteVerde = (configResiduais?.limite_verde ?? 100) / 1000;
  const limiteAmarelo = (configResiduais?.limite_amarelo ?? 900) / 1000;
  const limiteMaximo = (configResiduais?.limite_maximo ?? 999) / 1000;

  // Carregar colunas salvas do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dp_cols_residuais_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        setCols((prev) =>
          prev.map((col) => (parsed[col.k] !== undefined ? { ...col, on: !!parsed[col.k] } : col))
        );
      }
    } catch {}
  }, []);

  const handleToggleCol = (key: string) => {
    setCols((prev) => {
      const updated = prev.map((c) => (c.k === key ? { ...c, on: !c.on } : c));
      try {
        const storeMap: Record<string, boolean> = {};
        updated.forEach((c) => {
          storeMap[c.k] = c.on;
        });
        localStorage.setItem('dp_cols_residuais_config', JSON.stringify(storeMap));
      } catch {}
      return updated;
    });
  };

  // Mapas auxiliares
  const remessasCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of remessas) {
      map[r.material] = (map[r.material] || 0) + 1;
    }
    return map;
  }, [remessas]);

  const lotesInvSet = useMemo(() => {
    const set = new Set<string>();
    for (const item of lotesInvestigacao) {
      if (item.lote) set.add(item.lote.trim().toUpperCase());
    }
    return set;
  }, [lotesInvestigacao]);

  // Enriquecer dados da Pesagem com Regras de Residuais
  const enrichedData = useMemo<EnrichedResidualRow[]>(() => {
    const sourceData = (selectedCriticality && ['tr-zone', 'trzone', 'negativo', 'tr-zone negativo'].includes(selectedCriticality.toLowerCase()) && allData && allData.length > 0)
      ? allData
      : agingData;

    return sourceData.map((item, idx) => {
      const id_row = `${item.material}-${item.lote}-${item.posicao_deposito || idx}`;
      const vu = valores[item.material] || valores[item.material.replace(/^0+/, '')] || 0;
      const qtd = Number(item.estoque_disponivel) || 0;
      const vt = Math.max(0, qtd) * vu;
      const dias = item.dias_aging || 0;

      let status_crit: 'ok' | 'al' | 'cr' = 'ok';
      let status_label = 'Normal';
      if (dias > diasCritico) {
        status_crit = 'cr';
        status_label = 'Crítico';
      } else if (dias >= diasAlerta) {
        status_crit = 'al';
        status_label = 'Alerta';
      }

      const isKg = (item.unidade_medida || 'KG').toUpperCase() === 'KG';
      const is_res = isKg && qtd > 0 && qtd <= limiteMaximo;
      let res_nivel: 'v' | 'a' | 'r' | null = null;
      if (is_res) {
        if (qtd <= limiteVerde) res_nivel = 'v';
        else if (qtd <= limiteAmarelo) res_nivel = 'a';
        else res_nivel = 'r';
      }

      const especial = isMaterialEspecial(item.material);
      const is_inf = especial === 'inf';
      const is_cfa = especial === 'cfa';
      const is_controlado = (item.texto_breve_material || '').includes('**');
      const is_investigacao = lotesInvSet.has((item.lote || '').trim().toUpperCase());

      return {
        ...item,
        id_row,
        valor_unitario: vu,
        valor_total: vt,
        remessas: remessasCountMap[item.material] || 0,
        status_crit,
        status_label,
        is_res,
        res_nivel,
        is_inf,
        is_cfa,
        is_controlado,
        is_investigacao,
      };
    });
  }, [agingData, allData, selectedCriticality, valores, remessasCountMap, lotesInvSet, diasAlerta, diasCritico, limiteVerde, limiteAmarelo, limiteMaximo]);

  // Estatísticas de Residuais
  const residualStats = useMemo(() => {
    let countTotal = 0;
    let countV = 0;
    let countA = 0;
    let countR = 0;
    let valorTotal = 0;

    for (const item of enrichedData) {
      if (item.is_res) {
        countTotal++;
        valorTotal += item.valor_total;
        if (item.res_nivel === 'v') countV++;
        else if (item.res_nivel === 'a') countA++;
        else if (item.res_nivel === 'r') countR++;
      }
    }

    return { countTotal, countV, countA, countR, valorTotal };
  }, [enrichedData]);

  // Filtragem e Ordenação
  const filteredAndSorted = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();

    return enrichedData
      .filter((row) => {
        // Modo análise residual
        if (analysisMode) {
          if (!row.is_res) return false;
          if (resNivelFilter !== 'all' && row.res_nivel !== resNivelFilter) return false;
        }

        // Filtro de criticidade vindo dos cards do topo
        if (selectedCriticality) {
          const crit = selectedCriticality.toLowerCase();
          if (crit === 'tr-zone' || crit === 'trzone' || crit === 'negativo' || crit === 'tr-zone negativo') {
            const tipo = (row.tipo_deposito || '').trim().toUpperCase();
            const pos = (row.posicao_deposito || '').trim().toUpperCase();
            const is922OrTrZone = tipo === '922' || tipo.includes('922') || pos.includes('TR-ZONE') || pos.includes('TR_ZONE') || pos.includes('TRZONE');
            const isNegativo = (row.estoque_disponivel || 0) < 0;
            if (!is922OrTrZone || !isNegativo) return false;
          } else if (crit === 'normal' || crit === 'verde' || crit === 'ok') {
            if (row.status_crit !== 'ok') return false;
          } else if (crit === 'alerta' || crit === 'amarelo' || crit === 'al') {
            if (row.status_crit !== 'al') return false;
          } else if (crit === 'critico' || crit === 'crítico' || crit === 'vermelho' || crit === 'cr') {
            if (row.status_crit !== 'cr') return false;
          } else if (crit === 'inf') {
            if (!row.is_inf) return false;
          } else if (crit === 'cfa') {
            if (!row.is_cfa) return false;
          }
        }

        // Busca global
        if (q) {
          const match =
            row.material.toLowerCase().includes(q) ||
            (row.texto_breve_material || '').toLowerCase().includes(q) ||
            row.lote.toLowerCase().includes(q) ||
            (row.posicao_deposito || '').toLowerCase().includes(q);
          if (!match) return false;
        }

        // Filtros por coluna
        for (const [key, filterVal] of Object.entries(columnFilters)) {
          if (filterVal === undefined || filterVal === null || filterVal === '') continue;

          if (typeof filterVal === 'object') {
            const val = Number((row as any)[key]) || 0;
            if (filterVal.min !== undefined && filterVal.min !== '' && val < Number(filterVal.min)) return false;
            if (filterVal.max !== undefined && filterVal.max !== '' && val > Number(filterVal.max)) return false;
          } else {
            const raw = String((row as any)[key] || '').toLowerCase();
            const search = String(filterVal).toLowerCase();
            if (!raw.includes(search)) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let valA = (a as any)[sortField];
        let valB = (b as any)[sortField];

        if (typeof valA === 'number' && typeof valB === 'number') {
          return (valA - valB) * sortDir;
        }

        return String(valA || '').localeCompare(String(valB || ''), 'pt-BR') * sortDir;
      });
  }, [enrichedData, analysisMode, resNivelFilter, selectedCriticality, searchTerm, columnFilters, sortField, sortDir]);

  // Itens Selecionados
  const selectedRowsList = useMemo(() => {
    return filteredAndSorted.filter((r) => selectedIds[r.id_row]);
  }, [filteredAndSorted, selectedIds]);

  const selectedTotalValue = useMemo(() => {
    return selectedRowsList.reduce((acc, r) => acc + r.valor_total, 0);
  }, [selectedRowsList]);

  const totalFilteredValue = useMemo(() => {
    return filteredAndSorted.reduce((acc, r) => acc + r.valor_total, 0);
  }, [filteredAndSorted]);

  const isAllSelected = filteredAndSorted.length > 0 && selectedRowsList.length === filteredAndSorted.length;
  const isIndeterminate = selectedRowsList.length > 0 && selectedRowsList.length < filteredAndSorted.length;

  const handleSort = (fieldKey: string) => {
    if (sortField === fieldKey) {
      setSortDir((prev) => -prev);
    } else {
      setSortField(fieldKey);
      setSortDir(1);
    }
  };

  const handleRowCheckbox = (row: EnrichedResidualRow, index: number, event: React.MouseEvent) => {
    const isChecked = !selectedIds[row.id_row];

    if (event.shiftKey && lastSelectedRef.current !== null) {
      const start = Math.min(lastSelectedRef.current, index);
      const end = Math.max(lastSelectedRef.current, index);
      const nextMap = { ...selectedIds };

      for (let i = start; i <= end; i++) {
        const item = filteredAndSorted[i];
        if (item) {
          nextMap[item.id_row] = true;
        }
      }
      setSelectedIds(nextMap);
    } else {
      setSelectedIds((prev) => {
        const next = { ...prev };
        if (isChecked) next[row.id_row] = true;
        else delete next[row.id_row];
        return next;
      });
    }

    lastSelectedRef.current = index;
  };

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds({});
      return;
    }
    const nextMap: Record<string, boolean> = {};
    for (const r of filteredAndSorted) {
      nextMap[r.id_row] = true;
    }
    setSelectedIds(nextMap);
  };

  const formatBRL = (v: number) => {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const highlightText = (text: string | null | undefined) => {
    if (!text) return '';
    const q = (searchTerm || '').trim();
    if (!q) return text;
    const str = String(text);
    const index = str.toLowerCase().indexOf(q.toLowerCase());
    if (index === -1) return str;
    return (
      <>
        {str.substring(0, index)}
        <mark>{str.substring(index, index + q.length)}</mark>
        {str.substring(index + q.length)}
      </>
    );
  };

  const getUniqueColOptions = (colKey: string) => {
    const set = new Set<string>();
    enrichedData.forEach((row) => {
      const val = (row as any)[colKey];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        set.add(String(val).trim());
      }
    });
    return Array.from(set).sort();
  };

  // Funções de Copiar
  const handleCopyTSV = async () => {
    if (selectedRowsList.length === 0) return;
    const headers = ['Material', 'Descrição', 'Lote', 'Centro', 'Depósito', 'Tipo dep.', 'Posição', 'Quantidade', 'UMB', 'Val. unit.', 'Val. total', 'Aging', 'Status'];
    const rows = selectedRowsList.map((l) => [
      l.material,
      l.texto_breve_material,
      l.lote,
      l.centro || '600',
      l.deposito || 'PES',
      l.tipo_deposito || 'PES',
      l.posicao_deposito || '',
      l.estoque_disponivel.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
      l.unidade_medida || 'KG',
      l.valor_unitario.toFixed(2).replace('.', ','),
      l.valor_total.toFixed(2).replace('.', ','),
      l.dias_aging,
      l.status_label,
    ].join('\t'));

    const text = [headers.join('\t'), ...rows].join('\n');
    const ok = await copyToClipboard(text);
    if (ok) toast.success(`${selectedRowsList.length} linhas copiadas`);
  };

  const handleCopyMIGO = async () => {
    if (selectedRowsList.length === 0) return;
    const lines = selectedRowsList.map((d) => {
      // Sequência exata: codigo[2tabs]qtd[2tabs]umr[2tabs]Y84[1tab]centro[3tabs]pes[2tabs]pes[1tab]9000
      return [
        d.material,           // codigo
        '',                   // tab vazio
        d.estoque_disponivel.toLocaleString('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
          useGrouping: false  // Remove separador de milhares
        }),                   // qtd (quantidade com vírgula decimal)
        '',                   // tab vazio
        d.unidade_medida || 'KG', // umr (KG, G, etc)
        '',                   // tab vazio
        '',                   // tab vazio (Y84 já preenchido aqui)
        d.centro || '600',    // centro
        '',                   // tab vazio
        '',                   // tab vazio
        d.deposito || 'PES',  // pes
        '',                   // tab vazio
        d.deposito || 'PES',  // pes
        '9000',               // 9000
      ].join('\t');
    });

    const text = lines.join('\n');
    const ok = await copyToClipboard(text);
    if (ok) toast.success('Itens copiados no formato MIGO');
  };

  const handleCopyLotes = async () => {
    if (selectedRowsList.length === 0) return;
    const text = selectedRowsList.map((l) => l.lote).join('\n');
    const ok = await copyToClipboard(text);
    if (ok) toast.success(`${selectedRowsList.length} lotes copiados`);
  };

  const handleToggleBlock = () => {
    if (selectedRowsList.length === 0) return;
    const anyUnblocked = selectedRowsList.some((l) => !blockedMap[l.lote]);
    setBlockedMap((prev) => {
      const next = { ...prev };
      selectedRowsList.forEach((l) => {
        next[l.lote] = anyUnblocked;
      });
      return next;
    });
    toast.success(`${selectedRowsList.length} lote(s) ${anyUnblocked ? 'bloqueados' : 'desbloqueados'}`);
  };

  const waitForJobCompletion = async (jobId: number, maxWaitMs = 60000) => {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const job = await checkSapAutomationStatus(jobId);
      if (job?.status === 'completed') return true;
      if (job?.status === 'failed') throw new Error(job.result_message || 'Erro na execução do script SAP');
      await new Promise((r) => setTimeout(r, 1500));
    }
    return true;
  };

  const handleToggleInvestigacao = async () => {
    if (selectedRowsList.length === 0 || isApplyingInvestigacao) return;
    setIsApplyingInvestigacao(true);
    const anyNotInInv = selectedRowsList.some((l) => !l.is_investigacao);
    const toastId = toast.loading(anyNotInInv ? 'Marcando em investigação...' : 'Removendo da investigação...');

    try {
      for (const item of selectedRowsList) {
        if (anyNotInInv && !item.is_investigacao) {
          await addLoteInvestigacao({
            lote: item.lote,
            material: item.material,
            created_by: currentUserEmail || 'Web Pesagem',
          });
        } else if (!anyNotInInv && item.is_investigacao) {
          await removeLoteInvestigacao(item.lote);
        }
      }
      toast.dismiss(toastId);
      toast.success(anyNotInInv ? 'Lotes marcados em investigação' : 'Lotes removidos da investigação');
      setSelectedIds({});
      onInvestigacaoChange?.();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error('Erro ao atualizar investigação');
    } finally {
      setIsApplyingInvestigacao(false);
    }
  };

  // Modais Handlers
  const handleOpenDevolver = () => {
    if (selectedRowsList.length !== 1) {
      toast.error('Selecione exatamente 1 item para devolução');
      return;
    }
    const item = selectedRowsList[0];
    const rawEstoque = item.estoque_disponivel;
    const numEstoque =
      typeof rawEstoque === 'number'
        ? rawEstoque
        : parseFloat(String(rawEstoque).replace(',', '.')) || 0;
    const quantidadeFormatada = numEstoque.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
      useGrouping: false,
    });
    setDevolverMaterial(item.material);
    setDevolverDescricao(item.texto_breve_material || '');
    setDevolverLote(item.lote);
    setDevolverUnidade(item.unidade_medida?.toUpperCase() || 'KG');
    setDevolverSaldoTotal(numEstoque);
    setDevolverVolumes([
      { id: '1', quantidade: quantidadeFormatada, volume: '1' },
    ]);
    setDevolverOpen(true);
  };

  const handleOpenMoverModal = () => {
    const listToMover: MoverItemParam[] = selectedRowsList.map((row) => {
      const quantidadeTabela = row.estoque_disponivel.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
        useGrouping: false,
      });
      return {
        material: row.material,
        descricao: row.texto_breve_material || '',
        lote: row.lote,
        quantidade: quantidadeTabela,
        unidade: row.unidade_medida?.toUpperCase() || 'KG',
        depositoOrigem: row.deposito || 'PES',
      };
    });
    setMoverItems(listToMover);
    setMoverModalMode('route');
    setSelectedMoverRoute('pes_pesagem');
    setMoverModalOpen(true);
  };

  const handleOpenBloquearMigo = () => {
    if (selectedRowsList.length === 0) {
      toast.error('Selecione ao menos 1 item');
      return;
    }
    const params: BloquearItemParam[] = selectedRowsList.map((row) => {
      const quantidadeTabela = row.estoque_disponivel.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
        useGrouping: false,
      });
      return {
        material: row.material,
        descricao: row.texto_breve_material || '',
        lote: row.lote,
        quantidade: quantidadeTabela,
        unidade: row.unidade_medida?.toUpperCase() || 'KG',
        depositoOrigem: row.deposito || 'PES',
      };
    });
    setBloquearSelectedItems(params);
    setMacroPipeline([{ id: `step-${Date.now()}`, actionType: 'bloquear_migo' }]);
    setBloquearMigoOpen(true);
  };

  const handleToggleMigoMode = (mode: 'bloquear' | 'desbloquear') => {
    const targetType = mode === 'bloquear' ? 'bloquear_migo' : 'desbloquear_migo';
    setMacroPipeline((prev) => {
      const hasMigo = prev.some((m) => m.actionType === 'bloquear_migo' || m.actionType === 'desbloquear_migo');
      if (!hasMigo) {
        return [{ id: `step-${Date.now()}`, actionType: targetType }, ...prev];
      }
      return prev.map((m) => {
        if (m.actionType === 'bloquear_migo' || m.actionType === 'desbloquear_migo') {
          return { ...m, actionType: targetType };
        }
        return m;
      });
    });
  };

  const handleUpdateSingleBloquearItem = (field: keyof BloquearItemParam, value: string) => {
    setBloquearSelectedItems((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[0] = { ...updated[0], [field]: value };
      return updated;
    });
  };

  const executeSapJobAndWait = (
    command: string,
    userEmail: string,
    scriptCode?: string,
    timeoutSeconds = 120
  ): Promise<{ success: boolean; message?: string }> => {
    return new Promise(async (resolve) => {
      try {
        const res = await triggerSapAutomation(command, userEmail, scriptCode);
        if (!res.success || !res.job) {
          return resolve({ success: false, message: res.error || 'Falha ao enfileirar automação' });
        }
        const jobId = res.job.id;
        let attempts = 0;
        const maxAttempts = Math.ceil(timeoutSeconds / 2);
        const interval = setInterval(async () => {
          attempts++;
          try {
            const statusJob = await checkSapAutomationStatus(jobId);
            if (statusJob?.status === 'completed') {
              clearInterval(interval);
              return resolve({ success: true, message: statusJob.result_message });
            } else if (statusJob?.status === 'failed') {
              clearInterval(interval);
              return resolve({
                success: false,
                message: statusJob.result_message || 'Erro durante a execução do script',
              });
            } else if (attempts >= maxAttempts) {
              clearInterval(interval);
              return resolve({
                success: false,
                message: 'Tempo limite excedido aguardando resposta do Planilha Sync',
              });
            }
          } catch (e: any) {
            if (attempts >= maxAttempts) {
              clearInterval(interval);
              return resolve({ success: false, message: e?.message || 'Erro de comunicação com a API' });
            }
          }
        }, 2000);
      } catch (err: any) {
        resolve({ success: false, message: err?.message || 'Erro inesperado' });
      }
    });
  };

  const handleAddMacroToPipeline = (actionType: MacroActionType) => {
    setMacroPipeline((prev) => [
      ...prev,
      {
        id: `${actionType}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        actionType,
        routeId: actionType === 'mover_lt10' ? 'pes_pesagem' : undefined,
      },
    ]);
  };

  const handleRemoveMacroFromPipeline = (index: number) => {
    setMacroPipeline((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveMacroInPipeline = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= macroPipeline.length) return;
    setMacroPipeline((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const handleUpdateStepRoute = (stepId: string, routeId: string) => {
    setMacroPipeline((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, routeId } : s))
    );
  };

  const handleApplyMacroPreset = (presetTypes: MacroActionType[]) => {
    setMacroPipeline(
      presetTypes.map((actionType, i) => ({
        id: `${actionType}-${Date.now()}-${i}`,
        actionType,
        routeId: actionType === 'mover_lt10' ? 'pes_pesagem' : undefined,
      }))
    );
  };

  // Funções de Volume Devolver
  const parseQtdNumber = (val: string): number => {
    if (!val) return 0;
    const cleaned = String(val).trim().replace(/\s/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  const totalDevolvendo = useMemo(() => {
    return (
      Math.round(
        devolverVolumes.reduce((acc, v) => {
          const qtd = parseQtdNumber(v.quantidade);
          const vol = parseQtdNumber(v.volume);
          const mult = vol > 0 ? vol : 1;
          return acc + qtd * mult;
        }, 0) * 1000
      ) / 1000
    );
  }, [devolverVolumes]);

  const saldoRestante = useMemo(() => {
    return Math.round((devolverSaldoTotal - totalDevolvendo) * 1000) / 1000;
  }, [devolverSaldoTotal, totalDevolvendo]);

  const isOverSaldo = saldoRestante < -0.0001;
  const isZeroRestante = Math.abs(saldoRestante) <= 0.0001 && totalDevolvendo > 0;

  const handleAddVolume = () => {
    setDevolverVolumes((prev) => [
      ...prev,
      { id: String(Date.now()), quantidade: '', volume: '1' },
    ]);
  };

  const handleRemoveVolume = (idx: number) => {
    if (devolverVolumes.length <= 1) return;
    setDevolverVolumes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateVolume = (idx: number, field: 'quantidade' | 'volume', val: string) => {
    setDevolverVolumes((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const handleFillRestante = () => {
    if (saldoRestante <= 0.0001) return;
    const restanteStr = saldoRestante.toLocaleString('pt-BR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
    setDevolverVolumes((prev) => [
      ...prev,
      { id: String(Date.now()), quantidade: restanteStr, volume: '1' },
    ]);
  };

  const handleConfirmDevolver = async () => {
    if (devolverVolumes.length === 0) return;
    setIsDevolverRunning(true);
    const toastId = toast.loading('Enviando devolução ao SAP GUI via Planilha Sync...');

    try {
      const vbs = generateDevolverZwm296Vbs(devolverMaterial, devolverLote, devolverVolumes);
      const res = await triggerSapAutomation(
        'devolver_zwm296',
        currentUserEmail || 'Web Pesagem',
        vbs
      );

      if (res.job?.id) {
        await waitForJobCompletion(res.job.id);
      }

      toast.dismiss(toastId);
      toast.success('Devolução processada com sucesso no SAP!');
      setDevolverOpen(false);
      setSelectedIds({});
      onAtualizarDb?.();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Erro ao executar devolução: ${err.message || 'Falha no SAP'}`);
    } finally {
      setIsDevolverRunning(false);
    }
  };

  const handleConfirmMoverLt10 = async () => {
    if (moverItems.length === 0) return;
    setIsMoverRunning(true);
    const toastId = toast.loading(`Enviando transferência de ${moverItems.length} item(ns) ao SAP...`);

    try {
      const route = PREDEFINED_MOVER_ROUTES.find((r) => r.id === selectedMoverRoute) || PREDEFINED_MOVER_ROUTES[0];
      const vbs = generateMoverLt10Vbs(moverItems, { tipo: route.tipo, posicao: route.posicao });
      const res = await triggerSapAutomation(
        'mover_lt10',
        currentUserEmail || 'Web Pesagem',
        vbs
      );

      if (res.job?.id) {
        await waitForJobCompletion(res.job.id);
      }

      toast.dismiss(toastId);
      toast.success('Transferência LT10 executada com sucesso no SAP!');
      setMoverModalOpen(false);
      setSelectedIds({});
      onAtualizarDb?.();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Erro na transferência: ${err.message || 'Falha no SAP'}`);
    } finally {
      setIsMoverRunning(false);
    }
  };

  const handleMoverS = async () => {
    if (isMoverRunning) return;
    setIsMoverRunning(true);
    const toastId = toast.loading('Enviando solicitação movermigo (saldo tipo S) para o Planilha Sync...');

    try {
      const res = await triggerSapAutomation('movermigo', currentUserEmail || 'Dashboard');
      if (!res.success || !res.job) {
        toast.error(`Falha ao disparar automação: ${res.error || 'Erro desconhecido'}`, { id: toastId });
        setIsMoverRunning(false);
        return;
      }

      const jobId = res.job.id;
      toast.loading('Aguardando execução do script movermigo no SAP GUI...', { id: toastId });

      let attempts = 0;
      const maxAttempts = 30;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const statusJob = await checkSapAutomationStatus(jobId);
          if (statusJob?.status === 'completed') {
            clearInterval(interval);
            setIsMoverRunning(false);
            toast.success('Script movermigo (saldo S) executado com sucesso no SAP!', { id: toastId });
            onAtualizarDb?.();
          } else if (statusJob?.status === 'failed') {
            clearInterval(interval);
            setIsMoverRunning(false);
            toast.error(`Execução no SAP falhou: ${statusJob.result_message || 'Erro no script'}`, { id: toastId });
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsMoverRunning(false);
            toast('Tempo limite aguardando o Planilha Sync. Verifique se o app está aberto.', { id: toastId });
          }
        } catch (e) {
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsMoverRunning(false);
          }
        }
      }, 2000);
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`, { id: toastId });
      setIsMoverRunning(false);
    }
  };

  const handleExecuteMacroPipeline = async () => {
    if (macroPipeline.length === 0) {
      toast.error('Adicione ao menos uma macro ao pipeline de execução.');
      return;
    }

    const hasBloquearOrDesbloquear = macroPipeline.some(
      (m) => m.actionType === 'bloquear_migo' || m.actionType === 'desbloquear_migo'
    );
    if (hasBloquearOrDesbloquear) {
      if (bloquearSelectedItems.length === 0) return;
      const hasInvalid = bloquearSelectedItems.some(
        (it) => !it.material.trim() || !it.lote.trim() || !it.quantidade.trim()
      );
      if (hasInvalid) {
        toast.error('Preencha os campos obrigatórios (Material, Lote e Quantidade) de todos os itens');
        return;
      }
    }

    setBloquearMigoOpen(false);
    setIsBloquearMigoRunning(true);
    const totalSteps = macroPipeline.length;
    const countItems = bloquearSelectedItems.length;
    const toastId = toast.loading(`Iniciando pipeline de ${totalSteps} etapa(s) no SAP...`);

    try {
      for (let stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
        const step = macroPipeline[stepIdx];
        const stepNumber = stepIdx + 1;
        const macroDef = AVAILABLE_MACROS.find((m) => m.type === step.actionType);
        const label = macroDef?.shortLabel || step.actionType;

        toast.loading(`[${stepNumber}/${totalSteps}] Executando: ${label}...`, { id: toastId });

        let res: { success: boolean; message?: string };

        if (step.actionType === 'bloquear_migo') {
          const vbsCode = generateBloquearMigoVbs(bloquearSelectedItems);
          res = await executeSapJobAndWait(
            'bloquear_migo',
            currentUserEmail || 'Dashboard',
            vbsCode,
            Math.max(60, countItems * 25)
          );
        } else if (step.actionType === 'desbloquear_migo') {
          const vbsCode = generateDesbloquearMigoVbs(bloquearSelectedItems);
          res = await executeSapJobAndWait(
            'desbloquear_migo',
            currentUserEmail || 'Dashboard',
            vbsCode,
            Math.max(60, countItems * 25)
          );
        } else if (step.actionType === 'mover_lt10') {
          const targetRoute = PREDEFINED_MOVER_ROUTES.find((r) => r.id === (step.routeId || 'pes_pesagem')) || PREDEFINED_MOVER_ROUTES[0];
          const moverItemsParam: MoverItemParam[] = bloquearSelectedItems.map((it) => ({
            material: it.material,
            lote: it.lote,
            quantidade: it.quantidade,
            unidade: it.unidade,
            depositoOrigem: it.depositoOrigem || 'PES',
            descricao: it.descricao,
          }));
          const vbsCode = generateMoverLt10Vbs(moverItemsParam, { tipo: targetRoute.tipo, posicao: targetRoute.posicao });
          res = await executeSapJobAndWait(
            'mover_lt10',
            currentUserEmail || 'Dashboard',
            vbsCode,
            Math.max(60, countItems * 25)
          );
        } else if (step.actionType === 'mover_ajuste') {
          res = await executeSapJobAndWait(
            'movermigo',
            currentUserEmail || 'Dashboard',
            undefined,
            60
          );
        } else if (step.actionType === 'atualizar_db') {
          res = await executeSapJobAndWait(
            'atualizar_db',
            currentUserEmail || 'Dashboard',
            undefined,
            180
          );
        } else if (step.actionType === 'devolver') {
          const firstMat = bloquearSelectedItems[0]?.material || '';
          const firstLot = bloquearSelectedItems[0]?.lote || '';
          const vbsCode = generateDevolverZwm296Vbs(
            firstMat,
            firstLot,
            bloquearSelectedItems.map((it, idx) => ({
              quantidade: it.quantidade,
              volume: String(idx + 1),
            }))
          );
          res = await executeSapJobAndWait(
            'devolver',
            currentUserEmail || 'Dashboard',
            vbsCode,
            90
          );
        } else {
          res = { success: true };
        }

        if (!res.success) {
          toast.error(
            `Falha na etapa [${stepNumber}/${totalSteps}] (${label}): ${res.message || 'Erro na execução'}`,
            { id: toastId, duration: 6000 }
          );
          setIsBloquearMigoRunning(false);
          return;
        }
      }

      toast.success(
        `Pipeline completo de ${totalSteps} etapa(s) executado com sucesso no SAP!`,
        { id: toastId, icon: '✨', duration: 5000 }
      );
      setSelectedIds({});
      onAtualizarDb?.();
    } catch (err: any) {
      toast.error(`Erro no pipeline: ${err?.message || err}`, { id: toastId });
    } finally {
      setIsBloquearMigoRunning(false);
    }
  };

  return (
    <section id="tbl" className="space-y-2">
      {/* Barra de Ferramentas Superior (.tb-top) - IDÊNTICA AO FINANCEIRO */}
      <div className="tb-top">
        {/* Botão 1: Analisar resíduos */}
        <button
          type="button"
          className={cn("btn", analysisMode && "on")}
          onClick={() => {
            setAnalysisMode(!analysisMode);
            if (analysisMode) setResNivelFilter('all');
          }}
          title="Alternar modo de análise e filtragem de lotes residuais"
        >
          <AlertTriangle size={14} className={analysisMode ? "text-[var(--amber)]" : ""} />
          <span>Analisar resíduos</span>
        </button>

        {/* Botão 2: Busca Global (.search) com atalho / */}
        <label className="search">
          <Search size={14} className="text-[var(--text-3)] shrink-0" />
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Busca global: material, descrição, lote"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setSearchTerm('');
                searchInputRef.current?.focus();
              }}
              className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors p-0.5"
              title="Limpar busca (Esc)"
            >
              <X size={12} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </label>

        {/* Botão 3: Filtros por coluna */}
        <button
          type="button"
          className={cn("btn", showFilters && "on")}
          onClick={() => setShowFilters(!showFilters)}
          title="Exibir filtros avançados por coluna"
        >
          <Filter size={14} />
          <span>Filtros por coluna</span>
          {activeFiltersCount > 0 && (
            <span className="mono font-semibold text-[var(--accent)] ml-1">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* Botão Mover (S) */}
        <button
          type="button"
          className="btn"
          onClick={handleMoverS}
          disabled={isMoverRunning}
          title="Mover/Ajuste em massa de saldo bloqueado (S) para 999/AJUSTE via SAP"
        >
          {isMoverRunning ? (
            <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
          ) : (
            <RefreshCw size={14} />
          )}
          <span>Mover (S)</span>
        </button>

        {/* Botão 4: Popover de Colunas (.colpop) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={cn("btn", colsPopOpen && "on")}
            onClick={() => setColsPopOpen(!colsPopOpen)}
            title="Configurar colunas visíveis da tabela"
          >
            <Columns size={14} />
            <span>Colunas</span>
          </button>

          {colsPopOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setColsPopOpen(false)} />
              <div className="colpop" style={{ left: 0, top: 'calc(100% + 4px)' }}>
                <div className="px-3 py-1.5 border-b border-[var(--border)] text-[11px] font-semibold text-[var(--text-3)]">
                  COLUNAS VISÍVEIS
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {cols.map((col) => (
                    <label key={col.k}>
                      <input
                        type="checkbox"
                        checked={col.on}
                        disabled={col.k === 'material'}
                        onChange={() => handleToggleCol(col.k)}
                      />
                      <span>{col.l}</span>
                    </label>
                  ))}
                </div>
                <div className="pt-1.5 pb-1 px-3 border-t border-[var(--border)] flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCols(DEFAULT_COLS);
                      try {
                        localStorage.removeItem('dp_cols_residuais_config');
                      } catch {}
                    }}
                    className="text-[var(--accent)] hover:underline font-medium"
                  >
                    Restaurar padrão
                  </button>
                  <span className="text-[var(--text-3)] font-mono">
                    {cols.filter((c) => c.on).length}/{cols.length}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {onAtualizarDb && (
          <button
            type="button"
            className="btn"
            onClick={onAtualizarDb}
            disabled={isAtualizandoDb}
            title="Atualizar banco de dados via Planilha Sync"
          >
            <RefreshCw size={13} className={isAtualizandoDb ? "animate-spin text-[var(--accent)]" : ""} />
            <span>Atualizar DB</span>
          </button>
        )}

        <div className="grow" />

        {/* Contador Geral */}
        <span className="count">
          <b>{filteredAndSorted.length.toLocaleString('pt-BR')}</b> de{' '}
          <span className="mono">{enrichedData.length.toLocaleString('pt-BR')}</span> lotes ·{' '}
          <b>{formatBRL(totalFilteredValue)}</b>
        </span>
      </div>

      {/* Barra de Residuais (.res) */}
      {analysisMode && (
        <div className="res">
          <span className="font-semibold text-[var(--text)]">Resíduos PES:</span>
          <button
            type="button"
            onClick={() => setResNivelFilter('all')}
            className={resNivelFilter === 'all' ? 'on' : ''}
          >
            Total <b>{residualStats.countTotal}</b>
          </button>
          <button
            type="button"
            onClick={() => setResNivelFilter('v')}
            className={resNivelFilter === 'v' ? 'on' : ''}
          >
            <span className="dot" style={{ background: 'var(--green)' }} />
            Verdes <b>{residualStats.countV}</b>
          </button>
          <button
            type="button"
            onClick={() => setResNivelFilter('a')}
            className={resNivelFilter === 'a' ? 'on' : ''}
          >
            <span className="dot" style={{ background: 'var(--amber)' }} />
            Amarelos <b>{residualStats.countA}</b>
          </button>
          <button
            type="button"
            onClick={() => setResNivelFilter('r')}
            className={resNivelFilter === 'r' ? 'on' : ''}
          >
            <span className="dot" style={{ background: 'var(--red)' }} />
            Vermelhos <b>{residualStats.countR}</b>
          </button>
          <span className="text-[var(--text-3)] font-mono">
            Valor: <b className="text-[var(--text)]">{formatBRL(residualStats.valorTotal)}</b>
          </span>
          <span className="rule text-[var(--text-3)] hidden lg:inline">
            Regra: 0 &lt; qtd ≤ {limiteMaximo.toFixed(1)} kg · verde ≤ {limiteVerde.toFixed(1)} · amarelo ≤ {limiteAmarelo.toFixed(1)} · vermelho acima
          </span>
        </div>
      )}

      {/* Barra de Ações em Massa (.bulk) */}
      {selectedRowsList.length > 0 && (
        <div className="bulk">
          <span className="sel">
            <b>{selectedRowsList.length}</b> selecionado{selectedRowsList.length > 1 ? 's' : ''} · <b>{formatBRL(selectedTotalValue)}</b>
          </span>
          <div className="vsep" />
          <button type="button" className="btn sm" onClick={handleCopyTSV}>
            <Copy size={13} />
            Copiar selecionados
          </button>
          <button type="button" className="btn sm" onClick={handleCopyMIGO}>
            MIGO
          </button>
          <button type="button" className="btn sm" onClick={handleCopyLotes}>
            Lote
          </button>
          <div className="vsep" />
          <button type="button" className="btn sm primary" onClick={handleOpenBloquearMigo}>
            <Lock size={13} />
            Bloquear / desbloquear
          </button>
          <button type="button" className="btn sm" onClick={handleOpenMoverModal}>
            <ArrowRightLeft size={13} />
            Mover…
          </button>
          <button type="button" className="btn sm" onClick={handleToggleInvestigacao}>
            Investigação
          </button>
          <button type="button" className="btn sm warn" onClick={handleOpenDevolver}>
            <Undo2 size={13} />
            Devolver
          </button>
          <span className="grow" style={{ flex: 1 }} />
          <button
            type="button"
            className="btn sm"
            onClick={() => setSelectedIds({})}
          >
            Limpar seleção
          </button>
        </div>
      )}

      {/* Tabela de Alta Densidade (.tw e table.t) - IDÊNTICA AO FINANCEIRO */}
      <div className="tw" id="tw">
        <table className="t" id="t">
          <thead id="thead">
            <tr>
              <th className="ck">
                <input
                  type="checkbox"
                  id="ckAll"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  title="Selecionar todos os filtrados"
                />
              </th>
              {cols
                .filter((c) => c.on)
                .map((col) => (
                  <th
                    key={col.k}
                    onClick={() => col.s && handleSort(col.k)}
                    className={cn("s", col.r && "r", sortField === col.k && "on")}
                  >
                    {col.l}
                    {col.s && sortField === col.k && (
                      <span className="ar">{sortDir > 0 ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
            </tr>

            {/* Linha de Filtros por Coluna (tr.f) */}
            {showFilters && (
              <tr className="f">
                <th className="ck" />
                {cols
                  .filter((c) => c.on)
                  .map((col) => (
                    <th key={col.k}>
                      {col.f === 'txt' && (
                        <input
                          value={columnFilters[col.k] || ''}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, [col.k]: e.target.value }))
                          }
                          placeholder="Filtrar..."
                        />
                      )}
                      {col.f === 'sel' && (
                        <select
                          value={columnFilters[col.k] || ''}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, [col.k]: e.target.value }))
                          }
                        >
                          <option value="">Todos</option>
                          {getUniqueColOptions(col.k).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                      {col.f === 'num' && (
                        <div className="mm">
                          <input
                            type="number"
                            value={columnFilters[col.k]?.min ?? ''}
                            onChange={(e) =>
                              setColumnFilters((prev) => ({
                                ...prev,
                                [col.k]: { ...prev[col.k], min: e.target.value },
                              }))
                            }
                            placeholder="Mín"
                          />
                          <input
                            type="number"
                            value={columnFilters[col.k]?.max ?? ''}
                            onChange={(e) =>
                              setColumnFilters((prev) => ({
                                ...prev,
                                [col.k]: { ...prev[col.k], max: e.target.value },
                              }))
                            }
                            placeholder="Máx"
                          />
                        </div>
                      )}
                    </th>
                  ))}
              </tr>
            )}
          </thead>

          <tbody id="tbody">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={cols.filter((c) => c.on).length + 1}
                  className="empty"
                >
                  Nenhum lote residual encontrado com os filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((row, index) => {
                const isSelected = !!selectedIds[row.id_row];
                const resLevel = row.res_nivel;
                const rowClass = resLevel === 'v' ? 'rv' : resLevel === 'a' ? 'ra' : resLevel === 'r' ? 'rr' : '';

                return (
                  <tr
                    key={row.id_row}
                    className={cn(rowClass, isSelected && "sel")}
                  >
                    {/* Checkbox */}
                    <td className="ck">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => handleRowCheckbox(row, index, e)}
                        onChange={() => {}}
                      />
                    </td>

                    {/* Colunas dinâmicas */}
                    {cols.filter((c) => c.on).map((col) => {
                      switch (col.k) {
                        case 'material':
                          return (
                            <td key={col.k} className="mat">
                              <button
                                type="button"
                                onClick={() => {
                                  copyToClipboard(row.material);
                                  toast.success(`Material ${row.material} copiado`);
                                }}
                                className="hover:text-[var(--accent)] transition-colors cursor-pointer text-left"
                                title="Clique para copiar"
                              >
                                {highlightText(row.material)}
                              </button>
                            </td>
                          );

                        case 'texto_breve_material':
                          return (
                            <td key={col.k} className="ds" title={row.texto_breve_material}>
                              {highlightText(row.texto_breve_material?.replace(/\*\*/g, ''))}
                              {row.is_controlado && (
                                <span className="flag">Controlado</span>
                              )}
                            </td>
                          );

                        case 'lote': {
                          const isBlocked = blockedMap[row.lote] ?? row.is_blocked;
                          return (
                            <td key={col.k} className="lt">
                              <button
                                type="button"
                                onClick={() => {
                                  copyToClipboard(row.lote);
                                  toast.success(`Lote ${row.lote} copiado`);
                                }}
                                className="hover:text-[var(--amber)] transition-colors cursor-pointer text-left font-mono font-bold text-[var(--amber)]"
                                title="Clique para copiar"
                              >
                                <span>{highlightText(row.lote)}</span>
                              </button>
                              {isBlocked && (
                                <Lock className="lock inline-block w-3 h-3 text-[var(--amber)] ml-1 align-text-bottom" />
                              )}
                              {row.is_inf && <span className="flag v">INF</span>}
                              {row.is_cfa && <span className="flag b">CFA</span>}
                              {row.is_investigacao && <span className="flag">Investig.</span>}
                            </td>
                          );
                        }

                        case 'estoque_disponivel':
                          return (
                            <td
                              key={col.k}
                              className={cn(
                                "num font-mono font-semibold",
                                row.estoque_disponivel < 0 && "neg",
                                row.estoque_disponivel === 0 && "zero"
                              )}
                            >
                              {row.estoque_disponivel.toLocaleString('pt-BR', {
                                minimumFractionDigits: 3,
                                maximumFractionDigits: 3,
                              })}
                            </td>
                          );

                        case 'valor_unitario':
                          return (
                            <td key={col.k} className="num text-[var(--text-3)] font-mono">
                              {row.valor_unitario > 0 ? formatBRL(row.valor_unitario) : '—'}
                            </td>
                          );

                        case 'valor_total':
                          return (
                            <td key={col.k} className="num font-mono font-semibold text-[var(--green)]">
                              {row.valor_total > 0 ? formatBRL(row.valor_total) : <span className="zero">—</span>}
                            </td>
                          );

                        case 'dias_aging':
                          return (
                            <td
                              key={col.k}
                              className={cn(
                                "num font-mono font-bold",
                                row.status_crit === 'cr' && "c-cr",
                                row.status_crit === 'al' && "c-al",
                                row.status_crit === 'ok' && "c-ok"
                              )}
                            >
                              {row.dias_aging} d
                            </td>
                          );

                        case 'status_aging':
                          return (
                            <td key={col.k} className="st font-mono">
                              <span
                                className="dot"
                                style={{
                                  background:
                                    row.status_crit === 'cr'
                                      ? 'var(--red)'
                                      : row.status_crit === 'al'
                                      ? 'var(--amber)'
                                      : 'var(--green)',
                                }}
                              />
                              <span>{row.status_label}</span>
                            </td>
                          );

                        case 'ultimo_movimento':
                          return (
                            <td key={col.k} className="font-mono text-xs text-[var(--text-3)]">
                              {row.ultimo_movimento || '—'}
                            </td>
                          );

                        case 'remessas':
                          return (
                            <td key={col.k} className="num">
                              {row.remessas > 0 ? (
                                <span
                                  className="rem cursor-pointer hover:scale-105 transition-transform"
                                  onClick={() => onNavigateToRemessas?.(row.material)}
                                  title="Ver remessas deste material"
                                >
                                  {row.remessas}
                                </span>
                              ) : (
                                <span className="zero">—</span>
                              )}
                            </td>
                          );

                        case 'tipo_deposito':
                        case 'posicao_deposito':
                          return (
                            <td
                              key={col.k}
                              className={cn(
                                "font-mono",
                                row.tipo_deposito === 'TR-ZONE' && row.estoque_disponivel < 0 && "c-cr font-bold"
                              )}
                            >
                              {(row as any)[col.k] || '—'}
                            </td>
                          );

                        default:
                          return (
                            <td key={col.k} className="font-mono">
                              {(row as any)[col.k] != null ? String((row as any)[col.k]) : '—'}
                            </td>
                          );
                      }
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog Devolução Fracionada (/nzwm296) */}
      <Dialog open={devolverOpen} onOpenChange={setDevolverOpen}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl bg-[#0e1014] border border-[var(--border-strong)] text-[var(--text)] p-6 max-h-[90vh] flex flex-col rounded-xl shadow-2xl">
          <DialogHeader className="shrink-0 pb-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <DialogTitle className="flex items-center gap-2 text-[var(--text)] text-base font-bold uppercase tracking-wider">
                <Undo2 className="h-5 w-5 text-[var(--amber)]" />
                <span>Devolução Fracionada no SAP (/nzwm296)</span>
              </DialogTitle>
              <div className="flex items-center gap-2">
                <span className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] font-mono text-xs px-2 py-0.5 rounded">
                  Material: <strong className="text-[var(--accent)] ml-1">{devolverMaterial}</strong>
                </span>
                <span className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] font-mono text-xs px-2 py-0.5 rounded">
                  Lote: <strong className="text-[var(--amber)] ml-1">{devolverLote}</strong>
                </span>
              </div>
            </div>
            {devolverDescricao && (
              <p className="text-xs text-[var(--text-3)] truncate max-w-2xl mt-1">{devolverDescricao}</p>
            )}
            <DialogDescription className="text-[var(--text-3)] text-xs font-mono mt-0.5">
              Configure múltiplos volumes para devolução na transação <code>/nzwm296</code>. O saldo restante é calculado automaticamente.
            </DialogDescription>
          </DialogHeader>

          {/* Cards de Saldo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2 shrink-0">
            <div className="p-3.5 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] flex flex-col justify-between">
              <span className="text-[10.5px] font-mono font-semibold text-[var(--text-3)] uppercase tracking-wider">Saldo em Estoque</span>
              <div className="mt-1">
                <span className="text-xl font-bold font-mono text-[var(--text)]">
                  {devolverSaldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </span>
                <span className="text-xs text-[var(--text-3)] ml-1.5 font-semibold font-mono">{devolverUnidade}</span>
              </div>
              <span className="text-[10px] text-[var(--text-3)] font-mono mt-1">Total disponível no lote selecionado</span>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] flex flex-col justify-between">
              <span className="text-[10.5px] font-mono font-semibold text-[var(--text-3)] uppercase tracking-wider">Total a Devolver</span>
              <div className="mt-1">
                <span className={cn(
                  "text-xl font-bold font-mono",
                  isOverSaldo ? "text-[var(--red)]" : isZeroRestante ? "text-[var(--green)]" : "text-[var(--text)]"
                )}>
                  {totalDevolvendo.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </span>
                <span className="text-xs text-[var(--text-3)] ml-1.5 font-semibold font-mono">{devolverUnidade}</span>
              </div>
              <span className="text-[10px] text-[var(--text-3)] font-mono mt-1">
                Soma de {devolverVolumes.length} volume(s)
              </span>
            </div>

            <div
              onClick={saldoRestante > 0.0001 ? handleFillRestante : undefined}
              className={cn(
                "p-3.5 rounded-lg border flex flex-col justify-between transition-all duration-200",
                isZeroRestante
                  ? "bg-[var(--green)]/10 border-[var(--green)]/40 text-[var(--green)]"
                  : isOverSaldo
                  ? "bg-[var(--red)]/10 border-[var(--red)]/40 text-[var(--red)]"
                  : "bg-[var(--amber)]/10 hover:bg-[var(--amber)]/20 border-[var(--amber)]/40 text-[var(--amber)] cursor-pointer shadow-xs group"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-mono font-semibold uppercase tracking-wider">
                  {isZeroRestante ? 'Devolução Completa' : isOverSaldo ? 'Saldo Excedido' : 'Saldo Restante'}
                </span>
                {isZeroRestante ? (
                  <CheckCircle2 size={15} className="text-[var(--green)]" />
                ) : isOverSaldo ? (
                  <AlertCircle size={15} className="text-[var(--red)]" />
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--amber)]/20 border border-[var(--amber)]/40 text-[var(--amber)] font-bold group-hover:bg-[var(--amber)] group-hover:text-[#0e1014] transition-colors">
                    Auto-preencher ↵
                  </span>
                )}
              </div>
              <div className="mt-1">
                <span className="text-xl font-bold font-mono">
                  {isOverSaldo ? '+' : ''}
                  {Math.abs(saldoRestante).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </span>
                <span className="text-xs ml-1.5 font-semibold font-mono">{devolverUnidade}</span>
              </div>
              <span className="text-[10px] font-mono mt-1 opacity-90 truncate">
                {isZeroRestante ? "100% do saldo distribuído" : isOverSaldo ? "Reduza a quantidade" : "👉 Clique para auto-preencher"}
              </span>
            </div>
          </div>

          {/* Tabela de Volumes */}
          <div className="flex-1 overflow-y-auto border border-[var(--border-strong)] rounded-lg bg-[var(--surface-2)]/60 my-1">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="bg-[var(--surface-2)] sticky top-0 z-10 border-b border-[var(--border-strong)] text-[11px] text-[var(--text-3)] uppercase">
                <tr>
                  <th className="w-12 px-3 py-2 text-center font-bold">#</th>
                  <th className="w-28 px-3 py-2 font-bold">Material</th>
                  <th className="w-28 px-3 py-2 font-bold">Lote</th>
                  <th className="px-3 py-2 font-bold">Qtd a Devolver (MENGE)</th>
                  <th className="w-28 px-3 py-2 text-center font-bold">Qtd Vol</th>
                  <th className="w-20 px-3 py-2 text-center font-bold">Pallet</th>
                  <th className="w-14 px-3 py-2 text-center font-bold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {devolverVolumes.map((volItem, idx) => (
                  <tr key={volItem.id} className="hover:bg-[var(--hover)] transition-colors">
                    <td className="text-center font-bold text-[var(--text-3)] px-3 py-2">
                      {idx + 1}
                    </td>
                    <td className="text-[var(--accent)] font-semibold px-3 py-2">
                      {devolverMaterial}
                    </td>
                    <td className="text-[var(--amber)] font-semibold px-3 py-2">
                      {devolverLote}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={volItem.quantidade}
                          onChange={(e) => handleUpdateVolume(idx, 'quantidade', e.target.value)}
                          placeholder="Ex: 4,985"
                          className="font-mono font-bold text-xs bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text)] focus:border-[var(--accent)] h-8 rounded-[var(--radius)] px-2.5 outline-none flex-1 placeholder:text-[var(--text-3)]"
                        />
                        <span className="text-xs text-[var(--text-3)] font-semibold">{devolverUnidade}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={volItem.volume}
                        onChange={(e) => handleUpdateVolume(idx, 'volume', e.target.value)}
                        placeholder="1"
                        className="font-mono text-center text-xs bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text)] focus:border-[var(--accent)] h-8 rounded-[var(--radius)] w-20 mx-auto block outline-none placeholder:text-[var(--text-3)]"
                      />
                    </td>
                    <td className="text-center font-mono text-xs text-[var(--text-3)] px-3 py-2">
                      1
                    </td>
                    <td className="text-center px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveVolume(idx)}
                        disabled={devolverVolumes.length <= 1}
                        className="h-7 w-7 rounded-[var(--radius)] bg-[var(--surface-2)] hover:bg-[var(--red)]/20 text-[var(--text-3)] hover:text-[var(--red)] border border-[var(--border)] disabled:opacity-20 grid place-items-center mx-auto transition-colors cursor-pointer"
                        title="Remover volume"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddVolume}
                className="px-3 py-1.5 rounded-[var(--radius)] bg-[var(--surface-2)] hover:bg-[var(--hover)] border border-[var(--border-strong)] text-[var(--text)] font-bold text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={13} className="text-[var(--accent)]" />
                <span>+ Adicionar Volume</span>
              </button>

              {saldoRestante > 0.0001 && (
                <button
                  type="button"
                  onClick={handleFillRestante}
                  className="px-3 py-1.5 rounded-[var(--radius)] bg-[var(--amber)]/10 hover:bg-[var(--amber)]/20 border border-[var(--amber)]/40 text-[var(--amber)] font-bold text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles size={13} />
                  <span>Preencher Restante ({saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} {devolverUnidade})</span>
                </button>
              )}
            </div>
          </div>

          <DialogFooter className="mt-3 pt-3 border-t border-[var(--border)] gap-2 sm:gap-0 shrink-0">
            <button
              type="button"
              onClick={() => setDevolverOpen(false)}
              className="px-4 py-2 rounded-[var(--radius)] bg-[var(--surface-2)] hover:bg-[var(--hover)] border border-[var(--border-strong)] text-[var(--text)] font-semibold text-xs transition-colors cursor-pointer mr-2"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDevolver}
              disabled={totalDevolvendo <= 0 || isOverSaldo || isDevolverRunning}
              className="px-5 py-2 rounded-[var(--radius)] bg-[var(--amber)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-[#0e1014] font-bold text-xs shadow-xs transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
            >
              {isDevolverRunning ? (
                <>
                  <Loader2 size={14} className="animate-spin text-[#0e1014]" />
                  <span>Executando no SAP...</span>
                </>
              ) : (
                <>
                  <Undo2 size={14} />
                  <span>Executar Devolução SAP ({devolverVolumes.length} Volumes)</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Mover Estoque no SAP (/nlt10) */}
      <Dialog open={moverModalOpen} onOpenChange={setMoverModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-[#0e1014] border border-[var(--border-strong)] text-[var(--text)] max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--text)] text-base font-bold uppercase tracking-wider">
              <ArrowRightLeft className="h-5 w-5 text-[var(--accent)]" />
              <span>Mover Estoque no SAP</span>
              {moverItems.length > 0 && (
                <span className="border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)] font-mono text-[10px] py-0.5 px-2 rounded ml-1">
                  {moverItems.length} {moverItems.length === 1 ? 'item' : 'itens'}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs font-mono text-[var(--text-3)] pt-0.5">
              Transfira itens localizando pelo lote e quantidade exata via <code>/nlt10</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-semibold text-[var(--text-3)] uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-[var(--accent)]" />
                <span>Selecione a Rota de Destino:</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PREDEFINED_MOVER_ROUTES.map((route) => {
                  const isSelected = selectedMoverRoute === route.id;
                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => setSelectedMoverRoute(route.id)}
                      className={cn(
                        "p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer",
                        isSelected
                          ? "bg-[var(--surface-2)] border-[var(--accent)] text-[var(--text)] shadow-xs ring-1 ring-[var(--accent)]/40"
                          : "bg-[var(--surface)] hover:bg-[var(--surface-2)] border-[var(--border-strong)] text-[var(--text-3)]"
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className={cn("text-xs font-bold font-mono", isSelected ? "text-[var(--text)]" : "text-[var(--text-2)]")}>
                          {route.label}
                        </span>
                        {isSelected && <CheckCircle2 size={13} className="text-[var(--accent)]" />}
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-3)] leading-tight">
                        {route.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-lg border border-[var(--border-strong)] bg-[var(--surface)]">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead className="text-[10.5px] text-[var(--text-3)] uppercase bg-[var(--surface-2)] sticky top-0 border-b border-[var(--border-strong)]">
                  <tr>
                    <th className="px-2.5 py-1.5 font-bold">Material</th>
                    <th className="px-2.5 py-1.5 font-bold">Lote</th>
                    <th className="px-2.5 py-1.5 font-bold">Dep. Origem</th>
                    <th className="px-2.5 py-1.5 text-right font-bold">Qtd</th>
                    <th className="px-2.5 py-1.5 text-center font-bold">UMB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {moverItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[var(--hover)] transition-colors">
                      <td className="px-2.5 py-1.5 text-[var(--accent)] font-semibold">{item.material}</td>
                      <td className="px-2.5 py-1.5 text-[var(--amber)] font-bold">{item.lote}</td>
                      <td className="px-2.5 py-1.5 uppercase text-[var(--text)]">{item.depositoOrigem}</td>
                      <td className="px-2.5 py-1.5 text-right text-[var(--text)]">{item.quantidade}</td>
                      <td className="px-2.5 py-1.5 text-center uppercase text-[var(--text-3)]">{item.unidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setMoverModalOpen(false)}
              className="px-4 py-2 rounded-[var(--radius)] bg-[var(--surface-2)] hover:bg-[var(--hover)] border border-[var(--border-strong)] text-[var(--text)] font-semibold text-xs transition-colors cursor-pointer mr-2"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmMoverLt10}
              disabled={moverItems.length === 0 || isMoverRunning}
              className="px-5 py-2 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--bg)] font-bold text-xs shadow-xs transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
            >
              <Play size={13} className="fill-current" />
              <span>Executar Transferência ({moverItems.length} itens) no SAP</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Bloquear/MIGO e Pipeline de Macros (Redesign AgileWork Design System) */}
      <Dialog open={bloquearMigoOpen} onOpenChange={setBloquearMigoOpen}>
        <DialogContent className="bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] sm:max-w-3xl max-h-[88vh] overflow-hidden rounded-[8px] p-0 shadow-2xl flex flex-col">
          {/* Cabeçalho sóbrio com breadcrumb/escopo */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-[var(--text)]">
                  Execução SAP &amp; Pipeline de Macros
                </h2>
                <span className="mono text-[11px] text-[var(--text-3)]">
                  ({bloquearSelectedItems.length} {bloquearSelectedItems.length === 1 ? 'lote selecionado' : 'lotes selecionados'})
                </span>
              </div>
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                Automação em lote via MIGO / LT10 integrada ao Planilha Sync
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBloquearMigoOpen(false)}
              className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded transition-colors"
              title="Fechar (Esc)"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-[13px]">
            {/* Seletor Segmentado de Operação Base (.seg) */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs font-medium text-[var(--text-2)]">Operação no MIGO:</span>
              <div className="seg">
                <button
                  type="button"
                  onClick={() => handleToggleMigoMode('bloquear')}
                  className={!macroPipeline.some((m) => m.actionType === 'desbloquear_migo') ? 'on' : ''}
                >
                  <span className="dot" style={{ background: 'var(--amber)' }} />
                  Bloquear saldo (Y84)
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleMigoMode('desbloquear')}
                  className={macroPipeline.some((m) => m.actionType === 'desbloquear_migo') ? 'on' : ''}
                >
                  <span className="dot" style={{ background: 'var(--green)' }} />
                  Desbloquear saldo (Y83)
                </button>
              </div>
            </div>

            {/* Seção 1: Dados dos Lotes Selecionados */}
            <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface-2)] overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--border)] bg-[var(--surface)] text-xs">
                <span className="font-medium text-[var(--text-2)]">
                  {bloquearSelectedItems.length === 1 ? 'Parâmetros do lote' : 'Lotes a processar'}
                </span>
                <span className="mono text-[11px] text-[var(--text-3)]">
                  Dep. origem: {bloquearSelectedItems[0]?.depositoOrigem || 'PES'}
                </span>
              </div>

              {bloquearSelectedItems.length === 1 ? (
                <div className="p-3.5 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="block text-[11px] text-[var(--text-3)] mb-1">Código SAP</span>
                      <span className="mono font-medium text-xs text-[var(--text)]">
                        {bloquearSelectedItems[0]?.material}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="block text-[11px] text-[var(--text-3)] mb-1">Descrição do material</span>
                      <span className="text-xs text-[var(--text-2)] truncate block" title={bloquearSelectedItems[0]?.descricao}>
                        {bloquearSelectedItems[0]?.descricao || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--border)]">
                    <div>
                      <span className="block text-[11px] text-[var(--text-3)] mb-1">Lote</span>
                      <span className="mono font-medium text-xs text-[var(--text)]">
                        {bloquearSelectedItems[0]?.lote}
                      </span>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[var(--text-3)] mb-1">
                        Quantidade
                      </label>
                      <input
                        type="text"
                        value={bloquearSelectedItems[0]?.quantidade ?? ''}
                        onChange={(e) => handleUpdateSingleBloquearItem('quantidade', e.target.value)}
                        className="input mono text-xs h-7"
                        placeholder="0,000"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[var(--text-3)] mb-1">
                        Unidade (UMB)
                      </label>
                      <input
                        type="text"
                        value={bloquearSelectedItems[0]?.unidade ?? ''}
                        onChange={(e) => handleUpdateSingleBloquearItem('unidade', e.target.value.toUpperCase())}
                        className="input mono text-xs uppercase h-7"
                        placeholder="KG"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto">
                  <table className="t text-xs">
                    <thead>
                      <tr>
                        <th className="mono text-[11px]">Material</th>
                        <th className="text-[11px]">Descrição</th>
                        <th className="mono text-[11px]">Lote</th>
                        <th className="r mono text-[11px]">Quantidade</th>
                        <th className="text-[11px]">UMB</th>
                      </tr>
                    </thead>
                    <tbody className="mono text-xs">
                      {bloquearSelectedItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="font-medium text-[var(--text)]">{item.material}</td>
                          <td className="font-sans text-[var(--text-2)] text-[12px] truncate max-w-[200px]" title={item.descricao}>
                            {item.descricao || '—'}
                          </td>
                          <td className="text-[var(--text-2)]">{item.lote}</td>
                          <td className="r font-medium text-[var(--text)]">{item.quantidade}</td>
                          <td className="text-[var(--text-3)]">{item.unidade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Seção 2: Pipeline de Execução */}
            <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text)]">
                    Etapas do pipeline
                  </span>
                  <span className="mono text-[11px] text-[var(--text-3)]">
                    ({macroPipeline.length} {macroPipeline.length === 1 ? 'etapa' : 'etapas'})
                  </span>
                </div>

                {/* Predefinições Rápidas (.seg) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-[var(--text-3)]">Predefinições:</span>
                  <div className="seg">
                    <button
                      type="button"
                      onClick={() => handleApplyMacroPreset(['bloquear_migo', 'mover_lt10', 'atualizar_db'])}
                      title="Bloquear MIGO ➔ Mover (/nlt10) ➔ Atualizar Base"
                    >
                      Completo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMacroPreset(['mover_lt10', 'atualizar_db'])}
                      title="Mover (/nlt10) ➔ Atualizar Base"
                    >
                      Mover + DB
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMacroPreset(['bloquear_migo', 'atualizar_db'])}
                      title="Bloquear MIGO ➔ Atualizar Base"
                    >
                      Bloquear + DB
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMacroPreset(['desbloquear_migo', 'atualizar_db'])}
                      title="Desbloquear MIGO ➔ Atualizar Base"
                    >
                      Desbloquear + DB
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista Sequencial de Etapas */}
              <div className="space-y-1.5">
                {macroPipeline.length === 0 ? (
                  <div className="empty p-4 text-xs text-[var(--text-3)] border border-dashed border-[var(--border)] rounded-[var(--radius)]">
                    Nenhuma etapa no pipeline. Adicione uma ação abaixo.
                  </div>
                ) : (
                  macroPipeline.map((step, idx) => {
                    const macroDef = AVAILABLE_MACROS.find((m) => m.type === step.actionType);
                    if (!macroDef) return null;

                    return (
                      <div
                        key={step.id}
                        draggable
                        onDragStart={() => setDraggedMacroIndex(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedMacroIndex !== null && draggedMacroIndex !== idx) {
                            handleMoveMacroInPipeline(draggedMacroIndex, idx);
                            setDraggedMacroIndex(null);
                          }
                        }}
                        className={cn(
                          "border rounded-[var(--radius)] p-2.5 bg-[var(--surface-2)] transition-colors",
                          draggedMacroIndex === idx ? "opacity-50 border-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="mono text-[11px] text-[var(--text-3)] w-4 text-center select-none">
                              {idx + 1}.
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="dot"
                                  style={{
                                    background:
                                      step.actionType === 'bloquear_migo'
                                        ? 'var(--amber)'
                                        : step.actionType === 'desbloquear_migo'
                                        ? 'var(--green)'
                                        : step.actionType === 'mover_lt10'
                                        ? 'var(--accent)'
                                        : 'var(--text-3)',
                                  }}
                                />
                                <span className="font-medium text-xs text-[var(--text)]">
                                  {macroDef.label}
                                </span>
                              </div>
                              <span className="text-[11px] text-[var(--text-3)] block mt-0.5 truncate">
                                {macroDef.description}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveMacroInPipeline(idx, idx - 1)}
                              className="btn sm"
                              style={{ width: '26px', padding: 0, justifyContent: 'center' }}
                              title="Mover para cima"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === macroPipeline.length - 1}
                              onClick={() => handleMoveMacroInPipeline(idx, idx + 1)}
                              className="btn sm"
                              style={{ width: '26px', padding: 0, justifyContent: 'center' }}
                              title="Mover para baixo"
                            >
                              <ArrowDown size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMacroFromPipeline(idx)}
                              className="btn sm danger"
                              style={{ width: '26px', padding: 0, justifyContent: 'center' }}
                              title="Remover etapa"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Configuração de Rota para Mover LT10 */}
                        {step.actionType === 'mover_lt10' && (
                          <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center gap-2 flex-wrap text-xs">
                            <span className="text-[11px] text-[var(--text-3)]">Destino LT10:</span>
                            <div className="seg">
                              {PREDEFINED_MOVER_ROUTES.map((route) => {
                                const isCurrentRoute = (step.routeId || 'pes_pesagem') === route.id;
                                return (
                                  <button
                                    key={route.id}
                                    type="button"
                                    onClick={() => handleUpdateStepRoute(step.id, route.id)}
                                    className={cn("mono text-[11px]", isCurrentRoute && "on")}
                                  >
                                    {route.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Adicionar Ação ao Pipeline */}
              <div className="pt-2 border-t border-[var(--border)]">
                <span className="text-[11px] text-[var(--text-3)] block mb-1.5">
                  Adicionar ação ao pipeline:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_MACROS.map((macro) => (
                    <button
                      key={macro.type}
                      type="button"
                      onClick={() => handleAddMacroToPipeline(macro.type)}
                      className="btn sm"
                    >
                      <Plus size={11} />
                      <span>{macro.shortLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Aviso Informativo Sóbrio */}
            <div className="flex items-center gap-2 p-2.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--text-3)]">
              <span className="dot" style={{ background: 'var(--amber)' }} />
              <span>
                Certifique-se de que o SAP GUI está com a sessão aberta e o Planilha Sync conectado na estação.
              </span>
            </div>
          </div>

          {/* Rodapé Padrão com no máximo 1 botão primary */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
            <span className="text-xs text-[var(--text-3)] mono">
              {macroPipeline.length} etapa(s) no fluxo
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBloquearMigoOpen(false)}
                className="btn sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteMacroPipeline}
                disabled={
                  macroPipeline.length === 0 ||
                  isBloquearMigoRunning ||
                  (macroPipeline.some((m) => m.actionType === 'bloquear_migo' || m.actionType === 'desbloquear_migo') &&
                    (bloquearSelectedItems.length === 0 ||
                      bloquearSelectedItems.some((it) => !it.material || !it.lote || !it.quantidade)))
                }
                className="btn primary sm"
              >
                {isBloquearMigoRunning ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Executando no SAP…</span>
                  </>
                ) : (
                  <>
                    <Play size={12} />
                    <span>Executar no SAP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
