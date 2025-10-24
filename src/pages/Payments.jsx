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

  const [loanSummary, setLoanSummary] = useState({
    totalLoan: 0,
    totalPaid: 0,
    balance: 0,
    interestRate: 0,
    interestRs: 0,
    monthlyPayment: 0,
    totalPayable: 0,
    nextPaymentDate: "",
  });

  useEffect(() => {
    fetchLoans();
    fetchPayments();
  }, []);

  // 🔹 Fetch only Released loans (status = 3)
  async function fetchLoans() {
    const { data, error } = await supabase
      .from("loan_list")
      .select(
        "id, ref_no, amount, date_released, status, borrowers(firstname, lastname), loan_plan(months, interest_percentage)"
      )
      .eq("status", 3); // show only released loans
    if (!error) setLoans(data || []);
  }

  async function fetchPayments() {
    const { data, error } = await supabase
      .from("payments")
      .select(
  "id, loan_id, payee, amount, penalty_amount, date_created, loan_list(ref_no, borrowers(id_no))"
);

    if (!error) setPayments(data || []);
  }

  async function handleLoanChange(e) {
    const loanId = e.target.value;
    setFormData({ ...formData, loan_id: loanId });

    const selected = loans.find((l) => l.id == loanId);
    if (!selected) return;

    const loanAmount = parseFloat(selected.amount) || 0;
    const interestRate = parseFloat(selected.loan_plan?.interest_percentage) || 0;
    const months = parseInt(selected.loan_plan?.months) || 1;

    const { data: paymentData } = await supabase
      .from("payments")
      .select("amount, penalty_amount")
      .eq("loan_id", loanId);

    const totalPaid =
      paymentData?.reduce(
        (sum, p) =>
          sum + parseFloat(p.amount || 0) + parseFloat(p.penalty_amount || 0),
        0
      ) || 0;

    const releasedDate = new Date(selected.date_released);
    releasedDate.setDate(releasedDate.getDate() + 1);
    const nextPayment = new Date(releasedDate);
    nextPayment.setMonth(nextPayment.getMonth() + 1);

    const monthlyInterest = (loanAmount * interestRate) / 100;
    const principalPerMonth = loanAmount / months;
    const monthlyPayment = principalPerMonth + monthlyInterest;
    const totalPayable = monthlyPayment * months;
    const balance = totalPayable - totalPaid;

    setLoanSummary({
      totalLoan: loanAmount,
      totalPaid,
      balance,
      interestRate,
      interestRs: monthlyInterest.toFixed(2),
      monthlyPayment: monthlyPayment.toFixed(2),
      totalPayable: totalPayable.toFixed(2),
      nextPaymentDate: nextPayment.toLocaleDateString(),
    });

    setFormData({
      ...formData,
      loan_id: selected.id,
      payee: `${selected.borrowers?.firstname || ""} ${
        selected.borrowers?.lastname || ""
      }`,
      amount: monthlyPayment.toFixed(2),
      penalty_amount: 0,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (editing) {
      const { error } = await supabase
        .from("payments")
        .update({
          loan_id: formData.loan_id,
          payee: formData.payee,
          amount: formData.amount,
          penalty_amount: formData.penalty_amount,
        })
        .eq("id", formData.id);

      if (!error) {
        Swal.fire({
          title: "Payment Updated!",
          text: "Payment details have been updated successfully.",
          icon: "success",
          confirmButtonColor: "#22c55e",
          background: "#1a2238",
          color: "#fff",
        });
        setEditing(false);
        fetchPayments();
        setFormData({ id: null, loan_id: "", payee: "", amount: "", penalty_amount: 0 });
      }
      return;
    }

    const { error } = await supabase.from("payments").insert([
      {
        loan_id: formData.loan_id,
        payee: formData.payee,
        amount: formData.amount,
        penalty_amount: formData.penalty_amount || 0,
      },
    ]);

    if (!error) {
      await fetchPayments();
      await fetchLoans();

      if (loanSummary.balance <= 0) {
        await supabase
          .from("loan_list")
          .update({ status: 4 }) // set as Closed
          .eq("id", formData.loan_id);
      }

      Swal.fire({
        title: "Payment Added!",
        text: "Your payment has been recorded successfully.",
        icon: "success",
        confirmButtonColor: "#facc15",
        background: "#1a2238",
        color: "#fff",
      });

      setFormData({
        id: null,
        loan_id: "",
        payee: "",
        amount: "",
        penalty_amount: 0,
      });
    }
  }

  async function handleDelete(id) {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This payment will be permanently deleted!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
      background: "#1a2238",
      color: "#fff",
    });

    if (result.isConfirmed) {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (!error) {
        Swal.fire({
          title: "Deleted!",
          text: "Payment has been removed.",
          icon: "success",
          confirmButtonColor: "#22c55e",
          background: "#1a2238",
          color: "#fff",
        });
        fetchPayments();
      }
    }
  }

  function handleEdit(payment) {
    setFormData({
      id: payment.id,
      loan_id: payment.loan_id,
      payee: payment.payee,
      amount: payment.amount,
      penalty_amount: payment.penalty_amount,
    });
    setEditing(true);
  }

  return (
    <DashboardLayout>
      <div className="p-6 text-white">
        <h2 className="text-2xl font-semibold mb-4">💵 Payments Management</h2>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 mb-6">
         <Select
  options={loans.map((loan) => ({
    value: loan.id,
    label: `${loan.ref_no} — ${loan.borrowers?.firstname || ""} ${loan.borrowers?.lastname || ""} (Rs.${loan.amount})`,
  }))}
  value={
    formData.loan_id
      ? {
          value: formData.loan_id,
          label:
            loans.find((l) => l.id === formData.loan_id)?.ref_no || "Select Loan",
        }
      : null
  }
  onChange={(selected) => handleLoanChange({ target: { value: selected?.value } })}
  placeholder="🔍 Type Loan Ref or Borrower Name..."
  className="text-black flex-1"
  styles={{
    control: (base) => ({
      ...base,
      backgroundColor: "#202a40",
      color: "white",
      border: "none",
    }),
    singleValue: (base) => ({ ...base, color: "white" }),
    input: (base) => ({ ...base, color: "white" }),
    menu: (base) => ({ ...base, backgroundColor: "#1a2238", color: "white" }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "#2a3552" : "#1a2238",
      color: "white",
    }),
  }}
/>


          <input
            type="text"
            placeholder="Payee Name"
            className="bg-[#202a40] text-white px-4 py-2 rounded-md flex-1"
            value={formData.payee}
            onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
          />

          <input
            type="number"
            placeholder="Payment Amount"
            className="bg-[#202a40] text-white px-4 py-2 rounded-md w-40"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />

          <input
            type="number"
            placeholder="Penalty Amount"
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
        {formData.loan_id && (
          <div className="bg-[#1a2238] p-5 mb-6 rounded-lg grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>💰 <strong>Loan Amount:</strong> Rs. {loanSummary.totalLoan}</div>
            <div>📈 <strong>Interest Rate:</strong> {loanSummary.interestRate}%</div>
            <div>💵 <strong>Monthly Interest:</strong> Rs. {loanSummary.interestRs}</div>
            <div>💸 <strong>Monthly Payment:</strong> Rs. {loanSummary.monthlyPayment}</div>
            <div>🧮 <strong>Total Payable:</strong> Rs. {loanSummary.totalPayable}</div>
            <div>📅 <strong>Next Payment Date:</strong> {loanSummary.nextPaymentDate}</div>
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
              <tr key={p.id} className="border-b border-gray-700 hover:bg-[#2a3552]">
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
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center p-4 text-gray-400">
                  No payments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
