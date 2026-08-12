import { actionKeys, hasLoaded, isPending, loadKeys } from "../client/index.js";
import type { AppCore, UserMessage } from "../client/index.js";

import { EntityIcon } from "./entity-icon.js";
import { Section } from "./section.js";
import { useAppState } from "./use-app-state.js";

/**
 * What other people have addressed to this user. Today that is invitations —
 * and this is the only place a membership is created: an organization can offer
 * access, but joining it happens here, by the person joining.
 *
 * Nothing is shown when the inbox is empty. An inbox is not a part of the page
 * that has to be there; a heading over "no messages" is furniture.
 */
export function InboxSection({ core }: { core: AppCore }) {
  const inbox = useAppState(core, (state) => state.inbox);
  const loaded = useAppState(core, (state) => hasLoaded(state, loadKeys.inbox));

  const waiting = inbox.filter(
    (message) => message.invitation.status === "pending",
  );
  // Answered ones stay until the next load, so the click has something to say.
  const answered = inbox.filter(
    (message) =>
      message.invitation.status === "accepted" ||
      message.invitation.status === "declined",
  );
  if (!loaded || (waiting.length === 0 && answered.length === 0)) return null;

  return (
    <Section
      title="Invitations"
      note={
        waiting.length > 0
          ? `${String(waiting.length)} waiting for your answer`
          : undefined
      }
    >
      <ul className="rows">
        {[...waiting, ...answered].map((message) => (
          <li key={message.id}>
            <div className="row-main">
              <strong className="entity-chip">
                <EntityIcon entity="organization" />
                {message.invitation.organizationName}
              </strong>
              <span className="muted">
                {message.invitation.invitedByName} invited you as{" "}
                {message.invitation.role}
              </span>
            </div>
            <div className="row-actions">
              <Answer core={core} message={message} />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Answer({ core, message }: { core: AppCore; message: UserMessage }) {
  const pending = useAppState(core, (state) =>
    isPending(state, actionKeys.answerInvitation(message.invitation.id)),
  );

  if (message.invitation.status === "accepted")
    return <span className="muted">joined</span>;
  if (message.invitation.status === "declined")
    return <span className="muted">declined</span>;

  return (
    <>
      <button
        type="button"
        className="small"
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          void core.inbox.respond(message.invitation.id, "accept");
        }}
      >
        {pending ? "Working…" : "Accept"}
      </button>
      <button
        type="button"
        className="ghost small"
        disabled={pending}
        onClick={() => {
          void core.inbox.respond(message.invitation.id, "decline");
        }}
      >
        Decline
      </button>
    </>
  );
}
