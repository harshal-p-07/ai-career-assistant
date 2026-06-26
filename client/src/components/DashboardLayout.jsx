import Sidebar from "./Sidebar.jsx";

export default function DashboardLayout({ children }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen bg-background">{children}</main>
    </div>
  );
}
