import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "../assets/logo.png";
import { supabase } from "../lib/supabaseClient";
import "./Login.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [typingText, setTypingText] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const companyName = "VIDUNI INVESTMENT (P.V.T) LTD";

  // 🔹 Typewriter effect
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTypingText(companyName.slice(0, i));
      i++;
      if (i > companyName.length) clearInterval(interval);
    }, 70);
    return () => clearInterval(interval);
  }, []);

  // 🔹 Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(""); // clear old error

    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .single();

      if (error || !data) {
        setErrorMsg("Invalid username or password ❌");
        setPassword("");
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Login error:", err);
      setErrorMsg("Unexpected error. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="finance-login-root">
      <div className="finance-bg"></div>
      <div className="finance-overlay"></div>

      <motion.div
        className="finance-login-card"
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <div className="logo-section">
          <div className="logo-ring">
            <img src={logo} alt="logo" className="logo-img" />
          </div>
          <h2 className="company-name">{typingText}</h2>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Please wait..." : "Login"}
          </button>

          {/* 🔻 Inline invalid message */}
          <AnimatePresence>
            {errorMsg && (
              <motion.p
                className="error-msg"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.3 }}
              >
                {errorMsg}
              </motion.p>
            )}
          </AnimatePresence>
        </form>

        <p className="footer-text">© 2025 Viduni Investment (Pvt) Ltd</p>
      </motion.div>
    </div>
  );
}
