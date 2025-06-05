-- ====================================
-- TRIGGERS E FUNÇÕES: Rastreamento automático de usuários
-- ====================================
-- Execute este script após aplicar as colunas de rastreamento

-- 1. Função para obter nome do usuário
CREATE OR REPLACE FUNCTION get_user_display_name(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_name TEXT;
    user_email TEXT;
BEGIN
    -- Se user_id é null, retornar fallback
    IF user_id IS NULL THEN
        RETURN 'usuário';
    END IF;
    
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

-- 2. Função trigger para preencher automaticamente os campos de usuário
CREATE OR REPLACE FUNCTION set_user_tracking()
RETURNS TRIGGER AS $$
BEGIN
    -- Para INSERT
    IF TG_OP = 'INSERT' THEN
        NEW.created_by = auth.uid();
        NEW.updated_by = auth.uid();
        
        -- Se for NT, preencher o nome do criador
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

-- 3. Criar os triggers
DROP TRIGGER IF EXISTS nts_user_tracking ON nts;
CREATE TRIGGER nts_user_tracking
    BEFORE INSERT OR UPDATE ON nts
    FOR EACH ROW EXECUTE FUNCTION set_user_tracking();

DROP TRIGGER IF EXISTS nt_items_user_tracking ON nt_items;
CREATE TRIGGER nt_items_user_tracking
    BEFORE INSERT OR UPDATE ON nt_items
    FOR EACH ROW EXECUTE FUNCTION set_user_tracking();

-- 4. Atualizar registros existentes (opcional)
-- Preenche dados históricos para NTs existentes
UPDATE nts 
SET created_by_name = 'sistema' 
WHERE created_by_name IS NULL;

-- Preenche dados históricos para itens já pagos
UPDATE nt_items 
SET paid_by_name = 'sistema' 
WHERE status IN ('Pago', 'Pago Parcial') 
AND paid_by_name IS NULL;

-- 5. Verificar se tudo funcionou
SELECT 'Funções criadas:' as tipo, routine_name as nome
FROM information_schema.routines 
WHERE routine_name IN ('get_user_display_name', 'set_user_tracking')
UNION ALL
SELECT 'Triggers criados:' as tipo, trigger_name as nome
FROM information_schema.triggers 
WHERE trigger_name IN ('nts_user_tracking', 'nt_items_user_tracking');
