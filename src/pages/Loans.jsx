import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import DashboardLayout from "../layouts/DashboardLayout";
import Swal from "sweetalert2";
import { motion } from "framer-motion";

export default function Loans() {
  const [borrowers, setBorrowers] = useState([]);
  const [loanTypes, setLoanTypes] = useState([]);
  const [loanPlans, setLoanPlans] = useState([]);
  const [loans, setLoans] = useState([]);
  const [editingLoan, setEditingLoan] = useState(null);

  const [formData, setFormData] = useState({
    borrower_id: "",
    loan_type_id: "",
    plan_id: "",
    amount: "",
    purpose: "",
  });

  const [calcSummary, setCalcSummary] = useState({
    monthlyInterest: 0,
    monthlyPayment: 0,
    totalPayable: 0,
  });

  useEffect(() => {
    fetchBorrowers();
    fetchLoanTypes();
    fetchLoanPlans();
    fetchLoans();
  }, []);

  async function fetchBorrowers() {
    const { data } = await supabase.from("borrowers").select("id, firstname, lastname");
    setBorrowers(data || []);
  }

  async function fetchLoanTypes() {
    const { data } = await supabase.from("loan_types").select("id, type_name");
    setLoanTypes(data || []);
  }

  async function fetchLoanPlans() {
    const { data } = await supabase.from("loan_plan").select("id, months, interest_percentage");
    setLoanPlans(data || []);
  }

  async function fetchLoans() {
  const { data } = await supabase
  .from("loan_list")
  .select(
  `id, borrower_id, loan_type_id, plan_id, ref_no, amount, purpose, status, rate, term, date_created, date_released,
   borrowers(firstname, lastname, id_no),
   loan_types(type_name),
   loan_plan(months, interest_percentage)`
)

  .order("id", { ascending: false });


  setLoans(data || []);
  await autoCloseFullyPaidLoans();
}

  async function autoCloseFullyPaidLoans() {
  // fetch released loans (status = 3)
  const { data: releasedLoans } = await supabase
    .from("loan_list")
    .select("id, amount, loan_plan(months, interest_percentage)")
    .eq("status", 3);

  if (!releasedLoans || releasedLoans.length === 0) return;

  for (const loan of releasedLoans) {
    const amount = Number(loan.amount || 0);
    const months = Number(loan.loan_plan?.months || 0);
    const rate = Number(loan.loan_plan?.interest_percentage || 0);

    const totalInterest = amount * (rate / 100) * months;
    const totalPayable = amount + totalInterest;

    // sum all payments
    const { data: pays } = await supabase
      .from("payments")
      .select("amount, penalty_amount")
      .eq("loan_id", loan.id);

    const totalPaid = (pays || []).reduce(
      (sum, p) => sum + Number(p.amount || 0) + Number(p.penalty_amount || 0),
      0
    );

    // if fully paid, close it
    if (totalPaid >= totalPayable) {
      await supabase.from("loan_list").update({ status: 4 }).eq("id", loan.id);
    }
  }
}


  function handleCalculate() {
    const amount = parseFloat(formData.amount) || 0;
    const selectedPlan = loanPlans.find((p) => p.id == formData.plan_id);
    if (!amount || !selectedPlan) {
      Swal.fire("Error", "Please select plan and amount correctly!", "error");
      return;
    }

    const rate = selectedPlan.interest_percentage;
    const term = selectedPlan.months;
    const monthlyInterest = (amount * rate) / 100;
    const totalInterest = monthlyInterest * term;
    const totalPayable = amount + totalInterest;
    const monthlyPayment = totalPayable / term;

    setCalcSummary({
      monthlyInterest: monthlyInterest.toFixed(2),
      monthlyPayment: monthlyPayment.toFixed(2),
      totalPayable: totalPayable.toFixed(2),
    });
  }

  async function handleAddLoan(e) {
    e.preventDefault();
    const selectedPlan = loanPlans.find((p) => p.id == formData.plan_id);
    if (!selectedPlan) {
      Swal.fire("Error", "Please select a valid plan!", "error");
      return;
    }

    const confirm = await Swal.fire({
      title: "Confirm Loan Creation",
      text: "Are you sure you want to add this new loan?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Add it!",
      cancelButtonText: "Cancel",
      background: "#1a1f2e",
      color: "#fff",
    });

    if (!confirm.isConfirmed) return;

    const refNo = `REF-${Date.now()}`;
    const payload = {
      ref_no: refNo,
      borrower_id: Number(formData.borrower_id),
      loan_type_id: Number(formData.loan_type_id),
      plan_id: Number(formData.plan_id),
      amount: parseFloat(formData.amount),
      purpose: formData.purpose || null,
      rate: selectedPlan.interest_percentage,
      term: selectedPlan.months,
      status: 0,
    };

    const { error } = await supabase.from("loan_list").insert([payload]);
    if (error) return Swal.fire("Error", error.message, "error");

    Swal.fire({
      icon: "success",
      title: "🎉 Loan Added Successfully!",
      showConfirmButton: false,
      timer: 1800,
      background: "#1a1f2e",
      color: "#fff",
    });

    setFormData({ borrower_id: "", loan_type_id: "", plan_id: "", amount: "", purpose: "" });
    setCalcSummary({ monthlyInterest: 0, monthlyPayment: 0, totalPayable: 0 });
    fetchLoans();
  }

  async function handleUpdateLoan(e) {
  e.preventDefault();
  if (!editingLoan) return;

  const selectedPlan = loanPlans.find((p) => p.id == formData.plan_id);
  if (!selectedPlan) {
    Swal.fire("Error", "Please select a valid plan!", "error");
    return;
  }

  const confirm = await Swal.fire({
    title: "Confirm Update",
    text: "Are you sure you want to update this loan?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, Update it!",
    cancelButtonText: "Cancel",
    background: "#1a1f2e",
    color: "#fff",
  });

  if (!confirm.isConfirmed) return;

  const payload = {
    borrower_id: Number(formData.borrower_id),
    loan_type_id: Number(formData.loan_type_id),
    plan_id: Number(formData.plan_id),
    amount: parseFloat(formData.amount),
    purpose: formData.purpose || null,
    rate: selectedPlan.interest_percentage,
    term: selectedPlan.months,
  };

  const { error } = await supabase.from("loan_list").update(payload).eq("id", editingLoan.id);
  if (error) return Swal.fire("Error", error.message, "error");

  Swal.fire({
    icon: "success",
    title: "✅ Loan Updated Successfully!",
    showConfirmButton: false,
    timer: 1500,
    background: "#1a1f2e",
    color: "#fff",
  });

  setEditingLoan(null);
  setFormData({ borrower_id: "", loan_type_id: "", plan_id: "", amount: "", purpose: "" });
  setCalcSummary({ monthlyInterest: 0, monthlyPayment: 0, totalPayable: 0 });
  fetchLoans();
}


  async function handleStatusChange(loanId, newStatus) {
    await supabase.from("loan_list").update({ status: newStatus }).eq("id", loanId);
    fetchLoans();
  }

  const statusLabels = {
    0: "Pending",
    1: "Approved",
    2: "Rejected",
    3: "Released",
    4: "Closed",
  };

  const statusColors = {
    0: "bg-yellow-500",
    1: "bg-green-500",
    2: "bg-red-500",
    3: "bg-blue-500",
    4: "bg-gray-500",
  };
function getNextPaymentDate(createdAt) {
  if (!createdAt) return "N/A";
  const next = new Date(createdAt);
  next.setDate(next.getDate() + 1); // add 1 day (release considered tomorrow)
  next.setMonth(next.getMonth() + 1); // then add 1 month
  return next.toISOString().split("T")[0];
}
  // ✏️ Edit Loan Function (FULL AUTO-FILL)
async function handleEditLoan(loan) {
  setEditingLoan(loan);
  setFormData({
    borrower_id: loan.borrower_id || "",
    loan_type_id: loan.loan_type_id || "",
    plan_id: loan.plan_id || "",
    amount: loan.amount || "",
    purpose: loan.purpose || "",
  });

  setCalcSummary({
    monthlyInterest: (loan.amount * (loan.rate / 100)).toFixed(2),
    monthlyPayment: ((loan.amount + loan.amount * (loan.rate / 100) * loan.term) / loan.term).toFixed(2),
    totalPayable: (loan.amount + loan.amount * (loan.rate / 100) * loan.term).toFixed(2),
  });

  Swal.fire({
    icon: "info",
    title: "Editing Loan",
    text: `Now editing ${loan.ref_no}`,
    background: "#1a1f2e",
    color: "#fff",
  });
}


  // 🗑️ Delete Loan Function
  async function handleDeleteLoan(id) {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "This loan will be permanently deleted!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      background: "#1a1f2e",
      color: "#fff",
    });

    if (!confirm.isConfirmed) return;

    const { error } = await supabase.from("loan_list").delete().eq("id", id);
    if (error) {
      Swal.fire("Error", error.message, "error");
    } else {
      Swal.fire({
        icon: "success",
        title: "Loan Deleted",
        showConfirmButton: false,
        timer: 1500,
        background: "#1a1f2e",
        color: "#fff",
      });
      fetchLoans(); // refresh list
    }
  }


  return (
    <DashboardLayout>
      <div className="p-8 text-white">
        <h2 className="text-2xl font-semibold mb-6">🏦 Loan Management</h2>

        {/* Refined input layout */}
        <form
          onSubmit={editingLoan ? handleUpdateLoan : handleAddLoan}
          className="bg-[#1a2238] p-6 rounded-xl mb-6 grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4 shadow-md"
        >
          <select
            className="bg-[#202a40] text-white px-4 py-2 rounded-md focus:ring-2 focus:ring-yellow-500 outline-none"
            value={formData.borrower_id}
            onChange={(e) => setFormData({ ...formData, borrower_id: e.target.value })}
          >
            <option value="">Select Borrower</option>
            {borrowers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.firstname} {b.lastname}
              </option>
            ))}
          </select>

          <select
            className="bg-[#202a40] text-white px-4 py-2 rounded-md focus:ring-2 focus:ring-yellow-500 outline-none"
            value={formData.loan_type_id}
            onChange={(e) => setFormData({ ...formData, loan_type_id: e.target.value })}
          >
            <option value="">Select Loan Type</option>
            {loanTypes.map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lt.type_name}
              </option>
            ))}
          </select>

          <select
            className="bg-[#202a40] text-white px-4 py-2 rounded-md focus:ring-2 focus:ring-yellow-500 outline-none"
            value={formData.plan_id}
            onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
          >
            <option value="">Select Plan</option>
            {loanPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.months} Months @ {p.interest_percentage}%
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Amount"
            className="bg-[#202a40] text-white px-4 py-2 rounded-md focus:ring-2 focus:ring-yellow-500 outline-none"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />

          <input
            type="text"
            placeholder="Purpose"
            className="bg-[#202a40] text-white px-4 py-2 rounded-md focus:ring-2 focus:ring-yellow-500 outline-none"
            value={formData.purpose}
            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
          />

          <div className="flex gap-4 md:col-span-3 sm:col-span-2 justify-end mt-2">
            <button
              type="button"
              onClick={handleCalculate}
              className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 rounded-md font-semibold transition-all duration-300"
            >
              Calculate
            </button>
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-black px-6 py-2 rounded-md font-semibold transition-all duration-300"
            >
              {editingLoan ? "Update Loan" : "Add Loan"}
            </button>
          </div>
        </form>

        {calcSummary.totalPayable > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1e2b48] p-4 rounded-lg mb-6 shadow-lg"
          >
            <h3 className="text-lg font-semibold mb-2">💡 Calculation Summary</h3>
            <p>Monthly Interest: Rs. {calcSummary.monthlyInterest}</p>
            <p>Monthly Payment: Rs. {calcSummary.monthlyPayment}</p>
            <p>Total Payable: Rs. {calcSummary.totalPayable}</p>
          </motion.div>
        )}

        {/* Loan Table */}
        <table className="w-full bg-[#1a2238] rounded-lg overflow-hidden text-sm">
          <thead className="bg-[#2b364f] text-yellow-400">
            <tr>
              <th className="p-3 text-left">Ref No</th>
              <th className="p-3 text-left">Borrower</th>
              <th className="p-3 text-left">ID No</th>
              <th className="p-3 text-left">Loan Type</th>
              <th className="p-3 text-left">Plan</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Purpose</th>
              <th className="p-3 text-left">Date Released</th>
              <th className="p-3 text-left">Next Payment</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id} className="border-b border-gray-700 hover:bg-[#2a3552] transition-all duration-300">
                <td className="p-3">{loan.ref_no}</td>
                <td className="p-3">
                  {loan.borrowers?.firstname} {loan.borrowers?.lastname}
                </td>
                <td className="p-3">{loan.borrowers?.id_no || "N/A"}</td>
                <td className="p-3">{loan.loan_types?.type_name}</td>
                <td className="p-3">
                  {loan.term} mo @ {loan.rate}%
                </td>
                <td className="p-3">Rs.{loan.amount}</td>
                <td className="p-3">{loan.purpose}</td>
                <td className="p-3">{new Date(loan.date_created).toISOString().split("T")[0]}</td>
                <td className="p-3">{getNextPaymentDate(loan.date_created)}</td>
                <td className="p-3">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className={`px-3 py-1 rounded-full text-black font-semibold text-center ${statusColors[loan.status]}`}
                  >
                    {statusLabels[loan.status]}
                  </motion.div>
                </td>
                <td className="p-3 flex justify-center gap-2">
  <select
    className="bg-[#202a40] text-white px-2 py-1 rounded-md"
    value={loan.status}
    onChange={(e) => handleStatusChange(loan.id, parseInt(e.target.value))}
  >
    {Object.entries(statusLabels).map(([key, value]) => (
      <option key={key} value={key}>
        {value}
      </option>
    ))}
  </select>

  {/* ✅ Connect Edit Button */}
  <button
    onClick={() => handleEditLoan(loan)}
    className="bg-blue-500 px-3 py-1 rounded-md text-black font-semibold hover:bg-blue-600"
  >
    Edit
  </button>

  {/* ✅ Connect Delete Button */}
  <button
    onClick={() => handleDeleteLoan(loan.id)}
    className="bg-red-500 px-3 py-1 rounded-md text-black font-semibold hover:bg-red-600"
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
