import { getAuditLogs, getAuditLogEntityTypes, getAuditLogUsernames, getAuditLogModules } from "@/actions/audit";
import { AuditLogsClient } from "./audit-logs-client";

export default async function AuditLogsPage() {
  const [logsResult, entityTypes, usernames, modules] = await Promise.all([
    getAuditLogs(),
    getAuditLogEntityTypes(),
    getAuditLogUsernames(),
    getAuditLogModules(),
  ]);

  return (
    <AuditLogsClient 
      initialLogs={logsResult.logs}
      initialTotal={logsResult.total}
      initialPages={logsResult.pages}
      entityTypes={entityTypes}
      usernames={usernames}
      modules={modules}
    />
  );
}
