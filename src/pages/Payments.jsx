import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import DashboardLayout from "../layouts/DashboardLayout";
import Swal from "sweetalert2";
import "animate.css";
import Select from "react-select";

export default function Payments() {
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    loan_id: "",
    payee: "",
    amount: "",
    penalty_amount: 0,
  });
  const [editing, setEditing] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState("");
  const [loanSummary, setLoanSummary] = useState({});

  useEffect(() => {
    fetchLoans();
    fetchPayments();
  }, []);

  // 🔹 Fetch all released loans
  async function fetchLoans() {
    const { data, error } = await supabase
      .from("loan_list")
      .select(`
        id,
        ref_no,
        amount,
        status,
        next_payment_date,
        date_released,
        borrowers(firstname, lastname)
      `)
      .eq("status", 3);
    if (!error) setLoans(data || []);
  }

  // 🔹 Fetch all payments
  async function fetchPayments() {
    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, loan_id, payee, amount, penalty_amount, date_created, loan_list(ref_no, borrowers(id_no))"
      )
      .order("id", { ascending: true });
    if (!error) setPayments(data || []);
  }

  // 🔹 When a loan is selected
  async function handleLoanChange(e) {
    const loanId = e.target.value;
    setSelectedLoan(loanId);
    if (!loanId) return;

    const { data: loanData, error } = await supabase
      .from("loan_list")
      .select(`
        id, ref_no, amount, rate, term, next_payment_date, date_released, first_payment_date, paid_days,
        borrowers(firstname, lastname, id_no)
      `)
      .eq("id", loanId)
      .single();

    if (error || !loanData) return;

    const amount = Number(loanData.amount);
    const months = Number(loanData.term);
    const rate = Number(loanData.rate);
    const totalInterest = amount * (rate / 100) * months;
    const totalPayable = amount + totalInterest;
    const totalDays = months * 30;
    const dailyPayment = totalPayable / totalDays;

    const { count: paidDaysCount } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("loan_id", loanId);

    let nextPaymentDate;
    if (loanData.first_payment_date) {
      const firstPay = new Date(loanData.first_payment_date);
      firstPay.setDate(firstPay.getDate() + (loanData.paid_days || 0) + 1);
      nextPaymentDate = firstPay.toISOString().split("T")[0];
    } else {
      const release = new Date(loanData.date_released);
      release.setDate(release.getDate() + 1);
      nextPaymentDate = release.toISOString().split("T")[0];
    }

    const releaseDate = loanData.date_released
      ? new Date(loanData.date_released)
      : new Date();

    const remainingDays = Math.max(0, totalDays - (paidDaysCount || 0));

    setLoanSummary({
      loanId: loanData.id,
      payeeName: `${loanData.borrowers?.firstname || ""} ${loanData.borrowers?.lastname || ""}`,
      borrowerIdNo: loanData.borrowers?.id_no || "",
      loanAmount: amount.toFixed(2),
      interestRate: rate,
      totalPayable: totalPayable.toFixed(2),
      dailyPayment: dailyPayment.toFixed(2),
      nextPaymentDate,
      releaseDate: releaseDate.toLocaleDateString("en-CA"),
      paidDays: paidDaysCount || 0,
      firstPaymentDate: loanData.first_payment_date
        ? new Date(loanData.first_payment_date).toLocaleDateString("en-CA")
        : "N/A",
      remainingDays,
    });

    setFormData({
      ...formData,
      loan_id: loanData.id,
      payee: `${loanData.borrowers?.firstname || ""} ${loanData.borrowers?.lastname || ""}`,
      amount: dailyPayment.toFixed(2),
      penalty_amount: 0,
    });
  }

  // 🔹 Add or update payment
 // 🔹 Add or update payment
