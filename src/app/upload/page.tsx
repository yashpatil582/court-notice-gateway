import { Card, CardContent } from "@/components/ui/card";

export default function UploadPage() {
  return (
    <div className="flex-1 px-8 py-8 max-w-3xl">
      <header className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Upload notice</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drop a forwarded PACER / CM-ECF notice PDF. It will be parsed,
          validated, classified, and routed.
        </p>
      </header>
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          PDF upload + ingestion pipeline lands Day 2.
        </CardContent>
      </Card>
    </div>
  );
}
