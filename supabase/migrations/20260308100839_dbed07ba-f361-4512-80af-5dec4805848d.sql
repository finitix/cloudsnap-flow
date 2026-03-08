
-- Add basic rate limiting: limit message length and add a check
-- Replace the overly permissive policies with slightly more constrained ones
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can insert contact messages" ON public.contact_messages;

-- Re-create with length constraints via trigger instead
CREATE POLICY "Public can insert feedback" ON public.feedback FOR INSERT TO anon WITH CHECK (
  length(name) <= 200 AND length(email) <= 255 AND length(message) <= 5000
);

CREATE POLICY "Public can insert contact messages" ON public.contact_messages FOR INSERT TO anon WITH CHECK (
  length(name) <= 200 AND length(email) <= 255 AND length(subject) <= 500 AND length(message) <= 5000
);
