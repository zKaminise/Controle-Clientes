'use client';

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Preview = {
  headers: string[];
  mapping: Record<string, string>;
  preview: Array<{
    row: number;
    status: 'valid' | 'invalid' | 'duplicate';
    company: {
      name?: string;
      city?: string | null;
      state?: string | null;
    } | null;
    duplicate: { name: string; reasons: string[] } | null;
    error: string | null;
  }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
    willCreate: number;
    willUpdate: number;
    willSkip: number;
  };
  previewLimited?: boolean;
  error?: string;
};

const targets: Array<[string, string]> = [
  ['', 'Ignorar coluna'],
  ['name', 'Empresa'],
  ['tradeName', 'Nome fantasia'],
  ['legalName', 'Razão social'],
  ['document', 'Documento/CNPJ'],
  ['industry', 'Segmento'],
  ['city', 'Cidade'],
  ['state', 'Estado'],
  ['primaryContactName', 'Responsável/contato'],
  ['phone', 'Telefone'],
  ['whatsapp', 'WhatsApp'],
  ['email', 'E-mail'],
  ['instagram', 'Instagram'],
  ['website', 'Site'],
  ['leadSource', 'Origem'],
  ['sourceUrl', 'URL da origem'],
  ['prospectingStatus', 'Etapa da prospecção'],
  ['notesSummary', 'Observações'],
  ['hasSite', 'Possui site'],
  ['siteStatus', 'Status do site'],
  ['overallQuality', 'Qualidade geral (0–5)'],
  ['mobileQuality', 'Mobile (0–5)'],
  ['speedQuality', 'Velocidade (0–5)'],
  ['designQuality', 'Design (0–5)'],
  ['valuePropositionQuality', 'Proposta de valor (0–5)'],
  ['ctaQuality', 'CTA (0–5)'],
  ['hasWhatsappIntegration', 'Integração WhatsApp'],
  ['hasBasicSeo', 'SEO básico'],
  ['hasHttps', 'HTTPS'],
  ['hasBrokenLinks', 'Links quebrados'],
  ['hasActiveDigitalPresence', 'Presença digital ativa'],
  ['issues', 'Problemas do site'],
  ['opportunities', 'Oportunidade de melhoria'],
  ['scoreOverride', 'Lead score'],
  ['priority', 'Prioridade'],
];

