"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Database, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AuthPageProps {
  onBack: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignUp: (name: string, email: string, password: string) => Promise<void>;
}

export function AuthPage({ onBack, onLogin, onSignUp }: AuthPageProps) {
  const [isSignUp, setIsSignUp] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Sign up form state
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractErrorMessage = (err: unknown, fallback = "Network error") => {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === "string" && err) return err;
    try {
      return JSON.stringify(err) || fallback;
    } catch {
      return fallback;
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // call the handler provided by parent (Home)
      await onLogin(loginEmail, loginPassword);
      // parent is responsible for navigation/toasts/persistence
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // call the handler provided by parent (Home)
      await onSignUp(signUpName, signUpEmail, signUpPassword);
      // parent is responsible for navigation/toasts/persistence
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Signup failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="w-full px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-card/80 border-b border-border">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            disabled={loading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="w-8 h-8 bg-gradient-to-r from-sky-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">
            QueryCraft
          </span>
        </div>
      </nav>
      {/*main content*/}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-5xl h-[600px] md:h-[600px] bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden">
          {/* === START: REPLACED PANEL FROM CODE 2 === */}

          {/* Panel 1 - Purple Gradient */}
          <motion.div
            className="absolute inset-y-0 w-1/2 z-10 hidden md:block"
            initial={{ x: "100%" }}
            animate={{ x: isSignUp ? "0%" : "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
              background:
                "linear-gradient(135deg, #512DA8 0%, #673AB7 50%, #7E57C2 100%)",
              clipPath: isSignUp
                ? "polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%)"
                : "polygon(0% 0%, 75% 0%, 100% 100%, 0% 100%)",
            }}
          />

          {/* Panel 2 - Blue/Cyan Gradient */}
          <motion.div
            className="absolute inset-y-0 w-1/2 z-8 hidden md:block"
            initial={{ x: "100%" }}
            animate={{ x: isSignUp ? "0%" : "100%" }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              delay: 0.1,
            }}
            style={{
              background:
                "linear-gradient(135deg, #0891B2 0%, #0284C7 50%, #0EA5E9 100%)",
              clipPath: isSignUp
                ? "polygon(30% 0%, 100% 0%, 100% 100%, 5% 100%)"
                : "polygon(5% 0%, 70% 0%, 95% 100%, 0% 100%)",
            }}
          />

          {/* Panel 3 - Green/Teal Gradient */}
          <motion.div
            className="absolute inset-y-0 w-1/2 z-6 hidden md:block"
            initial={{ x: "100%" }}
            animate={{ x: isSignUp ? "0%" : "100%" }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              delay: 0.2,
            }}
            style={{
              background:
                "linear-gradient(135deg, #059669 0%, #0D9488 50%, #10B981 100%)",
              clipPath: isSignUp
                ? "polygon(35% 0%, 100% 0%, 100% 100%, 10% 100%)"
                : "polygon(10% 0%, 65% 0%, 90% 100%, 0% 100%)",
            }}
          />

          {/* Panel 4 - Orange/Red Gradient */}
          <motion.div
            className="absolute inset-y-0 w-1/2 z-4 hidden md:block"
            initial={{ x: "100%" }}
            animate={{ x: isSignUp ? "0%" : "100%" }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              delay: 0.3,
            }}
            style={{
              background:
                "linear-gradient(135deg, #DC2626 0%, #EA580C 50%, #F59E0B 100%)",
              clipPath: isSignUp
                ? "polygon(40% 0%, 100% 0%, 100% 100%, 15% 100%)"
                : "polygon(15% 0%, 60% 0%, 85% 100%, 0% 100%)",
            }}
          />

          {/* Text Content Layer - Above all colored panels (Wrapper from Code 2) */}
          <div className="absolute inset-y-0 w-1/2 z-20 hidden md:block pointer-events-none">
            <motion.div
              className="h-full flex flex-col items-center justify-center p-12 text-primary-foreground text-center pointer-events-auto" // Using text-primary-foreground from Code 1
              initial={{ x: "100%" }}
              animate={{ x: isSignUp ? "0%" : "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* === Content from Code 1 (with AnimatePresence) === */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={isSignUp ? "signin" : "signup"}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <h2 className="text-4xl font-bold mb-6">
                    {isSignUp ? "Welcome Back!" : "Hello, Friend!"}
                  </h2>
                  <p className="text-xl mb-10 opacity-90 leading-relaxed max-w-md">
                    {isSignUp
                      ? "To keep connected with us please login with your personal info"
                      : "Enter your personal details and start your journey with us"}
                  </p>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="bg-transparent border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary rounded-full px-10"
                    disabled={loading} // <-- Preserves loading state logic from Code 1
                  >
                    {isSignUp ? "Sign In" : "Sign Up"}
                  </Button>
                </motion.div>
              </AnimatePresence>
              {/* === End Content from Code 1 === */}
            </motion.div>
          </div>
          {/* === END: REPLACED PANEL === */}

          {/* Sign In (Unchanged from Code 1) */}
          <div
            className={`absolute inset-y-0 left-0 w-full md:w-1/2 flex flex-col justify-center p-6 md:p-12 transition-opacity duration-500 ${
              isSignUp ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: isSignUp ? 0 : 1, x: isSignUp ? -50 : 0 }}
              transition={{ delay: isSignUp ? 0.2 : 0.3 }}
            >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-200 mb-6 md:mb-10 font-mono">
              Sign In
            </h2>
            {error && (
              <div className="mb-4 px-4 py-2 bg-red-600/10 border border-red-600 text-red-700 rounded">
                {error}
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 hover:border-purple-300"
                required
              />
              <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 hover:border-purple-300"
                required
              />
              </div>
               <div className="text-center">
                  <a href="#" className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 text-sm font-medium">
                    Forgot Your Password?
                  </a>
                </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-4 rounded-full font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                disabled={loading}
              >
                {loading ? "Signing in..." : "SIGN IN"}
              </Button>
            </form>
            </motion.div>
          </div>

          {/* Sign Up (Unchanged from Code 1) */}
          <div
            className={`absolute inset-y-0 right-0 w-full md:w-1/2 flex flex-col justify-center p-6 md:p-12 transition-opacity duration-500 ${
              !isSignUp ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: isSignUp ? 1 : 0, x: isSignUp ? 0 : 50 }}
              transition={{ delay: isSignUp ? 0.3 : 0 }}
            >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-200 mb-6 md:mb-10 font-mono">
              Create Account
            </h2>
            {error && (
              <div className="mb-4 px-4 py-2 bg-red-600/10 border border-red-600 text-red-700 rounded">
                {error}
              </div>
            )}
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Name"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 hover:border-purple-300"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 hover:border-purple-300"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 hover:border-purple-300"
                    required
                  />
                </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-4 rounded-full font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                disabled={loading}
              >
                {loading ? "Creating account..." : "SIGN UP"}
              </Button>
            </form>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}