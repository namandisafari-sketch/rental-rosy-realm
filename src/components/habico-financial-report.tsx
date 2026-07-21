import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer, Mail } from "lucide-react";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import { sendFinancialReport } from "@/lib/sendEmails.functions";
import { toast } from "sonner";

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
  landlordEmail?: string;
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

  async function handleDownloadPdf() {
    if (!printRef.current) return;
    try {
      const imgData = await toPng(printRef.current, { backgroundColor: "#fff" });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (printRef.current.scrollHeight * imgW) / printRef.current.scrollWidth;
      let left = imgH;
      let pos = margin;
      pdf.addImage(imgData, "PNG", margin, pos, imgW, imgH);
      left -= pageH - margin * 2;
      while (left > 0) {
        pdf.addPage();
        pos = margin - (imgH - left);
        pdf.addImage(imgData, "PNG", margin, pos, imgW, imgH);
        left -= pageH - margin * 2;
      }
      const safeName = (data.landlordName || "landlord").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      pdf.save(`habico-financial-report-${safeName}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
    }
  }

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    const content = printRef.current?.innerHTML ?? "";
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>Financial Report - Habico</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: 'Inter','Segoe UI',system-ui,sans-serif; font-size: 10px; line-height: 1.6; color: #1e293b; padding: 16px; background: #fff; }
        .brand-header { background: linear-gradient(135deg,#0f172a,#1e293b); color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0; margin: -16px -16px 16px; display: flex; align-items: center; justify-content: space-between; }
        .brand-header h1 { font-size: 20px; font-weight: 800; letter-spacing: 2px; margin: 0; }
        .brand-header .sub { font-size: 9px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; margin: 2px 0 0; }
        .brand-header .badge { background: #f59e0b; color: #fff; padding: 4px 14px; border-radius: 4px; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .report-title { text-align: center; margin: 20px 0 16px; }
        .report-title h2 { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0; letter-spacing: 1px; text-transform: uppercase; }
        .report-title .line { width: 80px; height: 2px; background: #f59e0b; margin: 6px auto 0; border-radius: 1px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin: 12px 0; }
        .info-card .row { display: flex; margin: 3px 0; }
        .info-card .label { width: 70px; font-weight: 600; color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-card .value { flex: 1; font-weight: 500; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; border-radius: 6px; overflow: hidden; }
        td, th { padding: 6px 10px; text-align: left; vertical-align: top; }
        th { font-weight: 700; background: #1e293b; color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
        tr:nth-child(even) { background: #f8fafc; }
        tr:nth-child(odd) { background: #fff; }
        tr.total-row td { background: #f59e0b; color: #fff; font-weight: 700; }
        tr.balance-row td { background: #dc2626; color: #fff; font-weight: 700; }
        tr.balance-row.zero td { background: #059669; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .section-title { font-size: 11px; font-weight: 700; color: #1e293b; margin: 16px 0 4px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; letter-spacing: 1px; }
        .stat-grid { display: flex; gap: 8px; margin: 12px 0; }
        .stat-card { flex: 1; padding: 12px; border-radius: 6px; color: #fff; }
        .stat-card .stat-label { font-size: 7px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85; }
        .stat-card .stat-value { font-size: 13px; font-weight: 700; margin-top: 4px; }
        .bg-primary { background: #1e293b; }
        .bg-success { background: #059669; }
        .bg-danger { background: #dc2626; }
        .signature-area { margin-top: 24px; }
        .signature-line { border-top: 2px solid #1e293b; width: 220px; margin-top: 28px; padding-top: 4px; }
        .scanned-by { text-align: center; font-size: 8px; color: #94a3b8; margin-top: 20px; }
        .free-text { margin: 6px 0; text-align: justify; color: #475569; }
      </style>
      </head>
      <body>${content}
        <div class="scanned-by">Habico Property Managers — Basiima Building, 2nd Floor Room C03, Kampala · 0756742220 | 0702239607</div>
      </body>
      </html>
    `);
    win.document.close();
    win.print();
  }

  async function handleEmailReport() {
    if (!printRef.current) return;
    try {
      const imgData = await toPng(printRef.current, { backgroundColor: "#fff" });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (printRef.current.scrollHeight * imgW) / printRef.current.scrollWidth;
      let left = imgH;
      let pos = margin;
      pdf.addImage(imgData, "PNG", margin, pos, imgW, imgH);
      left -= pageH - margin * 2;
      while (left > 0) {
        pdf.addPage();
        pos = margin - (imgH - left);
        pdf.addImage(imgData, "PNG", margin, pos, imgW, imgH);
        left -= pageH - margin * 2;
      }
      const arr = pdf.output("arraybuffer");
      const bytes = new Uint8Array(arr);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const pdfBase64 = btoa(binary);

      const safeName = data.landlordName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const result = await sendFinancialReport({
        to: data.landlordEmail ?? "",
        landlordName: data.landlordName,
        propertyName: data.propertyName,
        pdfBase64,
        pdfFilename: `habico-financial-report-${safeName}.pdf`,
      });
      if (result.success) {
        toast.success("Financial report emailed to landlord");
      } else {
        toast.error(result.error ?? "Failed to send report");
      }
    } catch (err) {
      toast.error("Failed to generate or send report");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button onClick={handleDownloadPdf} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />PDF
        </Button>
        <Button onClick={handlePrint} variant="outline" size="sm">
          <Printer className="mr-2 h-4 w-4" />Print Report
        </Button>
        {data.landlordEmail && (
          <Button onClick={handleEmailReport} variant="outline" size="sm">
            <Mail className="mr-2 h-4 w-4" />Email Report
          </Button>
        )}
      </div>

      <div
        ref={printRef}
        className="rounded-lg border bg-white text-xs leading-relaxed text-black shadow-sm"
        style={{ fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", padding: "16px" }}
      >
        {/* Brand Header */}
        <div className="brand-header">
          <div>
            <h1>HABICO</h1>
            <p className="sub">Property Managers · Kampala, Uganda</p>
          </div>
          <div className="badge">Financial Report</div>
        </div>

        {/* Date */}
        <p style={{ margin: "6px 0", fontSize: "10px", color: "#64748b" }}>{data.date}</p>

        {/* Title */}
        <div className="report-title">
          <h2>Financial Report</h2>
          <div className="line" />
        </div>

        {/* Landlord info card */}
        <div className="info-card">
          <div className="row">
            <div className="label">To</div>
            <div className="value" style={{ fontWeight: 700 }}>{data.landlordName}</div>
          </div>
          <div className="row">
            <div className="label">Property</div>
            <div className="value">{data.propertyLocation}</div>
          </div>
          <div className="row">
            <div className="label">Tel</div>
            <div className="value">{data.landlordTel}</div>
          </div>
        </div>

        {/* Tenant context */}
        <p className="free-text" style={{ marginTop: "10px" }}>{data.tenantContext}</p>

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
                <th>Term</th>
                <th>Section</th>
                <th className="text-right">Rent</th>
              </tr>
            </thead>
            <tbody>
              {data.rentSchedule.map((r, i) => (
                <tr key={i}>
                  <td>{r.term}</td>
                  <td>{r.section}</td>
                  <td className="text-right">UGX {formatNum(r.amount)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={2} style={{ fontWeight: 700 }}>Total Rent</td>
                <td className="text-right" style={{ fontWeight: 700 }}>
                  UGX {formatNum(
                    data.rentSchedule.reduce((s, r) => s + r.amount, 0),
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Payment periods */}
        {data.paymentPeriods.map((period, pi) => (
          <div key={pi}>
            <div className="section-title">{period.title} — Payment Details</div>

            <table>
              <thead>
                <tr>
                  <th>Date / Description</th>
                  <th className="text-right">Amount (UGX)</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {period.rows
                  .filter((r) => r.amount > 0)
                  .map((r, ri) => (
                    <tr key={ri}>
                      <td style={{ fontWeight: 600 }}>{r.label}</td>
                      <td className="text-right">{formatNum(r.amount)}</td>
                      <td className="text-right" style={{ color: "#94a3b8" }}>—</td>
                    </tr>
                  ))}
                {period.payments.map((p, pi2) => (
                  <tr key={`p-${pi2}`}>
                    <td>{p.date}</td>
                    <td className="text-right">{formatNum(p.amount)}</td>
                    <td className="text-right" style={{ color: p.status === "Landlords paid" || p.status === "paid" || p.status === "completed" ? "#059669" : "#dc2626", fontWeight: 600 }}>
                      {p.status}
                    </td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td style={{ fontWeight: 700 }}>Total Rent Paid</td>
                  <td className="text-right" style={{ fontWeight: 700 }}>{formatNum(period.totalPaid)}</td>
                  <td />
                </tr>
                <tr className={`balance-row${period.balance <= 0 ? " zero" : ""}`}>
                  <td style={{ fontWeight: 700 }}>Balance ({period.title})</td>
                  <td className="text-right" style={{ fontWeight: 700 }}>{formatNum(period.balance)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        {/* Commission breakdown */}
        {data.commission.totalCollected > 0 && (
          <div>
            <div className="section-title">Commission Breakdown</div>

            <div className="stat-grid">
              <div className="stat-card bg-primary">
                <div className="stat-label">Total Collected</div>
                <div className="stat-value">UGX {formatNum(data.commission.totalCollected)}</div>
              </div>
              <div className="stat-card bg-success">
                <div className="stat-label">Landlord Share (66%)</div>
                <div className="stat-value">UGX {formatNum(data.commission.landlordShare)}</div>
              </div>
              {data.commission.pendingToLandlord > 0 && (
                <div className="stat-card" style={{ background: "#f59e0b" }}>
                  <div className="stat-label">Pending (66%)</div>
                  <div className="stat-value">UGX {formatNum(Math.round(data.commission.pendingToLandlord * 0.66))}</div>
                </div>
              )}
              <div className="stat-card" style={{ background: "#d97706" }}>
                <div className="stat-label">Company Fee (9%)</div>
                <div className="stat-value">UGX {formatNum(data.commission.companyFee)}</div>
              </div>
            </div>

            <table>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>Amount deposited to client's account:</td>
                  <td className="text-right" style={{ fontWeight: 700, color: "#059669" }}>
                    UGX {formatNum(data.commission.landlordShare)}
                  </td>
                </tr>
                {data.commission.pendingToLandlord > 0 && (
                  <tr>
                    <td style={{ fontWeight: 600 }}>
                      Amount to be deposited (66% × {formatNum(data.commission.pendingToLandlord)}):
                    </td>
                    <td className="text-right" style={{ fontWeight: 700, color: "#f59e0b" }}>
                      UGX {formatNum(Math.round(data.commission.pendingToLandlord * 0.66))}
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ fontWeight: 600 }}>
                    Company fees (9% × {data.commission.pendingToLandlord > 0
                      ? formatNum(data.commission.pendingToLandlord)
                      : formatNum(data.commission.totalCollected)}):
                  </td>
                  <td className="text-right" style={{ fontWeight: 700, color: "#d97706" }}>
                    UGX {formatNum(data.commission.companyFee)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Thank you */}
        <p style={{ margin: "16px 0 0", fontSize: "10px", fontStyle: "italic", color: "#64748b" }}>Thank you for your cooperation.</p>

        {/* Signatory */}
        <div className="signature-area">
          <p style={{ fontSize: "10px", margin: 0 }}>Yours Sincerely,</p>
          <div className="signature-line">
            <p style={{ fontWeight: 700, margin: 0, fontSize: "11px", color: "#1e293b" }}>{data.signatoryName}, {data.signatoryContact}</p>
            <p style={{ margin: "2px 0 0", fontSize: "9px", color: "#64748b" }}>For HABICO PROPERTY MANAGERS LIMITED</p>
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
    landlordEmail: ownerProfile?.email ?? undefined,
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
