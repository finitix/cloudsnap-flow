
-- Allow anonymous (non-authenticated) users to insert feedback
CREATE POLICY "Anyone can insert feedback" ON public.feedback FOR INSERT TO anon WITH CHECK (true);

-- Allow anonymous users to insert contact messages
CREATE POLICY "Anyone can insert contact messages" ON public.contact_messages FOR INSERT TO anon WITH CHECK (true);

-- Make user_id nullable on feedback so anonymous users can submit
ALTER TABLE public.feedback ALTER COLUMN user_id DROP NOT NULL;

-- Make user_id nullable on contact_messages (already nullable)
