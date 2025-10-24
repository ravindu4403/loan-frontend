// src/lib/alert.js
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

export const Alert = MySwal.mixin({
  background: "#1e293b", // dark navy blue background
  color: "#f8fafc", // light text color
  confirmButtonColor: "#facc15", // yellow confirm button
  cancelButtonColor: "#ef4444", // red cancel button
  buttonsStyling: false,
  customClass: {
    popup: "rounded-2xl shadow-xl border border-gray-700",
    title: "text-xl font-semibold text-yellow-400",
    confirmButton:
      "bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-2 rounded-lg mx-2",
    cancelButton:
      "bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-2 rounded-lg mx-2",
    htmlContainer: "text-gray-200",
  },
});

export default Alert;
