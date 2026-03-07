
DROP POLICY "Service can manage heal logs" ON public.deployment_heal_logs;
CREATE POLICY "Users can insert own heal logs" ON public.deployment_heal_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
