
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ThemeProvider from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Library from "./pages/Library";
import Explore from "./pages/Explore";
import NovelCreate from "./pages/NovelCreate";
import NovelOverview from "./pages/NovelOverview";
import Workbook from "./pages/Workbook";
import Reader from "./pages/Reader";

const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <p className="text-muted-foreground text-sm">Loading…</p>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ErrorBoundary fallback={
                <div className="min-h-screen bg-background flex items-center justify-center">
                  <p className="text-muted-foreground">Failed to load page</p>
                </div>
              }>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<Library />} />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/novels/new" element={<NovelCreate />} />
                    <Route path="/novels/:novelId" element={<NovelOverview />} />
                    <Route path="/novels/:novelId/workbook" element={<Workbook />} />
                    <Route path="/novels/:novelId/read" element={<Reader />} />
                    <Route path="/auth" element={<Auth />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
