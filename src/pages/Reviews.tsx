import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import PublicLayout from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function Reviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [type, setType] = useState<"review" | "feedback">("review");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("feedback").select("*").eq("is_published", true).order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setReviews(data);
    });
    if (user) {
      setEmail(user.email || "");
      setName(user.user_metadata?.display_name || "");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) { toast.error("Please fill in all fields."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Please enter a valid email."); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: user?.id || null,
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        rating,
        type,
      });
      if (error) throw error;
      toast.success("Thank you! Your review will appear after approval.");
      setMessage("");
      setRating(5);
      if (!user) { setName(""); setEmail(""); }
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4 border border-primary/20">
            <Star className="h-3 w-3" /> Community Voices
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Reviews & Feedback</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">See what our users think about Cloudsnap Studio, or share your own experience. No account required.</p>
        </div>

        {/* Submit form */}
        <div className="glass-card rounded-2xl p-8 mb-12 glow-border">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> Share Your Experience
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Your Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" required maxLength={255} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={type === "review" ? "default" : "outline"} size="sm" onClick={() => setType("review")}>
                    <Star className="h-3.5 w-3.5 mr-1" /> Review
                  </Button>
                  <Button type="button" variant={type === "feedback" ? "default" : "outline"} size="sm" onClick={() => setType("feedback")}>
                    <MessageSquare className="h-3.5 w-3.5 mr-1" /> Feedback
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button key={i} type="button" onClick={() => setRating(i)} className="p-0.5 transition-transform hover:scale-110">
                      <Star className={`h-6 w-6 transition-colors ${i <= rating ? "fill-primary text-primary" : "text-muted-foreground/20"}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us about your experience with Cloudsnap Studio..."
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                required
                maxLength={5000}
              />
              <p className="text-[10px] text-muted-foreground text-right">{message.length}/5000</p>
            </div>
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? "Submitting..." : "Submit Review"}
            </Button>
          </form>
        </div>

        {/* Reviews list */}
        {reviews.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Star className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <h3 className="font-semibold mb-2">No reviews yet</h3>
            <p className="text-sm">Be the first to share your experience!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((r) => (
              <div key={r.id} className="glass-card rounded-xl p-6 hover:border-primary/20 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-0.5">
                    {Array.from({ length: r.rating || 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />
                    ))}
                    {Array.from({ length: 5 - (r.rating || 5) }).map((_, i) => (
                      <Star key={`empty-${i}`} className="h-3.5 w-3.5 text-muted-foreground/20" />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{r.message}"</p>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                    {r.name[0]?.toUpperCase()}
                  </div>
                  <p className="text-sm font-medium">{r.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
