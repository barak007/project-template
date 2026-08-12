import type { Logger } from "../logging.js";

/**
 * How a message reaches a person outside the application. The one message this
 * product sends is an invitation, so that is the whole boundary: a provider
 * (Resend, SES, Postmark) is a second implementation of `sendInvitation`, and
 * nothing above here learns which one is installed.
 */
export type Mailer = {
  sendInvitation: (invitation: InvitationEmail) => Promise<void>;
};

export type InvitationEmail = {
  to: string;
  organizationName: string;
  invitedByName: string;
  role: "owner" | "admin" | "member";
  /**
   * Whether the address already has an account. The mail has to say either
   * "sign in" or "sign up" — being invited is not the same errand for the two.
   */
  hasAccount: boolean;
};

/**
 * The default mailer: it writes the invitation to the log instead of sending
 * it. An installation without a mail provider still works — the invitation
 * itself lives in the database and the invited person finds it in their inbox
 * when they sign in — and the log line is how an operator can pass it on by
 * hand until a provider is configured.
 */
export function createLogMailer(log: Logger, appUrl: string): Mailer {
  return {
    sendInvitation: (invitation) => {
      log.info("invitation email not sent: no mail provider is configured", {
        to: invitation.to,
        organization: invitation.organizationName,
        role: invitation.role,
        // Where the invited person answers it: their inbox, behind the login.
        url: `${appUrl.replace(/\/$/, "")}/app`,
        action: invitation.hasAccount ? "sign-in" : "sign-up",
      });
      return Promise.resolve();
    },
  };
}
