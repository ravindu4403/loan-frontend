import { Home, Users, DollarSign, FileText, LogOut } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: <Home size={18} />, label: "Dashboard", path: "/dashboard" },
    { icon: <Users size={18} />, label: "Borrowers", path: "/borrowers" },
    { icon: <FileText size={18} />, label: "LoanPlans", path: "/loanplans" },
    { icon: <DollarSign size={18} />, label: "Loans", path: "/loans" },
    { icon: <FileText size={18} />, label: "Payments", path: "/payments" },
    { icon: <FileText size={18} />, label: "UpcomingPayments", path: "/upcomingpayments" },
    { icon: <FileText size={18} />, label: "Reports", path: "/reports" },
    { icon: <FileText size={18} />, label: "Users", path: "/users" },
  ];

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <aside className="bg-gray-900/90 text-white w-64 min-h-screen flex flex-col justify-between border-r border-gray-800 shadow-lg">
      <div>
        <h2 className="text-xl font-bold p-4 border-b border-gray-700">
          🏦 Viduni
        </h2>
        <nav className="mt-4">
          {menuItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={index}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 w-full px-5 py-3 rounded-md text-sm font-medium transition-all
                  ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-[1.03]"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 p-4 text-red-400 hover:text-red-300 hover:bg-gray-800 transition-all"
      >
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </aside>
  );
}
