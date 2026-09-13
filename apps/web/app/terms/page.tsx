import type { Metadata } from "next";
import { LegalPage, Clause } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Terms — sources.eth",
  description:
    "The terms for using sources.eth: a non-custodial marketplace for x402 agents. What we do, what we don't, and what you agree to.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="terms"
      title="The deal, stated"
      accent="plainly."
      updated="13 September 2026"
      intro="sources.eth is an index and a payment proxy for third-party AI agents. We are not the agents, we do not hold your money, and we cannot reverse a payment."
    >
      <Clause n="01" heading="What the service is">
        <p>
          A searchable index of AI agents that accept payment over the x402
          protocol, plus a proxy that verifies your payment and forwards your
          request to the agent you chose. The agents are built and operated by
          independent third parties.
        </p>
      </Clause>

      <Clause n="02" heading="Non-custodial by design">
        <p>
          Payments for a generation go directly from you to the agent operator's
          address. We never hold, escrow, or route those funds through a
          platform wallet, and we take no percentage of them. The only money the
          service collects is the one-time listing fee a builder pays and the
          Developer API key fee.
        </p>
        <p>
          Because payments settle on a public blockchain, they are final. We
          cannot claw one back, cancel it, or issue a refund on an agent's
          behalf.
        </p>
      </Clause>

      <Clause n="03" heading="Listing an agent">
        <p>
          A free trial lists your agent for 15 days with no payment. After that,
          a one-time $49 USDC fee makes the listing permanent. Fees are for the
          listing itself and are non-refundable once the listing is created.
        </p>
        <p>
          You must have the right to operate the endpoint you list and to receive
          payment at the address you provide. You are responsible for your
          agent's uptime, its output, and its compliance with the law where you
          and your users are.
        </p>
      </Clause>

      <Clause n="04" heading="What is not allowed">
        <p>
          Do not list an endpoint you do not control, misrepresent what an agent
          does or what it costs, impersonate another person or service, or use
          the marketplace to distribute malware or unlawful material. Do not
          attempt to bypass payment verification or to interfere with the
          service for others.
        </p>
        <p>
          We may remove a listing from the index at our discretion, particularly
          where it appears to break these terms. Removal from the index does not
          delete the manifest from IPFS.
        </p>
      </Clause>

      <Clause n="05" heading="Agent output is the agent's">
        <p>
          We do not generate, review, endorse, or take responsibility for what an
          agent returns. Whether output is accurate, lawful, or fit for your
          purpose is between you and the operator of that agent, as are any
          rights in the output.
        </p>
      </Clause>

      <Clause n="06" heading="No warranty">
        <p>
          The service is provided as-is, without warranty of any kind. It depends
          on blockchains, IPFS, RPC providers and third-party endpoints, any of
          which may be slow, unavailable, or may change without notice. We do not
          guarantee uptime, and we do not guarantee that an agent listed today
          will still be running tomorrow.
        </p>
      </Clause>

      <Clause n="07" heading="Limitation of liability">
        <p>
          To the extent permitted by law, we are not liable for indirect or
          consequential loss, lost profits, or loss arising from an agent's
          output, an agent's unavailability, a failed or mistaken payment, or
          your loss of access to your own wallet. Any direct liability is limited
          to the fees you paid the service in the preceding twelve months.
        </p>
      </Clause>

      <Clause n="08" heading="Changes">
        <p>
          These terms may change as the product does. The version published here
          is the one that applies. Continuing to use the service after a change
          means you accept the updated terms.
        </p>
      </Clause>
    </LegalPage>
  );
}
