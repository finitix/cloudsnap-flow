-- Clean up stuck deployments and add a helper function
UPDATE public.deployments 
SET status = 'error', 
    error_message = 'Deployment timed out - please retry'
WHERE status IN ('deploying', 'building') 
  AND updated_at < NOW() - INTERVAL '10 minutes';

-- Create a function to clean up stuck deployments (can be called from edge functions)
CREATE OR REPLACE FUNCTION public.cleanup_stuck_deployments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.deployments 
  SET status = 'error', 
      error_message = 'Deployment timed out - please retry'
  WHERE status IN ('deploying', 'building') 
    AND updated_at < NOW() - INTERVAL '10 minutes';
END;
$$;