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
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// 🧮 Utility: Format Date to Local Timezone
const formatDate = (dateString) => {
  if (!dateString) return "N/A";

  // ✅ If it's already a Date object, convert to ISO string
  if (dateString instanceof Date) {
    return dateString.toISOString().split("T")[0];
  }

  // ✅ If it's a string, handle safely
  if (typeof dateString === "string") {
    return dateString.split("T")[0];
  }

  // fallback
  try {
    return new Date(dateString).toISOString().split("T")[0];
  } catch {
    return "N/A";
  }
};


export default function UpcomingPayments() {
  const [loans, setLoans] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
  fetchLoans();

  // 🕒 Auto refresh every 60s
  const interval = setInterval(fetchLoans, 60000);

  // 🧩 Real-time listener for payments table
  const channel = supabase
    .channel("realtime-payments")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "payments",
      },
      () => {
        console.log("🔄 Payment table changed → refreshing upcoming payments...");
        fetchLoans();
      }
    )
    .subscribe();

  // 🧹 Cleanup
  return () => {
    clearInterval(interval);
    supabase.removeChannel(channel);
  };
}, []);


  // 🧩 Fetch Released Loans
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
        paid_days,
        daily_payment,
        borrowers(firstname, lastname, id_no)
      `)
      .eq("status", 3); // 3 = Released

    if (error) {
      console.error("Error fetching loans:", error);
      setLoading(false);
      return;
    }

    const today = new Date();

    const formatted = data.map((loan) => {
      const release = loan.date_released ? new Date(loan.date_released) : null;
      const nextPay = loan.next_payment_date
        ? new Date(loan.next_payment_date)
        : null;

      // 🔹 Calculate due date
      const dueDate = release
        ? new Date(
            release.getTime() + (loan.term || 0) * 30 * 24 * 60 * 60 * 1000
          )
        : null;

      // 🔹 Calculate Days Left
      let label = "Upcoming";
      let color = "bg-blue-500 text-white";
      let icon = <ChevronRight size={15} />;
      let daysLeft = "N/A";

      if (nextPay) {
        const diffDays = Math.ceil(
          (nextPay - today) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 0) {
          label = "Due Today";
          color = "bg-yellow-400 text-black";
          icon = <Clock size={15} />;
        } else if (diffDays === 1) {
          label = "Due Tomorrow";
          color = "bg-green-400 text-black";
          icon = <CalendarDays size={15} />;
        } else if (diffDays < 0) {
          label = "Overdue";
          color = "bg-red-600 text-white animate-pulse";
          icon = <AlertTriangle size={15} />;
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

      const totalDays = (loan.term || 0) * 30;
      const remainingDays = Math.max(totalDays - (loan.paid_days || 0), 0);

      return {
        id: loan.id,
        refNo: loan.ref_no,
        borrowerName: `${loan.borrowers?.firstname || ""} ${
          loan.borrowers?.lastname || ""
        }`,
        idCard: loan.borrowers?.id_no || "N/A",
        releaseDate: formatDate(loan.date_released),
        nextPayment: formatDate(loan.next_payment_date),
        dueDate: formatDate(dueDate),
        daysLeft,
        remainingDays,
        dailyPayment: loan.daily_payment,
        label,
        color,
        icon,
      };
    });

    setLoans(formatted);
    setLoading(false);
  }

  // 🧮 Filter + Search
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

  // 📊 Counts for stat cards
  const count = {
    today: loans.filter((l) => l.label === "Due Today").length,
    tomorrow: loans.filter((l) => l.label === "Due Tomorrow").length,
    overdue: loans.filter((l) => l.label === "Overdue").length,
  };

  // 🔄 Manual refresh button
  const handleRefresh = async () => {
  setRefreshing(true);
  await fetchLoans();
  Swal.fire({
    title: "✅ Updated!",
    text: "Upcoming payments refreshed successfully.",
    icon: "success",
    timer: 1000,
    showConfirmButton: false,
    background: "#1a2238",
    color: "#fff",
  });
  setTimeout(() => setRefreshing(false), 800);
};

  return (
    <DashboardLayout>
      <div className="p-6 text-white space-y-6">
        {/* 🏷️ Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <motion.h2
            initial={{ x: -15, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="text-3xl font-bold flex items-center gap-2 text-yellow-400"
          >
            <CalendarDays size={26} /> Upcoming Payments
          </motion.h2>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 bg-[#2a3355] px-5 py-2 rounded-lg hover:bg-[#3b466f] transition-all text-sm font-medium"
          >
            {refreshing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCcw size={16} />
            )}
            Refresh
          </button>
        </div>

        {/* 📊 Summary Stat Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <StatCard
            icon={<Clock size={26} />}
            color="text-yellow-400"
            label="Due Today"
            value={count.today}
            border="border-yellow-400"
          />
          <StatCard
            icon={<CalendarDays size={26} />}
            color="text-green-400"
            label="Due Tomorrow"
            value={count.tomorrow}
            border="border-green-500"
          />
          <StatCard
            icon={<AlertTriangle size={26} />}
            color="text-red-500"
            label="Overdue"
            value={count.overdue}
            border="border-red-500"
            pulse
          />
        </div>

        {/* 🧭 Filter Controls */}
        <div className="flex flex-wrap gap-3 mb-4">
          {["All", "Today", "Tomorrow", "Overdue"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-md font-medium transition-all ${
                filter === f
                  ? "bg-yellow-400 text-black shadow-lg"
                  : "bg-[#2a3355] hover:bg-[#3b456b]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* 🔍 Search */}
        <div className="relative mb-5">
          <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search borrower, NIC, or loan ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#2a3355] text-white pl-10 pr-4 py-2 rounded-md w-full outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>

       {/* 📋 Table (Responsive for Mobile) */}
<div className="bg-[#1a2238] rounded-xl shadow-lg overflow-x-auto max-w-full">
  {loading ? (
    <div className="py-16 text-center text-gray-400 text-sm md:text-base">
      Loading upcoming payments...
    </div>
  ) : (
    <table className="w-full text-xs sm:text-sm border-collapse min-w-[600px]">
      <thead className="bg-[#2f3a5c] text-yellow-400 uppercase sticky top-0 z-10 shadow-md text-[11px] sm:text-xs">
        <tr>
          <th className="p-2 sm:p-3 text-left">Borrower</th>
          <th className="p-2 sm:p-3 text-left">NIC</th>
          <th className="p-2 sm:p-3 text-left">Loan Ref</th>
          <th className="p-2 sm:p-3 text-left">Release Date</th>
          <th className="p-2 sm:p-3 text-left">Next Payment</th>
          <th className="p-2 sm:p-3 text-left">Due Date</th>
          <th className="p-2 sm:p-3 text-left">Days Left</th>
          <th className="p-2 sm:p-3 text-left">Status</th>
          <th className="p-2 sm:p-3 text-center">Action</th>
        </tr>
      </thead>
      <AnimatePresence>
        <tbody>
          {filtered.length > 0 ? (
            filtered.map((l, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={`border-b border-gray-700 hover:bg-[#2f3a5c] transition-all ${
                  l.label === "Overdue" ? "bg-red-900/20" : ""
                }`}
              >
                <td className="p-2 sm:p-3 whitespace-nowrap">{l.borrowerName}</td>
                <td className="p-2 sm:p-3 whitespace-nowrap">{l.idCard}</td>
                <td className="p-2 sm:p-3 text-yellow-300 font-semibold">{l.refNo}</td>
                <td className="p-2 sm:p-3">{l.releaseDate}</td>
                <td className="p-2 sm:p-3">{l.nextPayment}</td>
                <td className="p-2 sm:p-3">{l.dueDate}</td>
                <td className="p-2 sm:p-3">{l.daysLeft}</td>
                <td className="p-2 sm:p-3">
                  <span
                    className={`px-2 sm:px-3 py-1 rounded-full flex items-center gap-1 justify-center w-fit text-[10px] sm:text-xs ${l.color}`}
                  >
                    {l.icon}
                    {l.label}
                  </span>
                </td>
                <td className="p-2 sm:p-3 text-center">
                  {l.label === "Overdue" && (
                    <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-2 sm:px-3 py-1 rounded-md flex items-center gap-1 mx-auto text-[10px] sm:text-xs font-medium">
                      <Bell size={12} /> Remind
                    </button>
                  )}
                </td>
              </motion.tr>
            ))
          ) : (
            <tr>
              <td
                colSpan="10"
                className="p-5 text-center text-gray-400 italic"
              >
                No upcoming payments found.
              </td>
            </tr>
          )}
        </tbody>
      </AnimatePresence>
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
