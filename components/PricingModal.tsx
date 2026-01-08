
import React, { useState } from 'react';
import { PRICING_PACKAGES } from '../services/userService';
import { stripeService } from '../services/stripeService';
import { UserProfile } from '../types';
import { X, Check, CreditCard, Lock, Sparkles, ShieldCheck, AlertCircle } from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSuccess: (updatedUser: UserProfile) => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, user, onSuccess }) => {
  const [loadingPkg, setLoadingPkg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubscribe = async (pkgId: string) => {
    setLoadingPkg(pkgId);
    setError(null);
    try {
        await stripeService.redirectToCheckout(user, pkgId);
        // Browser will redirect to Stripe, so no need to close
    } catch (err: any) {
        console.error("Payment redirect error:", err);
        setError(err.message || "Unable to reach payment gateway. Please check your internet or try again later.");
    } finally {
        setLoadingPkg(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        
        <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" 
            aria-hidden="true"
            onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-middle bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:max-w-5xl w-full border border-slate-100">
            <div className="relative p-6 sm:p-10">
                 <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-all">
                    <X className="w-6 h-6" />
                </button>

                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center px-4 py-1.5 bg-indigo-50 rounded-full mb-4">
                        <Sparkles className="w-4 h-4 text-indigo-600 mr-2" />
                        <span className="text-indigo-700 font-bold text-xs uppercase tracking-wider">Upgrade Today</span>
                    </div>
                    <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Simple Pricing, No Hidden Fees</h2>
                    <p className="mt-3 text-lg text-slate-500 max-w-2xl mx-auto">Track your expenses like a pro with AI-powered data extraction and advanced analytics.</p>
                </div>

                {error && (
                  <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 animate-shake">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {PRICING_PACKAGES.map((pkg) => (
                        <div 
                            key={pkg.id} 
                            className={`relative rounded-3xl border p-8 flex flex-col transition-all duration-300
                                ${pkg.popular 
                                    ? 'border-indigo-500 shadow-2xl shadow-indigo-100 ring-1 ring-indigo-500 scale-105 z-10 bg-white' 
                                    : 'border-slate-200 shadow-sm hover:border-indigo-200 bg-slate-50/30'
                                }`}
                        >
                            {pkg.popular && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase tracking-[0.1em] shadow-lg">
                                    Most Popular
                                </div>
                            )}
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-slate-900">{pkg.name}</h3>
                                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{pkg.description}</p>
                            </div>
                            <div className="mb-8 flex items-baseline">
                                <span className="text-sm font-bold text-slate-400 mr-1.5">RM</span>
                                <span className="text-5xl font-black text-slate-900 tracking-tight">{pkg.price.toFixed(0)}</span>
                                <span className="text-slate-400 font-medium ml-1.5">/month</span>
                            </div>
                            
                            <div className="space-y-4 mb-10 flex-1">
                                {pkg.features.map((feat, idx) => (
                                    <div key={idx} className="flex items-start text-sm text-slate-600">
                                        <div className="bg-emerald-100 rounded-full p-0.5 mr-3 mt-0.5 shrink-0">
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        </div>
                                        <span className="font-medium">{feat}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => handleSubscribe(pkg.id)}
                                disabled={loadingPkg !== null}
                                className={`w-full py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center transition-all active:scale-95
                                    ${pkg.popular 
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100' 
                                        : 'bg-white text-indigo-600 hover:bg-indigo-50 border-2 border-indigo-100'
                                    }
                                    ${loadingPkg === pkg.id ? 'opacity-70 cursor-wait' : ''}
                                `}
                            >
                                {loadingPkg === pkg.id ? (
                                    <div className="flex items-center gap-2">
                                        <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Connecting...</span>
                                    </div>
                                ) : (
                                    "Upgrade Now"
                                )}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-center text-xs text-slate-400 gap-6">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-500" />
                        Secure Checkout with Stripe
                    </div>
                    <div className="hidden md:block w-px h-4 bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-slate-400" />
                        256-bit SSL Encryption
                    </div>
                    <div className="hidden md:block w-px h-4 bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-slate-400" />
                        FPX, Visa, Mastercard, AMEX
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
