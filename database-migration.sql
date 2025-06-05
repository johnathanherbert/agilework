-- ====================================
-- MIGRATION: Adicionar rastreamento de usuários
-- ====================================

-- 1. Adicionar colunas para rastrear usuários nas tabelas existentes
ALTER TABLE nt_items 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS paid_by_name TEXT;

ALTER TABLE nts 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- 2. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_nt_items_created_by ON nt_items(created_by);
CREATE INDEX IF NOT EXISTS idx_nt_items_paid_by ON nt_items(paid_by);
CREATE INDEX IF NOT EXISTS idx_nts_created_by ON nts(created_by);

-- 3. Criar função para obter nome do usuário
CREATE OR REPLACE FUNCTION get_user_display_name(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_name TEXT;
    user_email TEXT;
BEGIN
    -- Tentar obter o nome do user_metadata
    SELECT 
        (raw_user_meta_data->>'name')::TEXT,
        email
    INTO user_name, user_email
    FROM auth.users 
    WHERE id = user_id;
    
    -- Se tem nome no metadata, usar ele
    IF user_name IS NOT NULL AND user_name != '' THEN
        RETURN user_name;
    END IF;
    
    -- Se não tem nome, usar a parte antes do @ do email
    IF user_email IS NOT NULL THEN
        RETURN split_part(user_email, '@', 1);
    END IF;
    
    -- Fallback
    RETURN 'usuário';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar trigger para preencher automaticamente os campos de usuário
CREATE OR REPLACE FUNCTION set_user_tracking()
RETURNS TRIGGER AS $$
BEGIN
    -- Para INSERT
    IF TG_OP = 'INSERT' THEN
        NEW.created_by = auth.uid();
        NEW.updated_by = auth.uid();
        
        -- Se for NT, preencher o nome
        IF TG_TABLE_NAME = 'nts' THEN
            NEW.created_by_name = get_user_display_name(auth.uid());
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- Para UPDATE
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_by = auth.uid();
        
        -- Se for item e status mudou para Pago ou Pago Parcial
        IF TG_TABLE_NAME = 'nt_items' AND 
           (NEW.status = 'Pago' OR NEW.status = 'Pago Parcial') AND
           OLD.status != NEW.status THEN
            NEW.paid_by = auth.uid();
            NEW.paid_by_name = get_user_display_name(auth.uid());
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Criar os triggers
DROP TRIGGER IF EXISTS nts_user_tracking ON nts;
CREATE TRIGGER nts_user_tracking
    BEFORE INSERT OR UPDATE ON nts
    FOR EACH ROW EXECUTE FUNCTION set_user_tracking();

DROP TRIGGER IF EXISTS nt_items_user_tracking ON nt_items;
CREATE TRIGGER nt_items_user_tracking
    BEFORE INSERT OR UPDATE ON nt_items
    FOR EACH ROW EXECUTE FUNCTION set_user_tracking();

-- 6. Atualizar registros existentes (opcional - preenche dados históricos)
-- CUIDADO: Isso vai atualizar TODOS os registros existentes
-- UPDATE nts SET created_by_name = 'sistema' WHERE created_by_name IS NULL;
-- UPDATE nt_items SET paid_by_name = 'sistema' WHERE status IN ('Pago', 'Pago Parcial') AND paid_by_name IS NULL;
