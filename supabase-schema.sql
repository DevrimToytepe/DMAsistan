-- ============================================================
-- DMAsistan — Supabase Tam Schema
-- Supabase Dashboard → SQL Editor → Buraya yapıştır → Run
-- ============================================================

-- ─────────────────────────────────────────
-- 1. EXTENSIONS
-- ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- 2. PROFILES TABLOSU
--    auth.users ile 1-1 ilişki
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  avatar_url    TEXT,
  phone         TEXT,
  bio           TEXT,
  business_name TEXT,
  industry      TEXT DEFAULT 'E-ticaret',
  city          TEXT,
  plan          TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'pro' | 'enterprise'
  plan_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 3. PLATFORMS TABLOSU
--    Kullanıcının bağladığı sosyal medya hesapları
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platforms (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL,   -- 'instagram' | 'whatsapp' | 'facebook' | 'tiktok'
  account_name  TEXT,
  account_handle TEXT,
  account_id    TEXT,            -- platform'un kendi ID'si
  access_token  TEXT,            -- şifreli saklanmalı (Vault kullan production'da)
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  followers_count INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  connected_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- ─────────────────────────────────────────
-- 4. CONVERSATIONS TABLOSU
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform_id   UUID REFERENCES public.platforms(id) ON DELETE SET NULL,
  platform      TEXT NOT NULL,
  contact_name  TEXT,
  contact_handle TEXT,
  contact_avatar TEXT,
  last_message  TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count  INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'open',  -- 'open' | 'closed' | 'pending'
  tags          TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 5. MESSAGES TABLOSU
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL,   -- 'inbound' | 'outbound'
  sender          TEXT NOT NULL,   -- 'user' | 'ai' | 'human_agent'
  content         TEXT NOT NULL,
  is_ai           BOOLEAN DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 6. CONTACTS TABLOSU
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform      TEXT,
  name          TEXT,
  handle        TEXT,
  avatar_url    TEXT,
  email         TEXT,
  phone         TEXT,
  status        TEXT DEFAULT 'cold',  -- 'hot' | 'warm' | 'cold' | 'customer'
  notes         TEXT,
  tags          TEXT[] DEFAULT '{}',
  first_contact_at TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 7. AI_SETTINGS TABLOSU
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bot_name      TEXT DEFAULT 'DMAsistan',
  tone          TEXT DEFAULT 'Samimi ve Sıcak',
  language      TEXT DEFAULT 'tr',
  system_prompt TEXT,
  creativity    INTEGER DEFAULT 70,   -- 0-100
  auto_reply    BOOLEAN DEFAULT TRUE,
  use_emoji     BOOLEAN DEFAULT TRUE,
  sales_focused BOOLEAN DEFAULT TRUE,
  working_hours_only BOOLEAN DEFAULT FALSE,
  working_start TIME DEFAULT '09:00',
  working_end   TIME DEFAULT '18:00',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ─────────────────────────────────────────
-- 8. TEMPLATES TABLOSU
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT DEFAULT 'general',  -- 'welcome' | 'sales' | 'support' | 'general'
  content       TEXT NOT NULL,
  variables     TEXT[] DEFAULT '{}',    -- ['{{isim}}', '{{link}}']
  is_active     BOOLEAN DEFAULT TRUE,
  usage_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 9. KEYWORDS TABLOSU
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.keywords (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keywords      TEXT[] NOT NULL,       -- ['fiyat', 'ücret']
  response      TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  match_type    TEXT DEFAULT 'contains', -- 'exact' | 'contains'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 10. USAGE_LOGS TABLOSU (Limit takibi)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,  -- 'message_sent' | 'ai_reply' | 'platform_connected'
  platform      TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 11. SUBSCRIPTIONS TABLOSU (Stripe)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id    TEXT,
  plan                  TEXT NOT NULL DEFAULT 'free',
  status                TEXT DEFAULT 'active', -- 'active' | 'canceled' | 'past_due' | 'trialing'
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 12. ANALYTICS_EVENTS TABLOSU
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,   -- 'conversation_started' | 'message_sent' | 'ai_resolved' | 'conversion'
  platform    TEXT,
  contact_id  UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  value       NUMERIC,         -- satış değeri vb.
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 13. ONBOARDING_STEPS TABLOSU
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_steps (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  step        TEXT NOT NULL,    -- 'profile' | 'platform' | 'ai_setup' | 'template' | 'complete'
  completed   BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, step)
);

-- ============================================================
-- RLS — ROW LEVEL SECURITY
-- ============================================================

-- Tüm tablolarda RLS aç
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platforms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_steps    ENABLE ROW LEVEL SECURITY;

-- ── PROFILES RLS ──
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ── PLATFORMS RLS ──
CREATE POLICY "platforms_all_own" ON public.platforms
  FOR ALL USING (auth.uid() = user_id);

-- ── CONVERSATIONS RLS ──
CREATE POLICY "conversations_all_own" ON public.conversations
  FOR ALL USING (auth.uid() = user_id);

-- ── MESSAGES RLS ──
CREATE POLICY "messages_all_own" ON public.messages
  FOR ALL USING (auth.uid() = user_id);

-- ── CONTACTS RLS ──
CREATE POLICY "contacts_all_own" ON public.contacts
  FOR ALL USING (auth.uid() = user_id);

-- ── AI_SETTINGS RLS ──
CREATE POLICY "ai_settings_all_own" ON public.ai_settings
  FOR ALL USING (auth.uid() = user_id);

-- ── TEMPLATES RLS ──
CREATE POLICY "templates_all_own" ON public.templates
  FOR ALL USING (auth.uid() = user_id);

-- ── KEYWORDS RLS ──
CREATE POLICY "keywords_all_own" ON public.keywords
  FOR ALL USING (auth.uid() = user_id);

-- ── USAGE_LOGS RLS ──
CREATE POLICY "usage_logs_select_own" ON public.usage_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "usage_logs_insert_own" ON public.usage_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── SUBSCRIPTIONS RLS ──
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- ── ANALYTICS_EVENTS RLS ──
CREATE POLICY "analytics_all_own" ON public.analytics_events
  FOR ALL USING (auth.uid() = user_id);

-- ── ONBOARDING_STEPS RLS ──
CREATE POLICY "onboarding_all_own" ON public.onboarding_steps
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- ── Yeni kullanıcı kaydında otomatik profil oluştur ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Profil oluştur
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- AI ayarları başlat
  INSERT INTO public.ai_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Onboarding adımlarını oluştur
  INSERT INTO public.onboarding_steps (user_id, step) VALUES
    (NEW.id, 'profile'),
    (NEW.id, 'platform'),
    (NEW.id, 'ai_setup'),
    (NEW.id, 'template'),
    (NEW.id, 'complete')
  ON CONFLICT (user_id, step) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── updated_at otomatik güncelle ──
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER platforms_updated_at BEFORE UPDATE ON public.platforms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER ai_settings_updated_at BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Aylık mesaj sayısını döndüren fonksiyon ──
CREATE OR REPLACE FUNCTION public.get_monthly_message_count(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.usage_logs
  WHERE user_id = p_user_id
    AND action = 'message_sent'
    AND created_at >= date_trunc('month', NOW());
  RETURN COALESCE(v_count, 0);
END;
$$;

-- ── Plan limitlerini döndüren fonksiyon ──
CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  RETURN CASE p_plan
    WHEN 'free'       THEN '{"messages":500,"platforms":1,"templates":3,"contacts":100}'::JSONB
    WHEN 'pro'        THEN '{"messages":10000,"platforms":3,"templates":50,"contacts":10000}'::JSONB
    WHEN 'enterprise' THEN '{"messages":999999,"platforms":99,"templates":999,"contacts":999999}'::JSONB
    ELSE '{"messages":500,"platforms":1,"templates":3,"contacts":100}'::JSONB
  END;
END;
$$;

-- ── Kullanıcı limitini kontrol eden fonksiyon ──
CREATE OR REPLACE FUNCTION public.check_limit(p_user_id UUID, p_resource TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan TEXT;
  v_limits JSONB;
  v_current INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = p_user_id;
  v_limits := public.get_plan_limits(COALESCE(v_plan, 'free'));
  v_limit := (v_limits ->> p_resource)::INTEGER;

  IF p_resource = 'messages' THEN
    v_current := public.get_monthly_message_count(p_user_id);
  ELSIF p_resource = 'platforms' THEN
    SELECT COUNT(*) INTO v_current FROM public.platforms WHERE user_id = p_user_id AND is_active = TRUE;
  ELSIF p_resource = 'contacts' THEN
    SELECT COUNT(*) INTO v_current FROM public.contacts WHERE user_id = p_user_id;
  ELSE
    v_current := 0;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_current < v_limit,
    'current', v_current,
    'limit', v_limit,
    'plan', v_plan,
    'resource', p_resource
  );
END;
$$;

-- ── Stripe webhook'tan plan güncelleme ──
CREATE OR REPLACE FUNCTION public.update_user_plan(
  p_stripe_customer_id TEXT,
  p_plan TEXT,
  p_status TEXT,
  p_period_end TIMESTAMPTZ
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET
    plan = p_plan,
    plan_expires_at = p_period_end,
    updated_at = NOW()
  WHERE stripe_customer_id = p_stripe_customer_id;

  UPDATE public.subscriptions
  SET
    plan = p_plan,
    status = p_status,
    current_period_end = p_period_end,
    updated_at = NOW()
  WHERE stripe_customer_id = p_stripe_customer_id;
END;
$$;

-- ============================================================
-- INDEXES (Performans)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_platforms_user_id ON public.platforms(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_platform ON public.conversations(platform);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON public.contacts(status);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON public.usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON public.templates(user_id);

-- ============================================================
-- ÖRNEK VERİ (Opsiyonel — test için)
-- ============================================================
-- INSERT INTO public.templates (user_id, name, category, content)
-- VALUES (auth.uid(), 'Hoş Geldin', 'welcome', 'Merhaba {{isim}}! 👋 Nasıl yardımcı olabilirim?');
