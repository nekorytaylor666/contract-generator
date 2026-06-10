import {
  ACCESS_LABELS,
  ACCESS_LEVELS,
  type AccessLevel,
} from "@contract-builder/api/constants/access";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getInitials } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

interface AccessLevelPickerProps {
  value: AccessLevel;
  onChange: (level: AccessLevel) => void;
  onRemove?: () => void;
  disabled?: boolean;
}

function AccessLevelPicker({
  value,
  onChange,
  onRemove,
  disabled,
}: AccessLevelPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-foreground text-sm outline-none hover:bg-muted disabled:opacity-50"
        disabled={disabled}
      >
        {ACCESS_LABELS[value]}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {ACCESS_LEVELS.map((level) => (
          <DropdownMenuItem
            className="justify-between"
            key={level}
            onSelect={() => onChange(level)}
          >
            {ACCESS_LABELS[level]}
            {level === value && <Check className="size-4 text-foreground" />}
          </DropdownMenuItem>
        ))}
        {onRemove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onSelect={onRemove}
              variant="destructive"
            >
              <Trash2 className="size-4" />
              Убрать из команды
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface MemberRowProps {
  name: string;
  email: string | null;
  image: string | null;
  accessLevel: AccessLevel;
  isOwner: boolean;
  disabled: boolean;
  onChangeLevel: (level: AccessLevel) => void;
  onRemove: () => void;
}

function MemberRow({
  name,
  email,
  image,
  accessLevel,
  isOwner,
  disabled,
  onChangeLevel,
  onRemove,
}: MemberRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar className="size-8">
          {image && <AvatarImage alt={name} src={image} />}
          <AvatarFallback className="bg-muted text-xs">
            {getInitials(name || email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground text-sm">{name}</p>
          {email && (
            <p className="truncate text-muted-foreground text-xs">{email}</p>
          )}
        </div>
      </div>
      {isOwner ? (
        <span className="shrink-0 px-2 text-muted-foreground text-sm">
          {ACCESS_LABELS.full}
        </span>
      ) : (
        <AccessLevelPicker
          disabled={disabled}
          onChange={onChangeLevel}
          onRemove={onRemove}
          value={accessLevel}
        />
      )}
    </div>
  );
}

interface AddUserFormProps {
  pending: boolean;
  onSubmit: (email: string, level: AccessLevel) => void;
  onCancel: () => void;
}

function AddUserForm({ pending, onSubmit, onCancel }: AddUserFormProps) {
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<AccessLevel>("full");

  const submit = () => {
    const value = email.trim();
    if (value) {
      onSubmit(value, level);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-2">
      <Input
        autoFocus
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="email@example.com"
        type="email"
        value={email}
      />
      <div className="flex items-center justify-between gap-2">
        <AccessLevelPicker onChange={setLevel} value={level} />
        <div className="flex items-center gap-1.5">
          <Button onClick={onCancel} size="sm" type="button" variant="ghost">
            Отмена
          </Button>
          <Button
            disabled={pending || !email.trim()}
            onClick={submit}
            size="sm"
            type="button"
          >
            Пригласить
          </Button>
        </div>
      </div>
    </div>
  );
}

const INVITE_MESSAGES: Record<string, string> = {
  added: "Пользователь добавлен в команду",
  updated: "Доступ обновлён",
  invited: "Приглашение отправлено",
  owner: "Это владелец — доступ изменить нельзя",
};

export function ShareAccessMenu() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data } = useQuery(trpc.team.members.queryOptions());

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.team.members.queryKey() });
  const onError = (error: { message: string }) => toast.error(error.message);

  const inviteMutation = useMutation(
    trpc.team.invite.mutationOptions({
      onSuccess: (result) => {
        invalidate();
        setAdding(false);
        toast.success(INVITE_MESSAGES[result.status] ?? "Готово");
      },
      onError,
    })
  );
  const updateMutation = useMutation(
    trpc.team.updateAccess.mutationOptions({ onSuccess: invalidate, onError })
  );
  const removeMutation = useMutation(
    trpc.team.remove.mutationOptions({ onSuccess: invalidate, onError })
  );
  const cancelMutation = useMutation(
    trpc.team.cancelInvite.mutationOptions({ onSuccess: invalidate, onError })
  );

  const members = data?.members ?? [];
  const invitations = data?.invitations ?? [];
  const busy =
    updateMutation.isPending ||
    removeMutation.isPending ||
    inviteMutation.isPending;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="gap-1.5" size="lg" variant="outline">
          <Users className="size-4" />
          Пригласить
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-2">
        <p className="px-2 py-1.5 text-muted-foreground text-xs">
          Ваша команда
        </p>

        <div className="flex max-h-[320px] flex-col overflow-y-auto">
          {members.map((m) => (
            <MemberRow
              accessLevel={m.accessLevel}
              disabled={busy}
              email={m.email}
              image={m.image}
              isOwner={m.role === "owner"}
              key={m.memberId}
              name={m.name}
              onChangeLevel={(level) =>
                updateMutation.mutate({
                  memberId: m.memberId,
                  accessLevel: level,
                })
              }
              onRemove={() => removeMutation.mutate({ memberId: m.memberId })}
            />
          ))}

          {invitations.map((inv) => (
            <div
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
              key={inv.id}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-muted text-xs">
                    {getInitials(inv.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-foreground text-sm">
                    {inv.email}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {ACCESS_LABELS[inv.accessLevel]}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="secondary">Приглашён</Badge>
                <Button
                  aria-label="Отменить приглашение"
                  onClick={() =>
                    cancelMutation.mutate({ invitationId: inv.id })
                  }
                  size="icon-sm"
                  variant="ghost"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="my-1 h-px bg-border" />

        {adding ? (
          <AddUserForm
            onCancel={() => setAdding(false)}
            onSubmit={(email, level) =>
              inviteMutation.mutate({ email, accessLevel: level })
            }
            pending={inviteMutation.isPending}
          />
        ) : (
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-foreground text-sm outline-none hover:bg-muted"
            onClick={() => setAdding(true)}
            type="button"
          >
            <span className="flex size-6 items-center justify-center rounded-full border border-dashed">
              <Plus className="size-3.5 text-muted-foreground" />
            </span>
            Добавить пользователей
            <UserPlus className="ml-auto size-4 text-muted-foreground" />
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
