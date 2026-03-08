
-- Allow admins to read all cloud connections
CREATE POLICY "Admins can read all connections" ON public.cloud_connections FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
