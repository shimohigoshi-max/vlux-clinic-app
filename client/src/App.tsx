import { Switch, Route, useLocation } from "wouter";
import { useEffect, type ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { StaffProtected } from "@/components/StaffProtected";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ClinicApp from "@/pages/clinic";
import PatientApp from "@/pages/patient";
import LoginPatient from "@/pages/login-patient";
import LoginStaff from "@/pages/login-staff";

function PatientProtected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !session) {
      setLocation("/patient/login");
    }
  }, [loading, session, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!session) {
    return null;
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/clinic/login" component={LoginStaff} />
      <Route path="/clinic">
        <StaffProtected>
          <ClinicApp />
        </StaffProtected>
      </Route>
      <Route path="/patient/login" component={LoginPatient} />
      <Route path="/patient">
        <PatientProtected>
          <PatientApp />
        </PatientProtected>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
