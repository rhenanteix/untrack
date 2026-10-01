"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { ActionStatus, apiRequest, useAction } from "./shared";

type WorkspaceMember = {
  userId: string;
  role: string;
  user: { name: string; email: string };
};
type ProjectMember = {
  userId: string;
  role: "owner" | "editor" | "viewer";
  user: { name: string; email: string };
};

export function ProjectMembersManager({ projectId }: { projectId: string }) {
  const action = useAction();
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiRequest<{ items: WorkspaceMember[] }>("/api/workspace/members?page=1", {
        signal: controller.signal,
      }),
      apiRequest<{ items: ProjectMember[] }>(`/api/projects/${projectId}/members`, {
        signal: controller.signal,
      }),
    ])
      .then(([workspaceResult, projectResult]) => {
        if (!controller.signal.aborted) {
          setWorkspaceMembers(workspaceResult.items);
          setMembers(projectResult.items);
          setError("");
        }
      })
      .catch((loadError: Error) => {
        if (!controller.signal.aborted) setError(loadError.message);
      });
    return () => controller.abort();
  }, [projectId, revision]);

  function refresh() {
    setRevision((value) => value + 1);
  }

  return (
    <section className="workspace-panel project-members-panel">
      <div className="workspace-panel-heading">
        <div>
          <span className="eyebrow">Responsáveis</span>
          <h2>Pessoas neste projeto</h2>
        </div>
      </div>
      <p>Os papéis organizam a iniciativa. As permissões de acesso continuam definidas pelo workspace.</p>
      {error && <p className="form-error">{error}</p>}
      <form
        className="collection-add"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void action.run(async () => {
            await apiRequest(`/api/projects/${projectId}/members`, {
              method: "POST",
              body: JSON.stringify({ userId: data.get("userId"), role: data.get("role") }),
            });
            refresh();
            action.setNotice("Responsável atualizado.");
          });
        }}
      >
        <label>
          Pessoa
          <select name="userId" defaultValue="" required>
            <option value="" disabled>Selecione uma pessoa</option>
            {workspaceMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.user.name || member.user.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          Papel
          <select name="role" defaultValue="editor">
            <option value="owner">Responsável</option>
            <option value="editor">Colaborador</option>
            <option value="viewer">Acompanhante</option>
          </select>
        </label>
        <button className="button button-secondary" disabled={action.busy}>
          <FiPlus aria-hidden="true" /> Adicionar
        </button>
      </form>
      <ActionStatus {...action} />
      <ul className="project-member-list">
        {members.map((member) => (
          <li key={member.userId}>
            <span>
              <strong>{member.user.name || member.user.email}</strong>
              <small>{member.user.email} · {member.role}</small>
            </span>
            <button
              type="button"
              title="Remover responsável"
              aria-label={`Remover ${member.user.name || member.user.email}`}
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await apiRequest(`/api/projects/${projectId}/members`, {
                    method: "DELETE",
                    body: JSON.stringify({ userId: member.userId }),
                  });
                  refresh();
                  action.setNotice("Responsável removido.");
                })
              }
            >
              <FiX aria-hidden="true" />
            </button>
          </li>
        ))}
        {!members.length && <li>Nenhuma pessoa atribuída ainda.</li>}
      </ul>
    </section>
  );
}