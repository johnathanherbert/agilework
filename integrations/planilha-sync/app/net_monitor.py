"""
net_monitor.py — Monitor de conexão com a internet e reinicialização automática do SAP GUI.

Detecta com precisão quando a conexão de internet cai e, quando restabelecida, encerra
as sessões travadas/desconectadas do SAP GUI e reabre o SAP Logon apontando para o
arquivo de Landscape XML especificado, selecionando automaticamente o 3º item da lista.
"""

from __future__ import annotations

import logging
import os
import socket
import subprocess
import sys
import tempfile
import threading
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Callable, Optional, Tuple

logger = logging.getLogger(__name__)

# Servidores DNS ultraconfiáveis para teste rápido de socket TCP na porta 53
DNS_CHECK_HOSTS = [
    ("1.1.1.1", 53),
    ("8.8.8.8", 53),
    ("9.9.9.9", 53),
]


def is_internet_available(timeout: float = 1.5, fallback_http_url: Optional[str] = None) -> bool:
    """
    Testa conectividade real com a internet usando sockets TCP rápidos em portas DNS (53).
    Caso falhe, tenta requisição HTTP leve para fallback_http_url se fornecido.
    """
    for host, port in DNS_CHECK_HOSTS:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            sock.connect((host, port))
            sock.close()
            return True
        except (socket.timeout, OSError):
            continue

    if fallback_http_url:
        try:
            import urllib.request
            req = urllib.request.Request(
                fallback_http_url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status < 500:
                    return True
        except Exception:
            pass

    return False


def get_third_service_name_from_xml(landscape_xml_path: str, target_index: int = 3) -> Optional[str]:
    """
    Lê o arquivo SAPUILandscape XML e tenta extrair o nome do serviço correspondente
    ao índice solicitado (1-based, padrão: 3 para o 3º da lista de cima para baixo).
    """
    try:
        p = Path(landscape_xml_path)
        if not p.exists() or not p.is_file():
            return None

        tree = ET.parse(str(p))
        root = tree.getroot()

        # Dicionário de serviços por UUID: {uuid: name}
        services_by_uuid: dict[str, str] = {}
        for svc in root.findall(".//Service"):
            uuid_val = svc.attrib.get("uuid") or svc.attrib.get("systemid") or ""
            name_val = svc.attrib.get("name") or svc.attrib.get("description") or ""
            if uuid_val and name_val:
                services_by_uuid[uuid_val] = name_val

        # 1. Tenta pegar a ordem da Workspace principal
        items = root.findall(".//Workspaces/Workspace/Item")
        if items and len(items) >= target_index:
            target_item = items[target_index - 1]
            svc_id = target_item.attrib.get("serviceid")
            if svc_id and svc_id in services_by_uuid:
                return services_by_uuid[svc_id]
            if "name" in target_item.attrib:
                return target_item.attrib["name"]

        # 2. Tenta pegar da lista direta de Services
        direct_services = root.findall(".//Services/Service")
        if direct_services and len(direct_services) >= target_index:
            target_svc = direct_services[target_index - 1]
            return target_svc.attrib.get("name") or target_svc.attrib.get("description")

    except Exception as exc:
        logger.debug("Não foi possível extrair nome do 3º serviço do XML: %s", exc)

    return None


def kill_sap_processes() -> None:
    """
    Finaliza todas as instâncias existentes de saplogon, saplgpad e sapgui.
    """
    logger.info("[SAP_RESTART] Encerrando processos SAP existentes (saplogon, saplgpad, sapgui)...")
    if sys.platform == "win32":
        try:
            # taskkill força encerramento imediato de toda a árvore
            subprocess.run(
                ["taskkill", "/F", "/IM", "saplogon.exe", "/IM", "saplgpad.exe", "/IM", "sapgui.exe"],
                capture_output=True,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        except Exception as exc:
            logger.debug("[SAP_RESTART] Erro ao executar taskkill: %s", exc)
    else:
        logger.debug("[SAP_RESTART] Modo não-Windows: pulando taskkill.")

    time.sleep(1.8)


def generate_powershell_restart_script(
    sap_exe: str,
    landscape_xml: str,
    target_index: int = 3,
    service_name: Optional[str] = None,
) -> str:
    """
    Gera o script PowerShell que inicia o SAP Logon com o arquivo XML especificado
    e ativa com precisão o 3º item da lista usando UI Automation e clique direto.
    """
    escaped_exe = sap_exe.replace("'", "''")
    escaped_xml = landscape_xml.replace("'", "''")
    if service_name:
        escaped_svc = service_name.replace("'", "''")
        svc_param = f"'{escaped_svc}'"
    else:
        svc_param = "$null"

    return f"""# PowerShell - Reinício e Ativação Precisa do 3º SAP Logon
$ErrorActionPreference = 'SilentlyContinue'

$sapExe = '{escaped_exe}'
$landscapeXml = '{escaped_xml}'
$targetIndex = {target_index}
$targetServiceName = {svc_param}

# 1. Helper Win32 para garantir foco no SAP Logon e clique via API nativa
$win32Code = @"
using System;
using System.Runtime.InteropServices;

public class Win32Helper {{
    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP   = 0x0004;

    public static void ForceForeground(IntPtr hWnd) {{
        if (hWnd == IntPtr.Zero) return;
        uint foreProcId;
        IntPtr foreWnd = GetForegroundWindow();
        uint foreThread = GetWindowThreadProcessId(foreWnd, out foreProcId);
        uint curThread = GetCurrentThreadId();

        if (foreThread != curThread && foreThread != 0) {{
            AttachThreadInput(curThread, foreThread, true);
            ShowWindowAsync(hWnd, 9); // SW_RESTORE
            SetForegroundWindow(hWnd);
            BringWindowToTop(hWnd);
            AttachThreadInput(curThread, foreThread, false);
        }} else {{
            ShowWindowAsync(hWnd, 9);
            SetForegroundWindow(hWnd);
            BringWindowToTop(hWnd);
        }}
    }}

    public static void LeftDoubleClickAt(int x, int y) {{
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(120);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(80);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }}
}}
"@

try {{
    Add-Type -TypeDefinition $win32Code -ErrorAction SilentlyContinue
}} catch {{}}

# 2. Fallback de executável 32/64 bits se o caminho original não existir
if (-not (Test-Path $sapExe)) {{
    $alt32 = "C:\\Program Files (x86)\\SAP\\FrontEnd\\SAPGUI\\saplogon.exe"
    $alt64 = "C:\\Program Files\\SAP\\FrontEnd\\SAPGUI\\saplogon.exe"
    if (Test-Path $alt32) {{ $sapExe = $alt32 }}
    elseif (Test-Path $alt64) {{ $sapExe = $alt64 }}
}}

Write-Output "[PS] Iniciando SAP Logon: $sapExe /LSXML_File=$landscapeXml"
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $sapExe
$psi.Arguments = "/LSXML_File=`"$landscapeXml`""
$psi.UseShellExecute = $true
$proc = [System.Diagnostics.Process]::Start($psi)

# 3. Aguarda a janela principal do SAP Logon aparecer
$timeoutSec = 20
$elapsed = 0
$sapWin = $null

while ($elapsed -lt $timeoutSec) {{
    Start-Sleep -Milliseconds 400
    $elapsed += 0.4
    $sapWin = Get-Process -Name "saplogon", "saplgpad" -ErrorAction SilentlyContinue | Where-Object {{ $_.MainWindowHandle -ne 0 }} | Select-Object -First 1
    if ($sapWin) {{ break }}
}}

if (-not $sapWin) {{
    Write-Output "[PS_WARN] Janela do SAP Logon não apareceu no tempo limite ($timeoutSec s)."
    exit 1
}}

# Traz o SAP Logon com prioridade máxima para primeiro plano
[Win32Helper]::ForceForeground($sapWin.MainWindowHandle)
Start-Sleep -Milliseconds 1000

# 4. Tenta conectar via SAP GUI Scripting COM se o serviço for conhecido
$connectedViaCom = $false
if ($targetServiceName) {{
    try {{
        Write-Output "[PS] Tentando conexão COM para: $targetServiceName"
        $sapGuiAuto = [System.Runtime.InteropServices.Marshal]::GetActiveObject("SAPGUI")
        if ($sapGuiAuto) {{
            $app = $sapGuiAuto.GetScriptingEngine()
            if ($app) {{
                $conn = $app.OpenConnection($targetServiceName, $true)
                if ($conn) {{
                    Write-Output "[PS_OK] Conexão aberta com sucesso via COM: $targetServiceName"
                    $connectedViaCom = $true
                }}
            }}
        }}
    }} catch {{
        Write-Output "[PS] COM Scripting não respondeu: $_. Prosseguindo com UI Automation."
    }}
}}

if ($connectedViaCom) {{
    exit 0
}}

# 5. UI Automation direcionada ao 3º item da lista (de cima para baixo)
try {{
    Add-Type -AssemblyName UIAutomationClient -ErrorAction SilentlyContinue
    Add-Type -AssemblyName UIAutomationTypes -ErrorAction SilentlyContinue
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue

    $root = [System.Windows.Automation.AutomationElement]::FromHandle($sapWin.MainWindowHandle)
    if ($root) {{
        $condList = New-Object System.Windows.Automation.OrCondition(
            (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::ListItem)),
            (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::TreeItem)),
            (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::DataItem))
        )

        $visibleItems = @()
        for ($i = 0; $i -lt 12; $i++) {{
            [Win32Helper]::ForceForeground($sapWin.MainWindowHandle)
            $found = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condList)
            if ($found) {{
                # Filtra apenas itens visíveis com dimensões reais e ordena do topo para baixo (Y crescente)
                $visibleItems = @($found | Where-Object {{
                    $r = $_.Current.BoundingRectangle
                    $r.Width -gt 25 -and $r.Height -gt 6 -and $r.X -gt 0 -and $r.Y -gt 0
                }} | Sort-Object {{ $_.Current.BoundingRectangle.Y }})

                if ($visibleItems.Count -ge $targetIndex) {{
                    break
                }}
            }}
            Start-Sleep -Milliseconds 400
        }}

        Write-Output "[PS] Itens visíveis encontrados no SAP Logon: $($visibleItems.Count)"

        $targetItem = $null

        # 5.1 Busca por nome do serviço se disponível
        if ($targetServiceName) {{
            $targetItem = $visibleItems | Where-Object {{ $_.Current.Name -like "*$targetServiceName*" }} | Select-Object -First 1
        }}

        # 5.2 Busca por '03' ou 'SAP 03' no nome do item
        if (-not $targetItem) {{
            $targetItem = $visibleItems | Where-Object {{
                $n = $_.Current.Name
                $n -match "\\b0?3\\b" -or $n -match "SAP\\s*0?3"
            }} | Select-Object -First 1
        }}

        # 5.3 Fallback estrito: o 3º item ordenado de cima para baixo (índice 2)
        if (-not $targetItem -and $visibleItems.Count -ge $targetIndex) {{
            $targetItem = $visibleItems[$targetIndex - 1]
        }}

        if ($targetItem) {{
            $itemName = $targetItem.Current.Name
            Write-Output "[PS] Item alvo selecionado: '$itemName' (3º de cima para baixo)."
            [Win32Helper]::ForceForeground($sapWin.MainWindowHandle)
            Start-Sleep -Milliseconds 150

            # Foca o item via UI Automation
            try {{ $targetItem.SetFocus() }} catch {{}}

            # Seleciona o item se suportado
            try {{
                $selPattern = $targetItem.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
                if ($selPattern) {{ $selPattern.Select() }}
            }} catch {{}}

            # Duplo clique físico nas coordenadas exatas do item
            $rect = $targetItem.Current.BoundingRectangle
            $clickX = [int]($rect.X + [Math]::Min(50, [int]($rect.Width / 3)))
            $clickY = [int]($rect.Y + [int]($rect.Height / 2))
            Write-Output "[PS] Executando duplo clique em ($clickX, $clickY) sobre '$itemName'..."
            [Win32Helper]::LeftDoubleClickAt($clickX, $clickY)
            Start-Sleep -Milliseconds 300

            # Confirma com ENTER na janela se estiver em primeiro plano
            if ([Win32Helper]::GetForegroundWindow() -eq $sapWin.MainWindowHandle) {{
                [System.Windows.Forms.SendKeys]::SendWait("{{ENTER}}")
            }}

            Write-Output "[PS_OK] Item '$itemName' acionado com sucesso!"
            exit 0
        }}
    }}
}} catch {{
    Write-Output "[PS_WARN] UI Automation falhou: $_"
}}

# 6. Fallback teclado com verificação estrita de janela em primeiro plano
Write-Output "[PS] Usando fallback de teclado com proteção de foco..."
[Win32Helper]::ForceForeground($sapWin.MainWindowHandle)
Start-Sleep -Milliseconds 600

$activeHwnd = [Win32Helper]::GetForegroundWindow()
if ($activeHwnd -ne $sapWin.MainWindowHandle) {{
    Write-Output "[PS_ERR] SAP Logon não está em primeiro plano (Janela ativa: $activeHwnd). Abortando para proteger a barra de tarefas."
    exit 2
}}

# Envia sequência segura apenas quando confirmado que o SAP Logon está em foco
Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
[System.Windows.Forms.SendKeys]::SendWait("{{TAB}}")
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait("{{HOME}}")
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait("{{DOWN}}")
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait("{{DOWN}}")
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait("{{ENTER}}")

Write-Output "[PS_OK] Sequência de teclado enviada para o SAP Logon."
exit 0
"""


def restart_sap_session(
    sap_exe: str,
    landscape_xml: str,
    target_index: int = 3,
) -> Tuple[bool, str]:
    """
    Fecha o SAP GUI travado e reabre conectando no 3º item da lista.
    """
    logger.info("[SAP_RESTART] Iniciando rotina de reinício do SAP GUI...")

    # Passo 1: Fechar instâncias travadas
    kill_sap_processes()

    # Passo 2: Extrai nome do 3º serviço do XML caso disponível
    service_name = get_third_service_name_from_xml(landscape_xml, target_index=target_index)
    if service_name:
        logger.info("[SAP_RESTART] Identificado 3º serviço no XML: '%s'", service_name)
    else:
        logger.info("[SAP_RESTART] Nome do serviço não extraído do XML; usará navegação direta no SAP Logon.")

    # Passo 3: Executa script PowerShell especializado
    ps_code = generate_powershell_restart_script(
        sap_exe=sap_exe,
        landscape_xml=landscape_xml,
        target_index=target_index,
        service_name=service_name,
    )

    tmp_ps = None
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".ps1", delete=False, encoding="utf-8-sig") as tf:
            tf.write(ps_code)
            tmp_ps = Path(tf.name)

        t0 = time.perf_counter()
        proc = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(tmp_ps),
            ],
            capture_output=True,
            text=True,
            timeout=40,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        elapsed = time.perf_counter() - t0

        stdout_clean = proc.stdout.strip()
        stderr_clean = proc.stderr.strip()

        if proc.returncode == 0:
            msg = f"SAP reiniciado com sucesso em {elapsed:.1f}s."
            logger.info("[SAP_RESTART] %s Output: %s", msg, stdout_clean)
            return True, msg
        else:
            err = stderr_clean or stdout_clean or f"Código de saída: {proc.returncode}"
            logger.error("[SAP_RESTART] Falha no script PowerShell do SAP: %s", err)
            return False, err

    except subprocess.TimeoutExpired:
        logger.error("[SAP_RESTART] Timeout excedido ao reiniciar o SAP.")
        return False, "Timeout ao reabrir o SAP."
    except Exception as exc:
        logger.error("[SAP_RESTART] Erro inesperado ao reiniciar o SAP: %s", exc, exc_info=True)
        return False, str(exc)
    finally:
        if tmp_ps and tmp_ps.exists():
            try:
                tmp_ps.unlink(missing_ok=True)
            except Exception:
                pass


