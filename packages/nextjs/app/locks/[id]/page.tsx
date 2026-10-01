import { LockDetails } from "../../../components/lock-details";
export default async function LockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><div className="page-heading compact"><div><p className="eyebrow">PUBLIC VERIFICATION / HEDERA TESTNET</p><h1>A commitment,<br /><em>on the record.</em></h1><p className="lede">Read the terms and release status directly from the contract.</p></div></div><LockDetails id={id} /></>;
}
