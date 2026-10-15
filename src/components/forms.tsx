import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Field, Modal, SelectInput, TextArea, TextInput } from "@/components/ui";
import {
  CLIENT_STATUS,
  CONTRACT_STATUS,
  FINANCE_STATUS,
  PRIORITIES,
  PROJECT_STATUS,
  UPDATE_STATUS,
  brDate,
  centsToInput,
  parseMoney,
  saoPauloToday,
} from "@/lib/ops/format";
import { useAuthedQuery } from "@/lib/ops/query";
import {
  getDirectory,
  saveAppointment,
  saveClient,
  saveContract,
  saveFinance,
  saveProject,
  saveTask,
  saveUpdate,
} from "@/lib/ops/server";
import type { Appointment, Client, Contract, Finance, Project, ProjectUpdate, Task } from "@/lib/ops/types";
import { errorText } from "@/lib/utils";

function useDir() {
  return useAuthedQuery(["ops", "directory"], () => getDirectory());
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: ["ops"] });
}

function ClientOptions({
  value,
  onChange,
  clients,
}: {
  value: string;
  onChange: (value: string) => void;
  clients: { id: string; name: string; company: string }[];
}) {
  return (
    <SelectInput value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Nenhum</option>
      {clients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.company ? `${client.name} · ${client.company}` : client.name}
        </option>
      ))}
    </SelectInput>
  );
}

