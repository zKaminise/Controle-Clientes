'use client';

import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

type LegacyClientValues = Record<string, string | boolean>;

const initial: LegacyClientValues = {
  companyName: '',
  primaryContactName: '',
  industry: '',
  city: '',
  state: '',
  website: '',
  email: '',
  phone: '',
  whatsapp: '',
  projectName: '',
  projectType: 'other',
  productionUrl: '',
  projectStartDate: '',
  deliveryDate: '',
  soldValue: '',
  domain: '',
  domainRegistrar: '',
  domainExpirationDate: '',
  domainResponsibility: 'client',
  hostingProvider: '',
  hostingPlan: '',
  hostingRenewalDate: '',
  hasMaintenance: false,
  maintenanceDescription: 'Manutenção mensal',
  maintenanceAmount: '',
  maintenanceStartDate: '',
  postSaleDate: '',
  lastContactAt: '',
  notes: '',
};

const steps = [
  'Empresa',
  'Projeto entregue',
  'Domínio e hospedagem',
  'Manutenção',
  'Pós-venda',
];

export function LegacyClientWizard({
  open,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (data: LegacyClientValues) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<LegacyClientValues>(initial);
  const set = (key: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }));
  const canAdvance =
    (step !== 0 || Boolean(values.companyName)) &&
    (step !== 1 || Boolean(values.projectName)) &&
    (step !== 2 || !values.domain || Boolean(values.domainExpirationDate)) &&
    (step !== 2 ||
      !values.hostingProvider ||
      Boolean(values.hostingRenewalDate)) &&
    (step !== 3 || !values.hasMaintenance || Boolean(values.maintenanceAmount));

  const close = () => {
    setStep(0);
    setValues(initial);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Adicionar cliente antigo</DialogTitle>
          <DialogDescription>
            Cadastre o cliente já como atendido, sem colocá-lo na fila de
            prospecção.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {steps.map((label, index) => (
            <div
              key={label}
              className={`min-w-fit rounded-full px-3 py-1 text-xs ${index === step ? 'bg-primary text-primary-foreground' : index < step ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}
            >
              {index < step ? (
                <Check className="mr-1 inline size-3" />
              ) : (
                `${index + 1}. `
              )}
              {label}
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {step === 0 && (
            <>
              <Field label="Nome da empresa *">
                <Input
                  value={String(values.companyName)}
                  onChange={(e) => set('companyName', e.target.value)}
                />
              </Field>
              <Field label="Segmento">
                <Input
                  value={String(values.industry)}
                  onChange={(e) => set('industry', e.target.value)}
                />
              </Field>
              <Field label="Contato principal">
                <Input
                  value={String(values.primaryContactName)}
                  onChange={(e) => set('primaryContactName', e.target.value)}
                />
              </Field>
              <Field label="Cidade">
                <Input
                  value={String(values.city)}
                  onChange={(e) => set('city', e.target.value)}
                />
              </Field>
              <Field label="UF">
                <Input
                  maxLength={2}
                  value={String(values.state)}
                  onChange={(e) => set('state', e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Site">
                <Input
                  type="url"
                  value={String(values.website)}
                  onChange={(e) => set('website', e.target.value)}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={String(values.email)}
                  onChange={(e) => set('email', e.target.value)}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={String(values.phone)}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </Field>
              <Field label="WhatsApp">
                <Input
                  value={String(values.whatsapp)}
                  onChange={(e) => set('whatsapp', e.target.value)}
                />
              </Field>
            </>
          )}
          {step === 1 && (
            <>
              <Field label="Nome do projeto *">
                <Input
                  value={String(values.projectName)}
                  onChange={(e) => set('projectName', e.target.value)}
                />
              </Field>
              <Field label="Tipo">
                <NativeSelect
                  value={String(values.projectType)}
                  onChange={(e) => set('projectType', e.target.value)}
                >
                  <NativeSelectOption value="landing_page">
                    Landing page
                  </NativeSelectOption>
                  <NativeSelectOption value="institutional">
                    Site institucional
                  </NativeSelectOption>
                  <NativeSelectOption value="ecommerce">
                    E-commerce
                  </NativeSelectOption>
                  <NativeSelectOption value="web_system">
                    Sistema web
                  </NativeSelectOption>
                  <NativeSelectOption value="other">Outro</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field label="URL publicada">
                <Input
                  type="url"
                  value={String(values.productionUrl)}
                  onChange={(e) => set('productionUrl', e.target.value)}
                />
              </Field>
              <Field label="Data de entrega">
                <Input
                  type="date"
                  value={String(values.deliveryDate)}
                  onChange={(e) => set('deliveryDate', e.target.value)}
                />
              </Field>
              <Field label="Data aproximada da venda">
                <Input
                  type="date"
                  value={String(values.projectStartDate)}
                  onChange={(e) => set('projectStartDate', e.target.value)}
                />
              </Field>
              <Field label="Valor vendido">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={String(values.soldValue)}
                  onChange={(e) => set('soldValue', e.target.value)}
                />
              </Field>
            </>
          )}
          {step === 2 && (
            <>
              <Field label="Domínio">
                <Input
                  placeholder="empresa.com.br"
                  value={String(values.domain)}
                  onChange={(e) => set('domain', e.target.value)}
                />
              </Field>
              <Field label="Registrador">
                <Input
                  value={String(values.domainRegistrar)}
                  onChange={(e) => set('domainRegistrar', e.target.value)}
                />
              </Field>
              <Field label="Vencimento do domínio">
                <Input
                  type="date"
                  value={String(values.domainExpirationDate)}
                  onChange={(e) => set('domainExpirationDate', e.target.value)}
                />
              </Field>
              <Field label="Responsabilidade">
                <NativeSelect
                  value={String(values.domainResponsibility)}
                  onChange={(e) => set('domainResponsibility', e.target.value)}
                >
                  <NativeSelectOption value="me">Minha</NativeSelectOption>
                  <NativeSelectOption value="client">
                    Cliente
                  </NativeSelectOption>
                  <NativeSelectOption value="third_party">
                    Terceiro
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field label="Hospedagem">
                <Input
                  placeholder="Vercel, Hostinger..."
                  value={String(values.hostingProvider)}
                  onChange={(e) => set('hostingProvider', e.target.value)}
                />
              </Field>
              <Field label="Plano">
                <Input
                  value={String(values.hostingPlan)}
                  onChange={(e) => set('hostingPlan', e.target.value)}
                />
              </Field>
              <Field label="Renovação da hospedagem">
                <Input
                  type="date"
                  value={String(values.hostingRenewalDate)}
                  onChange={(e) => set('hostingRenewalDate', e.target.value)}
                />
              </Field>
            </>
          )}
          {step === 3 && (
            <>
              <label className="col-span-full flex items-center gap-3 rounded-xl border p-4 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(values.hasMaintenance)}
                  onChange={(e) => set('hasMaintenance', e.target.checked)}
                />
                Este cliente possui manutenção recorrente
              </label>
              {values.hasMaintenance && (
                <>
                  <Field label="Descrição">
                    <Input
                      value={String(values.maintenanceDescription)}
                      onChange={(e) =>
                        set('maintenanceDescription', e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Valor mensal *">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={String(values.maintenanceAmount)}
                      onChange={(e) => set('maintenanceAmount', e.target.value)}
                    />
                  </Field>
                  <Field label="Início da cobrança">
                    <Input
                      type="date"
                      value={String(values.maintenanceStartDate)}
                      onChange={(e) =>
                        set('maintenanceStartDate', e.target.value)
                      }
                    />
                  </Field>
                </>
              )}
              {!values.hasMaintenance && (
                <p className="col-span-full rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                  O cliente será marcado como atendido sem plano recorrente e
                  nenhuma cobrança será criada.
                </p>
              )}
            </>
          )}
          {step === 4 && (
            <>
              <Field label="Último contato">
                <Input
                  type="datetime-local"
                  value={String(values.lastContactAt)}
                  onChange={(e) => set('lastContactAt', e.target.value)}
                />
              </Field>
              <Field label="Próximo contato pós-venda">
                <Input
                  type="datetime-local"
                  value={String(values.postSaleDate)}
                  onChange={(e) => set('postSaleDate', e.target.value)}
                />
              </Field>
              <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                Se não informar, o sistema agenda automaticamente 90 dias após a
                entrega quando ela existir.
              </div>
              <div className="col-span-full">
                <Field label="Observações">
                  <Textarea
                    rows={5}
                    value={String(values.notes)}
                    onChange={(e) => set('notes', e.target.value)}
                  />
                </Field>
              </div>
              <div className="col-span-full rounded-xl border p-4 text-sm">
                <p className="font-semibold">Revisão</p>
                <p className="mt-1 text-muted-foreground">
                  {String(values.companyName)} · {String(values.projectName)}{' '}
                  entregue ·{' '}
                  {values.hasMaintenance
                    ? `manutenção de R$ ${String(values.maintenanceAmount)}/mês`
                    : 'sem manutenção recorrente'}
                  .
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-between border-t pt-4">
          <Button
            variant="outline"
            disabled={step === 0 || busy}
            onClick={() => setStep((value) => value - 1)}
          >
            <ArrowLeft />
            Voltar
          </Button>
          {step < steps.length - 1 ? (
            <Button
              disabled={!canAdvance || busy}
              onClick={() => setStep((value) => value + 1)}
            >
              Continuar
              <ArrowRight />
            </Button>
          ) : (
            <Button
              disabled={!canAdvance || busy}
              onClick={async () => {
                await onSave(values);
                close();
              }}
            >
              <Check />
              {busy ? 'Salvando...' : 'Cadastrar cliente'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
