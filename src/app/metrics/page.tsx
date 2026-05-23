import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { loadEvalReport } from '@/lib/eval-report';

export const dynamic = 'force-dynamic';

function passColor(label: string, result: string, target: string): string {
  // Crude pass/fail based on whether result clears the target threshold.
  const num = (s: string) => Number(s.replace(/[^\d.]/g, ''));
  const isLowerBetter = target.startsWith('≤') || label.toLowerCase().includes('latency') || label.toLowerCase().includes('false');
  const r = num(result);
  const t = num(target);
  if (Number.isNaN(r) || Number.isNaN(t)) return 'text-foreground';
  return (isLowerBetter ? r <= t : r >= t) ? 'text-emerald-600' : 'text-amber-600';
}

export default async function MetricsPage() {
  const report = loadEvalReport();

  if (!report) {
    return (
      <div className="flex-1 px-8 py-8 max-w-6xl">
        <header className="pb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
        </header>
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No eval report yet. Run <code className="font-mono text-xs">pnpm eval</code> to generate one.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 px-8 py-8 max-w-6xl">
      <header className="pb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Eval Metrics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {report.fixtureCount} fixtures (legit: {report.legitCount}, phishing: {report.phishingCount}) ·{' '}
            model <span className="font-mono">{report.model}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Generated {new Date(report.generatedAt).toLocaleString()}. Reproduce locally with{' '}
            <code className="font-mono">pnpm eval</code>.
          </p>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Headline metrics
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {report.headline.map((m) => (
            <Card key={m.label}>
              <CardContent className="py-4 px-4">
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className={`text-2xl font-semibold tabular-nums mt-1 ${passColor(m.label, m.result, m.target)}`}>
                  {m.result}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                  target {m.target}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Field extraction (F1 per field) — macro F1 {report.macroF1}
        </h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead className="text-right">Precision</TableHead>
                <TableHead className="text-right">Recall</TableHead>
                <TableHead className="text-right">F1</TableHead>
                <TableHead className="text-right">TP</TableHead>
                <TableHead className="text-right">FP</TableHead>
                <TableHead className="text-right">FN</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.fields.map((f) => (
                <TableRow key={f.field}>
                  <TableCell className="font-mono text-xs">{f.field}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{f.precision}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{f.recall}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{f.f1}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{f.tp}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{f.fp}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{f.fn}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Per-fixture detail
        </h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fixture</TableHead>
                <TableHead>Case</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Conf.</TableHead>
                <TableHead className="text-right">Lat (s)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.fixtures.map((r) => (
                <TableRow key={r.fixture}>
                  <TableCell className="font-mono text-xs">{r.fixture}</TableCell>
                  <TableCell className="text-xs">{r.caseCell}</TableCell>
                  <TableCell className="text-xs">{r.typeCell}</TableCell>
                  <TableCell className="text-xs">{r.statusCell}</TableCell>
                  <TableCell className="text-right text-xs">{r.confidence}</TableCell>
                  <TableCell className="text-right text-xs">{r.latencySec}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
