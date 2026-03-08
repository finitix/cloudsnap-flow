import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Admin emails - add your email here
const ADMIN_EMAILS = ["admin@cloudsnap.studio"];

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setLoading(false); return; }

    const checkAdmin = async () => {
      // Check database role first
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (data === true) {
        setIsAdmin(true);
      } else {
        // Fallback: check if email is in admin list (for initial setup)
        // You should assign the admin role in the database after first login
        setIsAdmin(ADMIN_EMAILS.includes(user.email || ""));
      }
      setLoading(false);
    };
    checkAdmin();
  }, [user]);

  return { isAdmin, loading };
}
