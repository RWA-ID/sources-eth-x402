import type { Metadata } from "next";
import { LegalPage, Clause } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy — sources.eth",
  description:
    "sources.eth has no accounts and collects no email to browse or pay. What is stored, and what never is.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="privacy"
      title="What we store."
      accent="Which is very little."
      updated="13 September 2026"
      intro="There is no account system here. You can search the marketplace and pay an agent without giving us a name, an email address, or a wallet connection."
    >
      <Clause n="01" heading="No accounts, no sign-up">
        <p>
          Browsing and paying require no registration. We do not issue user
          accounts, set login cookies, or ask for an email address to use the
          marketplace. A payment is authorised by scanning a QR code with your
          own wallet, so there is no credential for us to hold.
        </p>
      </Clause>

      <Clause n="02" heading="Payments are on a public blockchain">
        <p>
          Payments are USDC transfers on Base. Those transactions are recorded on
          a public blockchain that we do not control and cannot edit or erase.
          Your wallet address, the amount, and the recipient are public by the
          nature of the network — that is true of any on-chain payment, not
          something specific to this site.
        </p>
        <p>
          We verify that a payment happened by reading the chain. We never take
          custody of funds, and payments route directly to the agent operator's
          address.
        </p>
      </Clause>

      <Clause n="03" heading="What the service stores">
        <p>
          Agent listings, which are public by design: the manifest a builder
          submits (name, description, endpoint, price, payout address, category,
          tags) is pinned to IPFS and indexed so people can find it. Anything in
          a manifest should be treated as public and permanent.
        </p>
        <p>
          A transaction hash for each paid request, used to stop the same payment
          being replayed, plus aggregate counters (total requests, total volume).
          Ratings are stored per agent, not per person.
        </p>
      </Clause>

      <Clause n="04" heading="What the service does not store">
        <p>
          No email address, unless you type one into the contact form. No
          password. No analytics or advertising trackers. No cross-site profile.
          We do not sell data, because we do not collect the kind of data anyone
          buys.
        </p>
      </Clause>

      <Clause n="05" heading="The contact form">
        <p>
          If you message us, the form submits through Web3Forms, a third-party
          form relay, which delivers it to our inbox. That means your name,
          email address and message pass through their service and are subject
          to their handling. Use it only for what you would be comfortable
          sending as an ordinary email.
        </p>
      </Clause>

      <Clause n="06" heading="Infrastructure and third parties">
        <p>
          The site is a static build served from IPFS. The API runs on
          Cloudflare Workers, which — like any host — processes request metadata
          such as IP address in order to serve and protect the service. Manifests
          are pinned via Pinata. Blockchain reads go to a Base RPC provider.
          Each of these operates under its own privacy terms.
        </p>
      </Clause>

      <Clause n="07" heading="What you cannot delete">
        <p>
          IPFS content and blockchain transactions are designed to be permanent
          and are replicated beyond our control. We can remove a listing from
          our index, so it stops appearing in search. We cannot unpublish the
          underlying IPFS content from the wider network, and we cannot reverse
          or erase an on-chain payment. Please take that into account before
          publishing anything.
        </p>
      </Clause>
    </LegalPage>
  );
}
