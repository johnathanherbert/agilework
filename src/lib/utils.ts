import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date to Brazilian format (DD/MM/YYYY)
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR')
}

// Format time to Brazilian format (HH:MM:SS)
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('pt-BR')
}

// Calcular o tempo decorrido entre duas datas
export function calculateElapsedTime(startDate: string | Date, endDate?: string | Date | null): number {
  // Verificar se a data inicial é válida
  if (!startDate) return 0;
  
  try {
    // Usar a função normalizeDate para obter objetos Date válidos
    const normalizedStart = normalizeDate(startDate);
    const normalizedEnd = endDate ? normalizeDate(endDate) : new Date();
    
    // Se a data de início for inválida, retornar 0
    if (!normalizedStart) {
      console.warn("Data de início inválida:", startDate);
      return 0;
    }
    
    // Se a data final for inválida, usar a data atual
    const start = normalizedStart.getTime();
    const end = normalizedEnd ? normalizedEnd.getTime() : Date.now();
    
    return end - start;
  } catch (error) {
    console.error("Erro ao calcular tempo decorrido:", error);
    return 0;
  }
}

// Verificar se há atraso (mais de 2 horas)
export function isDelayed(startDate: string | Date, endDate?: string | Date | null): boolean {
  if (!startDate) return false;
  
  try {
    const twoHoursInMs = 2 * 60 * 60 * 1000; // 2 horas em milissegundos
    const elapsedTime = calculateElapsedTime(startDate, endDate);
    return elapsedTime > twoHoursInMs;
  } catch (error) {
    console.error("Erro ao verificar atraso:", error);
    return false;
  }
}

// Formatar o tempo decorrido em horas e minutos
export function formatElapsedTime(milliseconds: number): string {
  // Verificar se temos um valor numérico válido
  if (isNaN(milliseconds) || milliseconds === null || milliseconds === undefined) {
    return "tempo indisponível";
  }
  
  // Garantir que o valor seja positivo
  const absoluteTime = Math.abs(milliseconds);
  
  // Se for menos de um minuto
  if (absoluteTime < 60000) {
    return "agora";
  }
  
  const minutes = Math.floor(absoluteTime / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  // Se for mais de um dia
  if (days > 0) {
    const remainingHours = hours % 24;
    if (remainingHours === 0) {
      return days === 1 ? `1 dia` : `${days} dias`;
    }
    return days === 1 
      ? `1 dia e ${remainingHours}h` 
      : `${days} dias e ${remainingHours}h`;
  }
  
  // Se for menos de uma hora
  if (hours < 1) {
    return minutes === 1 ? `1 minuto` : `${minutes} minutos`;
  }
  
  // Se for mais de uma hora, mostrar horas e minutos
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return hours === 1 ? `1 hora` : `${hours} horas`;
  }
  
  return hours === 1
    ? `1 hora e ${remainingMinutes} min`
    : `${hours} horas e ${remainingMinutes} min`;
}

