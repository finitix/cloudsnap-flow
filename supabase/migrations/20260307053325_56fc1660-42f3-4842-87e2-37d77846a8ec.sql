
-- Auto-heal logs table
CREATE TABLE public.deployment_heal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id uuid NOT NULL REFERENCES public.deployments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  error_category text NOT NULL DEFAULT 'unknown_error',
  error_message text,
  fix_applied text,
  fix_details jsonb DEFAULT '{}',
  result text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deployment_heal_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own heal logs" ON public.deployment_heal_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service can manage heal logs" ON public.deployment_heal_logs FOR ALL USING (true) WITH CHECK (true);

-- Deployment alerts table
CREATE TABLE public.deployment_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id uuid NOT NULL REFERENCES public.deployments(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  alert_type text NOT NULL DEFAULT 'autoheal_failed',
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deployment_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own alerts" ON public.deployment_alerts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add retry columns to deployments
ALTER TABLE public.deployments 
ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_error_category text;

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.deployment_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deployment_heal_logs;
