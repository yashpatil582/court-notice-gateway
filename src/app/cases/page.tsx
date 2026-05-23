import { Card, CardContent } from "@/components/ui/card";

export default function CasesPage() {
  return (
    <div className="flex-1 px-8 py-8 max-w-6xl">
      <header className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Case timelines with notices, extracted hearings, and generated tasks.
        </p>
      </header>
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Case list + timeline detail screen lands Day 4.
        </CardContent>
      </Card>
    </div>
  );
}
