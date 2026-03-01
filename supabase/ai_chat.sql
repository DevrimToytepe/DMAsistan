-- AI Chatbot (Yardımcı) Tabloları

CREATE TABLE public.ai_chat_usage (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    date date NOT NULL,
    message_count integer DEFAULT 0,
    plan text DEFAULT 'free',
    created_at timestamp with time zone DEFAULT now()
);

-- Her kullanıcının günde sadece 1 kaydı olmalı
CREATE UNIQUE INDEX ai_chat_usage_user_date_idx ON public.ai_chat_usage (user_id, date);

-- RLS (Row Level Security)
ALTER TABLE public.ai_chat_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kullanıcılar kendi kullanımlarını görebilir" ON public.ai_chat_usage FOR SELECT USING (auth.uid() = user_id);
-- Insert/Update is done largely via edge function (service_role), but if user calls it directly:
CREATE POLICY "Kullanıcılar kendi kullanımlarını kontrol edebilir" ON public.ai_chat_usage FOR ALL USING (auth.uid() = user_id);


CREATE TABLE public.ai_chat_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text CHECK (role IN ('user', 'bot')),
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kullanıcılar mesaj geçmişini görebilir" ON public.ai_chat_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Kullanıcılar mesajlarını ekleyebilir" ON public.ai_chat_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
-- delete yok
