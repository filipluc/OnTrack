import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import Agenda from "./pages/Agenda";
import More from "./pages/More";
import EliteU13Schedule from "./pages/EliteU13Schedule";
import CupaSteleleViitorului from "./pages/CupaSteleleViitorului";
import CupaYearSchedule from "./pages/CupaYearSchedule";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth>
            <Reports />
          </RequireAuth>
        }
      />
      <Route
        path="/agenda"
        element={
          <RequireAuth>
            <Agenda />
          </RequireAuth>
        }
      />
      <Route
        path="/more"
        element={
          <RequireAuth>
            <More />
          </RequireAuth>
        }
      />
      <Route
        path="/more/elite-u13"
        element={
          <RequireAuth>
            <EliteU13Schedule />
          </RequireAuth>
        }
      />
      <Route
        path="/more/cupa-stelele-viitorului"
        element={
          <RequireAuth>
            <CupaSteleleViitorului />
          </RequireAuth>
        }
      />
      <Route
        path="/more/cupa-stelele-viitorului/:year"
        element={
          <RequireAuth>
            <CupaYearSchedule />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