// 🔹 Add or update payment
async function handleSubmit(e) {
  e.preventDefault();

  if (!formData.loan_id) {
    Swal.fire({
      title: "⚠️ Select a Loan!",
      text: "Please choose a valid loan first.",
      icon: "warning",
      confirmButtonColor: "#facc15",
      background: "#1a2238",
      color: "#fff",
    });
    return;
  }

  // ✅ UPDATE mode
  if (editing) {
    const { error } = await supabase
      .from("payments")
      .update({
        payee: formData.payee,
        amount: formData.amount,
        penalty_amount: formData.penalty_amount,
      })
      .eq("id", formData.id);

    if (!error) {
      Swal.fire({
        title: "✅ Payment Updated!",
        text: "Details saved successfully.",
        icon: "success",
        confirmButtonColor: "#22c55e",
        background: "#1a2238",
        color: "#fff",
      });
      setEditing(false);
      fetchPayments();
    }
    return;
  }

  // 🔹 Fetch loan info
  const { data: loanData } = await supabase
    .from("loan_list")
    .select("id, first_payment_date, next_payment_date, paid_days, term, date_released")
    .eq("id", formData.loan_id)
    .single();

  if (!loanData) return;

  // --------------------------------------
  // 🧩 STEP 1: Initialize first/next payment
  // --------------------------------------
  let firstPaymentDate = loanData.first_payment_date;
  let nextPaymentDate = loanData.next_payment_date;

  if (!firstPaymentDate) {
    const release = new Date(loanData.date_released);
    release.setDate(release.getDate() + 1);
    firstPaymentDate = release.toISOString().split("T")[0];
    nextPaymentDate = firstPaymentDate; // ✅ first = next at the start

    await supabase
      .from("loan_list")
      .update({
        first_payment_date: firstPaymentDate,
        next_payment_date: nextPaymentDate,
      })
      .eq("id", loanData.id);
  }

  // --------------------------------------
  // 🧾 STEP 2: Add payment record
  // --------------------------------------
  const { error: payError } = await supabase.from("payments").insert([
    {
      loan_id: formData.loan_id,
      payee: formData.payee,
      amount: formData.amount,
      penalty_amount: formData.penalty_amount,
    },
  ]);

  if (payError) {
    console.error(payError);
    return;
  }

  // --------------------------------------
  // 🔄 STEP 3: Update next payment + paid_days
  // --------------------------------------
  const paidDays = (loanData.paid_days || 0) + 1;

  // 🧮 If this was the first payment, next = first_payment_date + 1 day
  const firstPayDate = new Date(firstPaymentDate);
  const newNextPayment = new Date(firstPayDate);
  newNextPayment.setDate(firstPayDate.getDate() + paidDays);

  await supabase
    .from("loan_list")
    .update({
      paid_days: paidDays,
      next_payment_date: newNextPayment.toISOString().split("T")[0],
    })
    .eq("id", loanData.id);

  // --------------------------------------
  // ✅ STEP 4: Auto-close loan if done
  // --------------------------------------
  const totalDays = (loanData.term || 0) * 30;
  if (paidDays >= totalDays) {
    await supabase
      .from("loan_list")
      .update({ status: 4 }) // closed
      .eq("id", loanData.id);

    Swal.fire({
      title: "🎉 Loan Fully Paid!",
      text: "This loan is now closed automatically.",
      icon: "success",
      confirmButtonColor: "#22c55e",
      background: "#1a2238",
      color: "#fff",
    });
  }

  // --------------------------------------
  // 🎯 STEP 5: Refresh
  // --------------------------------------
  Swal.fire({
    title: "💰 Payment Added!",
    text: "Payment recorded successfully.",
    icon: "success",
    confirmButtonColor: "#22c55e",
    background: "#1a2238",
    color: "#fff",
  });

  await handleLoanChange({ target: { value: formData.loan_id } });
  await fetchPayments();
  setFormData({ id: null, loan_id: "", payee: "", amount: "", penalty_amount: 0 });
}




  

  // 🔹 Edit
  async function handleEdit(payment) {
    setFormData({
      id: payment.id,
      loan_id: payment.loan_id,
      payee: payment.payee,
      amount: payment.amount,
      penalty_amount: payment.penalty_amount,
    });
    setEditing(true);

    Swal.fire({
      title: "✏️ Edit Mode Activated!",
      text: "You can now modify payment details.",
      icon: "info",
      confirmButtonColor: "#3b82f6",
      background: "#1a2238",
      color: "#fff",
    });
  }

  // 🔹 Delete
 async function handleDelete(id) {
  const result = await Swal.fire({
    title: "🗑️ Are you sure?",
    text: "This payment will be deleted permanently!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Yes, delete it!",
    background: "#1a2238",
    color: "#fff",
  });

  if (!result.isConfirmed) return;

  // 🟢 Step 1: Find payment BEFORE deleting
  const { data: deletedPayment } = await supabase
    .from("payments")
    .select("loan_id")
    .eq("id", id)
    .single();

  // 🟢 Step 2: Delete the payment
  await supabase.from("payments").delete().eq("id", id);

  // 🟢 Step 3: Update loan details
  if (deletedPayment) {
    const { data: loanData } = await supabase
      .from("loan_list")
      .select("id, paid_days, next_payment_date, first_payment_date, term")
      .eq("id", deletedPayment.loan_id)
      .single();

    if (loanData && loanData.paid_days > 0) {
      const updatedPaidDays = loanData.paid_days - 1;
      const firstDate = new Date(loanData.first_payment_date);
      const newNextDate = new Date(firstDate);
      newNextDate.setDate(firstDate.getDate() + updatedPaidDays);

      // update in DB
      await supabase
        .from("loan_list")
        .update({
          paid_days: updatedPaidDays,
          next_payment_date: newNextDate.toISOString().split("T")[0],
          status: 3,
        })
        .eq("id", deletedPayment.loan_id);
    }

    // ✅ Refresh loanSummary UI instantly
    await handleLoanChange({ target: { value: deletedPayment.loan_id } });
  }

  Swal.fire({
    title: "✅ Deleted!",
    text: "Payment removed successfully.",
    icon: "success",
    confirmButtonColor: "#22c55e",
    background: "#1a2238",
    color: "#fff",
  });

  await fetchPayments();
  await fetchLoans();
}


  return (
    <DashboardLayout>
      <div className="p-6 text-white">
        <h2 className="text-2xl font-semibold mb-4">💵 Payments Management</h2>

        {/* Payment Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap gap-3 mb-6 items-center justify-between"
        >
          <Select
  isSearchable
  menuPlacement="auto"
  menuPortalTarget={document.body}
  options={loans.map((loan) => ({
    value: loan.id,
    label: `${loan.ref_no} — ${loan.borrowers?.firstname || ""} ${loan.borrowers?.lastname || ""} (Rs.${loan.amount})`,
  }))}
  value={
    selectedLoan
      ? {
          value: selectedLoan,
          label:
            loans.find((l) => l.id === selectedLoan)?.ref_no || "Select Loan",
        }
      : null
  }
  onChange={(selected) =>
    handleLoanChange({
      target: { value: selected ? selected.value : "" },
    })
  }
  placeholder="🔍 Type Loan Ref or Borrower Name..."
  className="text-black flex-1 min-w-[250px] z-50"
  styles={{
    control: (base) => ({
      ...base,
      backgroundColor: "#202a40",
      border: "1px solid #3b4368",
      color: "#fff",
      boxShadow: "none",
    }),
    singleValue: (base) => ({
      ...base,
      color: "#ffffff", // ✅ main selected text bright white
      fontWeight: "500",
    }),
    input: (base) => ({
      ...base,
      color: "#ffffff", // ✅ typing text white
    }),
    placeholder: (base) => ({
      ...base,
      color: "#9ca3af", // ✅ gray placeholder text
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: "#1a2238",
      color: "#ffffff",
      border: "1px solid #3b4368",
    }),
    option: (base, state) => ({
      ...base,
      color: state.isFocused ? "#1a2238" : "#ffffff", // ✅ invert on hover
      backgroundColor: state.isFocused ? "#facc15" : "transparent", // yellow highlight on hover
      fontWeight: state.isFocused ? "600" : "400",
      cursor: "pointer",
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  }}
/>


          <input
            type="text"
            placeholder="Payee Name"
            className="bg-[#202a40] text-white px-4 py-2 rounded-md"
            value={formData.payee}
            onChange={(e) =>
              setFormData({ ...formData, payee: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="Amount"
            className="bg-[#202a40] text-white px-4 py-2 rounded-md w-40"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="Penalty"
            className="bg-[#202a40] text-white px-4 py-2 rounded-md w-40"
            value={formData.penalty_amount}
            onChange={(e) =>
              setFormData({ ...formData, penalty_amount: e.target.value })
            }
          />
          <button
            type="submit"
            className={`${
              editing
                ? "bg-green-500 hover:bg-green-600"
                : "bg-yellow-500 hover:bg-yellow-600"
            } text-black font-semibold px-6 py-2 rounded-md`}
          >
            {editing ? "Update Payment" : "Add Payment"}
          </button>
        </form>

        {/* Loan Summary */}
        {loanSummary.loanId && (
          <div className="bg-[#1a2238] p-5 mb-6 rounded-lg grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>💰 Loan Amount: Rs. {loanSummary.loanAmount}</div>
            <div>📈 Interest Rate: {loanSummary.interestRate}%</div>
            <div>💵 Daily Payment: Rs. {loanSummary.dailyPayment}</div>
            <div>💸 Total Payable: Rs. {loanSummary.totalPayable}</div>
            <div>📅 First Payment: {loanSummary.firstPaymentDate}</div>
            <div>📅 Next Payment: {loanSummary.nextPaymentDate}</div>
            <div>🗓 Release Date: {loanSummary.releaseDate}</div>
            <div>✅ Paid Days: {loanSummary.paidDays}</div>
            <div>⏳ Remaining: {loanSummary.remainingDays}</div>
          </div>
        )}

        {/* Payments Table */}
        <table className="w-full bg-[#1a2238] text-white rounded-lg overflow-hidden">
          <thead className="bg-[#2b364f] text-yellow-400">
            <tr>
              <th className="p-3 text-left">Loan Ref</th>
              <th className="p-3 text-left">Payee</th>
              <th className="p-3 text-left">Borrower ID No</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Penalty</th>
              <th className="p-3 text-left">Total</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr
                key={p.id}
                className="border-b border-gray-700 hover:bg-[#2a3552]"
              >
                <td className="p-3">{p.loan_list?.ref_no}</td>
                <td className="p-3">{p.payee}</td>
                <td className="p-3">{p.loan_list?.borrowers?.id_no || "N/A"}</td>
                <td className="p-3">Rs.{p.amount}</td>
                <td className="p-3">Rs.{p.penalty_amount}</td>
                <td className="p-3">
                  Rs.{parseFloat(p.amount) + parseFloat(p.penalty_amount)}
                </td>
                <td className="p-3">
                  {new Date(p.date_created).toLocaleDateString()}
                </td>
                <td className="p-3 flex justify-center gap-2">
                  <button
                    onClick={() => handleEdit(p)}
                    className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-white text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-white text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
