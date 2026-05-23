import { Card, CardContent } from "@/components/ui/card";

export default function MetricsPage() {
  return (
    <div className="flex-1 px-8 py-8 max-w-6xl">
      <header className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Workflow-level eval results: classification accuracy, field extraction F1,
          straight-through rate, phishing false positive rate, ingestion latency.
        </p>
      </header>
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Eval harness + dashboard land Day 5–7. Run <code className="font-mono text-xs">pnpm eval</code> to regenerate.
        </CardContent>
      </Card>
    </div>
  );
}