export function ClientForm({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Client | null;
}) {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [segment, setSegment] = useState("");
  const [document, setDocument] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<Client["status"]>("ativo");
  const [notes, setNotes] = useState("");
  const [extra, setExtra] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setCompany(initial?.company ?? "");
    setPhone(initial?.phone ?? "");
    setWhatsapp(initial?.whatsapp ?? "");
    setEmail(initial?.email ?? "");
    setSegment(initial?.segment ?? "");
    setDocument(initial?.document ?? "");
    setAddress(initial?.address ?? "");
    setStatus(initial?.status ?? "ativo");
    setNotes(initial?.notes ?? "");
    setExtra(initial?.extra ?? "");
  }, [open, initial]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const saved = await saveClient({
        data: { id: initial?.id, name, company, phone, whatsapp, email, segment, document, address, status, notes, extra },
      });
      toast.success(saved.created ? "Cliente cadastrado com sucesso." : "Cliente atualizado.");
      onOpenChange(false);
      await invalidate(qc);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? "Editar cliente" : "Novo cliente"}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" className="sm:col-span-2">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
        </Field>
        <Field label="Empresa">
          <TextInput value={company} onChange={(event) => setCompany(event.target.value)} />
        </Field>
        <Field label="Segmento">
          <TextInput value={segment} onChange={(event) => setSegment(event.target.value)} />
        </Field>
        <Field label="Telefone">
          <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
        </Field>
        <Field label="WhatsApp">
          <TextInput value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} inputMode="tel" />
        </Field>
        <Field label="E-mail">
          <TextInput value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" />
        </Field>
        <Field label="CPF/CNPJ">
          <TextInput value={document} onChange={(event) => setDocument(event.target.value)} />
        </Field>
        <Field label="Status">
          <SelectInput value={status} onChange={(event) => setStatus(event.target.value as Client["status"])}>
            {CLIENT_STATUS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Endereço" className="sm:col-span-2">
          <TextInput value={address} onChange={(event) => setAddress(event.target.value)} />
        </Field>
        <Field label="Informações adicionais" className="sm:col-span-2">
          <TextArea value={extra} onChange={(event) => setExtra(event.target.value)} />
        </Field>
        <Field label="Observações internas" className="sm:col-span-2">
          <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar cliente"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ProjectForm({
  open,
  onOpenChange,
  initial,
  clientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Project | null;
  clientId?: string | null;
}) {
  const qc = useQueryClient();
  const dir = useDir();
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [linked, setLinked] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<Project["status"]>("planejamento");
  const [url, setUrl] = useState("");
  const [repo, setRepo] = useState("");
  const [databaseUsed, setDatabaseUsed] = useState("");
  const [databaseName, setDatabaseName] = useState("");
  const [server, setServer] = useState("");
  const [techConfig, setTechConfig] = useState("");
  const [notes, setNotes] = useState("");
  const [value, setValue] = useState("");
  const [monthly, setMonthly] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setLinked(initial?.clientId ?? clientId ?? "");
    setDescription(initial?.description ?? "");
    setStartDate(initial?.startDate ?? "");
    setDueDate(initial?.dueDate ?? "");
    setStatus(initial?.status ?? "planejamento");
    setUrl(initial?.url ?? "");
    setRepo(initial?.repo ?? "");
    setDatabaseUsed(initial?.databaseUsed ?? "");
    setDatabaseName(initial?.databaseName ?? "");
    setServer(initial?.server ?? "");
    setTechConfig(initial?.techConfig ?? "");
    setNotes(initial?.notes ?? "");
    setValue(initial ? centsToInput(initial.valueCents) : "");
    setMonthly(initial ? centsToInput(initial.monthlyCents) : "");
  }, [open, initial, clientId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const valueCents = parseMoney(value);
    const monthlyCents = parseMoney(monthly);
    if (valueCents == null || monthlyCents == null) {
      toast.error("Informe os valores como 1500,00.");
      return;
    }
    setPending(true);
    try {
      const saved = await saveProject({
        data: {
          id: initial?.id,
          clientId: linked || null,
          name,
          description,
          startDate: startDate || null,
          dueDate: dueDate || null,
          status,
          url,
          repo,
          databaseUsed,
          databaseName,
          server,
          techConfig,
          notes,
          valueCents,
          monthlyCents,
        },
      });
      toast.success(saved.created ? "Projeto cadastrado." : "Projeto atualizado.");
      onOpenChange(false);
      await invalidate(qc);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? "Editar projeto" : "Novo projeto"}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" className="sm:col-span-2">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Cliente" className="sm:col-span-2">
          <ClientOptions value={linked} onChange={setLinked} clients={dir.data?.clients ?? []} />
        </Field>
        <Field label="Descrição" className="sm:col-span-2">
          <TextArea value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field label="Início">
          <TextInput type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </Field>
        <Field label="Prazo">
          <TextInput type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
        <Field label="Status">
          <SelectInput value={status} onChange={(event) => setStatus(event.target.value as Project["status"])}>
            {PROJECT_STATUS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Valor do projeto">
          <TextInput value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" placeholder="0,00" />
        </Field>
        <Field label="Mensalidade">
          <TextInput value={monthly} onChange={(event) => setMonthly(event.target.value)} inputMode="decimal" placeholder="0,00" />
        </Field>
        <details className="sm:col-span-2">
          <summary className="cursor-pointer text-sm font-medium">Configurações técnicas</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="URL do sistema">
              <TextInput value={url} onChange={(event) => setUrl(event.target.value)} />
            </Field>
            <Field label="Repositório">
              <TextInput value={repo} onChange={(event) => setRepo(event.target.value)} />
            </Field>
            <Field label="Banco utilizado">
              <TextInput value={databaseUsed} onChange={(event) => setDatabaseUsed(event.target.value)} />
            </Field>
            <Field label="Nome do banco">
              <TextInput value={databaseName} onChange={(event) => setDatabaseName(event.target.value)} />
            </Field>
            <Field label="Servidor / backend" className="sm:col-span-2">
              <TextInput value={server} onChange={(event) => setServer(event.target.value)} />
            </Field>
            <Field label="Configurações" className="sm:col-span-2">
              <TextArea value={techConfig} onChange={(event) => setTechConfig(event.target.value)} />
            </Field>
          </div>
        </details>
        <Field label="Observações internas" className="sm:col-span-2">
          <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar projeto"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function UpdateForm({
  open,
  onOpenChange,
  initial,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ProjectUpdate | null;
  projectId?: string | null;
}) {
  const qc = useQueryClient();
  const dir = useDir();
  const [pending, setPending] = useState(false);
  const [linked, setLinked] = useState("");
  const [version, setVersion] = useState("");
  const [happenedOn, setHappenedOn] = useState("");
  const [description, setDescription] = useState("");
  const [bugfix, setBugfix] = useState("");
  const [feature, setFeature] = useState("");
  const [status, setStatus] = useState<ProjectUpdate["status"]>("planejada");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setLinked(initial?.projectId ?? projectId ?? "");
    setVersion(initial?.version ?? "");
    setHappenedOn(initial?.happenedOn ?? dir.data?.today ?? saoPauloToday());
    setDescription(initial?.description ?? "");
    setBugfix(initial?.bugfix ?? "");
    setFeature(initial?.feature ?? "");
    setStatus(initial?.status ?? "planejada");
    setNotes(initial?.notes ?? "");
  }, [open, initial, projectId, dir.data?.today]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!linked) {
      toast.error("Escolha o projeto.");
      return;
    }
    setPending(true);
    try {
      const saved = await saveUpdate({
        data: { id: initial?.id, projectId: linked, version, happenedOn, description, bugfix, feature, status, notes },
      });
      toast.success(saved.created ? "Atualização registrada." : "Atualização revisada.");
      onOpenChange(false);
      await invalidate(qc);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? "Editar versão" : "Nova atualização"}>
      <form onSubmit={submit} className="grid gap-3">
        <Field label="Projeto">
          <SelectInput value={linked} onChange={(event) => setLinked(event.target.value)} required>
            <option value="">Selecione</option>
            {(dir.data?.projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Versão">
            <TextInput value={version} onChange={(event) => setVersion(event.target.value)} required placeholder="1.4.0" />
          </Field>
          <Field label="Data">
            <TextInput type="date" value={happenedOn} onChange={(event) => setHappenedOn(event.target.value)} required />
          </Field>
        </div>
        <Field label="Status">
          <SelectInput value={status} onChange={(event) => setStatus(event.target.value as ProjectUpdate["status"])}>
            {UPDATE_STATUS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Descrição da alteração">
          <TextArea value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field label="Problema corrigido">
          <TextArea value={bugfix} onChange={(event) => setBugfix(event.target.value)} />
        </Field>
        <Field label="Nova funcionalidade">
          <TextArea value={feature} onChange={(event) => setFeature(event.target.value)} />
        </Field>
        <Field label="Observações">
          <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar versão"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ContractForm({
  open,
  onOpenChange,
  initial,
  clientId,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Contract | null;
  clientId?: string | null;
  projectId?: string | null;
}) {
  const qc = useQueryClient();
  const dir = useDir();
  const [pending, setPending] = useState(false);
  const [linkedClient, setLinkedClient] = useState("");
  const [linkedProject, setLinkedProject] = useState("");
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [value, setValue] = useState("");
  const [monthly, setMonthly] = useState("");
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Contract["status"]>("rascunho");
  const [documentName, setDocumentName] = useState("");
  const [documentData, setDocumentData] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    setLinkedClient(initial?.clientId ?? clientId ?? "");
    setLinkedProject(initial?.projectId ?? projectId ?? "");
    setType(initial?.type ?? "");
    setStartDate(initial?.startDate ?? "");
    setEndDate(initial?.endDate ?? "");
    setValue(initial ? centsToInput(initial.valueCents) : "");
    setMonthly(initial ? centsToInput(initial.monthlyCents) : "");
    setConditions(initial?.conditions ?? "");
    setNotes(initial?.notes ?? "");
    setStatus(initial?.status ?? "rascunho");
    setDocumentName(initial?.documentName ?? "");
    setDocumentData(undefined);
  }, [open, initial, clientId, projectId]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 200_000) {
      toast.error("O arquivo passa de 200 KB.");
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      reader.readAsDataURL(file);
    });
    setDocumentName(file.name);
    setDocumentData(data);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const valueCents = parseMoney(value);
    const monthlyCents = parseMoney(monthly);
    if (valueCents == null || monthlyCents == null) {
      toast.error("Informe os valores como 1500,00.");
      return;
    }
    setPending(true);
    try {
      const saved = await saveContract({
        data: {
          id: initial?.id,
          clientId: linkedClient || null,
          projectId: linkedProject || null,
          type,
          startDate: startDate || null,
          endDate: endDate || null,
          valueCents,
          monthlyCents,
          conditions,
          notes,
          status,
          documentName,
          documentData,
        },
      });
      toast.success(saved.created ? "Contrato criado." : "Contrato atualizado.");
      onOpenChange(false);
      await invalidate(qc);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? "Editar contrato" : "Novo contrato"}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo" className="sm:col-span-2">
          <TextInput value={type} onChange={(event) => setType(event.target.value)} required placeholder="Suporte mensal" />
        </Field>
        <Field label="Cliente">
          <ClientOptions value={linkedClient} onChange={setLinkedClient} clients={dir.data?.clients ?? []} />
        </Field>
        <Field label="Projeto">
          <SelectInput value={linkedProject} onChange={(event) => setLinkedProject(event.target.value)}>
            <option value="">Nenhum</option>
            {(dir.data?.projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Início">
          <TextInput type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </Field>
        <Field label="Fim">
          <TextInput type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </Field>
        <Field label="Valor">
          <TextInput value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" placeholder="0,00" />
        </Field>
        <Field label="Mensalidade">
          <TextInput value={monthly} onChange={(event) => setMonthly(event.target.value)} inputMode="decimal" placeholder="0,00" />
        </Field>
        <Field label="Status" className="sm:col-span-2">
          <SelectInput value={status} onChange={(event) => setStatus(event.target.value as Contract["status"])}>
            {CONTRACT_STATUS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Condições" className="sm:col-span-2">
          <TextArea value={conditions} onChange={(event) => setConditions(event.target.value)} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <Field label="Arquivo" className="sm:col-span-2">
          <input
            type="file"
            className="block w-full text-sm text-muted file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:text-sm file:text-paper"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          {documentName ? <span className="text-xs text-muted">{documentName}</span> : null}
          {initial?.hasDocument ? (
            <button
              type="button"
              className="text-left text-sm text-bad"
              onClick={() => {
                setDocumentName("");
                setDocumentData("");
              }}
            >
              Remover arquivo atual
            </button>
          ) : null}
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar contrato"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function FinanceForm({
  open,
  onOpenChange,
  initial,
  kind,
  clientId,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Finance | null;
  kind?: Finance["kind"];
  clientId?: string | null;
  projectId?: string | null;
}) {
  const qc = useQueryClient();
  const dir = useDir();
  const [pending, setPending] = useState(false);
  const [entryKind, setEntryKind] = useState<Finance["kind"]>("entrada");
  const [linkedClient, setLinkedClient] = useState("");
  const [linkedProject, setLinkedProject] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [happenedOn, setHappenedOn] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [status, setStatus] = useState<Finance["status"]>("pendente");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setEntryKind(initial?.kind ?? kind ?? "entrada");
    setLinkedClient(initial?.clientId ?? clientId ?? "");
    setLinkedProject(initial?.projectId ?? projectId ?? "");
    setCategory(initial?.category ?? "");
    setDescription(initial?.description ?? "");
    setAmount(initial ? centsToInput(initial.amountCents) : "");
    setHappenedOn(initial?.happenedOn ?? dir.data?.today ?? saoPauloToday());
    setDueOn(initial?.dueOn ?? "");
    setPaidOn(initial?.paidOn ?? "");
    setPaymentMethod(initial?.paymentMethod ?? "");
    setStatus(initial?.status ?? "pendente");
    setNotes(initial?.notes ?? "");
  }, [open, initial, kind, clientId, projectId, dir.data?.today]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const amountCents = parseMoney(amount);
    if (!amountCents) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    setPending(true);
    try {
      const saved = await saveFinance({
        data: {
          id: initial?.id,
          kind: entryKind,
          clientId: linkedClient || null,
          projectId: linkedProject || null,
          category,
          description,
          amountCents,
          happenedOn,
          dueOn: dueOn || null,
          paidOn: paidOn || null,
          paymentMethod,
          status,
          notes,
        },
      });
      toast.success(
        saved.created
          ? entryKind === "entrada"
            ? "Entrada registrada."
            : "Saída registrada."
          : "Lançamento atualizado.",
      );
      onOpenChange(false);
      await invalidate(qc);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? "Editar lançamento" : entryKind === "saida" ? "Nova saída" : "Nova entrada"}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo">
          <SelectInput value={entryKind} onChange={(event) => setEntryKind(event.target.value as Finance["kind"])}>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </SelectInput>
        </Field>
        <Field label="Status">
          <SelectInput value={status} onChange={(event) => setStatus(event.target.value as Finance["status"])}>
            {FINANCE_STATUS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Descrição" className="sm:col-span-2">
          <TextInput value={description} onChange={(event) => setDescription(event.target.value)} required />
        </Field>
        <Field label="Valor">
          <TextInput value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" required />
        </Field>
        <Field label="Categoria">
          <TextInput value={category} onChange={(event) => setCategory(event.target.value)} />
        </Field>
        <Field label="Data">
          <TextInput type="date" value={happenedOn} onChange={(event) => setHappenedOn(event.target.value)} required />
        </Field>
        <Field label="Vencimento">
          <TextInput type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
        </Field>
        <Field label="Pagamento">
          <TextInput type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />
        </Field>
        <Field label="Forma">
          <TextInput value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} placeholder="Pix, boleto, cartão" />
        </Field>
        <Field label="Cliente">
          <ClientOptions value={linkedClient} onChange={setLinkedClient} clients={dir.data?.clients ?? []} />
        </Field>
        <Field label="Projeto">
          <SelectInput value={linkedProject} onChange={(event) => setLinkedProject(event.target.value)}>
            <option value="">Nenhum</option>
            {(dir.data?.projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar lançamento"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function TaskForm({
  open,
  onOpenChange,
  initial,
  scope,
  clientId,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Task | null;
  scope?: Task["scope"];
  clientId?: string | null;
  projectId?: string | null;
}) {
  const qc = useQueryClient();
  const dir = useDir();
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [taskPriority, setTaskPriority] = useState<Task["priority"]>("normal");
  const [category, setCategory] = useState("");
  const [taskScope, setTaskScope] = useState<Task["scope"]>("empresa");
  const [linkedClient, setLinkedClient] = useState("");
  const [linkedProject, setLinkedProject] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setDueOn(initial?.dueOn ?? "");
    setDueTime(initial?.dueTime ?? "");
    setTaskPriority(initial?.priority ?? "normal");
    setCategory(initial?.category ?? "");
    setTaskScope(initial?.scope ?? scope ?? "empresa");
    setLinkedClient(initial?.clientId ?? clientId ?? "");
    setLinkedProject(initial?.projectId ?? projectId ?? "");
  }, [open, initial, scope, clientId, projectId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const saved = await saveTask({
        data: {
          id: initial?.id,
          title,
          description,
          dueOn: dueOn || null,
          dueTime,
          priority: taskPriority,
          category,
          scope: taskScope,
          clientId: linkedClient || null,
          projectId: linkedProject || null,
          done: initial?.done ?? false,
        },
      });
      toast.success(saved.created ? "Tarefa criada." : "Tarefa atualizada.");
      onOpenChange(false);
      await invalidate(qc);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? "Editar tarefa" : "Nova tarefa"}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Título" className="sm:col-span-2">
          <TextInput value={title} onChange={(event) => setTitle(event.target.value)} required />
        </Field>
        <Field label="Escopo">
          <SelectInput value={taskScope} onChange={(event) => setTaskScope(event.target.value as Task["scope"])}>
            <option value="empresa">Empresa</option>
            <option value="pessoal">Pessoal</option>
          </SelectInput>
        </Field>
        <Field label="Prioridade">
          <SelectInput value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as Task["priority"])}>
            {PRIORITIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Data">
          <TextInput type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
        </Field>
        <Field label="Horário">
          <TextInput type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} />
        </Field>
        <Field label="Categoria">
          <TextInput value={category} onChange={(event) => setCategory(event.target.value)} />
        </Field>
        <Field label="Cliente">
          <ClientOptions value={linkedClient} onChange={setLinkedClient} clients={dir.data?.clients ?? []} />
        </Field>
        <Field label="Projeto" className="sm:col-span-2">
          <SelectInput value={linkedProject} onChange={(event) => setLinkedProject(event.target.value)}>
            <option value="">Nenhum</option>
            {(dir.data?.projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Descrição" className="sm:col-span-2">
          <TextArea value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar tarefa"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function AppointmentForm({
  open,
  onOpenChange,
  initial,
  clientId,
  date,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Appointment | null;
  clientId?: string | null;
  date?: string;
}) {
  const qc = useQueryClient();
  const dir = useDir();
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState("");
  const [happensOn, setHappensOn] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  const [linkedClient, setLinkedClient] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Appointment["status"]>("agendado");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setHappensOn(initial?.happensOn ?? date ?? dir.data?.today ?? saoPauloToday());
    setStartsAt(initial?.startsAt ?? "");
    setDurationMin(String(initial?.durationMin ?? 60));
    setLinkedClient(initial?.clientId ?? clientId ?? "");
    setLocation(initial?.location ?? "");
    setNotes(initial?.notes ?? "");
    setStatus(initial?.status ?? "agendado");
  }, [open, initial, clientId, date, dir.data?.today]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const duration = Number(durationMin);
    if (!Number.isFinite(duration) || duration < 15) {
      toast.error("A duração mínima é 15 minutos.");
      return;
    }
    setPending(true);
    try {
      const saved = await saveAppointment({
        data: {
          id: initial?.id,
          title,
          happensOn,
          startsAt,
          durationMin: duration,
          clientId: linkedClient || null,
          location,
          notes,
          status,
        },
      });
      toast.success(
        saved.created
          ? `Compromisso criado para ${brDate(saved.happensOn)}${saved.startsAt ? ` às ${saved.startsAt}` : ""}.`
          : "Compromisso atualizado.",
      );
      onOpenChange(false);
      await invalidate(qc);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? "Editar compromisso" : "Novo compromisso"}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Título" className="sm:col-span-2">
          <TextInput value={title} onChange={(event) => setTitle(event.target.value)} required />
        </Field>
        <Field label="Data">
          <TextInput type="date" value={happensOn} onChange={(event) => setHappensOn(event.target.value)} required />
        </Field>
        <Field label="Horário">
          <TextInput type="time" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </Field>
        <Field label="Duração (min)">
          <TextInput value={durationMin} onChange={(event) => setDurationMin(event.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Status">
          <SelectInput value={status} onChange={(event) => setStatus(event.target.value as Appointment["status"])}>
            <option value="agendado">Agendado</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </SelectInput>
        </Field>
        <Field label="Cliente" className="sm:col-span-2">
          <ClientOptions value={linkedClient} onChange={setLinkedClient} clients={dir.data?.clients ?? []} />
        </Field>
        <Field label="Local" className="sm:col-span-2">
          <TextInput value={location} onChange={(event) => setLocation(event.target.value)} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar compromisso"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
