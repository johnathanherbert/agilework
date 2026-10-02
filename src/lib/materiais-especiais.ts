import materiaisEspeciais from '@/data/materiais-especiais.json'

export type TipoMaterialEspecial = 'inf' | 'cfa'

export interface MaterialEspecialConfig {
  nome: string
  descricao: string
  cor: string
  icone: string
  materiais: string[]
}

export interface MateriaisEspeciaisData {
  inf: MaterialEspecialConfig
  cfa: MaterialEspecialConfig
}

export function isMaterialEspecial(material: string | null | undefined): TipoMaterialEspecial | null {
  if (!material) return null;
  const data = materiaisEspeciais as MateriaisEspeciaisData;
  const cleanCode = String(material).trim().replace(/^0+/, '');
  if (!cleanCode) return null;

  if (data.inf.materiais.some((m) => m.trim().replace(/^0+/, '') === cleanCode)) {
    return 'inf';
  }

  if (data.cfa.materiais.some((m) => m.trim().replace(/^0+/, '') === cleanCode)) {
    return 'cfa';
  }

  return null;
}

export function getMaterialEspecialConfig(tipo: TipoMaterialEspecial): MaterialEspecialConfig {
  const data = materiaisEspeciais as MateriaisEspeciaisData
  return data[tipo]
}

export function getMateriaisEspeciaisData(): MateriaisEspeciaisData {
  return materiaisEspeciais as MateriaisEspeciaisData
}

export function getMaterialEspecialBadge(material: string): { tipo: TipoMaterialEspecial; config: MaterialEspecialConfig } | null {
  const tipo = isMaterialEspecial(material)
  if (!tipo) return null
  
  return {
    tipo,
    config: getMaterialEspecialConfig(tipo)
  }
}
