import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { supabase } from "../lib/supabaseClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Reports.jsx
 * - Fetches released loans + payments
 * - Shows summary cards, pie & bar charts
 * - Shows loans table with Total Payable / Total Paid / Pending / Interest Earned
 * - CSV and PDF export
 *
 * Make sure your supabase client is set up in ../lib/supabaseClient
 */

const COLORS = ["#f5c542", "#ff6b6b", "#00c2a8"]; // receivable, paid, totalValue
const CARD_BG = "bg-[#111827]"; // adjust to match theme

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [borrowers, setBorrowers] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedBorrower, setSelectedBorrower] = useState("");
  const [filterApplied, setFilterApplied] = useState(false);

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    setLoading(true);
    try {
      // 1) fetch borrowers for dropdown
      const { data: bdata } = await supabase.from("borrowers").select("id, firstname, lastname");
      setBorrowers(bdata || []);

      // 2) fetch released loans with borrower and plan
      const { data: ldata, error: lerr } = await supabase
        .from("loan_list")
        .select(
          `id, ref_no, amount, plan_id, status, date_released, borrower_id,
           loan_plan ( months, interest_percentage ),
           borrowers ( id, firstname, lastname )`
        )
        .eq("status", 3) // released
        .order("date_released", { ascending: false });

      if (lerr) throw lerr;
      const loansFetched = ldata || [];

      // 3) fetch payments for these loans (if any)
      const loanIds = loansFetched.map((l) => l.id);
      let paymentsFetched = [];
      if (loanIds.length > 0) {
        const { data: pdata } = await supabase
          .from("payments")
          .select("id, loan_id, amount, penalty_amount, date_created")
          .in("loan_id", loanIds);
        paymentsFetched = pdata || [];
      }

      setLoans(loansFetched);
      setPayments(paymentsFetched);
    } catch (err) {
      console.error("Load Error:", err);
      alert("Failed to load report data. Check console for details.");
    } finally {
      setLoading(false);
    }
  }

  // helper: compute aggregated numbers per loan
  const loanRows = useMemo(() => {
    if (!loans) return [];
    // map payments sums by loan_id
    const paidMap = {};
    payments.forEach((p) => {
      const pen = p.penalty_amount ? Number(p.penalty_amount) : 0;
      const amt = Number(p.amount || 0) + pen;
      paidMap[p.loan_id] = (paidMap[p.loan_id] || 0) + amt;
    });

   return loans.map((l) => {
  const amount = Number(l.amount || 0);
  const plan = l.loan_plan || { months: 0, interest_percentage: 0 };
  const months = Number(plan.months || 0);
  const rate = Number(plan.interest_percentage || 0);

 const total_interest = amount * (rate / 100) * months;
const total_payable = amount + total_interest;
const total_paid = Number(paidMap[l.id] || 0);
const pending_balance = total_payable - total_paid;

// 🧮 proportionate interest calculation
let interest_earned = 0;
if (total_paid > 0) {
  const pay_ratio = Math.min(total_paid / total_payable, 1);
  interest_earned = total_interest * pay_ratio;
}


  return {
    loan_id: l.id,
    ref_no: l.ref_no,
    borrower_id: l.borrower_id,
    borrower_name: l.borrowers
      ? `${l.borrowers.firstname} ${l.borrowers.lastname}`
      : "Unknown",
    principal_amount: amount,
    months,
    interest_percentage: rate,
    total_interest,
    total_payable,
    total_paid,
    pending_balance,
    interest_earned,
    date_released: l.date_released,
  };
});

  }, [loans, payments]);

  // apply filters (date range & borrower)
  const filteredRows = useMemo(() => {
    return loanRows.filter((r) => {
      if (selectedBorrower && String(r.borrower_id) !== String(selectedBorrower)) return false;
      if (fromDate) {
        const from = new Date(fromDate);
        const released = r.date_released ? new Date(r.date_released) : null;
        if (!released || released < from) return false;
      }
      if (toDate) {
        const to = new Date(toDate);
        // include the whole day
        to.setHours(23, 59, 59, 999);
        const released = r.date_released ? new Date(r.date_released) : null;
        if (!released || released > to) return false;
      }
      return true;
    });
  }, [loanRows, selectedBorrower, fromDate, toDate]);

  // totals for top cards
  const totals = useMemo(() => {
    const totalLoanValue = filteredRows.reduce((s, r) => s + (r.total_payable || 0), 0);
    const totalPaid = filteredRows.reduce((s, r) => s + (r.total_paid || 0), 0);
    const interestEarned = filteredRows.reduce((s, r) => s + (r.interest_earned || 0), 0);
    const pendingBalance = filteredRows.reduce((s, r) => s + Math.max(0, r.pending_balance || 0), 0);
    return { totalLoanValue, totalPaid, interestEarned, pendingBalance };
  }, [filteredRows]);

  // Pie chart data
  const pieData = useMemo(() => {
    return [
      { name: "Receivable", value: totals.pendingBalance || 0 },
      { name: "Total Paid", value: totals.totalPaid || 0 },
      { name: "Total Value", value: totals.totalLoanValue || 0 },
    ];
  }, [totals]);

  // Monthly collections (group payments by month from payments array)
  const monthlyData = useMemo(() => {
    // gather all payments that match filteredRows' loan ids
    const loanIds = new Set(filteredRows.map((r) => r.loan_id));
    const filteredPayments = payments.filter((p) => loanIds.has(p.loan_id));

    const map = {};
    filteredPayments.forEach((p) => {
      const d = new Date(p.date_created);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = (map[key] || 0) + Number(p.amount || 0) + Number(p.penalty_amount || 0);
    });

    // convert to array sorted by month key
    const arr = Object.keys(map)
      .sort()
      .map((k) => ({ month: k, total: map[k] }));
    return arr;
  }, [payments, filteredRows]);

  function formatCurrency(v) {
    if (v == null) return "Rs.0";
    // local formatting
    return "Rs." + Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  // CSV export (no dependency on file-saver)
  function exportCSV() {
    const header = [
      "Ref No",
      "Borrower",
      "Principal Amount",
      "Interest %",
      "Months",
      "Date Released",
      "Total Payable",
      "Total Paid",
      "Pending Balance",
      "Interest Earned",
    ];
    const rows = filteredRows.map((r) => [
      r.ref_no,
      r.borrower_name,
      r.principal_amount,
      r.interest_percentage,
      r.months,
      r.date_released ? new Date(r.date_released).toLocaleDateString() : "",
      r.total_payable,
      r.total_paid,
      r.pending_balance,
      r.interest_earned,
    ]);

    const csvContent =
      [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "")}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `released_loans_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

function exportPDF() {
  try {
    const doc = new jsPDF("landscape", "pt", "a4");

    // 🔹 Company name header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("VIDUNI INVESTMENT (P.V.T) LTD", 40, 35);

    // 🔹 Report title
    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.text("Released Loans Report", 40, 60);

    // 🔹 Generated date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 75);

    // Table setup
    const tableCols = [
      "Ref No",
      "Borrower",
      "Principal",
      "Interest %",
      "Months",
      "Date",
      "Total Payable",
      "Total Paid",
      "Pending",
      "Interest Earned",
    ];

    const tableRows = filteredRows.map((r) => [
      r.ref_no,
      r.borrower_name,
      r.principal_amount,
      r.interest_percentage,
      r.months,
      r.date_released ? new Date(r.date_released).toLocaleDateString() : "",
      r.total_payable,
      r.total_paid,
      r.pending_balance,
      r.interest_earned,
    ]);

    // 🔹 Use autoTable with proper import
    autoTable(doc, {
      head: [tableCols],
      body: tableRows,
      startY: 90,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    // 🔹 Save PDF
    doc.save(`Released_Loans_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    console.error("PDF export failed:", err);
    alert("PDF export requires jsPDF and autotable. Check console for error.");
  }
}


  function handleFilter() {
    setFilterApplied(true);
  }
  function handleReset() {
    setFromDate("");
    setToDate("");
    setSelectedBorrower("");
    setFilterApplied(false);
  }

  return (
    <DashboardLayout>
      <div className="p-6 text-white">
        <h2 className="text-2xl font-bold mb-4">📊 Released Loans Report</h2>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-[#0f1724] px-4 py-2 rounded-md"
            placeholder="From"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-[#0f1724] px-4 py-2 rounded-md"
            placeholder="To"
          />
          <select
            value={selectedBorrower}
            onChange={(e) => setSelectedBorrower(e.target.value)}
            className="bg-[#0f1724] px-4 py-2 rounded-md"
          >
            <option value="">All Borrowers</option>
            {borrowers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.firstname} {b.lastname}
              </option>
            ))}
          </select>

          <button onClick={handleFilter} className="bg-yellow-500 px-4 py-2 rounded-md">
            Filter
          </button>
          <button onClick={handleReset} className="bg-gray-600 px-4 py-2 rounded-md">
            Reset
          </button>

          <div className="ml-auto flex gap-3">
            <button onClick={exportCSV} className="bg-yellow-500 px-4 py-2 rounded-md">
              Export CSV
            </button>
            <button onClick={exportPDF} className="bg-green-500 px-4 py-2 rounded-md">
              Export PDF
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-[#0f1724]">
            <div className="text-sm text-yellow-400">💰 Total Loan Value (With Interest)</div>
            <div className="text-2xl font-bold mt-2">{formatCurrency(totals.totalLoanValue)}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#0f1724]">
            <div className="text-sm text-green-400">💵 Total Paid</div>
            <div className="text-2xl font-bold mt-2">{formatCurrency(totals.totalPaid)}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#0f1724]">
            <div className="text-sm text-blue-400">📈 Interest Earned (So Far)</div>
            <div className="text-2xl font-bold mt-2">{formatCurrency(totals.interestEarned)}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#0f1724]">
            <div className="text-sm text-red-400">📄 Pending Balance</div>
            <div className="text-2xl font-bold mt-2">{formatCurrency(totals.pendingBalance)}</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="col-span-2 p-4 rounded-lg bg-[#0b1220]">
            <div className="text-yellow-400 font-semibold mb-3">📊 System Summary</div>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) =>
                      `${entry.name} (${Number(entry.value || 0).toLocaleString()})`
                    }
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#0b1220]">
            <div className="text-yellow-400 font-semibold mb-3">📆 Monthly Collections</div>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={monthlyData}>
                  <XAxis dataKey="month" tick={{ fill: "#9CA3AF" }} />
                  <YAxis tick={{ fill: "#9CA3AF" }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#34D399" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="p-4 rounded-lg bg-[#0b1220]">
          <div className="text-yellow-400 font-semibold mb-3">🔎 Released Loans</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-yellow-400">
                <tr>
                  <th className="py-3 px-2">Ref No</th>
                  <th className="py-3 px-2">Borrower</th>
                  <th className="py-3 px-2">Amount</th>
                  <th className="py-3 px-2">Interest (%)</th>
                  <th className="py-3 px-2">Months</th>
                  <th className="py-3 px-2">Loan Date</th>
                  <th className="py-3 px-2">Total Payable</th>
                  <th className="py-3 px-2">Total Paid</th>
                  <th className="py-3 px-2">Pending</th>
                  <th className="py-3 px-2">Interest Earned</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-400">
                      No released loans found for selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.loan_id} className="border-t border-gray-800 hover:bg-[#0f1724]">
                      <td className="py-3 px-2">{r.ref_no}</td>
                      <td className="py-3 px-2">{r.borrower_name}</td>
                      <td className="py-3 px-2">{formatCurrency(r.principal_amount)}</td>
                      <td className="py-3 px-2">{r.interest_percentage}%</td>
                      <td className="py-3 px-2">{r.months}</td>
                      <td className="py-3 px-2">
                        {r.date_released ? new Date(r.date_released).toLocaleDateString() : ""}
                      </td>
                      <td className="py-3 px-2">{formatCurrency(r.total_payable)}</td>
                      <td className="py-3 px-2">{formatCurrency(r.total_paid)}</td>
                      <td className="py-3 px-2">{formatCurrency(r.pending_balance)}</td>
                      <td className="py-3 px-2">{formatCurrency(r.interest_earned)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
