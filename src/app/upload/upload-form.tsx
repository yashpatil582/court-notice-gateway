'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadNotice, type UploadResult } from './actions';

export function UploadForm() {
  const [state, action, pending] = useActionState<UploadResult | null, FormData>(
    uploadNotice,
    null,
  );

  return (
    <Card>
      <CardContent className="py-8">
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="file">PDF file</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              Max 10MB. The notice will be parsed, validated against the sender
              and link allowlists, and routed to the inbox.
            </p>
          </div>

          {state?.error ? (
            <div className="text-sm text-destructive">{state.error}</div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? 'Ingesting…' : 'Upload notice'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
