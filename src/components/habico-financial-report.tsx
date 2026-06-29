import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface PaymentRecord {
  date: string;
  amount: number;
  status: string;
}

interface PaymentPeriod {
  title: string;
  rows: { label: string; amount: number }[];
  payments: PaymentRecord[];
  totalPaid: number;
  balance: number;
}

interface CommissionBreakdown {
  description: string;
  totalCollected: number;
  landlordShare: number;
  companyFee: number;
  pendingToLandlord: number;
}

export interface FinancialReportData {
  date: string;
  landlordName: string;
  landlordTel: string;
  propertyName: string;
  propertyLocation: string;
  tenantContext: string;
  agreementDescription: string;
  totalAgreed: number;
  rentSchedule: { term: string; section: string; amount: number }[];
  paymentPeriods: PaymentPeriod[];
  commission: CommissionBreakdown;
  signatoryName: string;
  signatoryContact: string;
  signatoryTitle: string;
}

function formatNum(n: number) {
  return n.toLocaleString("en-UG");
}

export function HabicoFinancialReport({ data }: { data: FinancialReportData }) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    const content = printRef.current?.innerHTML ?? "";
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>Financial Report - Habico</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.5; color: #000; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        td, th { border: 1px solid #000; padding: 4px 6px; text-align: left; vertical-align: top; }
        th { font-weight: bold; background: #f0f0f0; }
        .no-border td { border: none; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .text-sm { font-size: 10px; }
        .mt-4 { margin-top: 12px; }
        .mb-2 { margin-bottom: 6px; }
        .border-t { border-top: 1px solid #000; }
        .pt-2 { padding-top: 6px; }
        h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
        h2 { font-size: 13px; text-align: center; margin-bottom: 2px; }
        .contact-line { text-align: center; font-size: 10px; margin: 2px 0; }
        .header-bar { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .signature-area { margin-top: 20px; }
        .signature-line { border-top: 1px solid #000; width: 250px; margin-top: 30px; padding-top: 4px; }
        .scanned-by { text-align: center; font-size: 9px; color: #666; margin-top: 20px; }
        .free-text { margin: 8px 0; text-align: justify; }
      </style>
      </head>
      <body>${content}
        <div class="scanned-by">Scanned with CS CamScanner</div>
      </body>
      </html>
    `);
    win.document.close();
    win.print();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handlePrint} variant="outline" size="sm">
          <Printer className="mr-2 h-4 w-4" />Print Report
        </Button>
      </div>

      <div
        ref={printRef}
        className="rounded-lg border bg-white p-8 text-xs leading-relaxed text-black shadow-sm"
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
      >
        {/* Header */}
        <div className="header-bar text-center">
          <h1 className="text-lg font-bold tracking-wider">HABICO</h1>
          <h2 className="font-bold tracking-wider">PROPERTY MANAGERS</h2>
          <div className="contact-line">0756742220 | 0702239607</div>
          <div className="contact-line">
            Email Us Today Via: habicopropertymanagers@gmail.com
          </div>
          <div className="contact-line">BASIIMA BUILDING 2ND FLOOR ROOM</div>
        </div>

        {/* Date */}
        <p className="mb-4">{data.date}</p>

        {/* To */}
        <p className="font-bold">TO {data.landlordName},</p>
        <p className="mb-2">
          THE LANDLORDS OF THE PROPERTY AT {data.propertyLocation}
        </p>
        <p className="mb-4">Tel: {data.landlordTel}</p>

        {/* Title */}
        <p className="mb-4 font-bold">
          FINANCIAL REPORT FOR THE TENEMENT PROPERTY AT{" "}
          {data.propertyLocation}
        </p>

        {/* Tenant context */}
        <p className="free-text">{data.tenantContext}</p>

        {/* Agreement description */}
        <p className="free-text">
          {data.agreementDescription}
          {data.totalAgreed > 0 && (
            <>
              , a total amount of{" "}
              <span className="font-bold">
                UGX {formatNum(data.totalAgreed)}
              </span>{" "}
              (Uganda Shillings{" "}
              {numberToWords(data.totalAgreed).toUpperCase()}) was agreed to be
              paid during the course of First Term broken down as follows:
            </>
          )}
        </p>

        {/* Rent schedule table */}
        {data.rentSchedule.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>TERM</th>
                <th>SECTION</th>
                <th className="text-right">RENT</th>
              </tr>
            </thead>
            <tbody>
              {data.rentSchedule.map((r, i) => (
                <tr key={i}>
                  <td>{r.term}</td>
                  <td>{r.section}</td>
                  <td className="text-right">{formatNum(r.amount)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td colSpan={2}>TOTAL RENT</td>
                <td className="text-right">
                  {formatNum(
                    data.rentSchedule.reduce((s, r) => s + r.amount, 0),
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Payment periods */}
        {data.paymentPeriods.map((period, pi) => (
          <div key={pi} className="mt-4">
            <p className="mb-2 font-bold">{period.title} Payment details are as follows:</p>

            <table>
              <thead>
                <tr>
                  <th>{pi === 0 ? "1- First Term" : `${pi + 1}- ${period.title}`}</th>
                  <th className="text-right">
                    Rent deposited on the <br />
                    company Account
                  </th>
                  <th className="text-right">
                    Status of payments to the <br />
                    landlords
                  </th>
                </tr>
              </thead>
              <tbody>
                {period.rows
                  .filter((r) => r.amount > 0)
                  .map((r, ri) => (
                    <tr key={ri}>
                      <td>{r.label}</td>
                      <td className="text-right">
                        {r.amount > 0 ? formatNum(r.amount) : "—"}
                      </td>
                      <td className="text-right">—</td>
                    </tr>
                  ))}
                {period.payments.map((p, pi2) => (
                  <tr key={`p-${pi2}`}>
                    <td>{p.date}</td>
                    <td className="text-right">{formatNum(p.amount)}</td>
                    <td className="text-right">{p.status}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td>TOTAL RENT PAID</td>
                  <td className="text-right">{formatNum(period.totalPaid)}</td>
                  <td />
                </tr>
                <tr className="font-bold">
                  <td>BALANCE ({period.title})</td>
                  <td className="text-right">{formatNum(period.balance)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        {/* Commission breakdown */}
        {data.commission.totalCollected > 0 && (
          <div className="mt-4">
            <p className="mb-2 font-bold">{data.commission.description}</p>
            <table>
              <tbody>
                <tr>
                  <td>
                    Amount that was deposited to the client's account:
                  </td>
                  <td className="text-right font-bold">
                    UGX. {formatNum(data.commission.landlordShare)}/= (Only{" "}
                    {numberToWords(data.commission.landlordShare)
                      .charAt(0)
                      .toUpperCase() +
                      numberToWords(data.commission.landlordShare).slice(1)}{" "}
                    shillings)
                  </td>
                </tr>
                {data.commission.pendingToLandlord > 0 && (
                  <tr>
                    <td>
                      Amount to be deposited on the client's account
                      (66%*{formatNum(data.commission.pendingToLandlord)}):
                    </td>
                    <td className="text-right font-bold">
                      UGX. {formatNum(
                        Math.round(data.commission.pendingToLandlord * 0.66),
                      )}
                      /= (Only{" "}
                      {numberToWords(
                        Math.round(data.commission.pendingToLandlord * 0.66),
                      )
                        .charAt(0)
                        .toUpperCase() +
                        numberToWords(
                          Math.round(data.commission.pendingToLandlord * 0.66),
                        ).slice(1)}{" "}
                      shillings)
                    </td>
                  </tr>
                )}
                <tr>
                  <td>
                    Company fees (9%*
                    {data.commission.pendingToLandlord > 0
                      ? formatNum(data.commission.pendingToLandlord)
                      : formatNum(data.commission.totalCollected)}
                    ):
                  </td>
                  <td className="text-right font-bold">
                    UGX. {formatNum(data.commission.companyFee)}/= (Only{" "}
                    {numberToWords(data.commission.companyFee)
                      .charAt(0)
                      .toUpperCase() +
                      numberToWords(data.commission.companyFee).slice(1)}{" "}
                    shillings)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Thank you */}
        <p className="mt-4">Thank you for your cooperation.</p>

        {/* Signatory */}
        <div className="signature-area">
          <p>Yours Sincerely,</p>
          <div className="signature-line">
            <p className="font-bold">{data.signatoryName}, {data.signatoryContact}</p>
            <p>For HABICO PROPERTY MANAGERS LIMITED</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BuildReportInput {
  property: {
    id: string;
    name: string;
    location: string | null;
    owner_id: string | null;
  } | null;
  ownerProfile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  leases: any[];
  payments: any[];
}

export function buildPropertyReportData(input: BuildReportInput): FinancialReportData | null {
  const { property, ownerProfile, leases, payments } = input;
  if (!property) return null;

  const now = new Date();
  const months = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
  ];
  const dateStr = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  const landlordName = ownerProfile?.full_name?.toUpperCase() ?? ownerProfile?.email ?? "LANDLORD";
  const landlordTel = ownerProfile?.phone ?? "—";
  const propertyName = property.name ?? "";
  const propertyLocation = property.location?.toUpperCase() ?? propertyName.toUpperCase();

  const activeLeases = leases.filter((l: any) => l.status === "active");
  const allLeases = leases;

  const tenantNames = [...new Set(allLeases.map((l: any) => l.profile?.full_name).filter(Boolean))];
  const tenantContext = tenantNames.length > 0
    ? `The property is occupied by the following tenant(s): ${tenantNames.join(", ")}.`
    : "";

  const totalMonthlyRent = activeLeases.reduce((s: number, l: any) => s + Number(l.monthly_rent), 0);
  const totalArrears = allLeases.reduce((s: number, l: any) => s + Number(l.outstanding_balance ?? 0), 0);

  const rentSchedule = allLeases.map((l: any) => ({
    term: l.status === "active" ? "Current Term" : "Past Term",
    section: `${l.units?.unit_number ?? ""} — ${l.profile?.full_name ?? l.profile?.email ?? "Tenant"}`,
    amount: Number(l.monthly_rent),
  }));

  const totalSchedule = rentSchedule.reduce((s, r) => s + r.amount, 0);

  const rentPayments = payments.filter(
    (p: any) => p.payment_type === "Rent" || !p.payment_type,
  );

  const totalCollected = rentPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const pendingAmount = totalMonthlyRent - totalCollected;
  const balanceToCollect = Math.max(0, pendingAmount);

  const grouped: Record<string, { rows: { label: string; amount: number }[]; payments: PaymentRecord[]; totalPaid: number; balance: number }> = {};
  const getPeriod = (p: any): string => {
    const d = new Date(p.payment_date);
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  for (const p of rentPayments) {
    const period = getPeriod(p);
    if (!grouped[period]) {
      grouped[period] = { rows: [], payments: [], totalPaid: 0, balance: 0 };
    }
    grouped[period].payments.push({
      date: p.payment_date,
      amount: Number(p.amount),
      status: p.status === "completed" ? "Landlords paid" : "Not yet paid",
    });
    grouped[period].totalPaid += Number(p.amount);
    grouped[period].balance = Math.max(0, totalMonthlyRent - grouped[period].totalPaid);
  }

  const paymentPeriods: PaymentPeriod[] = Object.entries(grouped).map(([period, data], idx) => ({
    title: period,
    rows: idx === 0 && allLeases.length > 0
      ? [{ label: `${period} Rent`, amount: totalMonthlyRent }]
      : [{ label: `${period} Rent`, amount: totalMonthlyRent }],
    payments: data.payments,
    totalPaid: data.totalPaid,
    balance: data.balance,
  }));

  if (paymentPeriods.length === 0 && allLeases.length > 0) {
    paymentPeriods.push({
      title: `${months[now.getMonth()]} ${now.getFullYear()}`,
      rows: [{ label: "Rent Due", amount: totalMonthlyRent }],
      payments: [],
      totalPaid: 0,
      balance: totalMonthlyRent,
    });
  }

  const totalPaidAll = paymentPeriods.reduce((s, pp) => s + pp.totalPaid, 0);
  const landlordShare = Math.round(totalPaidAll * 0.66);
  const companyFee = Math.round(totalPaidAll * 0.09);
  const pendingToLandlord = totalPaidAll > 0 ? balanceToCollect : rentPayments.length > 0 ? 0 : 0;

  const commission: CommissionBreakdown = {
    description: paymentPeriods.length > 0
      ? `${paymentPeriods[0]?.title ?? "Current"} payments`
      : "Current payments",
    totalCollected: totalPaidAll,
    landlordShare,
    companyFee,
    pendingToLandlord,
  };

  return {
    date: dateStr,
    landlordName,
    landlordTel,
    propertyName,
    propertyLocation,
    tenantContext,
    agreementDescription: `As per the tenancy agreement between the above mentioned landlords and the tenants made in ${months[now.getMonth()]}, ${now.getFullYear()}`,
    totalAgreed: totalMonthlyRent > 0 ? totalMonthlyRent + totalArrears : 0,
    rentSchedule,
    paymentPeriods,
    commission,
    signatoryName: "Nabbosa Leila",
    signatoryContact: "0756742220",
    signatoryTitle: "For HABICO PROPERTY MANAGERS LIMITED",
  };
}

const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
];

function numberToWords(n: number): string {
  if (n === 0) return "zero";
  const num = Math.floor(Math.abs(n));
  if (num <= 0) return "zero";
  function convert(m: number): string {
    if (m < 20) return ONES[m];
    if (m < 100) return TENS[Math.floor(m / 10)] + (m % 10 ? " " + ONES[m % 10] : "");
    if (m < 1000) return ONES[Math.floor(m / 100)] + " hundred" + (m % 100 ? " " + convert(m % 100) : "");
    if (m < 1_000_000) return convert(Math.floor(m / 1000)) + " thousand" + (m % 1000 ? " " + convert(m % 1000) : "");
    if (m < 1_000_000_000) return convert(Math.floor(m / 1_000_000)) + " million" + (m % 1_000_000 ? " " + convert(m % 1_000_000) : "");
    return convert(Math.floor(m / 1_000_000_000)) + " billion" + (m % 1_000_000_000 ? " " + convert(m % 1_000_000_000) : "");
  }
  return convert(num);
}
