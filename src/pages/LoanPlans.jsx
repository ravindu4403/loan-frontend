import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import DashboardLayout from "../layouts/DashboardLayout";
import Swal from "sweetalert2"; // ✅ Added this import
import "sweetalert2/dist/sweetalert2.min.css";

export default function LoanPlans() {
  const [plans, setPlans] = useState([]);
  const [formData, setFormData] = useState({ id: null, months: "", interest_percentage: "", penalty_rate: "" });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    const { data, error } = await supabase.from("loan_plan").select("*").order("id");
    if (!error) setPlans(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      months: parseInt(formData.months),
      interest_percentage: parseFloat(formData.interest_percentage),
      penalty_rate: parseFloat(formData.penalty_rate),
    };

    if (editing) {
      await supabase.from("loan_plan").update(payload).eq("id", formData.id);
      Swal.fire({
        icon: "success",
        title: "Updated!",
        text: "Loan plan updated successfully.",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#3085d6",
        timer: 2000,
        showConfirmButton: false,
      });
    } else {
      await supabase.from("loan_plan").insert([payload]);
      Swal.fire({
        icon: "success",
        title: "Added!",
        text: "Loan plan added successfully.",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#3085d6",
        timer: 2000,
        showConfirmButton: false,
      });
    }

    setEditing(false);
    setFormData({ id: null, months: "", interest_percentage: "", penalty_rate: "" });
    fetchPlans();
  }

  async function handleEdit(plan) {
    setEditing(true);
    setFormData({
      id: plan.id,
      months: plan.months,
      interest_percentage: plan.interest_percentage,
      penalty_rate: plan.penalty_rate,
    });
  }

  async function handleDelete(id) {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This plan will be permanently deleted!",
      icon: "warning",
      background: "#1e293b",
      color: "#fff",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      await supabase.from("loan_plan").delete().eq("id", id);
      Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Loan plan deleted successfully.",
        background: "#1e293b",
        color: "#fff",
        timer: 2000,
        showConfirmButton: false,
      });
      fetchPlans();
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 text-white">
        <h2 className="text-2xl font-semibold mb-4">🏦 Loan Plans Management</h2>

        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 mb-6">
          <input
            type="number"
            placeholder="Months"
            className="bg-[#202a40] text-white px-4 py-2 rounded-md"
            value={formData.months}
            onChange={(e) => setFormData({ ...formData, months: e.target.value })}
          />
          <input
            type="number"
            placeholder="Interest %"
            className="bg-[#202a40] text-white px-4 py-2 rounded-md"
            value={formData.interest_percentage}
            onChange={(e) => setFormData({ ...formData, interest_percentage: e.target.value })}
          />
          <input
            type="number"
            placeholder="Penalty %"
            className="bg-[#202a40] text-white px-4 py-2 rounded-md"
            value={formData.penalty_rate}
            onChange={(e) => setFormData({ ...formData, penalty_rate: e.target.value })}
          />
          <button
            type="submit"
            className={`${editing ? "bg-green-500" : "bg-yellow-500"} text-black font-semibold px-6 py-2 rounded-md`}
          >
            {editing ? "Update Plan" : "Add Plan"}
          </button>
        </form>

        <table className="w-full bg-[#1a2238] rounded-lg overflow-hidden text-white">
          <thead className="bg-[#2b364f] text-yellow-400">
            <tr>
              <th className="p-3 text-left">Months</th>
              <th className="p-3 text-left">Interest %</th>
              <th className="p-3 text-left">Penalty %</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-gray-700 hover:bg-[#2a3552] transition-colors duration-200">
                <td className="p-3">{p.months}</td>
                <td className="p-3">{p.interest_percentage}%</td>
                <td className="p-3">{p.penalty_rate}%</td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => handleEdit(p)}
                    className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded-md mr-2 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded-md transition-all"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center p-4 text-gray-400">
                  No loan plans found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
