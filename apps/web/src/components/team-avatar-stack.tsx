import { useQuery } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { useTRPC } from "@/utils/trpc";

const MAX_VISIBLE = 3;

/** Overlapping avatars of the current org's members, shown in the header. */
export function TeamAvatarStack() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.team.members.queryOptions());

  const members = data?.members ?? [];
  if (members.length === 0) {
    return null;
  }

  const visible = members.slice(0, MAX_VISIBLE);
  const extra = members.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((m) => (
        <Avatar className="size-7 border-2 border-background" key={m.memberId}>
          {m.image && <AvatarImage alt={m.name} src={m.image} />}
          <AvatarFallback className="bg-muted text-[10px]">
            {getInitials(m.name || m.email)}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <span className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] text-muted-foreground">
          +{extra}
        </span>
      )}
    </div>
  );
}
