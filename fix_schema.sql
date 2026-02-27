-- ============================================================
-- DMAsistan — Eksik Sütunlar ve Şema Düzeltmeleri
-- Supabase Dashboard -> SQL Editor -> Run
-- ============================================================

-- 1. Platforms tablosuna platform_data ekle (JSONB)
ALTER TABLE public.platforms 
ADD COLUMN IF NOT EXISTS platform_data JSONB DEFAULT '{}';

-- 2. Conversations tablosuna platform bazlı ID'leri saklamak için sütun ekle
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS sender_id TEXT;

-- 3. Messages tablosuna platform ve sender_id ekle (AI yanıtları için kritik)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS platform TEXT,
ADD COLUMN IF NOT EXISTS sender_id TEXT;

-- 4. RLS Politikalarını Kontrol Et veya Güncelle
-- (Eğer tablolar yeni oluşturulduysa auth.uid() kontrolü olduğundan emin olalım)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'platforms_update_own') THEN
        CREATE POLICY "platforms_update_own" ON public.platforms FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;
