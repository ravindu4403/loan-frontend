import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  Clock,
  CalendarDays,
  AlertTriangle,
  Search,
  ChevronRight,
  RefreshCcw,
  Bell,
} from "lucide-react";
import { motion } from "framer-motion";

// ✅ Helper: Convert UTC → Local (no timezone issues)
function toLocalDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localTime.toISOString().split("T")[0];
}

export default function UpcomingPayments() {
  const [loans, setLoans] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoans();
    const interval = setInterval(fetchLoans, 30000); // 🔄 auto refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // 🔹 Fetch Released Loans
   // 🔹 Fetch Released Loans
    // 🔹 Fetch Released Loans
  async function fetchLoans() {
    setLoading(true);
    const { data, error } = await supabase
      .from("loan_list")
      .select(`
        id,
        ref_no,
        amount,
        rate,
        term,
        status,
        next_payment_date,
        date_released,
        first_payment_date,
        paid_days,
        daily_payment,
        borrowers(firstname, lastname, id_no)
      `)
      .eq("status", 3); // Released loans only

    if (error) {
      console.error("Error fetching loans:", error);
      setLoading(false);
      return;
    }

    const today = new Date();

    const formatted = data.map((loan) => {
      const release = loan.date_released
        ? new Date(loan.date_released)
        : null;

      const releaseDateLocal = release
        ? release.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" })
        : "Not yet released";

      // ✅ next payment date එකට 1 day එකක් add කරනවා
      let nextPayment = null;
      if (loan.next_payment_date) {
        const temp = new Date(loan.next_payment_date);
        temp.setDate(temp.getDate() + 1);
        nextPayment = temp;
      }

      const nextPaymentLocal = nextPayment
        ? nextPayment.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" })
        : "N/A";

      // 🔹 Due date = release date + term * 30 days
      const dueDate = release
        ? new Date(release.getTime() + (loan.term || 0) * 30 * 24 * 60 * 60 * 1000)
        : null;

      const dueDateLocal = dueDate
        ? dueDate.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" })
        : "N/A";

      // 🔹 Remaining days
      const totalDays = (loan.term || 0) * 30;
      const remainingDays = Math.max(totalDays - (loan.paid_days || 0), 0);

      // 🔹 Determine payment status
      let label = "Upcoming";
      let color = "bg-blue-500 text-white";
      let icon = <ChevronRight size={16} />;
      let daysLeft = "N/A";

      if (nextPayment) {
        const diffDays = Math.ceil(
          (nextPayment - today) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 0) {
          label = "Due Today";
          color = "bg-yellow-400 text-black";
          icon = <Clock size={16} />;
        } else if (diffDays === 1) {
          label = "Due Tomorrow";
          color = "bg-green-400 text-black";
          icon = <CalendarDays size={16} />;
        } else if (diffDays < 0) {
          label = "Overdue";
          color = "bg-red-600 text-white animate-pulse";
          icon = <AlertTriangle size={16} />;
        }

        daysLeft =
          diffDays > 1
            ? `${diffDays} days`
            : diffDays === 1
            ? "Tomorrow"
            : diffDays === 0
            ? "Today"
            : `${Math.abs(diffDays)} days late`;
      }

      return {
        id: loan.id,
        refNo: loan.ref_no,
        borrowerName: `${loan.borrowers?.firstname || ""} ${
          loan.borrowers?.lastname || ""
        }`,
        idCard: loan.borrowers?.id_no || "N/A",
        releaseDate: releaseDateLocal,
        nextPayment: nextPaymentLocal, // ✅ now always +1 day
        dueDate: dueDateLocal,
        totalDays,
        remainingDays,
        dailyPayment: loan.daily_payment,
        daysLeft,
        label,
        color,
        icon,
      };
    });

    setLoans(formatted);
    setLoading(false);
  }



  // 🔹 Filter + Search
  const filtered = loans.filter((l) => {
    const matchesSearch =
      l.borrowerName.toLowerCase().includes(search.toLowerCase()) ||
      l.idCard.includes(search) ||
      l.refNo.includes(search);
    const matchesFilter =
      filter === "All" ||
      (filter === "Today" && l.label === "Due Today") ||
      (filter === "Tomorrow" && l.label === "Due Tomorrow") ||
      (filter === "Overdue" && l.label === "Overdue");
    return matchesSearch && matchesFilter;
  });

  const count = {
    today: loans.filter((l) => l.label === "Due Today").length,
    tomorrow: loans.filter((l) => l.label === "Due Tomorrow").length,
    overdue: loans.filter((l) => l.label === "Overdue").length,
  };

  return (
    <DashboardLayout>
      <div className="p-6 text-white">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <motion.h2
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="text-3xl font-bold flex items-center gap-2 text-yellow-400"
          >
            <CalendarDays size={28} /> Upcoming Payments
          </motion.h2>

          <button
            onClick={fetchLoans}
            className="flex items-center gap-2 bg-[#2a3355] px-4 py-2 rounded-lg hover:bg-[#374270] transition-all"
          >
            <RefreshCcw size={18} /> Refresh
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid md:grid-cols-3 sm:grid-cols-2 gap-6 mb-8">
          <StatCard
            icon={<Clock size={30} />}
            color="text-yellow-400"
            label="Due Today"
            value={count.today}
            border="border-yellow-400"
          />
          <StatCard
            icon={<CalendarDays size={30} />}
            color="text-green-400"
            label="Due Tomorrow"
            value={count.tomorrow}
            border="border-green-500"
          />
          <StatCard
            icon={<AlertTriangle size={30} />}
            color="text-red-500"
            label="Overdue"
            value={count.overdue}
            border="border-red-500"
            pulse
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-3 mb-4">
          {["All", "Today", "Tomorrow", "Overdue"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-md ${
                filter === f
                  ? "bg-yellow-400 text-black"
                  : "bg-[#2a3355] hover:bg-[#3b456b]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search borrower, ID, or loan ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#2a3355] text-white pl-10 pr-4 py-2 rounded-md w-full outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>

        {/* Table */}
        <div className="bg-[#1a2238] p-6 rounded-xl shadow-lg overflow-x-auto">
          {loading ? (
            <p className="text-center text-gray-400 py-10">
              Loading upcoming payments...
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="bg-[#2f3a5c] text-yellow-400">
                <tr>
                  <th className="p-3 text-left">Borrower</th>
                  <th className="p-3 text-left">NIC</th>
                  <th className="p-3 text-left">Loan Ref</th>
                  <th className="p-3 text-left">Release Date</th>
                  <th className="p-3 text-left">Next Payment</th>
                  <th className="p-3 text-left">Due Date</th>
                  <th className="p-3 text-left">Days Left</th>
                  <th className="p-3 text-left">Remaining Days</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((l, i) => (
                    <motion.tr
                      key={i}
                      whileHover={{ scale: 1.01 }}
                      className={`border-b border-gray-700 hover:bg-[#2f3a5c] transition-all ${
                        l.label === "Overdue"
                          ? "bg-red-900/20 animate-pulse"
                          : ""
                      }`}
                    >
                      <td className="p-3">{l.borrowerName}</td>
                      <td className="p-3">{l.idCard}</td>
                      <td className="p-3 text-yellow-300 font-semibold">
                        {l.refNo}
                      </td>
                      <td className="p-3">{l.releaseDate}</td>
                      <td className="p-3">{l.nextPayment}</td>
                      <td className="p-3">{l.dueDate}</td>
                      <td className="p-3">{l.daysLeft}</td>
                      <td className="p-3">{l.remainingDays}</td>
                      <td className="p-3">
                        <span
                          className={`px-3 py-1 rounded-full flex items-center gap-2 justify-center w-fit ${l.color}`}
                        >
                          {l.icon}
                          {l.label}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {l.label === "Overdue" && (
                          <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded-md flex items-center gap-1 mx-auto">
                            <Bell size={14} /> Remind
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="10"
                      className="p-4 text-center text-gray-400 italic"
                    >
                      No upcoming payments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// 💳 Stat Card Component
function StatCard({ icon, color, label, value, border, pulse }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`bg-[#2a2e40] p-6 rounded-xl flex flex-col items-center border-l-4 ${border}`}
    >
      <div className={`${color} mb-2 ${pulse ? "animate-pulse" : ""}`}>
        {icon}
      </div>
      <p className={`${color} font-semibold`}>{label}</p>
      <h3 className="text-4xl font-bold">{value}</h3>
    </motion.div>
  );
}
