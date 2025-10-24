import { useState } from "react";
import { supabase } from "../lib/supabaseClient.jsx";

export default function LoanCalculator() {
  const [input, setInput] = useState({
    principal: "",
    rate: "",
    months: "",
  });
  const [result, setResult] = useState(null);

  const handleChange = (e) =>
    setInput({ ...input, [e.target.name]: e.target.value });

  const calculateLoan = async () => {
    const { data, error } = await supabase.functions.invoke("calc-loan", {
      body: input,
    });
    if (error) {
      alert("Error calculating loan");
      console.error(error);
    } else {
      setResult(data);
    }
  };

  return (
    <div className="bg-gray-900 p-6 rounded-xl text-white w-full max-w-md mx-auto mt-12">
      <h2 className="text-xl mb-4 font-semibold text-center">
        💰 Loan Calculator
      </h2>

      <div className="flex flex-col gap-3">
        <input
          type="number"
          name="principal"
          value={input.principal}
          onChange={handleChange}
          placeholder="Principal (Rs.)"
          className="bg-gray-800 px-3 py-2 rounded-md"
        />
        <input
          type="number"
          name="rate"
          value={input.rate}
          onChange={handleChange}
          placeholder="Interest Rate (%)"
          className="bg-gray-800 px-3 py-2 rounded-md"
        />
        <input
          type="number"
          name="months"
          value={input.months}
          onChange={handleChange}
          placeholder="Months"
          className="bg-gray-800 px-3 py-2 rounded-md"
        />

        <button
          onClick={calculateLoan}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 rounded-md mt-2"
        >
          Calculate
        </button>
      </div>

      {result && (
        <div className="mt-6 text-center border-t border-gray-700 pt-4">
          <p>📆 Monthly Payment: <strong>Rs. {result.monthlyPayment}</strong></p>
          <p>💵 Total Interest: Rs. {result.totalInterest}</p>
          <p>🏦 Total Payment: Rs. {result.totalPayment}</p>
        </div>
      )}
    </div>
  );
}
