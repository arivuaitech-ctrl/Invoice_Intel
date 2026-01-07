import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, ShieldCheck, Zap, AlertCircle, Mail, ArrowRight, ChevronLeft, KeyRound, RefreshCw } from 'lucide-react';
import { userService } from '../services/userService';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loginMethod, setLoginMethod] = useState<'email' | 'google'>('email');
  const [resendTimer, setResendTimer] = useState(0);
  
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Check if URL contains error params from a failed redirect
    const params = new URLSearchParams(window.location.hash.substring(1));
    const errorMsg = params.get('error_description');
    if (errorMsg) {
      setError(decodeURIComponent(errorMsg.replace(/\+/g, ' ')));
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startResendTimer = () => {
    setResendTimer(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onLogin();
    } catch (err: any) {
      console.error("Google login failed:", err);
      setError(err.message || "Google authentication failed.");
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || resendTimer > 0) return;
    
    setIsLoading(true);
    setError(null);
    try {
      await userService.loginWithEmail(email);
      setStep('otp');
      startResendTimer();
    } catch (err: any) {
      console.error("OTP send failed:", err);
      if (err.message?.includes('rate limit')) {
        setError("Too many attempts. Please wait a minute before trying again.");
      } else {
        setError(err.message || "Failed to send code. Please check your email and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) return;

    setIsLoading(true);
    setError(null);
    try {
      await userService.verifyOtp(email, otp);
      // Auth state change in App.tsx will pick this up
    } catch (err: any) {
      console.error("OTP verification failed:", err);
      setError("The code you entered is incorrect or has expired.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl rotate-3">
            <span className="text-white font-bold text-2xl -rotate-3">II</span>
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          InvoiceIntel
        </h2>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Smart Expense Tracking for Professionals
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-slate-200/60 rounded-3xl sm:px-10 border border-slate-100 min-h-[460px] flex flex-col transition-all duration-300">
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                <p className="font-semibold">Oops!</p>
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col">
            {step === 'email' ? (
              <div className="space-y-6">
                {/* Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200/50">
                  <button 
                    onClick={() => setLoginMethod('email')}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${loginMethod === 'email' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/30' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Email Code
                  </button>
                  <button 
                    onClick={() => setLoginMethod('google')}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${loginMethod === 'google' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/30' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Google
                  </button>
                </div>

                {loginMethod === 'email' ? (
                  <form onSubmit={handleSendOtp} className="space-y-5 animate-fadeIn">
                    <div>
                      <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                        Work or Personal Email
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                          id="email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="block w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                          placeholder="name@company.com"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="group w-full flex justify-center items-center gap-2 px-6 py-4 bg-indigo-600 text-white text-base font-bold rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-100"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          Get Verification Code <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                    <p className="text-center text-xs text-slate-400 px-4 leading-relaxed">
                      By signing in, you agree to our Terms of Service and Privacy Policy.
                    </p>
                  </form>
                ) : (
                  <div className="space-y-4 animate-fadeIn">
                    <button
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      className="w-full flex justify-center items-center gap-4 px-6 py-4 border-2 border-slate-100 shadow-sm text-base font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-95"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                      ) : (
                        <>
                          <svg className="h-6 w-6" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                            <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                              <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                              <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.059 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                              <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                              <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.799 L -6.734 42.379 C -8.804 40.439 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                            </g>
                          </svg>
                          Continue with Google
                        </>
                      )}
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-4 leading-relaxed">
                      Google OAuth requires authorized domains to be configured in your Cloud Console.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8 animate-fadeIn">
                <button 
                  onClick={() => setStep('email')}
                  className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700 font-bold transition-colors group"
                >
                  <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" /> Back
                </button>
                
                <div className="text-center">
                  <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <KeyRound className="w-10 h-10 text-indigo-600" />
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900">Verify your Email</h3>
                  <p className="text-slate-500 text-sm mt-2 max-w-[240px] mx-auto">
                    Enter the 6-digit code sent to <span className="text-slate-900 font-bold underline decoration-indigo-200">{email}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div className="relative">
                    <input
                      type="text"
                      required
                      autoFocus
                      maxLength={6}
                      pattern="\d{6}"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="block w-full px-4 py-5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-4xl font-black text-slate-900 tracking-[0.4em] placeholder-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all shadow-sm"
                      placeholder="••••••"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || otp.length < 6}
                    className="w-full flex justify-center items-center gap-3 px-6 py-4 bg-indigo-600 text-white text-base font-bold rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-100"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      "Sign In"
                    )}
                  </button>
                  
                  <div className="text-center space-y-4">
                    <p className="text-xs text-slate-500">
                      Didn't get a code? {resendTimer > 0 ? (
                        <span className="font-bold text-slate-400">Resend in {resendTimer}s</span>
                      ) : (
                        <button type="button" onClick={() => handleSendOtp()} className="text-indigo-600 hover:underline font-bold transition-all">Resend Code</button>
                      )}
                    </p>
                    <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
                      <p className="text-[10px] text-slate-400 font-medium">
                        💡 <strong>Check your Spam or Junk folder</strong> if the code doesn't arrive in 1 minute. Ensure you've enabled the "OTP" template in Supabase.
                      </p>
                    </div>
                  </div>
                </form>
              </div>
            )}

            <div className="mt-auto pt-10 grid grid-cols-1 gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium bg-slate-50/50 p-2 rounded-lg">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>10 Invoices Free Trial</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium bg-slate-50/50 p-2 rounded-lg">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <span>Encrypted Data Storage</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;