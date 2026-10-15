"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { 
  X, 
  Play, 
  Check, 
  AlertCircle, 
  ChevronUp, 
  ChevronDown, 
  Plus, 
  Trash2, 
  Loader2, 
  Layers,
  GripVertical,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { triggerSapAutomation, checkSapAutomationStatus } from "@/lib/dashpesagem-api";
import { cn } from "@/lib/utils";

export interface BloquearItemParam {
  material: string;
  lote: string;
  quantidade: string;
  unidade: string;
  depositoOrigem?: string;
  descricao?: string;
  centro?: string;
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

  const lgobeLines = items.map((item, idx) => {
    const dep = (item.depositoOrigem || 'PES').trim().toUpperCase();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-LGOBE[12,${idx}]").text = "${dep}"`;
  }).join('\n');

  const name1Lines = items.map((item, idx) => {
    const cen = (item.centro || '600').trim();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-NAME1[9,${idx}]").text = "${cen}"`;
  }).join('\n');

  const umlgobeLines = items.map((item, idx) => {
    const dep = (item.depositoOrigem || 'PES').trim().toUpperCase();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-UMLGOBE[14,${idx}]").text = "${dep}"`;
  }).join('\n');

  const grundLines = items.map((_, idx) => {
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-GRUND[15,${idx}]").text = "9000"`;
  }).join('\n');

  const validateGrid = `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,0]").setFocus
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,0]").caretPosition = 0
session.findById("wnd[0]").sendVKey 0`;

  const chargLines = items.map((item, idx) => {
    const lote = item.lote.trim();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-CHARG[2,${idx}]").text = "${lote}"`;
  }).join('\n');

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

  const lgobeLines = items.map((item, idx) => {
    const dep = (item.depositoOrigem || 'PES').trim().toUpperCase();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-LGOBE[12,${idx}]").text = "${dep}"`;
  }).join('\n');

  const name1Lines = items.map((item, idx) => {
    const cen = (item.centro || '600').trim();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-NAME1[9,${idx}]").text = "${cen}"`;
  }).join('\n');

  const umlgobeLines = items.map((item, idx) => {
    const dep = (item.depositoOrigem || 'PES').trim().toUpperCase();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-UMLGOBE[14,${idx}]").text = "${dep}"`;
  }).join('\n');

  const validateGrid = `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,0]").setFocus
session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-MAKTX[1,0]").caretPosition = 0
session.findById("wnd[0]").sendVKey 0`;

  const chargLines = items.map((item, idx) => {
    const lote = item.lote.trim();
    return `session.findById("wnd[0]/usr/ssubSUB_MAIN_CARRIER:SAPLMIGO:0008/subSUB_ITEMLIST:SAPLMIGO:0200/tblSAPLMIGOTV_GOITEM/ctxtGOITEM-CHARG[2,${idx}]").text = "${lote}"`;
  }).join('\n');

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

export function generateDevolverVbs(
  items: Array<{ material: string; lote: string; quantidade: string; volume?: string; depositoOrigem?: string }>
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

  const matnrLines = items.map((item, idx) => {
    const cleanMat = item.material.trim();
    return `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-MATNR[0,${idx}]").text = "${cleanMat}"`;
  }).join('\n');

  const chargLines = items.map((item, idx) => {
    const cleanLote = item.lote.trim();
    return `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/ctxtT_ZWMTB296I-CHARG[1,${idx}]").text = "${cleanLote}"`;
  }).join('\n');

  const mengeLines = items.map((item, idx) => {
    const cleanQtd = item.quantidade.trim().replace('.', ',');
    return `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-MENGE[2,${idx}]").text = "${cleanQtd}"`;
  }).join('\n');

  const mengeVolLines = items.map((item, idx) => {
    const cleanVol = (item.volume || '1').trim().replace('.', ',');
    return `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-MENGE_VOL[4,${idx}]").text = "${cleanVol}"`;
  }).join('\n');

  const palletLines = items.map((_, idx) => {
    return `session.findById("wnd[0]/usr/tblSAPMZ_296TC_ITEM/txtT_ZWMTB296I-PALLET[5,${idx}]").text = "1"`;
  }).join('\n');

  const lastIdx = items.length - 1;
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

export interface SapPipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BloquearItemParam[];
  currentUserEmail?: string;
  initialPreset?: MacroActionType[];
  onSuccess?: () => void;
  onItemsChange?: (updatedItems: BloquearItemParam[]) => void;
}

/* ============================================================================
 * Apenas apresentação — nada abaixo altera geração de VBS ou execução
 * ========================================================================== */

const STEP_COLOR: Record<MacroActionType, string> = {
  bloquear_migo: 'var(--amber)',
  desbloquear_migo: 'var(--green)',
  mover_lt10: 'var(--accent)',
  mover_ajuste: 'var(--text-3)',
  atualizar_db: 'var(--text-3)',
  devolver: 'var(--text-3)',
};

const UI_PRESETS: Array<{ label: string; types: MacroActionType[] }> = [
  { label: 'Completo', types: ['bloquear_migo', 'mover_lt10', 'atualizar_db'] },
  { label: 'Mover + DB', types: ['mover_lt10', 'atualizar_db'] },
  { label: 'Bloquear + DB', types: ['bloquear_migo', 'atualizar_db'] },
  { label: 'Desbloquear + DB', types: ['desbloquear_migo', 'atualizar_db'] },
];

function shortLabelOf(type: MacroActionType): string {
  return AVAILABLE_MACROS.find((m) => m.type === type)?.shortLabel || type;
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-2">
      <h3 className="text-[13px] font-medium text-[var(--text)]">{children}</h3>
      {right && <div className="text-[11px] text-[var(--text-3)]">{right}</div>}
    </div>
  );
}