class NetworkSapWatchdog:
    """
    Worker em background que monitora continuamente a conexão com a internet.
    Detecta quedas e, no retorno, executa automaticamente o fechamento e a
    reabertura do SAP GUI com seleção do 3º item.
    """

    def __init__(
        self,
        sap_exe: str,
        landscape_xml: str,
        target_index: int = 3,
        poll_interval: float = 4.0,
        fallback_url: Optional[str] = None,
        on_notify: Optional[Callable[[str, str], None]] = None,
    ):
        self.sap_exe = sap_exe
        self.landscape_xml = landscape_xml
        self.target_index = target_index
        self.poll_interval = poll_interval
        self.fallback_url = fallback_url
        self.on_notify = on_notify

        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

        # Estado da rede
        self.is_online = True
        self.was_offline = False
        self.offline_since: Optional[float] = None
        self.last_restart_time: float = 0.0

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run_loop,
            daemon=True,
            name="net-sap-watchdog",
        )
        self._thread.start()
        logger.info(
            "[NET_WATCHDOG] Monitor de internet e SAP iniciado (polling a cada %.1fs). Alvo SAP: 3º item.",
            self.poll_interval,
        )

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=3)
        logger.info("[NET_WATCHDOG] Monitor de internet e SAP parado.")

    def trigger_restart_now(self) -> Tuple[bool, str]:
        """Permite disparar a reinicialização manual (ex: via clique na bandeja)."""
        logger.info("[NET_WATCHDOG] Disparo manual de reinício do SAP solicitado.")
        # NÃO chama on_notify ANTES do reinício para não roubar o foco da tela para a bandeja
        ok, msg = restart_sap_session(
            sap_exe=self.sap_exe,
            landscape_xml=self.landscape_xml,
            target_index=self.target_index,
        )
        if self.on_notify:
            if ok:
                self.on_notify("Planilha Sync — SAP", "SAP reaberto com sucesso no 3º item!")
            else:
                self.on_notify("Planilha Sync — Erro SAP", f"Falha ao reabrir SAP: {msg}")
        return ok, msg

    def _run_loop(self) -> None:
        # Verificação inicial
        initial_check = is_internet_available(fallback_http_url=self.fallback_url)
        self.is_online = initial_check
        if not initial_check:
            self.was_offline = True
            self.offline_since = time.time()
            logger.warning("[NET_WATCHDOG] Iniciado com conexão de internet OFFLINE.")
        else:
            logger.info("[NET_WATCHDOG] Conexão inicial com a internet: ONLINE.")

        consecutive_online_count = 0

        while not self._stop_event.is_set():
            try:
                available = is_internet_available(fallback_http_url=self.fallback_url)

                # 1. Caso a internet tenha acabado de cair (ONLINE -> OFFLINE)
                if not available and self.is_online:
                    self.is_online = False
                    self.was_offline = True
                    self.offline_since = time.time()
                    consecutive_online_count = 0

                    logger.warning(
                        "[NET_WATCHDOG] ⚠️ Conexão com a internet CAIU! Monitorando retorno para reiniciar o SAP..."
                    )
                    if self.on_notify:
                        self.on_notify(
                            "Planilha Sync — Rede",
                            "Conexão com a internet perdida. O SAP será reiniciado assim que a rede voltar.",
                        )

                # 2. Caso a internet continue offline
                elif not available and not self.is_online:
                    consecutive_online_count = 0

                # 3. Caso a internet tenha retornado (OFFLINE -> ONLINE)
                elif available and not self.is_online:
                    consecutive_online_count += 1
                    # Filtro anti-flapping: requer 2 checagens seguidas para confirmar que a rede estabilizou
                    if consecutive_online_count >= 2:
                        duration_offline = (
                            time.time() - self.offline_since if self.offline_since else 0
                        )
                        self.is_online = True
                        logger.info(
                            "[NET_WATCHDOG] 🌐 Conexão com a internet VOLTOU após %.1fs de queda! Iniciando reinício do SAP...",
                            duration_offline,
                        )

                        # NOTA: NÃO chamamos self.on_notify aqui antes da reinicialização
                        # pois balões de notificação do Windows roubam o foco para Shell_TrayWnd (bandeja).

                        # Executa encerramento e reabertura do SAP
                        ok, msg = restart_sap_session(
                            sap_exe=self.sap_exe,
                            landscape_xml=self.landscape_xml,
                            target_index=self.target_index,
                        )

                        self.last_restart_time = time.time()
                        self.was_offline = False
                        self.offline_since = None

                        if ok:
                            logger.info("[NET_WATCHDOG] ✅ SAP reaberto com sucesso no 3º item.")
                            if self.on_notify:
                                self.on_notify(
                                    "Planilha Sync — SAP",
                                    "SAP reaberto com sucesso no 3º item da lista!",
                                )
                        else:
                            logger.error("[NET_WATCHDOG] ❌ Falha ao reiniciar SAP: %s", msg)
                            if self.on_notify:
                                self.on_notify(
                                    "Planilha Sync — Erro SAP",
                                    f"Falha ao reabrir SAP no retorno da rede: {msg}",
                                )

                # 4. Continua online
                elif available and self.is_online:
                    consecutive_online_count = max(consecutive_online_count + 1, 2)
                    self.was_offline = False

            except Exception as exc:
                logger.error("[NET_WATCHDOG] Erro no loop de monitoramento de rede: %s", exc, exc_info=True)

            self._stop_event.wait(self.poll_interval)
