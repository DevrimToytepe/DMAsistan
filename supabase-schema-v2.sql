-- ============================================================
-- DMAsistan — Schema Güncellemeleri (v2 — Global Scale)
-- Supabase Dashboard → SQL Editor → Buraya yapıştır → Run
-- Mevcut schema'ya EK olarak çalıştır
-- ============================================================

-- ─────────────────────────────────────────
-- 1. PROFILES — Dil & Timezone Desteği
-- ─────────────────────────────────────────
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'tr',   -- 'tr' | 'en'
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Istanbul';

-- ─────────────────────────────────────────
-- 2. EKSİK INDEX'LER — Performans
-- ─────────────────────────────────────────

-- conversations: en sık kullanılan filtreler
CREATE INDEX IF NOT EXISTS idx_conversations_user_status 
  ON public.conversations(user_id, status);

CREATE INDEX IF NOT EXISTS idx_conversations_last_msg 
  ON public.conversations(user_id, last_message_at DESC);

-- contacts: arama için
CREATE INDEX IF NOT EXISTS idx_contacts_name 
  ON public.contacts USING gin(to_tsvector('simple', coalesce(name, '')));

CREATE INDEX IF NOT EXISTS idx_contacts_phone 
  ON public.contacts(user_id, phone);

-- usage_logs: zaman bazlı sorgu
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_action 
  ON public.usage_logs(user_id, action, created_at DESC);

-- analytics_events: event type bazlı
CREATE INDEX IF NOT EXISTS idx_analytics_event_type 
  ON public.analytics_events(user_id, event_type, created_at DESC);

-- messages: konuşma bazlı sıralı okuma
CREATE INDEX IF NOT EXISTS idx_messages_conv_created 
  ON public.messages(conversation_id, created_at ASC);

-- keywords: kullanıcı bazlı sayım (limit kontrolü için)
CREATE INDEX IF NOT EXISTS idx_keywords_user_id 
  ON public.keywords(user_id);

-- ─────────────────────────────────────────
-- 3. CONVERSATIONS — Cursor-based pagination için composite index
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conv_cursor 
  ON public.conversations(user_id, last_message_at DESC, id);

-- ─────────────────────────────────────────
-- 4. RLS DOĞRULAMA — Tüm tabloların RLS açık olduğunu teyit et
-- ─────────────────────────────────────────
-- Bu sorgu RLS'i kapalı tabloları listeler (boş olmalı):
-- SELECT tablename FROM pg_tables 
-- WHERE schemaname = 'public' 
--   AND tablename NOT IN (
--     SELECT relname FROM pg_class c
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--     WHERE n.nspname = 'public' AND c.relrowsecurity = true
--   );

-- ─────────────────────────────────────────
-- 5. PROFILES — check_limit fonksiyonuna keyword desteği ekle
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_limit(p_user_id UUID, p_resource TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan    TEXT;
  v_limits  JSONB;
  v_current INTEGER;
  v_limit   INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = p_user_id;
  v_limits := public.get_plan_limits(COALESCE(v_plan, 'free'));
  
  -- keyword limiti plan limitlerinde yoksa 100 olarak ayarla
  IF p_resource = 'keywords' THEN
    v_limit := COALESCE((v_limits->>'keywords')::INTEGER, 100);
    SELECT COUNT(*) INTO v_current FROM public.keywords WHERE user_id = p_user_id;
  ELSIF p_resource = 'messages' THEN
    v_limit := (v_limits->>'messages')::INTEGER;
    v_current := public.get_monthly_message_count(p_user_id);
  ELSIF p_resource = 'platforms' THEN
    v_limit := (v_limits->>'platforms')::INTEGER;
    SELECT COUNT(*) INTO v_current FROM public.platforms WHERE user_id = p_user_id AND is_active = TRUE;
  ELSIF p_resource = 'contacts' THEN
    v_limit := (v_limits->>'contacts')::INTEGER;
    SELECT COUNT(*) INTO v_current FROM public.contacts WHERE user_id = p_user_id;
  ELSIF p_resource = 'templates' THEN
    v_limit := (v_limits->>'templates')::INTEGER;
    SELECT COUNT(*) INTO v_current FROM public.templates WHERE user_id = p_user_id;
  ELSE
    v_current := 0;
    v_limit := 0;
  END IF;

  RETURN jsonb_build_object(
    'allowed',   v_current < v_limit,
    'current',   v_current,
    'limit',     v_limit,
    'plan',      v_plan,
    'resource',  p_resource
  );
END;
$$;

-- ─────────────────────────────────────────
-- 6. PLAN LİMİTLERİ — keyword limiti ekle
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  RETURN CASE p_plan
    WHEN 'free'       THEN '{"messages":500,"platforms":1,"templates":3,"contacts":100,"keywords":20}'::JSONB
    WHEN 'pro'        THEN '{"messages":10000,"platforms":3,"templates":50,"contacts":10000,"keywords":100}'::JSONB
    WHEN 'enterprise' THEN '{"messages":999999,"platforms":99,"templates":999,"contacts":999999,"keywords":999}'::JSONB
    ELSE '{"messages":500,"platforms":1,"templates":3,"contacts":100,"keywords":20}'::JSONB
  END;
END;
$$;

-- ─────────────────────────────────────────
-- 7. ANALYTICS_EVENTS — platform + user_agent için metadata index
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_analytics_metadata 
  ON public.analytics_events USING gin(metadata);

-- ─────────────────────────────────────────
-- 8. USAGE_LOGS — RLS insert policy (analytics_events insert)
-- ─────────────────────────────────────────
-- analytics_events tablosuna insert için policy (zaten var, ama doğrula)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'analytics_events' 
    AND policyname = 'analytics_insert_own'
  ) THEN
    CREATE POLICY "analytics_insert_own" ON public.analytics_events
      FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

-- ─────────────────────────────────────────
-- ✅ TAMAMLANDI
-- ─────────────────────────────────────────
-- Bu script'i çalıştırdıktan sonra kontrol et:
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;
