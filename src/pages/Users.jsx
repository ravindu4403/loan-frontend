import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import DashboardLayout from "../layouts/DashboardLayout";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    username: "",
    password: "",
    type: 2,
  });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    const { data, error } = await supabase.from("users").select("*").order("id");
    if (!error) setUsers(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      name: formData.name,
      username: formData.username,
      password: formData.password,
      type: parseInt(formData.type),
    };

    try {
      if (editing) {
        const { error } = await supabase
          .from("users")
          .update(payload)
          .eq("id", formData.id);
        if (error) throw error;

        Swal.fire({
          icon: "success",
          title: "User Updated!",
          text: "User details successfully updated.",
          background: "#1e293b",
          color: "#f8fafc",
          confirmButtonColor: "#22c55e",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        const { error } = await supabase.from("users").insert([payload]);
        if (error) throw error;

        Swal.fire({
          icon: "success",
          title: "User Added!",
          text: "New user has been successfully added.",
          background: "#1e293b",
          color: "#f8fafc",
          confirmButtonColor: "#facc15",
          timer: 2000,
          showConfirmButton: false,
        });
      }

      setEditing(false);
      setFormData({ id: null, name: "", username: "", password: "", type: 2 });
      fetchUsers();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Something went wrong!",
        background: "#1e293b",
        color: "#f8fafc",
        confirmButtonColor: "#ef4444",
      });
    }
  }

  async function handleDelete(id) {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "This action will permanently delete the user.",
      icon: "warning",
      background: "#1e293b",
      color: "#f8fafc",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#3b82f6",
      confirmButtonText: "Yes, delete it!",
    });

    if (confirm.isConfirmed) {
      await supabase.from("users").delete().eq("id", id);
      fetchUsers();
      Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "User deleted successfully.",
        background: "#1e293b",
        color: "#f8fafc",
        timer: 2000,
        showConfirmButton: false,
      });
    }
  }

  async function handleEdit(user) {
    setEditing(true);
    setFormData({
      id: user.id,
      name: user.name,
      username: user.username,
      password: user.password,
      type: user.type,
    });
  }

  return (
    <DashboardLayout>
      <div className="p-6 text-white">
        <h2 className="text-2xl font-semibold mb-4">👥 User Role Management</h2>

        {/* 🧾 User Form - Horizontal Layout */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap md:flex-nowrap items-center gap-3 bg-[#1a2238]/80 backdrop-blur-sm p-5 rounded-lg mb-6 shadow-md"
        >
          <input
            type="text"
            placeholder="Full Name"
            className="flex-1 bg-[#202a40] text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Username"
            className="flex-1 bg-[#202a40] text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
            value={formData.username}
            onChange={(e) =>
              setFormData({ ...formData, username: e.target.value })
            }
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="flex-1 bg-[#202a40] text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
          />
          <select
            className="bg-[#202a40] text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          >
            <option value={1}>Admin</option>
            <option value={2}>Staff</option>
          </select>

          <button
            type="submit"
            className={`${
              editing
                ? "bg-green-500 hover:bg-green-600"
                : "bg-yellow-500 hover:bg-yellow-600"
            } text-black font-semibold px-8 py-3 rounded-md transition duration-300`}
          >
            {editing ? "Update" : "Add User"}
          </button>
        </form>

        {/* 📋 User Table */}
        <table className="w-full bg-[#1a2238] rounded-lg overflow-hidden text-white shadow-md">
          <thead className="bg-[#2b364f] text-yellow-400">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Username</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-gray-700 hover:bg-[#2a3552] transition"
              >
                <td className="p-3">{u.name}</td>
                <td className="p-3">{u.username}</td>
                <td className="p-3">
                  {u.type === 1 ? (
                    <span className="bg-green-700 text-white px-2 py-1 rounded-md text-xs">
                      Admin
                    </span>
                  ) : (
                    <span className="bg-blue-700 text-white px-2 py-1 rounded-md text-xs">
                      Staff
                    </span>
                  )}
                </td>
                <td className="p-3 text-center space-x-2">
                  <button
                    onClick={() => handleEdit(u)}
                    className="bg-blue-500 px-3 py-1 rounded-md hover:bg-blue-600 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="bg-red-500 px-3 py-1 rounded-md hover:bg-red-600 transition-all"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan="4"
                  className="text-center p-4 text-gray-400 italic"
                >
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
