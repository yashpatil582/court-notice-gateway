import { Card, CardContent } from "@/components/ui/card";

export default function ReviewQueuePage() {
  return (
    <div className="flex-1 px-8 py-8 max-w-6xl">
      <header className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Review Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Notices with low extraction confidence routed to a paralegal for review.
        </p>
      </header>
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Review surface lands Day 4. Side-by-side PDF + editable extracted fields with confidence bars.
        </CardContent>
      </Card>
    </div>
  );
}