// Formatar timestamp para data e hora legível
export function formatTimestamp(timestamp: string | Date | null): string {
  if (!timestamp) return '-';
  
  try {
    // Usar a função normalizeDate para obter um objeto Date válido
    const normalizedDate = normalizeDate(timestamp);
    
    // Verificar se a data é válida
    if (!normalizedDate) return '-';
    
    const day = normalizedDate.getDate().toString().padStart(2, '0');
    const month = (normalizedDate.getMonth() + 1).toString().padStart(2, '0');
    const hour = normalizedDate.getHours().toString().padStart(2, '0');
    const minute = normalizedDate.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month} às ${hour}:${minute}`;
  } catch (error) {
    console.error("Erro ao formatar timestamp:", error);
    return '-';
  }
}

// Get current date in Brazilian format
export function getCurrentDate(): string {
  return formatDate(new Date())
}

// Get current time in Brazilian format
export function getCurrentTime(): string {
  return formatTime(new Date())
}

// Get current shift based on time
export function getCurrentShift(): number {
  const hour = new Date().getHours()
  
  if (hour >= 6 && hour < 14) {
    return 1 // 1st shift (6:00 - 14:00)
  } else if (hour >= 14 && hour < 22) {
    return 2 // 2nd shift (14:00 - 22:00)
  } else {
    return 3 // 3rd shift (22:00 - 6:00)
  }
}

// Check if an item is overdue (payment awaiting for more than 24 hours)
export function isItemOverdue(createdDate: string, createdTime: string): boolean {
  // Parse the date and time (Brazilian format)
  const [day, month, year] = createdDate.split('/').map(Number)
  const [hour, minute, second] = createdTime.split(':').map(Number)
  
  const createdDateTime = new Date(year, month - 1, day, hour, minute, second)
  const now = new Date()
  
  // Calculate the difference in hours
  const diffInHours = (now.getTime() - createdDateTime.getTime()) / (1000 * 60 * 60)
  
  return diffInHours >= 24
}

// Calculate the due date (24 hours after creation)
export function calculateDueDate(createdDate: string, createdTime: string): Date {
  // Parse the date and time (Brazilian format)
  const [day, month, year] = createdDate.split('/').map(Number)
  const [hour, minute, second] = createdTime.split(':').map(Number)
  
  const createdDateTime = new Date(year, month - 1, day, hour, minute, second)
  
  // Add 24 hours
  createdDateTime.setHours(createdDateTime.getHours() + 24)
  
  return createdDateTime
}

// Format a number as currency (R$)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// Validate NT number format
export function isValidNTNumber(ntNumber: string): boolean {
  // NT numbers should follow the pattern: NT-YYYY-XXXXX
  const regex = /^NT-\d{4}-\d{5}$/
  return regex.test(ntNumber)
}

// Generate a new NT number based on year and sequence
export function generateNTNumber(year: number, sequence: number): string {
  return `NT-${year}-${sequence.toString().padStart(5, '0')}`
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "..."
}

// Format file size
export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 Byte'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i]
}

// Função para normalizar datas em diferentes formatos
export function normalizeDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  
  try {
    // Se já for um objeto Date, apenas retorna
    if (date instanceof Date) return date;
    
    // Verifica se é uma string ISO
    if (typeof date === 'string') {
      // Tenta criar uma data a partir da string
      const parsedDate = new Date(date);
      
      // Verifica se a data é válida
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
      
      // Tenta interpretar diferentes formatos de data
      
      // Formato ISO
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(date)) {
        return new Date(date);
      }
      
      // Formato brasileiro DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}/.test(date)) {
        const [day, month, year] = date.split('/').map(Number);
        return new Date(year, month - 1, day);
      }
      
      // Timestamp em milissegundos
      if (/^\d+$/.test(date)) {
        return new Date(parseInt(date, 10));
      }
    }
    
    // Retorna null se nenhum formato for reconhecido
    console.warn("Formato de data não reconhecido:", date);
    return null;
  } catch (error) {
    console.error("Erro ao normalizar data:", error);
    return null;
  }
}

// Função para parsear datas e horários separados como em NTItem
export function parseDateTime(dateStr: string, timeStr: string, paymentTimeStr?: string | null): {
  creationDate: Date;
  paymentDate: Date | null;
} {
  try {
    // Parse creation date
    const [day, month, year] = dateStr.split('/').map(Number);
    const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
    
    // Create creation date - JS month is 0-indexed (January = 0)
    const creationDate = new Date(year, month - 1, day, hours, minutes, seconds);
    
    // If no payment time provided, return only creation date
    if (!paymentTimeStr) {
      return {
        creationDate,
        paymentDate: null
      };
    }
    
    let paymentDate: Date;
    
    if (paymentTimeStr.includes('T')) {
      // ISO format with T
      paymentDate = new Date(paymentTimeStr);
    } else if (paymentTimeStr.includes('/')) {
      // DD/MM/YYYY HH:MM:SS format
      const [datePart, timePart] = paymentTimeStr.split(' ');
      const [pDay, pMonth, pYear] = datePart.split('/').map(Number);
      const [pHours, pMinutes, pSeconds = 0] = timePart ? timePart.split(':').map(Number) : [0, 0, 0];
      paymentDate = new Date(pYear, pMonth - 1, pDay, pHours, pMinutes, pSeconds);
    } else if (paymentTimeStr.includes(':')) {
      // Time-only format (HH:MM or HH:MM:SS)
      const [pHours, pMinutes, pSeconds = 0] = paymentTimeStr.split(':').map(Number);
      // Use creation date but with payment time
      paymentDate = new Date(year, month - 1, day, pHours, pMinutes, pSeconds);
    } else {
      // Try direct conversion as fallback
      paymentDate = new Date(paymentTimeStr);
    }
    
    return {
      creationDate,
      paymentDate
    };
  } catch (error) {
    console.error('Erro ao analisar data e hora:', error);
    throw new Error('Formato de data/hora inválido');
  }
}

// Função para depuração de datas (útil para troubleshooting)
export function debugDate(label: string, date: any): void {
  if (process.env.NODE_ENV === 'development') {
    try {
      console.group(`[DEBUG] ${label}`);
      console.log('Valor original:', date);
      
      if (date) {
        if (date instanceof Date) {
          console.log('É um objeto Date');
          console.log('ISO String:', date.toISOString());
          console.log('Timestamp:', date.getTime());
          console.log('Data válida:', !isNaN(date.getTime()));
        } else if (typeof date === 'string') {
          console.log('É uma string');
          const parsed = new Date(date);
          console.log('Convertido para Date:', parsed);
          console.log('ISO String:', parsed.toISOString());
          console.log('Timestamp:', parsed.getTime());
          console.log('Data válida:', !isNaN(parsed.getTime()));
        } else if (typeof date === 'number') {
          console.log('É um número (timestamp)');
          const parsed = new Date(date);
          console.log('Convertido para Date:', parsed);
          console.log('ISO String:', parsed.toISOString());
        } else {
          console.log('Tipo desconhecido:', typeof date);
        }
      } else {
        console.log('Valor nulo ou indefinido');
      }
    } catch (error) {
      console.error('Erro ao depurar data:', error);
    } finally {
      console.groupEnd();
    }
  }
}
