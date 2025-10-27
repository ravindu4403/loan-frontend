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

  async function fetchLoanPlans() {
  const { data, error } = await supabase
    .from("loan_plan")
    .select("id, months, interest_percentage");

  if (error) {
    console.error("Error fetching loan plans:", error.message);
    return;
  }

  setLoanPlans(data || []);
}

  async function fetchBorrowers() {
    const { data } = await supabase.from("borrowers").select("id, firstname, lastname");
    setBorrowers(data || []);
  }

  async function fetchLoanTypes() {
    const { data } = await supabase.from("loan_types").select("id, type_name");
    setLoanTypes(data || []);
  }

    async function fetchLoans() {
    const { data, error } = await supabase
      .from("loan_list")
      .select(`
        id, borrower_id, loan_type_id, plan_id, ref_no, amount, purpose, status, rate, term,
        date_created, date_released, next_payment_date,
        borrowers(firstname, lastname, id_no),
        loan_types(type_name),
        loan_plan(months, interest_percentage),
        payments(amount)
      `)
      .order("id", { ascending: false });

    if (error) {
      console.error("Error fetching loans:", error);
      return;
    }



    // group total payments for each loan
    const withPayments = (data || []).map((loan) => {
      const total_paid = loan.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      return { ...loan, total_paid };
    });

    setLoans(withPayments);
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
  const months = selectedPlan.months;
  const totalInterest = amount * (rate / 100) * months;
  const totalPayable = amount + totalInterest;
  const totalDays = months * 30;
  const dailyPayment = totalPayable / totalDays;

  setCalcSummary({
    totalInterest: totalInterest.toFixed(2),
    totalPayable: totalPayable.toFixed(2),
    dailyPayment: dailyPayment.toFixed(2),
    totalDays,
    months,
    rate,
    amount,
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
      date_created: new Date().toLocaleDateString("en-CA"),
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
  if (newStatus === 3) {
    // Loan Released 🟢
    const now = new Date();
    const releaseDate = now.toISOString().split("T")[0]; // yyyy-mm-dd

    const firstPayment = new Date(now);
    firstPayment.setDate(firstPayment.getDate() + 1);
    const firstPaymentDate = firstPayment.toISOString().split("T")[0];
    const nextPaymentDate = firstPaymentDate;

    const { error } = await supabase
      .from("loan_list")
      .update({
        status: 3,
        date_released: releaseDate, // set only now
        first_payment_date: firstPaymentDate,
        next_payment_date: nextPaymentDate,
        paid_days: 0,
      })
      .eq("id", loanId);

    if (error) {
      console.error(error);
      Swal.fire("Error", "Failed to release loan!", "error");
      return;
    }

    Swal.fire({
      icon: "success",
      title: "Loan Released!",
      text: `Loan released successfully on ${releaseDate}`,
      background: "#1a1f2e",
      color: "#fff",
    });
  } else if (newStatus === 1) {
    // Loan Pending 🟡
    const { error } = await supabase
      .from("loan_list")
      .update({
        status: 1,
        date_released: null, // reset
        first_payment_date: null,
        next_payment_date: null,
        paid_days: 0,
      })
      .eq("id", loanId);

    if (error) {
      console.error(error);
      Swal.fire("Error", "Failed to update loan status!", "error");
      return;
    }
  }

  fetchLoans(); // refresh UI
}




// 🧮 Calculate next payment date for monthly loan
function getNextPaymentDate(createdAt) {
  if (!createdAt) return "N/A";
  const base = new Date(createdAt + "T00:00:00"); // avoid timezone shift
  const next = new Date(base);
  next.setMonth(base.getMonth() + 1); // add one month
  return next.toLocaleDateString("en-CA"); // yyyy-mm-dd format
}

  // 🔵 Loan Status Definitions
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
// 🧩 Safe date formatter to avoid "Invalid Date"
// 🧩 Safe date formatter to handle Supabase timestamps
function formatDateSafe(dateValue) {
  if (!dateValue) return "N/A";
  
  const dateObj = new Date(dateValue);
  if (isNaN(dateObj.getTime())) return "N/A";

  return dateObj.toLocaleDateString("en-CA"); // yyyy-mm-dd
}


  // 🔴 Determine overdue color for next payment
  function getNextPaymentStatus(loan) {
    if (!loan.next_payment_date) return "text-gray-300";

    const today = new Date();
    const nextDate = new Date(loan.next_payment_date + "T00:00:00");

    // Payment check
    const hasPayment = loan.total_paid && loan.total_paid > 0;

    if (!hasPayment && nextDate < today && loan.status === 3) {
      return "text-red-400 font-semibold"; // Overdue
    }

    return "text-white"; // Normal
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
    transition={{ duration: 0.3 }}
    className="bg-gradient-to-r from-[#1b253b] to-[#222c46] border border-[#2f3c5f] p-6 rounded-2xl mb-6 shadow-lg"
  >
    <h3 className="text-xl font-semibold mb-4 text-yellow-400 flex items-center gap-2">
      📊 Daily Loan Summary
    </h3>

    <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4 text-sm">
      <div className="bg-[#1a2238] p-3 rounded-lg text-center">
        <p className="text-gray-400">💰 Loan Amount</p>
        <p className="text-lg font-bold text-green-400">
          Rs. {calcSummary.amount}
        </p>
      </div>

      <div className="bg-[#1a2238] p-3 rounded-lg text-center">
        <p className="text-gray-400">📈 Interest Rate</p>
        <p className="text-lg font-bold text-blue-400">{calcSummary.rate}%</p>
      </div>

      <div className="bg-[#1a2238] p-3 rounded-lg text-center">
        <p className="text-gray-400">🧮 Loan Period</p>
        <p className="text-lg font-bold text-yellow-400">
          {calcSummary.months} months ({calcSummary.totalDays} days)
        </p>
      </div>

      <div className="bg-[#1a2238] p-3 rounded-lg text-center">
        <p className="text-gray-400">💵 Daily Payment</p>
        <p className="text-lg font-bold text-yellow-400">
          Rs. {calcSummary.dailyPayment}
        </p>
      </div>

      <div className="bg-[#1a2238] p-3 rounded-lg text-center">
        <p className="text-gray-400">💸 Total Payable</p>
        <p className="text-lg font-bold text-green-400">
          Rs. {calcSummary.totalPayable}
        </p>
      </div>

      <div className="bg-[#1a2238] p-3 rounded-lg text-center">
        <p className="text-gray-400">📆 Total Interest</p>
        <p className="text-lg font-bold text-blue-400">
          Rs. {calcSummary.totalInterest}
        </p>
      </div>
    </div>
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
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
  {loans.map((loan) => (
    <tr
      key={loan.id}
      className="border-b border-gray-700 hover:bg-[#2a3552] transition-all duration-300"
    >
      {/* 🔹 Reference No */}
      <td className="p-3">{loan.ref_no}</td>

      {/* 🔹 Borrower Name */}
      <td className="p-3">
        {loan.borrowers?.firstname} {loan.borrowers?.lastname}
      </td>

      {/* 🔹 Borrower ID */}
      <td className="p-3">{loan.borrowers?.id_no || "N/A"}</td>

      {/* 🔹 Loan Type */}
      <td className="p-3">{loan.loan_types?.type_name}</td>

      {/* 🔹 Plan + Daily Payment */}
      <td className="p-3">
        {loan.term} mo @ {loan.rate}%<br />
       <span className="text-yellow-400 text-xs">
  💰 Daily: Rs.{(() => {
    const amount = Number(loan.amount || 0);
    const months = Number(loan.loan_plan?.months || 0);
    const rate = Number(loan.loan_plan?.interest_percentage || 0);
    if (!amount || !months || !rate) return "0.00";
    const totalInterest = amount * (rate / 100) * months;
    const totalPayable = amount + totalInterest;
    const totalDays = months * 30;
    const dailyPayment = totalPayable / totalDays;
    return dailyPayment.toFixed(2);
  })()}
</span>

      </td>

      {/* 🔹 Amount */}
      <td className="p-3">Rs.{loan.amount}</td>

      {/* 🔹 Purpose */}
      <td className="p-3">{loan.purpose || "—"}</td>

     
{/* 🔹 Date Released */}
<td className="p-3 text-gray-300">
  {loan.status === 3
    ? formatDateSafe(loan.date_released)
    : "Not yet released"}
</td>

     

      {/* 🔹 Status */}
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

      {/* 🔹 Actions */}
      <td className="p-3 flex justify-center gap-2">
        {/* Status Selector */}
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

        {/* Edit Button */}
        <button
          onClick={() => handleEditLoan(loan)}
          className="bg-blue-500 px-3 py-1 rounded-md text-black font-semibold hover:bg-blue-600"
        >
          Edit
        </button>

        {/* Delete Button */}
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
