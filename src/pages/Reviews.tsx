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
    if (!user) { toast.error("Please sign in to submit a review."); return; }
    if (!name || !message) { toast.error("Please fill in all fields."); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: user.id, name, email, message, rating, type,
      });
      if (error) throw error;
      toast.success("Thank you! Your review will appear after approval.");
      setMessage("");
      setRating(5);
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Reviews & Feedback</h1>
          <p className="text-muted-foreground">See what our users think, or share your own experience.</p>
        </div>

        {/* Submit form */}
        <div className="glass-card rounded-2xl p-8 mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> Leave a Review
          </h2>
          {!user ? (
            <p className="text-sm text-muted-foreground">Please <a href="/auth" className="text-primary hover:underline">sign in</a> to leave a review.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={type === "review" ? "default" : "outline"} size="sm" onClick={() => setType("review")}>Review</Button>
                    <Button type="button" variant={type === "feedback" ? "default" : "outline"} size="sm" onClick={() => setType("feedback")}>Feedback</Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button key={i} type="button" onClick={() => setRating(i)} className="p-0.5">
                      <Star className={`h-6 w-6 transition-colors ${i <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share your experience..."
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Review"}
              </Button>
            </form>
          )}
        </div>

        {/* Reviews list */}
        {reviews.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No reviews yet. Be the first to share your experience!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((r) => (
              <div key={r.id} className="glass-card rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-0.5">
                    {Array.from({ length: r.rating || 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">"{r.message}"</p>
                <p className="text-sm font-medium">{r.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
