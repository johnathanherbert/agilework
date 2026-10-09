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
  Layers 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isRunning) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl w-full p-0 overflow-hidden bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0 bg-[var(--surface)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]">
                <Layers size={15} />
              </span>
              <DialogTitle className="text-sm font-semibold tracking-tight text-[var(--text)]">
                Execução SAP &amp; Pipeline de Macros
              </DialogTitle>
              <span className="font-mono text-[11px] text-[var(--text-3)]">
                ({selectedItems.length} {selectedItems.length === 1 ? 'lote' : 'lotes'})
              </span>
            </div>
            <p className="text-xs text-[var(--text-3)] mt-0.5 ml-[29px]">
              Automação em lote via MIGO / LT10 integrada ao Planilha Sync
            </p>
          </div>
        </DialogHeader>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-[13px]">
          {/* Seletor Segmentado de Operação Base */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-medium text-[var(--text-2)]">Operação no MIGO:</span>
            <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)] divide-x divide-[var(--border-strong)]">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => handleToggleMigoMode('bloquear')}
                className={cn(
                  "py-1 px-3 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
                  !macroPipeline.some((m) => m.actionType === 'desbloquear_migo')
                    ? "bg-[var(--hover)] text-[var(--text)] font-semibold"
                    : "text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[var(--surface)]"
                )}
              >
                <span className="w-2 h-2 rounded-full bg-[var(--amber)] shrink-0" />
                <span>Bloquear saldo (Y84)</span>
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => handleToggleMigoMode('desbloquear')}
                className={cn(
                  "py-1 px-3 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
                  macroPipeline.some((m) => m.actionType === 'desbloquear_migo')
                    ? "bg-[var(--hover)] text-[var(--text)] font-semibold"
                    : "text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[var(--surface)]"
                )}
              >
                <span className="w-2 h-2 rounded-full bg-[var(--green)] shrink-0" />
                <span>Desbloquear saldo (Y83)</span>
              </button>
            </div>
          </div>

          {/* Seção 1: Dados dos Lotes Selecionados */}
          <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface-2)] overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--border)] bg-[var(--surface)] text-xs">
              <span className="font-medium text-[var(--text-2)]">
                {selectedItems.length === 1 ? 'Parâmetros do lote' : 'Lotes a processar'}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-3)]">
                Dep. origem: {selectedItems[0]?.depositoOrigem || 'PES'}
              </span>
            </div>

            {selectedItems.length === 1 ? (
              <div className="p-3.5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="block text-[11px] text-[var(--text-3)] mb-1">Código SAP</span>
                    <span className="font-mono font-medium text-xs text-[var(--text)]">
                      {selectedItems[0]?.material}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-[11px] text-[var(--text-3)] mb-1">Descrição do material</span>
                    <span className="text-xs text-[var(--text-2)] truncate block" title={selectedItems[0]?.descricao}>
                      {selectedItems[0]?.descricao || '—'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--border)]">
                  <div>
                    <span className="block text-[11px] text-[var(--text-3)] mb-1">Lote</span>
                    <span className="font-mono font-medium text-xs text-[var(--text)]">
                      {selectedItems[0]?.lote}
                    </span>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-3)] mb-1">
                      Quantidade
                    </label>
                    <input
                      type="text"
                      disabled={isRunning}
                      value={selectedItems[0]?.quantidade ?? ''}
                      onChange={(e) => handleUpdateSingleItem('quantidade', e.target.value)}
                      className="h-7 w-full px-2 font-mono text-xs border border-[var(--border-strong)] rounded bg-[var(--bg)] text-[var(--text)] focus:border-[var(--accent)] outline-none"
                      placeholder="0,000"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-3)] mb-1">
                      Unidade (UMB)
                    </label>
                    <input
                      type="text"
                      disabled={isRunning}
                      value={selectedItems[0]?.unidade ?? ''}
                      onChange={(e) => handleUpdateSingleItem('unidade', e.target.value.toUpperCase())}
                      className="h-7 w-full px-2 font-mono text-xs uppercase border border-[var(--border-strong)] rounded bg-[var(--bg)] text-[var(--text)] focus:border-[var(--accent)] outline-none"
                      placeholder="KG"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-[11px] font-semibold text-[var(--text-3)] uppercase text-left">
                      <th className="p-2 font-mono">Material</th>
                      <th className="p-2">Descrição</th>
                      <th className="p-2 font-mono">Lote</th>
                      <th className="p-2 text-right font-mono">Quantidade</th>
                      <th className="p-2">UMB</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs divide-y divide-[var(--border)]">
                    {selectedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[var(--hover)]">
                        <td className="p-2 font-medium text-[var(--text)]">{item.material}</td>
                        <td className="p-2 font-sans text-[var(--text-2)] text-[12px] truncate max-w-[200px]" title={item.descricao}>
                          {item.descricao || '—'}
                        </td>
                        <td className="p-2 text-[var(--text-2)]">{item.lote}</td>
                        <td className="p-2 text-right font-medium text-[var(--text)]">{item.quantidade}</td>
                        <td className="p-2 text-[var(--text-3)]">{item.unidade}</td>
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
                <span className="font-mono text-[11px] text-[var(--text-3)]">
                  ({macroPipeline.length} {macroPipeline.length === 1 ? 'etapa' : 'etapas'})
                </span>
              </div>

              {/* Predefinições Rápidas */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-[var(--text-3)]">Predefinições:</span>
                <div className="flex border border-[var(--border-strong)] rounded-[var(--radius)] overflow-hidden bg-[var(--bg)] divide-x divide-[var(--border-strong)]">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleApplyMacroPreset(['bloquear_migo', 'mover_lt10', 'atualizar_db'])}
                    className="py-0.5 px-2 text-[11px] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                    title="Bloquear MIGO ➔ Mover (/nlt10) ➔ Atualizar Base"
                  >
                    Completo
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleApplyMacroPreset(['mover_lt10', 'atualizar_db'])}
                    className="py-0.5 px-2 text-[11px] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                    title="Mover (/nlt10) ➔ Atualizar Base"
                  >
                    Mover + DB
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleApplyMacroPreset(['bloquear_migo', 'atualizar_db'])}
                    className="py-0.5 px-2 text-[11px] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                    title="Bloquear MIGO ➔ Atualizar Base"
                  >
                    Bloquear + DB
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleApplyMacroPreset(['desbloquear_migo', 'atualizar_db'])}
                    className="py-0.5 px-2 text-[11px] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
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
                <div className="p-4 text-center text-xs text-[var(--text-3)] border border-dashed border-[var(--border)] rounded-[var(--radius)]">
                  Nenhuma etapa no pipeline. Adicione uma ação abaixo.
                </div>
              ) : (
                macroPipeline.map((step, idx) => {
                  const macroDef = AVAILABLE_MACROS.find((m) => m.type === step.actionType);
                  if (!macroDef) return null;

                  const isCurrentRunning = isRunning && runningStepIndex === idx;
                  const isDone = completedSteps.includes(idx);
                  const isFailed = stepError?.stepIndex === idx;

                  return (
                    <div
                      key={step.id}
                      draggable={!isRunning}
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
                        isCurrentRunning && "border-[var(--accent)] bg-[var(--accent-weak)]/20",
                        isDone && "border-[var(--green)] bg-[var(--green-weak)]/10",
                        isFailed && "border-[var(--red)] bg-[var(--red-weak)]/20",
                        draggedMacroIndex === idx && "opacity-50 border-[var(--accent)]",
                        !isCurrentRunning && !isDone && !isFailed && "border-[var(--border)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-[11px] text-[var(--text-3)] w-4 text-center select-none">
                            {idx + 1}.
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
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
                              {isCurrentRunning && (
                                <Loader2 size={12} className="animate-spin text-[var(--accent)]" />
                              )}
                              {isDone && (
                                <Check size={12} className="text-[var(--green)]" />
                              )}
                              {isFailed && (
                                <AlertCircle size={12} className="text-[var(--red)]" />
                              )}
                            </div>
                            <span className="text-[11px] text-[var(--text-3)] block mt-0.5 truncate">
                              {macroDef.description}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={isRunning || idx === 0}
                            onClick={() => handleMoveMacroInPipeline(idx, idx - 1)}
                            className="p-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] hover:text-[var(--text)] disabled:opacity-30 transition-opacity cursor-pointer"
                            title="Mover para cima"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={isRunning || idx === macroPipeline.length - 1}
                            onClick={() => handleMoveMacroInPipeline(idx, idx + 1)}
                            className="p-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] hover:text-[var(--text)] disabled:opacity-30 transition-opacity cursor-pointer"
                            title="Mover para baixo"
                          >
                            <ChevronDown size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => handleRemoveMacroFromPipeline(idx)}
                            className="p-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] hover:text-[var(--red)] disabled:opacity-30 transition-colors cursor-pointer"
                            title="Remover etapa"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Configuração de Rota para /nlt10 */}
                      {step.actionType === 'mover_lt10' && (
                        <div className="mt-2.5 pt-2 border-t border-[var(--border)] flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-[11px] text-[var(--text-3)]">Rota de transferência:</span>
                          <select
                            disabled={isRunning}
                            value={step.routeId || 'pes_pesagem'}
                            onChange={(e) => handleUpdateStepRoute(step.id, e.target.value)}
                            className="h-6 px-2 text-xs border border-[var(--border-strong)] rounded bg-[var(--surface)] text-[var(--text)] focus:border-[var(--accent)] outline-none"
                          >
                            {PREDEFINED_MOVER_ROUTES.map((route) => (
                              <option key={route.id} value={route.id}>
                                {route.label} ({route.description})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Adicionar Ação ao Pipeline */}
            <div className="pt-2 border-t border-[var(--border)] flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[var(--text-3)]">Adicionar ação:</span>
              {AVAILABLE_MACROS.map((macro) => (
                <button
                  key={macro.type}
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleAddMacroToPipeline(macro.type)}
                  className="h-6 px-2 text-[11px] font-medium border border-[var(--border-strong)] rounded bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <Plus size={10} />
                  <span>{macro.shortLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Log de Execução ao Vivo */}
          {executionLog.length > 0 && (
            <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface-2)] p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text)]">
                <span>Registro de Execução</span>
                {isRunning && (
                  <span className="flex items-center gap-1.5 text-[var(--accent)] text-[11px] font-normal">
                    <Loader2 size={11} className="animate-spin" />
                    Processando no SAP...
                  </span>
                )}
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto font-mono text-[11px]">
                {executionLog.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[var(--text-3)] shrink-0">{log.timestamp}</span>
                    <span className="font-semibold text-[var(--text-2)] shrink-0">[{log.stepLabel}]</span>
                    <span
                      className={cn(
                        "flex-1",
                        log.status === 'ok' && "text-[var(--green)]",
                        log.status === 'error' && "text-[var(--red)] font-medium",
                        log.status === 'running' && "text-[var(--accent)]"
                      )}
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-2)] shrink-0">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onOpenChange(false)}
            className="h-8 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors cursor-pointer disabled:opacity-40"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={
              isRunning ||
              macroPipeline.length === 0 ||
              selectedItems.length === 0 ||
              selectedItems.some((it) => !it.material || !it.lote || !it.quantidade)
            }
            onClick={handleExecutePipeline}
            className="h-8 px-4 rounded-[var(--radius)] bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-sm"
          >
            {isRunning ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Executando etapa {(runningStepIndex ?? 0) + 1} de {macroPipeline.length}...</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>Executar Pipeline ({macroPipeline.length} {macroPipeline.length === 1 ? 'etapa' : 'etapas'})</span>
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SapPipelineModal;
