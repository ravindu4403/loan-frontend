import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  Clock,
  CalendarDays,
  AlertTriangle,
  Search,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";

export default function UpcomingPayments() {
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchUpcomingPayments();
  }, []);

  async function fetchUpcomingPayments() {
    const { data, error } = await supabase
      .from("loan_list")
      .select(
        `id, ref_no, amount, date_released, date_created, borrower_id, 
        borrowers(firstname, lastname, id_no), loan_plan(months)`
      )
      .eq("status", 3); // Released loans only

    if (error) return console.error(error);

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const formatted = data.map((loan) => {
      const releaseDate = new Date(loan.date_released);
      // ✅ Next Payment Date = Release date + 1 day (considered tomorrow), then +1 month
      const nextPayment = new Date(releaseDate);
      nextPayment.setDate(nextPayment.getDate() + 1);
      nextPayment.setMonth(nextPayment.getMonth() + 1);

      const dueDate = new Date(releaseDate);
      dueDate.setMonth(releaseDate.getMonth() + loan.loan_plan?.months);

      let label = "Upcoming";
      let color = "bg-blue-500";
      let icon = <ChevronRight size={16} />;

      const todayStr = today.toISOString().split("T")[0];
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      const nextPaymentStr = nextPayment.toISOString().split("T")[0];

      if (nextPaymentStr === todayStr) {
        label = "Due Today";
        color = "bg-yellow-500 text-black";
        icon = <Clock size={16} />;
      } else if (nextPaymentStr === tomorrowStr) {
        label = "Due Tomorrow";
        color = "bg-green-500 text-black";
        icon = <CalendarDays size={16} />;
      } else if (nextPayment < today) {
        label = "Overdue";
        color = "bg-red-600 text-white animate-pulse";
        icon = <AlertTriangle size={16} />;
      }

      return {
        borrowerName: `${loan.borrowers?.firstname || ""} ${
          loan.borrowers?.lastname || ""
        }`,
        idCard: loan.borrowers?.id_no || "N/A",
        refNo: loan.ref_no,
        releaseDate: releaseDate.toISOString().split("T")[0],
        nextPayment: nextPaymentStr,
        dueDate: dueDate.toISOString().split("T")[0],
        label,
        color,
        icon,
      };
    });

    // Sorting order: Today → Tomorrow → Overdue → Others
    const sorted = formatted.sort((a, b) => {
      const priority = (p) => {
        if (p.label === "Due Today") return 1;
        if (p.label === "Due Tomorrow") return 2;
        if (p.label === "Overdue") return 3;
        return 4;
      };
      return priority(a) - priority(b);
    });

    setPayments(sorted);
  }

  const filtered = payments.filter(
    (p) =>
      p.borrowerName.toLowerCase().includes(search.toLowerCase()) ||
      p.idCard.includes(search) ||
      p.refNo.includes(search)
  );

  const count = {
    today: payments.filter((p) => p.label === "Due Today").length,
    tomorrow: payments.filter((p) => p.label === "Due Tomorrow").length,
    overdue: payments.filter((p) => p.label === "Overdue").length,
  };

  return (
    <DashboardLayout>
      <div className="p-6 text-white">
        <motion.h2
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="text-3xl font-bold mb-6 flex items-center gap-2 text-yellow-400"
        >
          <CalendarDays size={28} />
          Upcoming Payments
        </motion.h2>

        {/* Stat Cards */}
        <div className="grid md:grid-cols-3 sm:grid-cols-2 gap-6 mb-8">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-[#2a2e40] p-6 rounded-xl flex flex-col items-center border-l-4 border-yellow-400"
          >
            <Clock className="text-yellow-400 mb-2" size={30} />
            <p className="text-yellow-400 font-semibold">Due Today</p>
            <h3 className="text-4xl font-bold">{count.today}</h3>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-[#1f3c2f] p-6 rounded-xl flex flex-col items-center border-l-4 border-green-500"
          >
            <CalendarDays className="text-green-400 mb-2" size={30} />
            <p className="text-green-400 font-semibold">Due Tomorrow</p>
            <h3 className="text-4xl font-bold">{count.tomorrow}</h3>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-[#3a1f1f] p-6 rounded-xl flex flex-col items-center border-l-4 border-red-500"
          >
            <AlertTriangle className="text-red-500 mb-2 animate-pulse" size={30} />
            <p className="text-red-500 font-semibold">Overdue</p>
            <h3 className="text-4xl font-bold">{count.overdue}</h3>
          </motion.div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search
            size={18}
            className="absolute left-3 top-3 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search borrower, ID, or loan ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#2a3355] text-white pl-10 pr-4 py-2 rounded-md w-full outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>

        {/* Payments Table */}
        <div className="bg-[#1a2238] p-6 rounded-xl shadow-lg overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-[#2f3a5c] text-yellow-400">
              <tr>
                <th className="p-3 text-left">Borrower</th>
                <th className="p-3 text-left">ID Card</th>
                <th className="p-3 text-left">Loan Ref</th>
                <th className="p-3 text-left">Release Date</th>
                <th className="p-3 text-left">Next Payment Date</th>
                <th className="p-3 text-left">Loan Due Date</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((p, i) => (
                  <motion.tr
                    key={i}
                    whileHover={{ scale: 1.01 }}
                    className={`border-b border-gray-700 hover:bg-[#2f3a5c] transition-all ${
                      p.label === "Overdue" ? "bg-red-900/20 animate-pulse" : ""
                    }`}
                  >
                    <td className="p-3">{p.borrowerName}</td>
                    <td className="p-3">{p.idCard}</td>
                    <td className="p-3 text-yellow-300 font-semibold">{p.refNo}</td>
                    <td className="p-3">{p.releaseDate}</td>
                    <td className="p-3">{p.nextPayment}</td>
                    <td className="p-3">{p.dueDate}</td>
                    <td className="p-3">
                      <span
                        className={`px-3 py-1 rounded-full flex items-center gap-2 justify-center w-fit ${p.color}`}
                      >
                        {p.icon}
                        {p.label}
                      </span>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="p-4 text-center text-gray-400 italic"
                  >
                    No upcoming payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