export function ImportLeadsDialog({
  content,
  fileName,
  onClose,
  onImported,
}: {
  content: string | null;
  fileName: string | null;
  onClose: () => void;
  onImported: (message: string) => Promise<void>;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicateAction, setDuplicateAction] = useState<
    'reject' | 'ignore' | 'update'
  >('reject');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(
    async (
      currentMapping?: Record<string, string>,
      currentAction: 'reject' | 'ignore' | 'update' = 'reject',
    ) => {
      if (!content) return;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch('/api/import/companies', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            content,
            mapping:
              currentMapping && Object.keys(currentMapping).length
                ? currentMapping
                : undefined,
            duplicateAction: currentAction,
            confirm: false,
          }),
        });
        const result = (await response.json()) as Preview;
        if (!response.ok)
          throw new Error(
            result.error || 'Não foi possível validar o arquivo.',
          );
        setPreview(result);
        setMapping(result.mapping);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Não foi possível validar o arquivo.',
        );
      } finally {
        setBusy(false);
      }
    },
    [content],
  );

  useEffect(() => {
    if (content) void loadPreview(undefined, 'reject');
    else {
      setPreview(null);
      setMapping({});
      setError(null);
    }
  }, [content, loadPreview]);

  async function confirmImport() {
    if (!content || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/import/companies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content,
          mapping,
          duplicateAction,
          confirm: true,
        }),
      });
      const result = (await response.json()) as {
        created?: number;
        updated?: number;
        skipped?: number;
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || 'Não foi possível importar.');
      await onImported(
        `${result.created || 0} criados, ${result.updated || 0} atualizados e ${result.skipped || 0} ignorados.`,
      );
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível importar.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(content)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Importar leads com segurança</DialogTitle>
          <DialogDescription>
            {fileName || 'Arquivo CSV'} · confira o mapeamento, erros e
            duplicidades antes de confirmar.
          </DialogDescription>
        </DialogHeader>
        {busy && !preview ? (
          <div className="grid h-40 place-items-center">
            <LoaderCircle className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4" />
                {error}
              </div>
            )}
            {preview && (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    ['Linhas', preview.summary.total],
                    ['Novos', preview.summary.valid],
                    ['Duplicados', preview.summary.duplicates],
                    ['Com erro', preview.summary.invalid],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="text-xs text-muted-foreground">
                        {label}
                      </div>
                      <div className="mt-1 text-xl font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
                <section>
                  <h3 className="mb-2 text-sm font-semibold">
                    1. Mapeamento das colunas
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {preview.headers.map((header) => (
                      <label
                        key={header}
                        className="rounded-lg border p-2 text-xs"
                      >
                        <span
                          className="mb-1 block truncate font-medium"
                          title={header}
                        >
                          {header}
                        </span>
                        <NativeSelect
                          className="w-full"
                          size="sm"
                          value={mapping[header] || ''}
                          onChange={(event) =>
                            setMapping((current) => ({
                              ...current,
                              [header]: event.target.value,
                            }))
                          }
                        >
                          {targets.map(([value, label]) => (
                            <NativeSelectOption key={value} value={value}>
                              {label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </label>
                    ))}
                  </div>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => loadPreview(mapping, duplicateAction)}
                  >
                    <RefreshCw className={busy ? 'animate-spin' : ''} />
                    Revalidar mapeamento
                  </Button>
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-semibold">
                    2. Como tratar duplicados
                  </h3>
                  <NativeSelect
                    className="w-full sm:w-96"
                    value={duplicateAction}
                    onChange={(event) => {
                      const value = event.target.value as
                        | 'reject'
                        | 'ignore'
                        | 'update';
                      setDuplicateAction(value);
                      void loadPreview(mapping, value);
                    }}
                  >
                    <NativeSelectOption value="reject">
                      Parar até eu escolher
                    </NativeSelectOption>
                    <NativeSelectOption value="ignore">
                      Ignorar registros duplicados
                    </NativeSelectOption>
                    <NativeSelectOption value="update">
                      Atualizar registros que já existem
                    </NativeSelectOption>
                  </NativeSelect>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A verificação usa telefone/WhatsApp, e-mail, domínio e nome
                    + cidade.
                  </p>
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-semibold">3. Prévia</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Linha</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Local</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead>Detalhe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.preview.map((row) => (
                        <TableRow key={row.row}>
                          <TableCell>{row.row}</TableCell>
                          <TableCell>{row.company?.name || '—'}</TableCell>
                          <TableCell>
                            {[row.company?.city, row.company?.state]
                              .filter(Boolean)
                              .join('/') || '—'}
                          </TableCell>
                          <TableCell>
                            {row.status === 'valid' ? (
                              <Badge>
                                <CheckCircle2 />
                                Pronto
                              </Badge>
                            ) : row.status === 'duplicate' ? (
                              <Badge variant="outline">Duplicado</Badge>
                            ) : (
                              <Badge variant="destructive">Erro</Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-80 whitespace-normal text-xs text-muted-foreground">
                            {row.error || 'Será criado.'}
                            {row.duplicate &&
                              ` Registro encontrado: ${row.duplicate.name}.`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {preview.previewLimited && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      A prévia mostra as primeiras 100 linhas; todas serão
                      validadas.
                    </p>
                  )}
                </section>
              </>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={
              busy ||
              !preview ||
              (preview.summary.duplicates > 0 &&
                duplicateAction === 'reject') ||
              preview.summary.valid + preview.summary.willUpdate === 0
            }
            onClick={confirmImport}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <Upload />}
            Confirmar importação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
