import DashboardLayout from "../layouts/DashboardLayout";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import Swal from "sweetalert2";
import Alert from "../lib/alert";

export default function Borrowers() {
  const [borrowers, setBorrowers] = useState([]);
  const [searchResult, setSearchResult] = useState(null);
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    contact_no: "",
    address: "",
    email: "",
    id_no: "",
    guarantor_name: "",
    guarantor_contact: "",
    guarantor_address: "",
    guarantor_id_no: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [searchId, setSearchId] = useState("");

  useEffect(() => {
    fetchBorrowers();
  }, []);

  async function fetchBorrowers() {
    const { data, error } = await supabase.from("borrowers").select("*");
    if (!error) setBorrowers(data);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (editingId) {
      await supabase.from("borrowers").update(formData).eq("id", editingId);
      Alert.fire("✅ Updated!", "Borrower details updated successfully.", "success");
    } else {
      await supabase.from("borrowers").insert([formData]);
      Alert.fire("🎉 Success!", "New borrower added successfully.", "success");
    }
    setEditingId(null);
    resetForm();
    fetchBorrowers();
  }

  function resetForm() {
    setFormData({
      firstname: "",
      lastname: "",
      contact_no: "",
      address: "",
      email: "",
      id_no: "",
      guarantor_name: "",
      guarantor_contact: "",
      guarantor_address: "",
      guarantor_id_no: "",
    });
  }

  function handleEdit(b) {
    setFormData(b);
    setEditingId(b.id);
  }

  async function handleDelete(id) {
    const confirm = await Alert.fire({
      title: "Delete Borrower?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });
    if (confirm.isConfirmed) {
      await supabase.from("borrowers").delete().eq("id", id);
      Alert.fire("🗑️ Deleted!", "Borrower removed successfully.", "success");
      fetchBorrowers();
    }
  }

  async function handleSearch() {
    if (!searchId.trim()) {
      setSearchResult(null);
      return;
    }

    const { data: borrowerData } = await supabase
      .from("borrowers")
      .select("*")
      .eq("id_no", searchId)
      .single();

    if (!borrowerData) {
      Alert.fire("❌ Not Found", "No borrower found with that ID number.", "error");
      setSearchResult(null);
      return;
    }

    const { data: loans } = await supabase
  .from("loan_list")
  .select("*, loan_plan(months, interest_percentage)")
  .eq("borrower_id", borrowerData.id)
  .in("status", [3, 4]); // ✅ Only Released or Closed loans


    let loanInfo = loans?.map((loan) => {
      const amount = parseFloat(loan.amount);
      const rate = parseFloat(loan.loan_plan?.interest_percentage);
      const months = parseInt(loan.loan_plan?.months);
      const totalPayable = amount + (amount * rate * months) / 100;
      const monthly = totalPayable / months;
      const releaseDate = loan.date_released
  ? new Date(loan.date_released).toLocaleDateString()
  : "Not Released";


      return {
        ref: loan.ref_no,
        amount,
        rate,
        months,
        totalPayable,
        monthly,
        releaseDate,
        status:
  loan.status === 4
    ? "✅ Completed"
    : loan.status === 3
    ? "🕓 Awaiting Payments"
    : "",

      };
    });

    setSearchResult({ borrowerData, loanInfo });
  }

  return (
    <DashboardLayout>
      <div className="text-white p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          👥 Borrowers Management
        </h2>

        {/* 🔍 Search Borrower */}
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="Enter Borrower ID..."
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="p-3 rounded bg-[#2a3355] text-white w-72"
          />
          <button
            onClick={handleSearch}
            className="bg-green-500 hover:bg-green-600 text-black font-semibold px-6 py-2 rounded-lg"
          >
            Search
          </button>
        </div>

        {/* 🧾 Search Result Section */}
        {searchResult && (
          <div className="bg-[#1a2238] p-6 mb-8 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-2 text-yellow-400">
              🔎 Borrower Information
            </h3>
            <div className="mb-3">
              <p>
                <strong>Name:</strong> {searchResult.borrowerData.firstname}{" "}
                {searchResult.borrowerData.lastname}
              </p>
              <p>
                <strong>ID No:</strong> {searchResult.borrowerData.id_no}
              </p>
              <p>
                <strong>Contact:</strong> {searchResult.borrowerData.contact_no}
              </p>
              <p>
                <strong>Email:</strong> {searchResult.borrowerData.email}
              </p>
            </div>

            <h4 className="mt-4 font-semibold text-yellow-400">💰 Loan Summary:</h4>
            {searchResult.loanInfo && searchResult.loanInfo.length > 0 ? (
              <table className="w-full mt-4 bg-[#2a3355] rounded-lg overflow-hidden text-sm">
                <thead className="bg-[#353f66] text-yellow-400 text-left">
                  <tr>
                    <th className="p-3">Ref No</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Interest %</th>
                    <th className="p-3">Months</th>
                    <th className="p-3">Total Payable</th>
                    <th className="p-3">Monthly</th>
                    <th className="p-3">Released Date</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResult.loanInfo.map((loan, i) => (
                    <tr
                      key={i}
                      className="border-t border-gray-700 hover:bg-[#2f3a5c]"
                    >
                      <td className="p-3">{loan.ref}</td>
                      <td className="p-3">Rs.{loan.amount.toLocaleString()}</td>
                      <td className="p-3">{loan.rate}%</td>
                      <td className="p-3">{loan.months}</td>
                      <td className="p-3">Rs.{loan.totalPayable.toLocaleString()}</td>
                      <td className="p-3">Rs.{loan.monthly.toLocaleString()}</td>
                      <td className="p-3">{loan.releaseDate}</td>
                      <td className="p-3">{loan.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-400 mt-2">
                No active or completed loans found.
              </p>
            )}
          </div>
        )}

        {/* 📋 Borrower Form */}
        <form onSubmit={handleSubmit} className="bg-[#1a2238] p-6 rounded-lg mb-10">
          <h3 className="text-lg font-semibold mb-4 text-yellow-400">
            {editingId ? "✏️ Edit Borrower" : "➕ Add New Borrower"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="First Name"
              value={formData.firstname}
              onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
              className="p-3 rounded bg-[#2a3355] text-white"
              required
            />
            <input
              type="text"
              placeholder="Last Name"
              value={formData.lastname}
              onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
              className="p-3 rounded bg-[#2a3355] text-white"
              required
            />
            <input
              type="text"
              placeholder="Contact Number"
              value={formData.contact_no}
              onChange={(e) => setFormData({ ...formData, contact_no: e.target.value })}
              className="p-3 rounded bg-[#2a3355] text-white"
            />
            <input
              type="text"
              placeholder="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="p-3 rounded bg-[#2a3355] text-white"
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="p-3 rounded bg-[#2a3355] text-white"
            />
            <input
              type="text"
              placeholder="NIC / ID Number"
              value={formData.id_no}
              onChange={(e) => setFormData({ ...formData, id_no: e.target.value })}
              className="p-3 rounded bg-[#2a3355] text-white"
              required
            />
          </div>

          <h4 className="text-yellow-400 mt-6 mb-2 font-semibold">🧾 Guarantor Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Guarantor Name"
              value={formData.guarantor_name}
              onChange={(e) => setFormData({ ...formData, guarantor_name: e.target.value })}
              className="p-3 rounded bg-[#2a3355] text-white"
            />
            <input
              type="text"
              placeholder="Guarantor Contact"
              value={formData.guarantor_contact}
              onChange={(e) => setFormData({ ...formData, guarantor_contact: e.target.value })}
              className="p-3 rounded bg-[#2a3355] text-white"
            />
            <input
              type="text"
              placeholder="Guarantor Address"
              value={formData.guarantor_address}
              onChange={(e) => setFormData({ ...formData, guarantor_address: e.target.value })}
              className="p-3 rounded bg-[#2a3355] text-white"
            />
            <input
              type="text"
              placeholder="Guarantor ID No"
              value={formData.guarantor_id_no}
              onChange={(e) => setFormData({ ...formData, guarantor_id_no: e.target.value })}
              className="p-3 rounded bg-[#2a3355] text-white"
            />
          </div>

          <div className="mt-6 flex gap-4">
            <button
              type="submit"
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-2 rounded-lg"
            >
              {editingId ? "Update Borrower" : "Add Borrower"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* 📊 Borrowers Table */}
        <div className="bg-[#1a2238] p-6 rounded-lg shadow-lg mt-10">
          <h3 className="text-yellow-400 font-semibold mb-3">📋 All Borrowers</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-[#353f66] text-yellow-400">
                <tr>
                  <th className="p-3 text-left">First Name</th>
                  <th className="p-3 text-left">Last Name</th>
                  <th className="p-3 text-left">ID No</th>
                  <th className="p-3 text-left">Contact</th>
                  <th className="p-3 text-left">Address</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Guarantor Name</th>
                  <th className="p-3 text-left">Guarantor Contact</th>
                  <th className="p-3 text-left">Guarantor Address</th>
                  <th className="p-3 text-left">Guarantor ID</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {borrowers.length > 0 ? (
                  borrowers.map((b, i) => (
                    <tr
                      key={i}
                      className="border-t border-gray-700 hover:bg-[#2f3a5c] transition-colors"
                    >
                      <td className="p-3">{b.firstname}</td>
                      <td className="p-3">{b.lastname}</td>
                      <td className="p-3">{b.id_no}</td>
                      <td className="p-3">{b.contact_no}</td>
                      <td className="p-3">{b.address}</td>
                      <td className="p-3">{b.email}</td>
                      <td className="p-3">{b.guarantor_name}</td>
                      <td className="p-3">{b.guarantor_contact}</td>
                      <td className="p-3">{b.guarantor_address}</td>
                      <td className="p-3">{b.guarantor_id_no}</td>
                      <td className="p-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => handleEdit(b)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-4 text-center text-gray-400" colSpan="11">
                      No borrowers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
