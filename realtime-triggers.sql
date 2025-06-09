-- ====================================
-- TRIGGERS APRIMORADOS: Funcionalidades PostgreSQL Changes para Timeline em Tempo Real
-- ====================================
-- Execute este script para melhorar o sistema de tempo real

-- 1. Habilitar realtime para as tabelas necessárias
ALTER PUBLICATION supabase_realtime ADD TABLE nt_items;
ALTER PUBLICATION supabase_realtime ADD TABLE nts;

-- 2. Função para notificar mudanças em tempo real
CREATE OR REPLACE FUNCTION notify_timeline_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Notificar apenas quando um item é marcado como pago
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'nt_items' THEN
        -- Se o status mudou para Pago ou Pago Parcial
        IF (NEW.status = 'Pago' OR NEW.status = 'Pago Parcial') AND 
           OLD.status != NEW.status THEN
            
            -- Notificar via NOTIFY (para aplicações que escutam)
            PERFORM pg_notify(
                'item_paid_notification',
                json_build_object(
                    'id', NEW.id,
                    'code', NEW.code,
                    'status', NEW.status,
                    'nt_id', NEW.nt_id,
                    'paid_by', NEW.paid_by,
                    'paid_by_name', NEW.paid_by_name,
                    'timestamp', EXTRACT(EPOCH FROM NOW())
                )::text
            );

            -- Log para debugging
            INSERT INTO realtime_logs (
                event_type,
                table_name,
                record_id,
                old_status,
                new_status,
                user_id,
                created_at
            ) VALUES (
                'item_paid',
                'nt_items',
                NEW.id,
                OLD.status,
                NEW.status,
                auth.uid(),
                NOW()
            );
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar tabela de logs para debugging do realtime
CREATE TABLE IF NOT EXISTS realtime_logs (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_status TEXT,
    new_status TEXT,
    user_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela de logs
ALTER TABLE realtime_logs ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura dos logs (para debugging)
CREATE POLICY "Allow read realtime_logs" ON realtime_logs
    FOR SELECT USING (true);

-- Política para permitir inserção nos logs
CREATE POLICY "Allow insert realtime_logs" ON realtime_logs
    FOR INSERT WITH CHECK (true);

-- 4. Trigger para notificar mudanças em tempo real
DROP TRIGGER IF EXISTS notify_timeline_changes_trigger ON nt_items;
CREATE TRIGGER notify_timeline_changes_trigger
    AFTER UPDATE ON nt_items
    FOR EACH ROW EXECUTE FUNCTION notify_timeline_changes();

-- 5. Função para broadcast personalizado (pode ser chamada manualmente)
CREATE OR REPLACE FUNCTION broadcast_item_paid(item_id UUID)
RETURNS VOID AS $$
DECLARE
    item_data RECORD;
BEGIN
    -- Buscar dados do item
    SELECT 
        ni.id,
        ni.code,
        ni.description,
        ni.quantity,
        ni.status,
        ni.updated_at,
        ni.paid_by_name,
        n.nt_number
    INTO item_data
    FROM nt_items ni
    LEFT JOIN nts n ON ni.nt_id = n.id
    WHERE ni.id = item_id;

    IF FOUND THEN
        -- Notificar via pg_notify
        PERFORM pg_notify(
            'timeline_broadcast',
            json_build_object(
                'event', 'item_paid',
                'data', row_to_json(item_data),
                'timestamp', EXTRACT(EPOCH FROM NOW())
            )::text
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função para obter estatísticas do realtime
CREATE OR REPLACE FUNCTION get_realtime_stats()
RETURNS TABLE (
    total_notifications INTEGER,
    notifications_today INTEGER,
    last_notification TIMESTAMP WITH TIME ZONE,
    most_active_user TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_notifications,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END)::INTEGER as notifications_today,
        MAX(created_at) as last_notification,
        (
            SELECT COALESCE(get_user_display_name(user_id), 'sistema')
            FROM realtime_logs 
            WHERE user_id IS NOT NULL 
            GROUP BY user_id 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ) as most_active_user
    FROM realtime_logs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Política para permitir acesso às estatísticas
CREATE OR REPLACE FUNCTION public.get_timeline_stats()
RETURNS JSON AS $$
DECLARE
    stats_data JSON;
BEGIN
    SELECT json_build_object(
        'total_paid_today', (
            SELECT COUNT(*) 
            FROM nt_items 
            WHERE status = 'Pago' 
            AND DATE(updated_at) = CURRENT_DATE
        ),
        'total_paid_this_week', (
            SELECT COUNT(*) 
            FROM nt_items 
            WHERE status = 'Pago' 
            AND updated_at >= DATE_TRUNC('week', CURRENT_DATE)
        ),
        'realtime_logs_count', (
            SELECT COUNT(*) 
            FROM realtime_logs 
            WHERE DATE(created_at) = CURRENT_DATE
        ),
        'last_activity', (
            SELECT MAX(created_at) 
            FROM realtime_logs
        )
    ) INTO stats_data;
    
    RETURN stats_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Índices para melhorar performance do realtime
CREATE INDEX IF NOT EXISTS idx_nt_items_status_updated ON nt_items(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_logs_created_at ON realtime_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_logs_event_type ON realtime_logs(event_type);

-- 9. Trigger adicional para garantir que mudanças sejam capturadas
CREATE OR REPLACE FUNCTION ensure_realtime_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Forçar updated_at quando status muda
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        NEW.updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_realtime_update_trigger ON nt_items;
CREATE TRIGGER ensure_realtime_update_trigger
    BEFORE UPDATE ON nt_items
    FOR EACH ROW EXECUTE FUNCTION ensure_realtime_update();

-- 10. Verificar configuração do realtime
SELECT 'Verificação do Realtime:' as info;

-- Verificar se as tabelas estão na publicação
SELECT 
    'Tabelas na publicação realtime:' as tipo,
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('nt_items', 'nts');

-- Verificar triggers criados
SELECT 
    'Triggers criados:' as tipo,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name IN (
    'notify_timeline_changes_trigger',
    'ensure_realtime_update_trigger'
);

-- Verificar funções criadas
SELECT 
    'Funções criadas:' as tipo,
    routine_name
FROM information_schema.routines 
WHERE routine_name IN (
    'notify_timeline_changes',
    'broadcast_item_paid',
    'get_realtime_stats',
    'get_timeline_stats',
    'ensure_realtime_update'
);

-- 11. Função de teste para verificar se o realtime está funcionando
CREATE OR REPLACE FUNCTION test_realtime_notification()
RETURNS TEXT AS $$
DECLARE
    test_item_id UUID;
    result TEXT;
BEGIN
    -- Criar um item de teste se não existir
    SELECT id INTO test_item_id
    FROM nt_items 
    WHERE code = 'REALTIME_TEST'
    LIMIT 1;
    
    IF test_item_id IS NULL THEN
        RETURN 'Erro: Não foi possível encontrar item de teste. Crie um item com código "REALTIME_TEST" primeiro.';
    END IF;
    
    -- Atualizar status para disparar notificação
    UPDATE nt_items 
    SET status = 'Pago',
        paid_by_name = 'TESTE REALTIME',
        updated_at = NOW()
    WHERE id = test_item_id;
    
    -- Verificar se foi criado log
    IF EXISTS (
        SELECT 1 FROM realtime_logs 
        WHERE record_id = test_item_id 
        AND created_at > NOW() - INTERVAL '10 seconds'
    ) THEN
        result := 'SUCCESS: Notificação realtime enviada com sucesso!';
    ELSE
        result := 'WARNING: Notificação enviada mas log não encontrado.';
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mensagem final
SELECT 'REALTIME TRIGGERS CONFIGURADOS COM SUCESSO!' as status;
SELECT 'Execute: SELECT test_realtime_notification(); para testar.' as instrucao;
