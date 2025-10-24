// src/layouts/DashboardLayout.jsx
import Sidebar from "../components/Sidebar";

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen bg-[#0a0f1f] text-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
