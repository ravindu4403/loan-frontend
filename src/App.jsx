import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Borrowers from "./pages/Borrowers";
import Loans from "./pages/Loans";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import LoanPlans from "./pages/LoanPlans";
import Users from "./pages/Users";
import UpcomingPayments from "./pages/UpcomingPayments";
import "animate.css";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/borrowers" element={<Borrowers />} />
        <Route path="/loans" element={<Loans/>} />
        <Route path="/payments" element={<Payments/>} />
        <Route path="/upcomingpayments" element={<UpcomingPayments />} />
        <Route path="/reports" element={<Reports/>} />
        <Route path="/loanplans" element={<LoanPlans/>} />
        <Route path="/users" element={<Users/>} />
      </Routes>
    </BrowserRouter>
  );
}
