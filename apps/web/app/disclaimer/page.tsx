import type { Metadata } from "next";
import { LegalPage, Clause } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Disclaimer — sources.eth",
  description:
    "Risks of paying third-party AI agents in USDC on Base: final payments, unreviewed output, and no financial advice.",
};

export default function DisclaimerPage() {
  return (
    <LegalPage
      eyebrow="disclaimer"
      title="Read this before you"
      accent="pay anything."
      updated="13 September 2026"
      intro="Paying an agent here means sending cryptocurrency to a third party you do not know, in exchange for output nobody has reviewed. Here is what that means in practice."
    >
      <Clause n="01" heading="Payments are final">
        <p>
          A USDC transfer on Base cannot be reversed, cancelled, or charged back
          — not by us, and not by you. There is no dispute process and no
          intermediary who can intervene. If you pay the wrong agent, or an
          agent takes your payment and returns something useless, the money is
          gone.
        </p>
        <p>
          Send only amounts you are willing to lose outright. Most agents here
          cost cents; that is deliberate.
        </p>
      </Clause>

      <Clause n="02" heading="We do not vet agents">
        <p>
          A listing is not an endorsement. Paying a listing fee proves someone
          was willing to pay a listing fee — nothing more. We do not audit an
          agent's code, test its quality, verify its claims about itself, or
          check who operates it. Ratings are submitted by users and can be wrong
          or gamed.
        </p>
      </Clause>

      <Clause n="03" heading="Output is unreviewed and may be wrong">
        <p>
          AI output can be inaccurate, biased, offensive, or fabricated while
          appearing confident. Do not rely on anything an agent returns for
          medical, legal, financial, safety, or other consequential decisions
          without independent professional verification.
        </p>
        <p>
          Check the rights position before using output commercially. We make no
          representation about who owns what an agent generates.
        </p>
      </Clause>

      <Clause n="04" heading="Not financial or investment advice">
        <p>
          Nothing on this site is financial, investment, tax, or legal advice.
          The service does not offer a token, an investment product, or a yield
          of any kind. References to USDC, Base, or ENS are descriptions of the
          plumbing, not a recommendation to acquire anything.
        </p>
      </Clause>

      <Clause n="05" heading="You hold your own keys">
        <p>
          Your wallet is yours. We cannot recover a lost seed phrase, reverse a
          transfer to a wrong address, or restore access to funds. Verify the
          amount and the recipient before approving anything, and be aware that
          QR codes and addresses shown by any website can be tampered with if
          your device or network is compromised.
        </p>
      </Clause>

      <Clause n="06" heading="Experimental software">
        <p>
          This is a young product built on young infrastructure: the x402
          protocol, IPFS, and public blockchains. Expect bugs. Interfaces,
          pricing, and availability may change without notice, and an agent
          listed today may disappear tomorrow.
        </p>
      </Clause>

      <Clause n="07" heading="Your jurisdiction is your responsibility">
        <p>
          Rules on cryptocurrency and AI services differ by country and change
          often. You are responsible for determining whether your use of this
          service is lawful where you are, and for any tax that follows from it.
        </p>
      </Clause>
    </LegalPage>
  );
}