export const SapPipelineModal: React.FC<SapPipelineModalProps> = ({
  open,
  onOpenChange,
  items: initialItems,
  currentUserEmail = 'Web Pesagem',
  initialPreset = ['bloquear_migo'],
  onSuccess,
  onItemsChange,
}) => {
  const [selectedItems, setSelectedItems] = useState<BloquearItemParam[]>(initialItems);
  const [macroPipeline, setMacroPipeline] = useState<MacroActionItem[]>([]);
  const [draggedMacroIndex, setDraggedMacroIndex] = useState<number | null>(null);

  // Execução
  const [isRunning, setIsRunning] = useState(false);
  const [runningStepIndex, setRunningStepIndex] = useState<number | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [stepError, setStepError] = useState<{ stepIndex: number; message: string } | null>(null);
  const [executionLog, setExecutionLog] = useState<Array<{ stepLabel: string; status: 'ok' | 'error' | 'running'; message: string; timestamp: string }>>([]);

  // UI (somente visual)
  const [showAddMenu, setShowAddMenu] = useState(false);

  const prevOpenRef = useRef(false);

  useEffect(() => {
    setSelectedItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setIsRunning(false);
      setRunningStepIndex(null);
      setCompletedSteps([]);
      setStepError(null);
      setExecutionLog([]);
      setShowAddMenu(false);
      setMacroPipeline(
        initialPreset.map((actionType, i) => ({
          id: `${actionType}-${Date.now()}-${i}`,
          actionType,
          routeId: actionType === 'mover_lt10' ? 'pes_pesagem' : undefined,
        }))
      );
    }
    prevOpenRef.current = open;
  }, [open, initialPreset]);

  const handleUpdateSingleItem = (field: keyof BloquearItemParam, value: string) => {
    setSelectedItems((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[0] = { ...updated[0], [field]: value };
      onItemsChange?.(updated);
      return updated;
    });
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

  const handleExecutePipeline = async () => {
    if (macroPipeline.length === 0) {
      toast.error('Adicione ao menos uma ação ao pipeline');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Nenhum lote selecionado');
      return;
    }

    setIsRunning(true);
    setCompletedSteps([]);
    setStepError(null);
    setExecutionLog([]);

    const timestamp = () => new Date().toLocaleTimeString('pt-BR');

    for (let i = 0; i < macroPipeline.length; i++) {
      const step = macroPipeline[i];
      const macroDef = AVAILABLE_MACROS.find((m) => m.type === step.actionType);
      const stepLabel = macroDef?.shortLabel || step.actionType;

      setRunningStepIndex(i);
      setExecutionLog((prev) => [
        ...prev,
        { stepLabel, status: 'running', message: 'Enviando comando para o SAP...', timestamp: timestamp() },
      ]);

      let result: { success: boolean; message?: string } = { success: false };

      try {
        if (step.actionType === 'bloquear_migo') {
          const vbsCode = generateBloquearMigoVbs(selectedItems);
          const timeout = Math.max(60, selectedItems.length * 20);
          result = await executeSapJobAndWait('bloquear_migo', currentUserEmail, vbsCode, timeout);
        } else if (step.actionType === 'desbloquear_migo') {
          const vbsCode = generateDesbloquearMigoVbs(selectedItems);
          const timeout = Math.max(60, selectedItems.length * 20);
          result = await executeSapJobAndWait('desbloquear_migo', currentUserEmail, vbsCode, timeout);
        } else if (step.actionType === 'mover_lt10') {
          const route = PREDEFINED_MOVER_ROUTES.find((r) => r.id === (step.routeId || 'pes_pesagem')) || {
            tipo: step.customTipo || 'pes',
            posicao: step.customPosicao || 'pesagem',
          };
          const moverParams: MoverItemParam[] = selectedItems.map((it) => ({
            material: it.material,
            descricao: it.descricao,
            lote: it.lote,
            quantidade: it.quantidade,
            unidade: it.unidade,
            depositoOrigem: it.depositoOrigem || 'PES',
          }));
          const vbsCode = generateMoverLt10Vbs(moverParams, route);
          const timeout = Math.max(60, selectedItems.length * 20);
          result = await executeSapJobAndWait('mover_lt10', currentUserEmail, vbsCode, timeout);
        } else if (step.actionType === 'mover_ajuste') {
          result = await executeSapJobAndWait('movermigo', currentUserEmail, undefined, 180);
        } else if (step.actionType === 'atualizar_db') {
          result = await executeSapJobAndWait('extrair_relatorio', currentUserEmail, undefined, 180);
        } else if (step.actionType === 'devolver') {
          const vbsCode = generateDevolverVbs(selectedItems);
          result = await executeSapJobAndWait('devolver_zwm296', currentUserEmail, vbsCode, 120);
        }
      } catch (err: any) {
        result = { success: false, message: err?.message || 'Erro inesperado na execução' };
      }

      if (result.success) {
        setCompletedSteps((prev) => [...prev, i]);
        setExecutionLog((prev) =>
          prev.map((log, idx) =>
            idx === prev.length - 1
              ? { ...log, status: 'ok', message: result.message || 'Executado com sucesso no SAP' }
              : log
          )
        );
      } else {
        setStepError({ stepIndex: i, message: result.message || 'Falha na execução desta etapa' });
        setExecutionLog((prev) =>
          prev.map((log, idx) =>
            idx === prev.length - 1
              ? { ...log, status: 'error', message: result.message || 'Erro na execução' }
              : log
          )
        );
        setIsRunning(false);
        setRunningStepIndex(null);
        toast.error(`Falha na etapa ${i + 1} (${stepLabel}): ${result.message}`);
        return;
      }
    }

    setIsRunning(false);
    setRunningStepIndex(null);
    toast.success('Pipeline SAP executado com sucesso completo!');

    if (onSuccess) {
      onSuccess();
    }
  };

  /* ---------------------------- Derivados de UI ---------------------------- */

  const totalSteps = macroPipeline.length;
  const migoMode: 'bloquear' | 'desbloquear' | null = macroPipeline.some((m) => m.actionType === 'desbloquear_migo')
    ? 'desbloquear'
    : macroPipeline.some((m) => m.actionType === 'bloquear_migo')
    ? 'bloquear'
    : null;

  const origens = Array.from(new Set(selectedItems.map((it) => (it.depositoOrigem || 'PES').toUpperCase())));
  const origemLabel = origens.length <= 1 ? (origens[0] || 'PES') : `${origens.length} depósitos`;
  const materiaisCount = new Set(selectedItems.map((it) => it.material)).size;
  const hasInvalidItem = selectedItems.some((it) => !it.material || !it.lote || !it.quantidade);
  const canRun = !isRunning && totalSteps > 0 && selectedItems.length > 0 && !hasInvalidItem;

  const finishedOk = !isRunning && !stepError && totalSteps > 0 && completedSteps.length === totalSteps;
  const hasRun = executionLog.length > 0;
  const progressPct = totalSteps > 0 ? (completedSteps.length / totalSteps) * 100 : 0;
  const lastLogTime = executionLog[executionLog.length - 1]?.timestamp;

  const activePreset = UI_PRESETS.find(
    (p) => p.types.length === totalSteps && p.types.every((t, i) => macroPipeline[i]?.actionType === t)
  )?.label;

  const lotesLabel = `${selectedItems.length} ${selectedItems.length === 1 ? 'lote' : 'lotes'}`;
  const etapasLabel = `${totalSteps} ${totalSteps === 1 ? 'etapa' : 'etapas'}`;

  let footerStatus: { dot: string; text: string } = { dot: 'var(--text-3)', text: 'Pronto para executar' };
  if (isRunning) {
    const cur = runningStepIndex !== null ? macroPipeline[runningStepIndex] : undefined;
    footerStatus = {
      dot: 'var(--accent)',
      text: `Etapa ${(runningStepIndex ?? 0) + 1} de ${totalSteps}${cur ? ` · ${shortLabelOf(cur.actionType)}` : ''}`,
    };
  } else if (stepError) {
    footerStatus = { dot: 'var(--red)', text: `Parou na etapa ${stepError.stepIndex + 1} · ${completedSteps.length} de ${totalSteps} concluídas` };
  } else if (finishedOk) {
    footerStatus = { dot: 'var(--green)', text: `Concluído${lastLogTime ? ` às ${lastLogTime}` : ''}` };
  } else if (hasInvalidItem) {
    footerStatus = { dot: 'var(--amber)', text: 'Lote sem material, número ou quantidade' };
  } else if (totalSteps === 0) {
    footerStatus = { dot: 'var(--amber)', text: 'Nenhuma etapa no pipeline' };
  }

  const inputCls =
    "h-10 sm:h-8 w-full px-2.5 font-mono text-[13px] sm:text-xs border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] text-[var(--text)] focus:border-[var(--accent)] outline-none transition-colors disabled:opacity-50";

  const iconBtnCls =
    "h-8 w-8 sm:h-6 sm:w-6 inline-flex items-center justify-center rounded text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] disabled:opacity-25 disabled:hover:bg-transparent transition-colors cursor-pointer";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isRunning) onOpenChange(o); }}>
      <DialogContent className="max-w-xl w-[calc(100vw-1rem)] sm:w-full p-0 gap-0 overflow-hidden bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xl flex flex-col max-h-[92vh]">
        {/* ───────────── Cabeçalho ───────────── */}
        <DialogHeader className="px-5 pt-4 pb-3 pr-12 border-b border-[var(--border)] shrink-0 text-left space-y-0.5">
          <DialogTitle className="text-[15px] font-semibold tracking-tight text-[var(--text)] flex items-center gap-2">
            <Layers size={15} className="text-[var(--text-3)]" />
            Pipeline SAP
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--text-3)]">
            {lotesLabel} · origem <span className="font-mono text-[var(--text-2)]">{origemLabel}</span> · executa via Planilha Sync
          </DialogDescription>
        </DialogHeader>

        {/* ───────────── Corpo ───────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 text-[13px]">
          {/* Lotes */}
          <section>
            <SectionTitle right={selectedItems.length > 1 ? `${materiaisCount} ${materiaisCount === 1 ? 'material' : 'materiais'}` : undefined}>
              {selectedItems.length === 1 ? 'Lote' : `Lotes (${selectedItems.length})`}
            </SectionTitle>

            {selectedItems.length === 0 ? (
              <p className="text-xs text-[var(--text-3)]">Nenhum lote selecionado.</p>
            ) : selectedItems.length === 1 ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-lg font-semibold leading-tight text-[var(--text)]">
                      {selectedItems[0]?.lote || '—'}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--text-2)] truncate" title={selectedItems[0]?.descricao}>
                      <span className="font-mono text-[var(--text)]">{selectedItems[0]?.material}</span>
                      {selectedItems[0]?.descricao ? <span className="text-[var(--text-3)]"> · {selectedItems[0]?.descricao}</span> : null}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-2)]">
                    {(selectedItems[0]?.depositoOrigem || 'PES').toUpperCase()}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-[1fr_96px] gap-2">
                  <label className="block">
                    <span className="block text-[11px] text-[var(--text-3)] mb-1">Quantidade</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={isRunning}
                      value={selectedItems[0]?.quantidade ?? ''}
                      onChange={(e) => handleUpdateSingleItem('quantidade', e.target.value)}
                      className={inputCls}
                      placeholder="0,000"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] text-[var(--text-3)] mb-1">Unidade</span>
                    <input
                      type="text"
                      disabled={isRunning}
                      value={selectedItems[0]?.unidade ?? ''}
                      onChange={(e) => handleUpdateSingleItem('unidade', e.target.value.toUpperCase())}
                      className={cn(inputCls, "uppercase")}
                      placeholder="KG"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <ul className="max-h-48 overflow-y-auto border-y border-[var(--border)] divide-y divide-[var(--border)]">
                {selectedItems.map((item, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-medium text-[var(--text)]">{item.lote}</div>
                      <div className="text-[11px] text-[var(--text-3)] truncate" title={item.descricao}>
                        <span className="font-mono">{item.material}</span>
                        {item.descricao ? ` · ${item.descricao}` : ''}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-xs">
                      <span className="font-medium text-[var(--text)]">{item.quantidade || '—'}</span>
                      <span className="ml-1 text-[var(--text-3)]">{item.unidade}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Operação MIGO */}
          <section>
            <SectionTitle right={migoMode === null ? 'sem etapa MIGO' : undefined}>Operação no MIGO</SectionTitle>
            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border)]">
              {([
                { mode: 'bloquear' as const, label: 'Bloquear saldo', code: 'Y84', color: 'var(--amber)' },
                { mode: 'desbloquear' as const, label: 'Desbloquear saldo', code: 'Y83', color: 'var(--green)' },
              ]).map((opt) => {
                const active = migoMode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleToggleMigoMode(opt.mode)}
                    className={cn(
                      "h-10 sm:h-8 px-3 rounded-[calc(var(--radius)-2px)] text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50",
                      active
                        ? "bg-[var(--surface)] text-[var(--text)] font-medium shadow-sm"
                        : "text-[var(--text-3)] hover:text-[var(--text-2)]"
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.color, opacity: active ? 1 : 0.5 }} />
                    {opt.label}
                    <span className="font-mono text-[11px] text-[var(--text-3)]">{opt.code}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Pipeline */}
          <section>
            <SectionTitle right={etapasLabel}>Etapas</SectionTitle>

            {/* Predefinições */}
            <div className="flex items-center gap-1 flex-wrap mb-3">
              {UI_PRESETS.map((p) => {
                const active = activePreset === p.label;
                return (
                  <button
                    key={p.label}
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleApplyMacroPreset(p.types)}
                    title={p.types.map(shortLabelOf).join(' → ')}
                    className={cn(
                      "h-8 sm:h-6 px-2.5 rounded-full text-[11px] border transition-colors cursor-pointer disabled:opacity-40",
                      active
                        ? "border-[var(--text-3)] text-[var(--text)] bg-[var(--hover)]"
                        : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {totalSteps === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--text-3)] border border-dashed border-[var(--border)] rounded-[var(--radius)]">
                Nenhuma etapa. Escolha uma predefinição ou adicione abaixo.
              </p>
            ) : (
              <ol>
                {macroPipeline.map((step, idx) => {
                  const macroDef = AVAILABLE_MACROS.find((m) => m.type === step.actionType);
                  if (!macroDef) return null;

                  const isCurrentRunning = isRunning && runningStepIndex === idx;
                  const isDone = completedSteps.includes(idx);
                  const isFailed = stepError?.stepIndex === idx;
                  const isLast = idx === totalSteps - 1;
                  const route = step.actionType === 'mover_lt10'
                    ? PREDEFINED_MOVER_ROUTES.find((r) => r.id === (step.routeId || 'pes_pesagem'))
                    : undefined;

                  return (
                    <li
                      key={step.id}
                      draggable={!isRunning}
                      onDragStart={() => setDraggedMacroIndex(idx)}
                      onDragEnd={() => setDraggedMacroIndex(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedMacroIndex !== null && draggedMacroIndex !== idx) {
                          handleMoveMacroInPipeline(draggedMacroIndex, idx);
                          setDraggedMacroIndex(null);
                        }
                      }}
                      className={cn(
                        "group relative flex gap-3 rounded-[var(--radius)] -mx-2 px-2 transition-colors",
                        !isLast && "pb-1",
                        draggedMacroIndex === idx && "opacity-40",
                        !isRunning && "hover:bg-[var(--hover)]/50"
                      )}
                    >
                      {/* Trilho */}
                      {!isLast && (
                        <span
                          aria-hidden
                          className="absolute left-[19px] top-[30px] bottom-[-2px] w-px"
                          style={{ background: isDone ? 'var(--green)' : 'var(--border)' }}
                        />
                      )}

                      {/* Marcador */}
                      <span
                        className={cn(
                          "relative z-10 mt-2 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border font-mono text-[11px] bg-[var(--surface)]",
                          isCurrentRunning && "border-[var(--accent)] text-[var(--accent)]",
                          isDone && "border-[var(--green)] bg-[var(--green)] text-white",
                          isFailed && "border-[var(--red)] text-[var(--red)]",
                          !isCurrentRunning && !isDone && !isFailed && "border-[var(--border-strong)] text-[var(--text-3)]"
                        )}
                      >
                        {isCurrentRunning ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : isDone ? (
                          <Check size={12} strokeWidth={3} />
                        ) : isFailed ? (
                          <AlertCircle size={12} />
                        ) : (
                          idx + 1
                        )}
                      </span>

                      <div className="min-w-0 flex-1 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STEP_COLOR[step.actionType] }} />
                              <span className={cn("text-[13px] font-medium", isFailed ? "text-[var(--red)]" : "text-[var(--text)]")}>
                                {macroDef.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--text-3)] mt-0.5 truncate">{macroDef.description}</p>
                          </div>

                          {!isRunning && (
                            <div className="flex items-center shrink-0 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <span className="hidden sm:inline-flex h-6 w-5 items-center justify-center text-[var(--text-3)] cursor-grab" title="Arraste para reordenar">
                                <GripVertical size={12} />
                              </span>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveMacroInPipeline(idx, idx - 1)}
                                className={iconBtnCls}
                                title="Mover para cima"
                              >
                                <ChevronUp size={13} />
                              </button>
                              <button
                                type="button"
                                disabled={isLast}
                                onClick={() => handleMoveMacroInPipeline(idx, idx + 1)}
                                className={iconBtnCls}
                                title="Mover para baixo"
                              >
                                <ChevronDown size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveMacroFromPipeline(idx)}
                                className={cn(iconBtnCls, "hover:text-[var(--red)]")}
                                title="Remover etapa"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Rota /nlt10 */}
                        {step.actionType === 'mover_lt10' && (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <select
                              disabled={isRunning}
                              value={step.routeId || 'pes_pesagem'}
                              onChange={(e) => handleUpdateStepRoute(step.id, e.target.value)}
                              className="h-9 sm:h-7 pl-2 pr-6 text-xs border border-[var(--border-strong)] rounded-[var(--radius)] bg-[var(--bg)] text-[var(--text)] focus:border-[var(--accent)] outline-none disabled:opacity-50"
                              title={route?.description}
                            >
                              {PREDEFINED_MOVER_ROUTES.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--text-3)]">
                              {origemLabel}
                              <ArrowRight size={11} />
                              <span className="text-[var(--text-2)]">
                                {(route?.tipo || 'pes').toUpperCase()} · {(route?.posicao || 'pesagem').toUpperCase()}
                              </span>
                            </span>
                          </div>
                        )}

                        {isCurrentRunning && (
                          <p className="mt-1 text-[11px] text-[var(--accent)]">Executando no SAP…</p>
                        )}
                        {isFailed && stepError && (
                          <p className="mt-1 text-[11px] text-[var(--red)] break-words">{stepError.message}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {/* Adicionar etapa */}
            <div className="mt-2">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setShowAddMenu((v) => !v)}
                className="h-9 sm:h-7 px-2 -mx-2 inline-flex items-center gap-1.5 rounded text-xs text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer disabled:opacity-40"
              >
                <Plus size={13} className={cn("transition-transform", showAddMenu && "rotate-45")} />
                {showAddMenu ? 'Fechar' : 'Adicionar etapa'}
              </button>

              {showAddMenu && !isRunning && (
                <ul className="mt-1 border-y border-[var(--border)] divide-y divide-[var(--border)]">
                  {AVAILABLE_MACROS.map((macro) => (
                    <li key={macro.type}>
                      <button
                        type="button"
                        onClick={() => {
                          handleAddMacroToPipeline(macro.type);
                          setShowAddMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 py-2.5 sm:py-2 px-1 text-left hover:bg-[var(--hover)] transition-colors cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STEP_COLOR[macro.type] }} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-[var(--text)]">{macro.label}</span>
                          <span className="block text-[11px] text-[var(--text-3)] truncate">{macro.description}</span>
                        </span>
                        <Plus size={12} className="text-[var(--text-3)] shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Registro */}
          {hasRun && (
            <section>
              <SectionTitle right={isRunning ? 'ao vivo' : lastLogTime}>Registro</SectionTitle>
              <ul className="space-y-1.5 max-h-36 overflow-y-auto">
                {executionLog.map((log, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed">
                    <span
                      className={cn("mt-[6px] w-1.5 h-1.5 rounded-full shrink-0", log.status === 'running' && "animate-pulse")}
                      style={{
                        background:
                          log.status === 'ok' ? 'var(--green)' : log.status === 'error' ? 'var(--red)' : 'var(--accent)',
                      }}
                    />
                    <span className="font-mono text-[var(--text-3)] shrink-0">{log.timestamp}</span>
                    <span className="font-medium text-[var(--text-2)] shrink-0">{log.stepLabel}</span>
                    <span
                      className={cn(
                        "flex-1 min-w-0 break-words",
                        log.status === 'error' ? "text-[var(--red)]" : "text-[var(--text-3)]"
                      )}
                    >
                      {log.message}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ───────────── Rodapé ───────────── */}
        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]">
          {(isRunning || hasRun) && (
            <div className="h-0.5 w-full bg-[var(--border)]">
              <div
                className="h-full transition-[width] duration-500"
                style={{
                  width: `${stepError ? Math.max(progressPct, 4) : progressPct}%`,
                  background: stepError ? 'var(--red)' : finishedOk ? 'var(--green)' : 'var(--accent)',
                }}
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-5 py-3">
            <div className="flex items-center gap-2 text-xs text-[var(--text-2)] min-w-0">
              <span
                className={cn("w-1.5 h-1.5 rounded-full shrink-0", isRunning && "animate-pulse")}
                style={{ background: footerStatus.dot }}
              />
              <span className="truncate">{footerStatus.text}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => onOpenChange(false)}
                className="h-10 sm:h-8 px-3 flex-1 sm:flex-none rounded-[var(--radius)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer disabled:opacity-40"
              >
                {finishedOk ? 'Fechar' : 'Cancelar'}
              </button>

              <button
                type="button"
                disabled={!canRun}
                onClick={handleExecutePipeline}
                className="h-10 sm:h-8 px-4 flex-[2] sm:flex-none rounded-[var(--radius)] bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Executando {(runningStepIndex ?? 0) + 1}/{totalSteps}…</span>
                  </>
                ) : (
                  <>
                    <Play size={12} />
                    <span>
                      {stepError || finishedOk ? 'Executar de novo' : 'Executar'} · {etapasLabel} · {lotesLabel}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SapPipelineModal;
