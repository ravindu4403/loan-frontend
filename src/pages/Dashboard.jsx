import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import DashboardLayout from "../layouts/DashboardLayout";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { FaUsers, FaMoneyBill, FaFileInvoiceDollar, FaChartLine } from "react-icons/fa";

export default function Dashboard() {
  const [stats, setStats] = useState({
    paymentsToday: 0,
    totalBorrowers: 0,
    activeLoans: 0,
    totalReceivable: 0,
  });

  const COLORS = ["#22c55e", "#3b82f6", "#facc15", "#ef4444"];

  const chartData = [
    { name: "Active Loans", value: stats.activeLoans },
    { name: "Borrowers", value: stats.totalBorrowers },
    { name: "Receivable", value: stats.totalReceivable },
    { name: "Payments", value: stats.paymentsToday },
  ];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    const { data, error } = await supabase.from("dashboard_summary").select("*").single();

    if (!error && data) {
      setStats({
        paymentsToday: Number(data.payments_today || 0),
        totalBorrowers: Number(data.total_borrowers || 0),
        activeLoans: Number(data.active_loans || 0),
        totalReceivable: Number(data.total_receivable || 0),
      });
    } else {
      console.error("❌ Error fetching dashboard data:", error);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 text-white">
        <h1 className="text-3xl font-bold mb-6 text-yellow-400">📊 Dashboard Overview</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <motion.div whileHover={{ scale: 1.05 }} className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <FaMoneyBill className="text-3xl" />
              <h3 className="text-xl font-semibold">Payments Today</h3>
            </div>
            <p className="text-2xl font-bold mt-2">Rs. {stats.paymentsToday.toFixed(2)}</p>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }} className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <FaUsers className="text-3xl" />
              <h3 className="text-xl font-semibold">Total Borrowers</h3>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.totalBorrowers}</p>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }} className="bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <FaFileInvoiceDollar className="text-3xl" />
              <h3 className="text-xl font-semibold">Active Loans</h3>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.activeLoans}</p>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }} className="bg-gradient-to-br from-red-500 to-red-700 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <FaChartLine className="text-3xl" />
              <h3 className="text-xl font-semibold">Total Receivable</h3>
            </div>
            <p className="text-2xl font-bold mt-2">Rs. {stats.totalReceivable.toFixed(2)}</p>
          </motion.div>
        </div>

        {/* Chart */}
        <div className="bg-[#1a2238] p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-yellow-300">📈 Summary Visualization</h2>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
                label
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </DashboardLayout>
  );
}
